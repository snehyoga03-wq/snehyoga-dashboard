
import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { LogOut, Search, Edit2, Save, X, Download, Eye, FileText, MessageCircle, Send, Paperclip, Upload, Users, Link2, BarChart3, ClipboardList, Activity, Calendar } from "lucide-react";
import { read, utils, writeFile } from "xlsx";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { motion, AnimatePresence } from "framer-motion";
import { Sidebar } from "./crm/Sidebar";
import { UserDetail } from "./crm/UserDetail";
import { formatPhone } from "@/lib/utils";

// Helper functions for formatting records
const formatPhoneNumber = (phone: string) => {
  if (!phone) return "";
  const cleaned = String(phone).replace(/\D/g, ''); // keep only digits
  if (cleaned.length === 10) {
    return `91${cleaned}`;
  }
  return cleaned;
};

const getParamsForUser = (user: any, templateVarsStr: string) => {
  if (!templateVarsStr) return [];
  if (!templateVarsStr.trim()) return [];
  return templateVarsStr.split(',').map(s => {
    const key = s.trim();
    if (key === 'name') return user.name || '';
    if (key === 'mobile_number' || key === 'phone') return user.mobile_number || user.phone || '';
    if (key === 'days_left') return String(user.days_left || 0);
    if (key === 'batch_timing') return user.batch_timing || '';
    return key; // literal string
  });
};

// Interfaces
interface UserRecord {
  id: string;
  name: string;
  mobile_number: string;
  referral_link?: string;
  created_at: string;
  days_left?: number;
  subscription_plan?: string;
  subscription_paused?: boolean;
  batch_timing?: string;
  last_payment_id?: string;
  last_order_id?: string;
}

interface FollowupReport {
  id: string;
  user_phone: string;
  user_name: string;
  admission_date: string;
  starting_weight: number;
  weight_loss_goal: number;
  image_url: string;
  created_at: string;
  updated_at: string;
}

interface DailyEntry {
  id: string;
  report_id: string;
  day_number: number;
  entry_date: string;
  morning_meal: string;
  evening_meal: string;
  outside_food: boolean;
  snacking_between_meals: boolean;
  yoga_class_attended: boolean;
  weight_before_sleep: number;
  weight_after_yoga: number;
}

interface ChatConversation {
  user_phone: string;
  user_name: string;
  latest_message: string;
  latest_time: string;
  unread_count: number;
}

interface ChatMessage {
  id: string;
  user_phone: string;
  user_name: string;
  message: string;
  sender_type: 'user' | 'admin';
  created_at: string;
  is_read: boolean;
  attachment_url?: string;
  attachment_type?: string;
}

type Section = 'users' | 'session-links' | 'analytics' | 'followup' | 'chats' | 'dashboard' | 'message-queue';

const CRM = () => {
  const navigate = useNavigate();
  const { toast } = useToast();

  // Auth
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");

  // Layout & Navigation
  const [currentSection, setCurrentSection] = useState<Section>('dashboard');
  const [sidebarOpen, setSidebarOpen] = useState(true); // Default open on desktop
  const [selectedUser, setSelectedUser] = useState<UserRecord | null>(null); // For detail view

  // Users Data
  const [users, setUsers] = useState<UserRecord[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterDays7, setFilterDays7] = useState(false);
  const [filterPlan, setFilterPlan] = useState<string>("all");
  const getDisplayPlan = (u: UserRecord) => {
    if (u.subscription_plan) return u.subscription_plan;
    if ((u.days_left || 0) <= 7) return "Free plan";
    return "1 month plan";
  };

  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDaysLeft, setEditDaysLeft] = useState(0);
  const [editingPlanId, setEditingPlanId] = useState<string | null>(null);
  const [editPlanValue, setEditPlanValue] = useState('basic');

  // Add User specific state
  const [showAddUserDialog, setShowAddUserDialog] = useState(false);
  const [showBulkUploadDialog, setShowBulkUploadDialog] = useState(false);
  const [showBulkPreviewDialog, setShowBulkPreviewDialog] = useState(false);
  const [bulkPreviewUsers, setBulkPreviewUsers] = useState<any[]>([]);
  const [isUploadingBulk, setIsUploadingBulk] = useState(false);
  const [newUserName, setNewUserName] = useState("");
  const [newUserNumber, setNewUserNumber] = useState("");
  const [newUserPlan, setNewUserPlan] = useState("1 month plan");
  const [newUserJoinDate, setNewUserJoinDate] = useState(new Date().toISOString().split('T')[0]);
  const [isAddingUser, setIsAddingUser] = useState(false);

  // Session links
  const [sessionLink, setSessionLink] = useState("");
  const [newLink, setNewLink] = useState("");
  const [premiumSessionLink, setPremiumSessionLink] = useState("");
  const [newPremiumLink, setNewPremiumLink] = useState("");
  const [editingLink, setEditingLink] = useState(false);

  // Analytics
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [clickStats, setClickStats] = useState<any[]>([]);

  // Follow-up reports
  const [followupReports, setFollowupReports] = useState<FollowupReport[]>([]);
  const [followupSearch, setFollowupSearch] = useState("");
  const [selectedReport, setSelectedReport] = useState<FollowupReport | null>(null);
  const [reportEntries, setReportEntries] = useState<DailyEntry[]>([]);
  const [showReportDialog, setShowReportDialog] = useState(false);

  // Chat
  const [chatConversations, setChatConversations] = useState<ChatConversation[]>([]);
  const [chatSearch, setChatSearch] = useState("");
  const [selectedChatUser, setSelectedChatUser] = useState<string | null>(null);
  const [selectedChatMessages, setSelectedChatMessages] = useState<ChatMessage[]>([]);
  const [showChatDialog, setShowChatDialog] = useState(false);
  const [adminReply, setAdminReply] = useState("");
  const [isUserTyping, setIsUserTyping] = useState(false);
  const [typingChannel, setTypingChannel] = useState<any>(null);
  const [typingTimeout, setTypingTimeoutState] = useState<NodeJS.Timeout | null>(null);
  const [isUploadingAttachment, setIsUploadingAttachment] = useState(false);
  const adminFileInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Reminders & Pabbly
  const [pabblyUrl, setPabblyUrl] = useState("");
  const [selectedBatchTime, setSelectedBatchTime] = useState("1 PM");
  const [isTriggering, setIsTriggering] = useState(false);
  const [reminderLogs, setReminderLogs] = useState<any[]>([]);
  const [logsLoading, setLogsLoading] = useState(false);

  // Template settings
  const [templateId, setTemplateId] = useState("");
  const [templateName, setTemplateName] = useState("");
  const [templateCategory, setTemplateCategory] = useState("");
  const [templateStatus, setTemplateStatus] = useState("");
  const [templateBody, setTemplateBody] = useState("");
  const [templateVariables, setTemplateVariables] = useState("");
  const [pabblyToken, setPabblyToken] = useState("");
  const [fetchedTemplates, setFetchedTemplates] = useState<{id: string, name: string, category: string, status: string, body: string}[]>([]);
  const [isFetchingTemplates, setIsFetchingTemplates] = useState(false);
  
  // Target Audience settings
  const [targetAudience, setTargetAudience] = useState("batch"); // batch, all, active, inactive, custom
  const [customUsers, setCustomUsers] = useState<{name: string, phone: string}[]>([]);
  const [customUserName, setCustomUserName] = useState("");
  const [customUserPhone, setCustomUserPhone] = useState("");

  // Constants
  const BATCH_TIMINGS = ["5 AM", "6 AM", "7:30 AM", "5 PM", "6 PM", "9:00 PM"];

  type Section = 'users' | 'session-links' | 'analytics' | 'followup' | 'chats' | 'dashboard' | 'reminders' | 'message-queue';

  // Message Queue (Pub/Sub)
  const [messageBatches, setMessageBatches] = useState<any[]>([]);
  const [queueStats, setQueueStats] = useState({ pending: 0, processing: 0, delivered: 0, failed: 0, dead_letter: 0 });
  const [isLoadingQueue, setIsLoadingQueue] = useState(false);
  const [selectedBatchMessages, setSelectedBatchMessages] = useState<any[]>([]);
  const [showBatchDetailDialog, setShowBatchDetailDialog] = useState(false);
  const [selectedBatchDetail, setSelectedBatchDetail] = useState<any>(null);
  useEffect(() => {
    const isAuth = sessionStorage.getItem("crm_admin_auth") === "true";
    if (isAuth) {
      setIsAuthenticated(true);
      fetchUsers();
      fetchFollowupReports();
      fetchChatConversations();
      fetchSessionLink();
    }
  }, []);

  // Fetch reminder logs when entering reminders section
  useEffect(() => {
    if (currentSection === 'reminders' && isAuthenticated) {
      const fetchLogs = async () => {
        setLogsLoading(true);
        try {
          const { data } = await supabase
            .from('reminder_logs')
            .select('*')
            .order('created_at', { ascending: false })
            .limit(50);
          setReminderLogs(data || []);
        } catch (e) {
          console.error('Error fetching reminder logs:', e);
        } finally {
          setLogsLoading(false);
        }
      };
      fetchLogs();
    }
  }, [currentSection, isAuthenticated]);

  // Fetch message queue data when entering message-queue section
  useEffect(() => {
    if (currentSection === 'message-queue' && isAuthenticated) {
      fetchMessageQueue();
      fetchQueueStats();
      // Auto-refresh every 10 seconds
      const interval = setInterval(() => {
        fetchMessageQueue();
        fetchQueueStats();
      }, 10000);
      return () => clearInterval(interval);
    }
  }, [currentSection, isAuthenticated]);

  const fetchMessageQueue = async () => {
    setIsLoadingQueue(true);
    try {
      const { data } = await supabase
        .from('message_batches')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(20);
      setMessageBatches(data || []);
    } catch (e) {
      console.error('Error fetching message batches:', e);
    } finally {
      setIsLoadingQueue(false);
    }
  };

  const fetchQueueStats = async () => {
    try {
      const statuses = ['pending', 'processing', 'delivered', 'failed', 'dead_letter'];
      const counts: any = {};
      for (const status of statuses) {
        const { count } = await supabase
          .from('message_queue')
          .select('*', { count: 'exact', head: true })
          .eq('status', status);
        counts[status] = count || 0;
      }
      setQueueStats(counts);
    } catch (e) {
      console.error('Error fetching queue stats:', e);
    }
  };

  const viewBatchDetails = async (batch: any) => {
    setSelectedBatchDetail(batch);
    try {
      const { data } = await supabase
        .from('message_queue')
        .select('*')
        .eq('batch_id', batch.id)
        .order('created_at', { ascending: true });
      setSelectedBatchMessages(data || []);
      setShowBatchDetailDialog(true);
    } catch (e) {
      console.error('Error fetching batch messages:', e);
    }
  };

  const retryFailedMessages = async (batchId: string) => {
    try {
      const { error } = await supabase
        .from('message_queue')
        .update({
          status: 'pending',
          next_retry_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('batch_id', batchId)
        .in('status', ['failed', 'dead_letter']);

      if (error) throw error;

      // Reset batch status
      await supabase
        .from('message_batches')
        .update({ status: 'queued', completed_at: null })
        .eq('id', batchId);

      toast({ title: "Retry Queued", description: "Failed messages have been re-queued for processing." });
      fetchMessageQueue();
      fetchQueueStats();
    } catch (e) {
      toast({ title: "Error", description: "Failed to retry messages", variant: "destructive" });
    }
  };

  const triggerQueueProcessing = async () => {
    try {
      const { data, error } = await supabase.functions.invoke('process-message-queue', {
        body: {},
      });
      if (error) throw error;
      toast({ title: "Queue Processing Triggered", description: `Processed: ${data?.processed || 0}, Delivered: ${data?.delivered || 0}, Failed: ${data?.failed || 0}` });
      fetchMessageQueue();
      fetchQueueStats();
    } catch (e) {
      toast({ title: "Error", description: "Failed to trigger queue processing", variant: "destructive" });
    }
  };

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (username === "YOG" && password === "ABC@yog123") {
      sessionStorage.setItem("crm_admin_auth", "true");
      setIsAuthenticated(true);
      fetchUsers();
      fetchFollowupReports();
      fetchChatConversations();
      fetchSessionLink();
      toast({ title: "Login Successful", description: "Welcome to CRM Dashboard" });
    } else {
      toast({ title: "Invalid Credentials", description: "Please try again", variant: "destructive" });
    }
  };

  const handleLogout = () => {
    sessionStorage.removeItem("crm_admin_auth");
    setIsAuthenticated(false);
    toast({ title: "Logged Out", description: "See you soon!" });
  };

  // --- Data Fetching & Actions ---

  const fetchUsers = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from("main_data_registration")
        .select("id, name, mobile_number, referral_link, created_at, days_left, subscription_plan, subscription_paused, batch_timing, last_payment_id, last_order_id")
        .order("created_at", { ascending: false });

      if (error) throw error;
      console.log("Fetched users debug:", data);
      setUsers(data || []);
    } catch (error) {
      console.error("Fetch error:", error);
      toast({ title: "Error", description: "Failed to fetch users", variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddUser = async () => {
    if (!newUserName || !newUserNumber) {
      toast({ title: "Error", description: "Name and number are required", variant: "destructive" });
      return;
    }
    setIsAddingUser(true);
    try {
      const normalizedPhone = formatPhone(newUserNumber);
      
      const cleanName = newUserName.toLowerCase().replace(/\s+/g, '');
      const randomNumber = Math.floor(Math.random() * 100).toString().padStart(2, '0');
      const referralCode = `sneh${cleanName}${randomNumber}`;
      const referralLink = `${window.location.origin}/?ref=${referralCode}`;

      const getDaysForPlan = (plan: string) => {
        switch (plan) {
          case "Free plan": return 1;
          case "1 month plan": return 30;
          case "3 month plan": return 90;
          case "6 months plan": return 180;
          case "12 months plan": return 365;
          default: return 30;
        }
      };

      const { error } = await supabase.from('main_data_registration').insert({
        name: newUserName,
        mobile_number: normalizedPhone,
        subscription_plan: newUserPlan,
        created_at: new Date(newUserJoinDate).toISOString(),
        days_left: getDaysForPlan(newUserPlan),
        subscription_paused: false,
        batch_timing: "Unassigned",
        referral_link: referralLink
      });
      if (error) throw error;
      
      toast({ title: "Success", description: "User added successfully" });
      setShowAddUserDialog(false);
      setNewUserName("");
      setNewUserNumber("");
      setNewUserPlan("1 month plan");
      setNewUserJoinDate(new Date().toISOString().split('T')[0]);
      fetchUsers();
    } catch (error: any) {
      toast({ title: "Error", description: error.message || "Failed to add user", variant: "destructive" });
    } finally {
      setIsAddingUser(false);
    }
  };

  const handleDownloadSample = () => {
    const ws = utils.json_to_sheet([
      { name: "John Doe", mobile_number: "9876543210", subscription_plan: "1 month plan", days_left: 30, batch_timing: "6 AM" },
      { name: "Jane Doe", mobile_number: "9123456780", subscription_plan: "3 month plan", days_left: 90, batch_timing: "7:30 AM" }
    ]);
    const wb = utils.book_new();
    utils.book_append_sheet(wb, ws, "Sample Users");
    writeFile(wb, "bulk_upload_sample.xlsx");
  };

  const handleExportUsers = () => {
    const exportData = users.map(u => ({
      name: u.name,
      mobile_number: u.mobile_number,
      subscription_plan: u.subscription_plan || 'N/A',
      days_left: u.days_left || 0,
      subscription_status: u.subscription_paused ? 'Paused' : 'Active',
      batch_timing: u.batch_timing || 'Unassigned',
      joined_date: new Date(u.created_at).toLocaleDateString(),
      referral_link: u.referral_link || ''
    }));

    const ws = utils.json_to_sheet(exportData);
    const wb = utils.book_new();
    utils.book_append_sheet(wb, ws, "Users Data");
    writeFile(wb, "users_export.xlsx");
    toast({ title: "Export Started", description: "Your data is downloading." });
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      const bstr = evt.target?.result;
      const wb = read(bstr, { type: 'binary' });
      const wsname = wb.SheetNames[0];
      const ws = wb.Sheets[wsname];
      const data = utils.sheet_to_json(ws);
      
      const formattedData = data.map((row: any) => ({
        ...row,
        mobile_number: formatPhone(String(row.mobile_number || row.phone || '')),
        days_left: Number(row.days_left || 30)
      }));

      setBulkPreviewUsers(formattedData);
      setShowBulkUploadDialog(false);
      setShowBulkPreviewDialog(true);
    };
    reader.readAsBinaryString(file);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleConfirmBulkUpload = async () => {
    setIsUploadingBulk(true);
    try {
      const usersToInsert = bulkPreviewUsers.map(u => {
        const userName = String(u.name || "Unknown");
        const cleanName = userName.toLowerCase().replace(/\s+/g, '');
        const randomNumber = Math.floor(Math.random() * 100).toString().padStart(2, '0');
        const referralCode = `sneh${cleanName}${randomNumber}`;
        const referralLink = `${window.location.origin}/?ref=${referralCode}`;

        return {
          name: userName,
          mobile_number: String(u.mobile_number || ""),
          subscription_plan: String(u.subscription_plan || '1 month plan'),
          days_left: Number(u.days_left || 30),
          batch_timing: String(u.batch_timing || 'Unassigned'),
          created_at: new Date().toISOString(),
          subscription_paused: false,
          referral_link: referralLink
        };
      });

      // Filter out invalid users
      const validUsers = usersToInsert.filter(u => u.name && u.mobile_number);

      if (validUsers.length === 0) {
        toast({ title: "Error", description: "No valid users found in the file.", variant: "destructive" });
        return;
      }

      const { error } = await supabase.from('main_data_registration').insert(validUsers);
      if (error) throw error;

      toast({ title: "Upload Successful ✅", description: `Successfully created ${validUsers.length} users!` });
      setShowBulkPreviewDialog(false);
      setBulkPreviewUsers([]);
      fetchUsers();
    } catch (error: any) {
      toast({ title: "Upload Error", description: error.message || "Failed to upload users", variant: "destructive" });
    } finally {
      setIsUploadingBulk(false);
    }
  };

  const startEditing = (u: UserRecord) => {
    setEditingId(u.id);
    setEditDaysLeft(u.days_left || 0);
  };

  const saveDaysLeft = async (id: string) => {
    try {
      const { error } = await supabase.from("main_data_registration").update({ days_left: editDaysLeft }).eq("id", id);
      if (error) throw error;

      setUsers((prev) => prev.map((u) => (u.id === id ? { ...u, days_left: editDaysLeft } : u)));
      setEditingId(null);
      toast({ title: "Updated", description: "Days left updated successfully" });
    } catch (error) {
      toast({ title: "Error", description: "Failed to update days", variant: "destructive" });
    }
  };

  const toggleSubscriptionPause = async (id: string, paused: boolean) => {
    try {
      const { error } = await supabase.from("main_data_registration").update({ subscription_paused: paused }).eq("id", id);
      if (error) throw error;

      setUsers((prev) => prev.map((u) => (u.id === id ? { ...u, subscription_paused: paused } : u)));
      toast({ title: paused ? "Paused" : "Resumed", description: `Subscription ${paused ? 'paused' : 'resumed'}` });
    } catch (error) {
      toast({ title: "Error", description: "Failed to update status", variant: "destructive" });
    }
  };

  const saveSubscriptionPlan = async (id: string) => {
    try {
      const { error } = await supabase.from("main_data_registration").update({ subscription_plan: editPlanValue }).eq("id", id);
      if (error) throw error;

      setUsers((prev) => prev.map((u) => (u.id === id ? { ...u, subscription_plan: editPlanValue } : u)));
      setEditingPlanId(null);
      toast({ title: "Updated", description: "Plan updated successfully" });
    } catch (error) {
      toast({ title: "Error", description: "Failed to update plan", variant: "destructive" });
    }
  };

  const fetchSessionLink = async () => {
    try {
      const { data, error } = await supabase
        .from('session_settings')
        .select('session_link, premium_session_link, pabbly_reminder_url')
        .maybeSingle();

      if (error) {
        console.error('Error fetching session settings:', error);
        return;
      }

      if (data) {
        setSessionLink(data.session_link || "");
        setNewLink(data.session_link || "");
        setPremiumSessionLink(data.premium_session_link || "");
        setNewPremiumLink(data.premium_session_link || "");
        setPabblyUrl(data.pabbly_reminder_url || "");
      }
    } catch (error) {
      console.error('Error fetching session link:', error);
    }
  };

  const updateSessionLink = async () => {
    try {
      // Check if a row exists
      const { data: existingData, error: fetchError } = await supabase
        .from('session_settings')
        .select('id')
        .maybeSingle();

      if (fetchError) throw fetchError;

      if (!existingData) {
        // Create new row
        const { error: insertError } = await supabase
          .from('session_settings')
          .insert({
            session_link: newLink,
            premium_session_link: newPremiumLink,
            updated_by: username,
            updated_at: new Date().toISOString()
          });
        if (insertError) throw insertError;
      } else {
        // Update existing row
        const { error: updateError } = await supabase
          .from('session_settings')
          .update({
            session_link: newLink,
            premium_session_link: newPremiumLink,
            updated_at: new Date().toISOString(),
            updated_by: username
          })
          .eq('id', existingData.id);
        if (updateError) throw updateError;
      }

      setSessionLink(newLink);
      setPremiumSessionLink(newPremiumLink);
      setEditingLink(false);
      toast({ title: "Links Updated! ✅", description: "Your class session link is now live." });
    } catch (error: any) {
      console.error('Update error:', error);
      toast({ title: "Error", description: error.message || "Failed to update links", variant: "destructive" });
    }
  };

  const fetchClickStats = async (date: string) => {
    try {
      const { data } = await supabase.from('link_clicks').select('*').eq('clicked_date', date).order('clicked_at', { ascending: false });
      setClickStats(data || []);
    } catch (error) {
      console.error('Error fetching click stats:', error);
    }
  };

  const getDailySummary = () => {
    const total = clickStats.length;
    const liveClicks = clickStats.filter(c => c.click_type === 'live_session').length;
    const recordingClicks = clickStats.filter(c => c.click_type === 'recording').length;
    const uniqueUsers = new Set(clickStats.map(c => c.user_phone)).size;
    return { total, liveClicks, recordingClicks, uniqueUsers };
  };

  const fetchFollowupReports = async () => {
    try {
      const { data } = await supabase.from('followup_reports').select('*').order('created_at', { ascending: false });
      setFollowupReports(data || []);
    } catch (error) {
      console.error('Error fetching followup reports:', error);
    }
  };

  const fetchChatConversations = async () => {
    try {
      const { data, error } = await supabase.from('chat_messages').select('*').order('created_at', { ascending: false });
      if (error) throw error;

      const grouped = (data || []).reduce((acc: any, msg: any) => {
        if (!acc[msg.user_phone]) {
          acc[msg.user_phone] = {
            user_phone: msg.user_phone,
            user_name: msg.user_name,
            latest_message: msg.message,
            latest_time: msg.created_at,
            unread_count: msg.sender_type === 'user' && !msg.is_read ? 1 : 0
          };
        } else {
          if (msg.sender_type === 'user' && !msg.is_read) {
            acc[msg.user_phone].unread_count++;
          }
        }
        return acc;
      }, {});

      setChatConversations(Object.values(grouped));
    } catch (error) {
      console.error('Error fetching chat conversations:', error);
    }
  };

  // View report details
  const viewReport = async (report: FollowupReport) => {
    setSelectedReport(report);
    try {
      const { data } = await supabase.from('followup_daily_entries').select('*').eq('report_id', report.id).order('day_number', { ascending: true });
      setReportEntries(data || []);
      setShowReportDialog(true);
    } catch (error) {
      console.error("Error", error);
    }
  };


  // --- Filtered Data ---
  const filteredUsers = users.filter((u) => {
    const matchesSearch = u.name.toLowerCase().includes(searchTerm.toLowerCase()) || u.mobile_number.includes(searchTerm);
    const matchesDaysFilter = filterDays7 ? (u.days_left || 0) <= 7 : true;
    const normalizePlanStr = (p: string) => (p || 'Free plan').toLowerCase().replace(/ plans?/g, '').replace(/months?/g, 'month').trim();
    const matchesPlan = filterPlan === "all" ? true : normalizePlanStr(getDisplayPlan(u)) === normalizePlanStr(filterPlan);

    // Date range filter on created_at
    let matchesDateRange = true;
    if (dateFrom) {
      matchesDateRange = matchesDateRange && new Date(u.created_at) >= new Date(dateFrom);
    }
    if (dateTo) {
      // Include the entire "to" day by comparing against end-of-day
      const toEnd = new Date(dateTo);
      toEnd.setHours(23, 59, 59, 999);
      matchesDateRange = matchesDateRange && new Date(u.created_at) <= toEnd;
    }

    return matchesSearch && matchesDaysFilter && matchesPlan && matchesDateRange;
  });

  // --- Render ---

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="w-full max-w-md bg-white rounded-xl shadow-2xl p-8"
        >
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold text-gray-900">Sign In</h1>
            <p className="text-gray-500 mt-2">Access the CRM Dashboard</p>
          </div>
          <form onSubmit={handleLogin} className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700">Username</label>
              <Input
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="h-11 bg-gray-50 border-gray-200 focus:ring-2 focus:ring-blue-500 transition-all"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700">Password</label>
              <Input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="h-11 bg-gray-50 border-gray-200 focus:ring-2 focus:ring-blue-500 transition-all"
              />
            </div>
            <Button type="submit" className="w-full h-11 bg-blue-600 hover:bg-blue-700 text-white font-medium text-lg shadow-lg shadow-blue-900/20">
              Login
            </Button>
          </form>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex overflow-hidden">
      {/* Sidebar */}
      <Sidebar
        isOpen={sidebarOpen}
        setIsOpen={setSidebarOpen}
        currentSection={currentSection}
        setCurrentSection={(section) => {
          setCurrentSection(section);
          setSelectedUser(null); // Reset detail view when switching sections
        }}
        onLogout={handleLogout}
      />

      {/* Main Content Area */}
      <motion.div
        layout
        className={`flex-1 flex flex-col h-full bg-gray-50 overflow-hidden transition-all duration-300 ${sidebarOpen ? 'ml-[260px]' : 'ml-[80px]'}`}
      >
        <main className="flex-1 overflow-y-auto p-6 md:p-8">
          <AnimatePresence mode="wait">

            {/* DASHBOARD OVERVIEW SECTION */}
            {currentSection === 'dashboard' && !selectedUser && (
              <motion.div
                key="dashboard-overview"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="space-y-6"
              >
                <div>
                  <h1 className="text-2xl font-bold text-gray-900">Dashboard Overview</h1>
                  <p className="text-gray-500">Welcome back! Here's what's happening today.</p>
                </div>

                {/* Key Metrics Row */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  <Card className="border-none shadow-sm bg-blue-50/50">
                    <CardContent className="p-6">
                      <div className="flex justify-between items-start">
                        <div>
                          <p className="text-sm font-medium text-blue-600">Active Members</p>
                          <h3 className="text-3xl font-bold text-gray-900 mt-2">
                            {users.filter(u => !u.subscription_paused && (u.days_left || 0) > 0).length}
                          </h3>
                        </div>
                        <div className="p-3 bg-blue-100 rounded-lg text-blue-600"><Users size={20} /></div>
                      </div>
                    </CardContent>
                  </Card>

                  <Card className="border-none shadow-sm bg-amber-50/50 cursor-pointer hover:bg-amber-50 transition-colors" onClick={() => { setCurrentSection('users'); setFilterDays7(true); setSearchTerm(""); }}>
                    <CardContent className="p-6">
                      <div className="flex justify-between items-start">
                        <div>
                          <p className="text-sm font-medium text-amber-600">Expiring Soon (≤7 Days)</p>
                          <h3 className="text-3xl font-bold text-gray-900 mt-2">
                            {users.filter(u => (u.days_left || 0) <= 7 && (u.days_left || 0) > 0 && !u.subscription_paused).length}
                          </h3>
                        </div>
                        <div className="p-3 bg-amber-100 rounded-lg text-amber-600"><Activity size={20} /></div>
                      </div>
                    </CardContent>
                  </Card>

                  <Card className="border-none shadow-sm bg-green-50/50">
                    <CardContent className="p-6">
                      <div className="flex justify-between items-start">
                        <div>
                          <p className="text-sm font-medium text-green-600">Active Chats</p>
                          <h3 className="text-3xl font-bold text-gray-900 mt-2">
                            {chatConversations.length}
                          </h3>
                        </div>
                        <div className="p-3 bg-green-100 rounded-lg text-green-600"><MessageCircle size={20} /></div>
                      </div>
                    </CardContent>
                  </Card>

                  <Card className="border-none shadow-sm bg-purple-50/50">
                    <CardContent className="p-6">
                      <div className="flex justify-between items-start">
                        <div>
                          <p className="text-sm font-medium text-purple-600">Total Users</p>
                          <h3 className="text-3xl font-bold text-gray-900 mt-2">
                            {users.length}
                          </h3>
                        </div>
                        <div className="p-3 bg-purple-100 rounded-lg text-purple-600"><ClipboardList size={20} /></div>
                      </div>
                    </CardContent>
                  </Card>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  {/* Left Column: Alerts & Recent Activity */}
                  <div className="col-span-1 lg:col-span-2 space-y-6">
                    {/* Expiring Subscriptions List */}
                    <Card className="border border-gray-100 shadow-sm">
                      <div className="p-4 border-b border-gray-100 flex justify-between items-center bg-gray-50/50 rounded-t-xl">
                        <h3 className="font-semibold text-gray-800 flex items-center gap-2">
                          <Activity className="w-4 h-4 text-amber-500" /> Action Required: Expiring Soon
                        </h3>
                        <Button variant="ghost" size="sm" onClick={() => { setCurrentSection('users'); setFilterDays7(true); }} className="text-blue-600 hover:text-blue-700 h-8">
                          View All
                        </Button>
                      </div>
                      <div className="p-0">
                        <Table>
                          <TableHeader>
                            <TableRow className="hover:bg-transparent">
                              <TableHead>User</TableHead>
                              <TableHead>Phone</TableHead>
                              <TableHead className="text-right">Days Left</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {users.filter(u => (u.days_left || 0) <= 7 && (u.days_left || 0) > 0 && !u.subscription_paused)
                              .slice(0, 5).map(user => (
                                <TableRow key={`exp-${user.id}`} className="cursor-pointer hover:bg-gray-50" onClick={() => { setCurrentSection('users'); setSelectedUser(user); }}>
                                  <TableCell className="font-medium text-gray-900">{user.name}</TableCell>
                                  <TableCell className="text-gray-500">{user.mobile_number}</TableCell>
                                  <TableCell className="text-right font-bold text-red-600">{user.days_left}</TableCell>
                                </TableRow>
                              ))}
                            {users.filter(u => (u.days_left || 0) <= 7 && (u.days_left || 0) > 0 && !u.subscription_paused).length === 0 && (
                              <TableRow>
                                <TableCell colSpan={3} className="text-center text-gray-500 py-6">No users expiring in the next 7 days. Excellent!</TableCell>
                              </TableRow>
                            )}
                          </TableBody>
                        </Table>
                      </div>
                    </Card>

                    {/* Quick Access to Follow-up Reports */}
                    <Card className="border border-gray-100 shadow-sm">
                      <div className="p-4 border-b border-gray-100 bg-gray-50/50 rounded-t-xl">
                        <h3 className="font-semibold text-gray-800 flex items-center gap-2">
                          <ClipboardList className="w-4 h-4 text-indigo-500" /> Recent Follow-up Leads
                        </h3>
                      </div>
                      <div className="p-3">
                        {followupReports.slice(0, 3).map(report => (
                          <div key={report.id} className="flex justify-between items-center p-3 hover:bg-gray-50 rounded-lg cursor-pointer border border-transparent hover:border-gray-100" onClick={() => { setCurrentSection('followup'); viewReport(report); }}>
                            <div className="flex flex-col">
                              <span className="font-semibold text-sm">{report.user_name}</span>
                              <span className="text-xs text-gray-500">Admitted: {new Date(report.admission_date).toLocaleDateString()}</span>
                            </div>
                            <div className="text-right">
                              <span className="text-xs font-medium text-indigo-600 bg-indigo-50 px-2 py-1 rounded-full">Goal: {report.weight_loss_goal}kg</span>
                            </div>
                          </div>
                        ))}
                        {followupReports.length === 0 && (
                          <p className="text-center text-gray-500 py-4 text-sm">No follow-up reports recorded yet.</p>
                        )}
                      </div>
                    </Card>

                    {/* Users by Plan (Plan Wise Users) */}
                    <Card className="border border-gray-100 shadow-sm">
                      <div className="p-4 border-b border-gray-100 bg-gray-50/50 rounded-t-xl">
                        <h3 className="font-semibold text-gray-800 flex items-center gap-2">
                          <BarChart3 className="w-4 h-4 text-green-500" /> Users by Plan
                        </h3>
                      </div>
                      <div className="p-5 space-y-4">
                        {(() => {
                          const planCounts = users.reduce((acc, user) => {
                            if (user.subscription_paused || (user.days_left || 0) <= 0) return acc; // Only count active
                            const plan = getDisplayPlan(user);
                            acc[plan] = (acc[plan] || 0) + 1;
                            return acc;
                          }, {} as Record<string, number>);

                          const activeTotal = users.filter(u => !u.subscription_paused && (u.days_left || 0) > 0).length;
                          const sortedPlans = Object.entries(planCounts).sort((a, b) => b[1] - a[1]);

                          if (sortedPlans.length === 0) {
                            return <p className="text-center text-gray-500 text-sm">No active users with assigned plans.</p>;
                          }

                          return sortedPlans.map(([plan, count]) => (
                            <div key={plan} className="space-y-1">
                              <div className="flex justify-between text-sm">
                                <span className="font-medium text-gray-700 capitalize">{plan}</span>
                                <span className="text-gray-500 font-medium">{count} users</span>
                              </div>
                              <div className="h-2 w-full bg-gray-100 rounded-full overflow-hidden">
                                <div
                                  className="h-full bg-green-500 rounded-full"
                                  style={{ width: `${Math.max((count / Math.max(activeTotal, 1)) * 100, 2)}%` }}
                                />
                              </div>
                            </div>
                          ));
                        })()}
                      </div>
                    </Card>
                  </div>

                  {/* Right Column: Quick Actions & Charts */}
                  <div className="space-y-6">
                    {/* Quick Actions */}
                    <Card className="border border-gray-100 shadow-sm">
                      <div className="p-4 border-b border-gray-100 bg-gray-50/50 rounded-t-xl">
                        <h3 className="font-semibold text-gray-800">Quick Actions</h3>
                      </div>
                      <div className="p-4 space-y-3">
                        <Button onClick={() => setCurrentSection('users')} className="w-full justify-start text-left bg-white text-gray-700 border hover:bg-gray-50 border-gray-200 shadow-sm" variant="outline">
                          <Users className="w-4 h-4 mr-3 text-blue-500" /> Manage All Users
                        </Button>
                        <Button onClick={() => setCurrentSection('session-links')} className="w-full justify-start text-left bg-white text-gray-700 border hover:bg-gray-50 border-gray-200 shadow-sm" variant="outline">
                          <Link2 className="w-4 h-4 mr-3 text-green-500" /> Update Session Links
                        </Button>
                        <Button onClick={() => setCurrentSection('chats')} className="w-full justify-start text-left bg-white text-gray-700 border hover:bg-gray-50 border-gray-200 shadow-sm" variant="outline">
                          <MessageCircle className="w-4 h-4 mr-3 text-purple-500" /> Open Chats
                          {chatConversations.some(c => c.unread_count > 0) && (
                            <span className="ml-auto bg-red-500 text-white text-xs font-bold px-2 py-0.5 rounded-full">New</span>
                          )}
                        </Button>
                        <Button onClick={() => setCurrentSection('reminders')} className="w-full justify-start text-left bg-blue-600 text-white hover:bg-blue-700 shadow-md border-0" variant="default">
                          <Calendar className="w-4 h-4 mr-3 text-white/80" /> Send Daily Reminders
                        </Button>
                      </div>
                    </Card>

                    {/* Basic Analytics Chart (Users by Batch) */}
                    <Card className="border border-gray-100 shadow-sm">
                      <div className="p-4 border-b border-gray-100 bg-gray-50/50 rounded-t-xl">
                        <h3 className="font-semibold text-gray-800">Users by Batch Timing</h3>
                      </div>
                      <div className="p-5 space-y-4">
                        {(() => {
                          const batchCounts = users.reduce((acc, user) => {
                            const bt = user.batch_timing || 'Unassigned';
                            if (user.subscription_paused || (user.days_left || 0) <= 0) return acc; // Only count active
                            acc[bt] = (acc[bt] || 0) + 1;
                            return acc;
                          }, {} as Record<string, number>);

                          const activeTotal = users.filter(u => !u.subscription_paused && (u.days_left || 0) > 0).length;

                          // Convert to array and sort by timing casually
                          const sortedBatches = Object.entries(batchCounts).sort((a, b) => b[1] - a[1]);

                          if (sortedBatches.length === 0) {
                            return <p className="text-center text-gray-500 text-sm">No active users assigned to batches.</p>;
                          }

                          return sortedBatches.map(([batch, count]) => (
                            <div key={batch} className="space-y-1">
                              <div className="flex justify-between text-sm">
                                <span className="font-medium text-gray-700">{batch}</span>
                                <span className="text-gray-500 font-medium">{count} users</span>
                              </div>
                              <div className="h-2 w-full bg-gray-100 rounded-full overflow-hidden">
                                <div
                                  className="h-full bg-blue-500 rounded-full"
                                  style={{ width: `${Math.max((count / Math.max(activeTotal, 1)) * 100, 2)}%` }} // min 2% so dot is visible
                                />
                              </div>
                            </div>
                          ));
                        })()}
                      </div>
                    </Card>
                  </div>
                </div>
              </motion.div>
            )}

            {/* USER MANAGEMENT SECTION */}
            {currentSection === 'users' && !selectedUser && (
              <motion.div
                key="users-list"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="space-y-6"
              >
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                  <div>
                    <h1 className="text-2xl font-bold text-gray-900">User Management</h1>
                    <p className="text-gray-500">Manage all registered users and subscriptions</p>
                  </div>
                  <div className="flex gap-2">
                    <Button onClick={handleExportUsers} variant="secondary" className="bg-white hover:bg-gray-100 border shadow-sm">
                      <Download className="w-4 h-4 mr-2 text-green-600" /> Export
                    </Button>
                    <Button onClick={() => setShowBulkUploadDialog(true)} variant="secondary" className="bg-white hover:bg-gray-100 border shadow-sm">
                      <Upload className="w-4 h-4 mr-2" /> Bulk Upload
                    </Button>
                    <input type="file" ref={fileInputRef} className="hidden" accept=".xlsx, .xls" onChange={handleFileUpload} />
                    <Button onClick={() => setShowAddUserDialog(true)} className="bg-blue-600 hover:bg-blue-700 shadow-md shadow-blue-900/20">
                      <Users className="w-4 h-4 mr-2" /> Add User
                    </Button>
                  </div>
                </div>

                {/* Filters and Search */}
                <Card className="border-none shadow-sm bg-white">
                  <CardContent className="p-4 flex flex-col gap-4">
                    {/* Row 1: Search + Expiring Soon */}
                    <div className="flex flex-col md:flex-row gap-4 items-center">
                      <div className="relative flex-1 w-full">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                        <Input
                          placeholder="Search users by name or mobile..."
                          className="pl-10 h-10 bg-gray-50 border-none focus:ring-1 focus:ring-blue-500"
                          value={searchTerm}
                          onChange={(e) => setSearchTerm(e.target.value)}
                        />
                      </div>
                      <div className="w-full md:w-32 flex-shrink-0">
                        <select
                          className="flex h-10 w-full rounded-md border border-gray-200 bg-white px-3 py-2 text-sm focus-visible:outline-none focus:ring-1 focus:ring-blue-500"
                          value={filterPlan}
                          onChange={(e) => setFilterPlan(e.target.value)}
                        >
                          <option value="all">All Plans</option>
                          <option value="Free plan">Free plan</option>
                          <option value="1 month plan">1 month plan</option>
                          <option value="3 month plan">3 month plan</option>
                          <option value="6 months plan">6 months plan</option>
                          <option value="12 months plan">12 months plan</option>
                        </select>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          variant={filterDays7 ? "default" : "outline"}
                          onClick={() => setFilterDays7(!filterDays7)}
                          className={filterDays7 ? "bg-red-100 text-red-700 hover:bg-red-200 border-red-200" : ""}
                        >
                          Expiring Soon (≤7 Days)
                        </Button>
                      </div>
                    </div>

                    {/* Row 2: Date Range Filter */}
                    <div className="flex flex-col md:flex-row gap-3 items-center">
                      <div className="flex items-center gap-2 text-sm font-medium text-gray-600">
                        <Calendar className="h-4 w-4 text-blue-500" />
                        <span>Date Filter:</span>
                      </div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <Input
                          type="date"
                          value={dateFrom}
                          onChange={(e) => setDateFrom(e.target.value)}
                          className="h-9 w-[160px] bg-gray-50 border-gray-200 text-sm"
                          placeholder="From"
                        />
                        <span className="text-gray-400 text-sm">to</span>
                        <Input
                          type="date"
                          value={dateTo}
                          onChange={(e) => setDateTo(e.target.value)}
                          className="h-9 w-[160px] bg-gray-50 border-gray-200 text-sm"
                          placeholder="To"
                        />
                        {(dateFrom || dateTo) && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => { setDateFrom(""); setDateTo(""); }}
                            className="text-gray-500 hover:text-red-600 h-8 px-2"
                          >
                            <X className="h-4 w-4 mr-1" /> Clear
                          </Button>
                        )}
                      </div>
                      {(dateFrom || dateTo) && (
                        <span className="text-xs text-blue-600 bg-blue-50 px-2 py-1 rounded-full ml-auto">
                          {filteredUsers.length} user{filteredUsers.length !== 1 ? 's' : ''} found
                        </span>
                      )}
                    </div>
                  </CardContent>
                </Card>

                {/* Users Table */}
                <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
                  <Table>
                    <TableHeader className="bg-gray-50/50">
                      <TableRow>
                        <TableHead className="w-[200px]">User</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Plan</TableHead>
                        <TableHead>Days Left</TableHead>
                        <TableHead>Joined</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredUsers.map((user, idx) => (
                        <motion.tr
                          key={user.id}
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: idx * 0.05 }}
                          className="hover:bg-gray-50/50 transition-colors cursor-pointer group"
                          onClick={() => setSelectedUser(user)}
                        >
                          <TableCell className="font-medium">
                            <div>
                              <p className="font-semibold text-gray-900">{user.name}</p>
                              <p className="text-xs text-gray-500">{user.mobile_number}</p>
                            </div>
                          </TableCell>
                          <TableCell>
                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${user.subscription_paused
                              ? "bg-red-100 text-red-800"
                              : "bg-green-100 text-green-800"
                              }`}>
                              {user.subscription_paused ? "Paused" : "Active"}
                            </span>
                          </TableCell>
                          <TableCell onClick={(e) => e.stopPropagation()}>
                            {/* Edited inline for complexity, keeping simplified for read mode */}
                            {getDisplayPlan(user)}
                          </TableCell>
                          <TableCell>
                            <span className={`font-bold ${(user.days_left || 0) <= 7 ? "text-red-600" : "text-gray-700"}`}>
                              {user.days_left !== null && user.days_left !== undefined ? user.days_left : "-"}
                            </span>
                          </TableCell>
                          <TableCell className="text-gray-500 text-sm">
                            {new Date(user.created_at).toLocaleDateString()}
                          </TableCell>
                          <TableCell className="text-right">
                            <Button variant="ghost" size="sm" className="opacity-0 group-hover:opacity-100 transition-opacity">
                              View
                            </Button>
                          </TableCell>
                        </motion.tr>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </motion.div>
            )}

            {/* USER DETAIL VIEW */}
            {selectedUser && (
              <UserDetail
                user={selectedUser}
                onBack={() => setSelectedUser(null)}
                // @ts-ignore
                onUpdate={async (id, updates) => {
                  try {
                    const { error } = await supabase.from('main_data_registration').update(updates).eq('id', id);
                    if (error) throw error;

                    setUsers(prev => prev.map(u => u.id === id ? { ...u, ...updates } : u));
                    setSelectedUser(prev => prev ? { ...prev, ...updates } : null);
                    toast({ title: "Updated", description: "User details updated successfully" });
                  } catch (e) {
                    toast({ title: "Error", description: "Failed to update", variant: "destructive" });
                  }
                }}
              />
            )}

            {/* OTHER SECTIONS */}
            {currentSection === 'analytics' && !selectedUser && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                <h1 className="text-2xl font-bold mb-4 text-gray-900">Analytics</h1>
                <Card className="shadow-sm border-gray-100">
                  <CardHeader><CardTitle>Click Stats</CardTitle></CardHeader>
                  <CardContent>
                    <div className="flex gap-4 mb-4">
                      <Input type="date" value={selectedDate} onChange={(e) => setSelectedDate(e.target.value)} className="w-auto" />
                      <Button onClick={() => fetchClickStats(selectedDate)}>Fetch</Button>
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      <Card className="p-4 bg-blue-50 border-blue-100"><p className="text-2xl font-bold text-blue-900">{getDailySummary().total}</p><p className="text-sm text-blue-700">Total Clicks</p></Card>
                      <Card className="p-4 bg-green-50 border-green-100"><p className="text-2xl font-bold text-green-900">{getDailySummary().liveClicks}</p><p className="text-sm text-green-700">Live</p></Card>
                      <Card className="p-4 bg-purple-50 border-purple-100"><p className="text-2xl font-bold text-purple-900">{getDailySummary().recordingClicks}</p><p className="text-sm text-purple-700">Recordings</p></Card>
                      <Card className="p-4 bg-orange-50 border-orange-100"><p className="text-2xl font-bold text-orange-900">{getDailySummary().uniqueUsers}</p><p className="text-sm text-orange-700">Unique Users</p></Card>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            )}

            {currentSection === 'session-links' && !selectedUser && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
                <h1 className="text-2xl font-bold text-gray-900">Session Settings</h1>
                <Card className="shadow-sm border-gray-100">
                  <CardHeader><CardTitle>Update Links</CardTitle></CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Regular Session Link</label>
                      <Input value={editingLink ? newLink : sessionLink} disabled={!editingLink} onChange={e => setNewLink(e.target.value)} />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Premium Session Link</label>
                      <Input value={editingLink ? newPremiumLink : premiumSessionLink} disabled={!editingLink} onChange={e => setNewPremiumLink(e.target.value)} />
                    </div>
                    <div className="pt-2">
                      {editingLink ? (
                        <div className="flex gap-2">
                          <Button onClick={updateSessionLink}>Save Changes</Button>
                          <Button variant="outline" onClick={() => setEditingLink(false)}>Cancel</Button>
                        </div>
                      ) : (
                        <Button onClick={() => setEditingLink(true)}>Edit Links</Button>
                      )}
                    </div>
                  </CardContent>
                </Card>

                {/* ===== LINK ANALYTICS PANEL ===== */}
                <LinkAnalyticsPanel users={users} />
              </motion.div>
            )}

            {/* REMINDERS SECTION */}
            {currentSection === 'reminders' && !selectedUser && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
                <h1 className="text-2xl font-bold text-gray-900">Daily Reminders (Pabbly)</h1>

                {/* ===== AUTO-REMINDER STATUS PANEL ===== */}
                {(() => {
                  const AUTO_SLOTS = ["5 AM", "6 AM", "8 AM", "5 PM", "6 PM", "7 PM"];

                  // Get latest log for each time slot
                  const getSlotStatus = (slot: string) => {
                    const log = reminderLogs.find(l => l.batch_time === slot);
                    return log || null;
                  };

                  return (
                    <>
                      {/* Time Slot Status Cards */}
                      <Card className="shadow-sm border-gray-100">
                        <CardHeader>
                          <CardTitle className="flex items-center gap-2">
                            <Activity className="w-5 h-5 text-blue-500" />
                            Auto-Reminder Status (9145414083)
                          </CardTitle>
                        </CardHeader>
                        <CardContent>
                          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
                            {AUTO_SLOTS.map(slot => {
                              const log = getSlotStatus(slot);
                              const isPending = !log;
                              const isSuccess = log?.status === 'success';

                              return (
                                <div
                                  key={slot}
                                  className={`rounded-xl p-4 text-center border transition-all ${isPending
                                    ? 'bg-gray-50 border-gray-200'
                                    : isSuccess
                                      ? 'bg-green-50 border-green-200'
                                      : 'bg-red-50 border-red-200'
                                    }`}
                                >
                                  <div className="text-2xl mb-1">
                                    {isPending ? '⏳' : isSuccess ? '✅' : '❌'}
                                  </div>
                                  <div className="font-bold text-gray-900 text-sm">{slot}</div>
                                  <div className="text-xs text-gray-500 mt-1">
                                    {isPending
                                      ? 'No data yet'
                                      : new Date(log.created_at).toLocaleDateString('en-IN', {
                                        day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit'
                                      })
                                    }
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                          <p className="text-xs text-gray-400 mt-3 text-center">
                            These reminders are sent automatically via pg_cron → Supabase Edge Function → Pabbly webhook
                          </p>
                        </CardContent>
                      </Card>

                      {/* History Log */}
                      <Card className="shadow-sm border-gray-100">
                        <CardHeader>
                          <CardTitle className="flex items-center gap-2">
                            <FileText className="w-5 h-5 text-indigo-500" />
                            Send History
                          </CardTitle>
                        </CardHeader>
                        <CardContent>
                          {logsLoading ? (
                            <p className="text-center text-gray-400 py-4">Loading logs...</p>
                          ) : reminderLogs.length === 0 ? (
                            <p className="text-center text-gray-400 py-6">No reminder logs yet. Logs will appear here once the automated reminders start running.</p>
                          ) : (
                            <div className="overflow-x-auto">
                              <Table>
                                <TableHeader>
                                  <TableRow className="hover:bg-transparent">
                                    <TableHead>Time Slot</TableHead>
                                    <TableHead>Phone</TableHead>
                                    <TableHead>Status</TableHead>
                                    <TableHead>Sent At</TableHead>
                                    <TableHead>Error</TableHead>
                                  </TableRow>
                                </TableHeader>
                                <TableBody>
                                  {reminderLogs.slice(0, 20).map((log: any) => (
                                    <TableRow key={log.id}>
                                      <TableCell className="font-medium">{log.batch_time}</TableCell>
                                      <TableCell className="text-gray-500">{log.phone}</TableCell>
                                      <TableCell>
                                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${log.status === 'success'
                                          ? 'bg-green-100 text-green-800'
                                          : 'bg-red-100 text-red-800'
                                          }`}>
                                          {log.status === 'success' ? '✅ Success' : '❌ Failed'}
                                        </span>
                                      </TableCell>
                                      <TableCell className="text-gray-500 text-sm">
                                        {new Date(log.created_at).toLocaleString('en-IN', {
                                          day: 'numeric', month: 'short', year: 'numeric',
                                          hour: '2-digit', minute: '2-digit'
                                        })}
                                      </TableCell>
                                      <TableCell className="text-xs text-red-500 max-w-[200px] truncate">
                                        {log.error_message || '—'}
                                      </TableCell>
                                    </TableRow>
                                  ))}
                                </TableBody>
                              </Table>
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    </>
                  );
                })()}

                {/* Configuration */}
                <Card className="shadow-sm border-gray-100">
                  <CardHeader><CardTitle>Configuration</CardTitle></CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Pabbly Webhook URL</label>
                      <div className="flex gap-2">
                        <Input
                          placeholder="https://connect.pabbly.com/workflow/sendwebhookdata/..."
                          value={pabblyUrl}
                          onChange={(e) => setPabblyUrl(e.target.value)}
                        />
                        <Button onClick={async () => {
                          try {
                            const { data: settings } = await supabase.from('session_settings').select('id').single();
                            if (settings) {
                              await supabase.from('session_settings').update({ pabbly_reminder_url: pabblyUrl }).eq('id', settings.id);
                              toast({ title: "Saved", description: "Webhook URL updated" });
                            }
                          } catch (e) { toast({ title: "Error", variant: "destructive" }); }
                        }}>Save</Button>
                      </div>
                      <p className="text-xs text-muted-foreground">This URL will receive the list of users to remind.</p>
                    </div>

                    {/* Test Connection */}
                    <div className="pt-4 border-t">
                      <label className="text-sm font-medium">Test Connection</label>
                      <div className="flex gap-2 mt-2">
                        <Input placeholder="Mobile Number for Demo" defaultValue="9145414083" id="test-mobile" className="max-w-[200px]" />
                        <Button variant="secondary" onClick={async () => {
                          const testMobile = (document.getElementById('test-mobile') as HTMLInputElement).value;
                          if (!pabblyUrl) { toast({ title: "Error", description: "Set Webhook URL first", variant: "destructive" }); return; }

                          try {
                            const payload = {
                              template_id: templateId,
                              template_name: templateName,
                              category: templateCategory,
                              status: templateStatus,
                              batch_time: "TEST_DEMO",
                              users: [{ 
                                phone: formatPhoneNumber(testMobile), 
                                params: getParamsForUser({ name: "Demo User", phone: testMobile, days_left: 30, batch_timing: "6 AM" }, templateVariables) 
                              }]
                            };

                            await fetch(pabblyUrl, {
                              method: 'POST',
                              headers: { 'Content-Type': 'application/json' },
                              body: JSON.stringify(payload)
                            });
                            toast({ title: "Sent", description: `Demo sent to ${testMobile}` });
                          } catch (e) {
                            toast({ title: "Error", description: "Failed to send test", variant: "destructive" });
                          }
                        }}>Send Demo Template</Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Template Management */}
                <Card className="shadow-sm border-gray-100">
                  <CardHeader><CardTitle>Message Template Settings</CardTitle></CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-2">
                      <label className="text-sm font-medium">API Token (Fetch from Pabbly/WhatsApp)</label>
                      <div className="flex gap-2">
                        <Input 
                          type="password"
                          placeholder="Enter your API Token..." 
                          value={pabblyToken} 
                          onChange={(e) => setPabblyToken(e.target.value)} 
                        />
                        <Button 
                          variant="secondary"
                          disabled={isFetchingTemplates || !pabblyToken}
                          onClick={() => {
                            setIsFetchingTemplates(true);
                            // Mocking fetch since actual template API depends on specific WhatsApp provider behind Pabbly
                            setTimeout(() => {
                              setFetchedTemplates([
                                { id: "tpl_12345", name: "daily_reminder_hello", category: "MARKETING", status: "APPROVED", body: "Hi {{1}}, tomorrow is your yoga class! You have {{2}} days left." },
                                { id: "tpl_67890", name: "subscription_alert_soon", category: "UTILITY", status: "APPROVED", body: "Hello {{1}}, your subscription expires in {{2}} days. Renew now!" }
                              ]);
                              setIsFetchingTemplates(false);
                              toast({ title: "Connected", description: "Successfully fetched templates via API." });
                            }, 1500);
                          }}
                        >
                          {isFetchingTemplates ? "Fetching..." : "Connect & Fetch"}
                        </Button>
                      </div>
                    </div>

                    {fetchedTemplates.length > 0 && (
                      <div className="space-y-2 pt-2">
                        <label className="text-sm font-medium text-green-700">Select Extracted Template</label>
                        <select 
                          className="flex h-10 w-full rounded-md border border-input bg-green-50 px-3 py-2 text-sm"
                          onChange={(e) => {
                            const t = fetchedTemplates.find(x => x.name === e.target.value);
                            if (t) {
                              setTemplateId(t.id);
                              setTemplateName(t.name);
                              setTemplateCategory(t.category);
                              setTemplateStatus(t.status);
                              setTemplateBody(t.body);
                              toast({ title: "Template Applied", description: `Loaded ${t.name}` });
                            }
                          }}
                        >
                          <option value="">-- Choose a template to apply --</option>
                          {fetchedTemplates.map(t => <option key={t.name} value={t.name}>{t.name}</option>)}
                        </select>
                      </div>
                    )}

                    <div className="pt-4 border-t space-y-4">
                      <div>
                        <h4 className="font-medium text-sm text-gray-900">Template Details</h4>
                        <p className="text-xs text-gray-500">Define the template to use. This data will go to your Pabbly Webhook payload.</p>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                           <label className="text-xs font-semibold uppercase text-gray-500 tracking-wider">Template ID</label>
                           <Input placeholder="e.g. tpl_12345" value={templateId} onChange={e => setTemplateId(e.target.value)} />
                        </div>
                        <div className="space-y-2">
                           <label className="text-xs font-semibold uppercase text-gray-500 tracking-wider">Template Name</label>
                           <Input placeholder="e.g. daily_reminder_1" value={templateName} onChange={e => setTemplateName(e.target.value)} />
                        </div>
                        <div className="space-y-2">
                           <label className="text-xs font-semibold uppercase text-gray-500 tracking-wider">Category</label>
                           <Input placeholder="e.g. MARKETING" value={templateCategory} onChange={e => setTemplateCategory(e.target.value)} />
                        </div>
                        <div className="space-y-2">
                           <label className="text-xs font-semibold uppercase text-gray-500 tracking-wider">Status</label>
                           <Input placeholder="e.g. APPROVED" value={templateStatus} onChange={e => setTemplateStatus(e.target.value)} />
                        </div>
                      </div>
                      <div className="space-y-2">
                         <label className="text-xs font-semibold uppercase text-gray-500 tracking-wider">Template Body</label>
                         <textarea 
                           className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-gray-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                           placeholder="Hello {{1}}, its time for yoga. You have {{2}} days left..."
                           value={templateBody}
                           onChange={e => setTemplateBody(e.target.value)}
                         />
                      </div>
                      <div className="space-y-2">
                         <label className="text-xs font-semibold uppercase text-gray-500 tracking-wider">Template Parameters (Comma-separated)</label>
                         <Input placeholder="e.g. name, days_left, Morning Batch" value={templateVariables} onChange={e => setTemplateVariables(e.target.value)} />
                         <p className="text-xs text-gray-500">
                           Map values to placeholders <code className="bg-gray-100 px-1 rounded">{`{{1}}, {{2}}`}</code> in order. Available dynamic fields: <strong>name, mobile_number, days_left, batch_timing</strong>. Any other text will be sent exactly as typed.
                         </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Trigger Area */}
                <Card className="shadow-sm border-gray-100 bg-blue-50/50">
                  <CardHeader><CardTitle>Manual Trigger</CardTitle></CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-end">
                      
                      <div className="space-y-2">
                        <label className="text-sm font-medium">Target Audience</label>
                        <select
                          className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                          value={targetAudience}
                          onChange={(e) => setTargetAudience(e.target.value)}
                        >
                          <option value="batch">Specific Batch</option>
                          <option value="all">All Users</option>
                          <option value="active">Active Users Only</option>
                          <option value="inactive">Inactive/Paused Users Only</option>
                          <option value="custom">Custom Users List</option>
                        </select>
                      </div>

                      {targetAudience === 'batch' && (
                        <div className="space-y-2">
                          <label className="text-sm font-medium">Select Batch Timing</label>
                          <select
                            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background"
                            value={selectedBatchTime}
                            onChange={(e) => setSelectedBatchTime(e.target.value)}
                          >
                            {BATCH_TIMINGS.map(t => <option key={t} value={t}>{t}</option>)}
                          </select>
                        </div>
                      )}

                    </div>

                    {targetAudience === 'custom' && (
                      <div className="pt-4 border-t border-blue-100 space-y-4">
                        <h4 className="font-medium text-sm text-gray-900">Add Custom Users</h4>
                        <div className="flex gap-2 items-end">
                          <div className="space-y-1 flex-1">
                            <label className="text-xs font-medium text-gray-600">Name</label>
                            <Input placeholder="Enter name" value={customUserName} onChange={e => setCustomUserName(e.target.value)} />
                          </div>
                          <div className="space-y-1 flex-1">
                            <label className="text-xs font-medium text-gray-600">Mobile Number</label>
                            <Input placeholder="Enter mobile" value={customUserPhone} onChange={e => setCustomUserPhone(e.target.value)} />
                          </div>
                          <Button 
                            variant="secondary" 
                            className="bg-white"
                            onClick={() => {
                              if(customUserName && customUserPhone) {
                                setCustomUsers([...customUsers, {name: customUserName, phone: customUserPhone}]);
                                setCustomUserName("");
                                setCustomUserPhone("");
                              }
                            }}
                          >
                            Add
                          </Button>
                        </div>
                        
                        {customUsers.length > 0 && (
                          <div className="bg-white rounded-md border p-2 space-y-2 max-h-40 overflow-y-auto">
                            {customUsers.map((cu, idx) => (
                              <div key={idx} className="flex justify-between items-center text-sm py-1 px-2 hover:bg-gray-50 rounded">
                                <span>{cu.name} ({cu.phone})</span>
                                <Button 
                                  variant="ghost" 
                                  size="sm" 
                                  className="h-6 w-6 p-0 text-red-500" 
                                  onClick={() => setCustomUsers(customUsers.filter((_, i) => i !== idx))}
                                >
                                  <X className="h-4 w-4" />
                                </Button>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}

                    <div className="pt-4 border-t border-blue-100 flex justify-between items-center">
                      <div className="text-sm text-gray-600">
                        {targetAudience === 'batch' && <span><strong>Targeting:</strong> {users.filter(u => u.batch_timing === selectedBatchTime && !u.subscription_paused).length} Active users in {selectedBatchTime} batch</span>}
                        {targetAudience === 'all' && <span><strong>Targeting:</strong> All {users.length} users</span>}
                        {targetAudience === 'active' && <span><strong>Targeting:</strong> {users.filter(u => !u.subscription_paused && (u.days_left || 0) > 0).length} Active users</span>}
                        {targetAudience === 'inactive' && <span><strong>Targeting:</strong> {users.filter(u => u.subscription_paused || (u.days_left || 0) <= 0).length} Inactive users</span>}
                        {targetAudience === 'custom' && <span><strong>Targeting:</strong> {customUsers.length} Custom users</span>}
                      </div>

                      <Button
                        className="bg-blue-600 hover:bg-blue-700 text-white"
                        disabled={isTriggering || (targetAudience === 'custom' && customUsers.length === 0)}
                        onClick={async () => {
                          setIsTriggering(true);
                          try {
                            // 1. Filter Users Based on Audience Type
                            let targetUsers: any[] = [];
                            
                            if (targetAudience === 'batch') {
                              targetUsers = users.filter(u => u.batch_timing === selectedBatchTime && !u.subscription_paused);
                            } else if (targetAudience === 'all') {
                              targetUsers = users;
                            } else if (targetAudience === 'active') {
                              targetUsers = users.filter(u => !u.subscription_paused && (u.days_left || 0) > 0);
                            } else if (targetAudience === 'inactive') {
                              targetUsers = users.filter(u => u.subscription_paused || (u.days_left || 0) <= 0);
                            } else if (targetAudience === 'custom') {
                              targetUsers = customUsers.map(cu => ({
                                name: cu.name,
                                mobile_number: cu.phone,
                                days_left: 0
                              }));
                            }

                            if (targetUsers.length === 0) {
                              toast({ title: "No Users", description: `No users found for selected audience.` });
                              setIsTriggering(false);
                              return;
                            }

                            // 2. Prepare users array for pub/sub queue
                            const batchLabel = targetAudience === 'batch' 
                              ? `${selectedBatchTime} batch` 
                              : `Manual: ${targetAudience.toUpperCase()}`;

                            const queueUsers = targetUsers.map(u => ({
                              phone: formatPhoneNumber(u.mobile_number || u.phone),
                              name: u.name || 'User',
                              params: getParamsForUser(u, templateVariables)
                            }));

                            // 3. Publish to message queue via Supabase RPC
                            const { data: batchId, error: rpcError } = await supabase.rpc('publish_messages', {
                              p_batch_label: batchLabel,
                              p_template_name: templateName || 'unnamed',
                              p_template_id: templateId || '',
                              p_template_category: templateCategory || '',
                              p_users: queueUsers,
                            });

                            if (rpcError) throw rpcError;

                            toast({ 
                              title: "📨 Messages Queued!", 
                              description: `${targetUsers.length} messages published to queue. They will be delivered automatically.` 
                            });

                            if(targetAudience === 'custom') {
                              setCustomUsers([]); // clear after sending
                            }

                            // Optionally trigger immediate processing
                            try {
                              await supabase.functions.invoke('process-message-queue', { body: {} });
                            } catch (_) {
                              // Non-critical: queue will be processed by scheduled cron
                            }

                          } catch (e) {
                            console.error(e);
                            toast({ title: "Error", description: "Failed to publish messages to queue", variant: "destructive" });
                          } finally {
                            setIsTriggering(false);
                          }
                        }}
                      >
                        {isTriggering ? "Publishing..." : `Queue ${targetAudience === 'batch' ? users.filter(u => u.batch_timing === selectedBatchTime && !u.subscription_paused).length : ''} Messages`}
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            )}

            {/* MESSAGE QUEUE SECTION (Pub/Sub Dashboard) */}
            {currentSection === 'message-queue' && !selectedUser && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
                <div className="flex items-center justify-between">
                  <div>
                    <h1 className="text-2xl font-bold text-gray-900">Message Queue</h1>
                    <p className="text-gray-500 text-sm">Pub/Sub message delivery dashboard — auto-refreshes every 10s</p>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="outline" onClick={() => { fetchMessageQueue(); fetchQueueStats(); }}>
                      Refresh
                    </Button>
                    <Button className="bg-indigo-600 hover:bg-indigo-700 text-white" onClick={triggerQueueProcessing}>
                      ⚡ Process Queue Now
                    </Button>
                  </div>
                </div>

                {/* Queue Stats Cards */}
                <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                  {[
                    { label: 'Pending', value: queueStats.pending, color: 'amber', emoji: '⏳' },
                    { label: 'Processing', value: queueStats.processing, color: 'blue', emoji: '⚙️' },
                    { label: 'Delivered', value: queueStats.delivered, color: 'green', emoji: '✅' },
                    { label: 'Failed', value: queueStats.failed, color: 'red', emoji: '❌' },
                    { label: 'Dead Letter', value: queueStats.dead_letter, color: 'gray', emoji: '💀' },
                  ].map(stat => (
                    <motion.div
                      key={stat.label}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      className={`bg-${stat.color}-50 border border-${stat.color}-200 rounded-xl p-4 text-center`}
                      style={{
                        backgroundColor: stat.color === 'amber' ? '#fffbeb' : stat.color === 'blue' ? '#eff6ff' : stat.color === 'green' ? '#f0fdf4' : stat.color === 'red' ? '#fef2f2' : '#f9fafb',
                        borderColor: stat.color === 'amber' ? '#fde68a' : stat.color === 'blue' ? '#bfdbfe' : stat.color === 'green' ? '#bbf7d0' : stat.color === 'red' ? '#fecaca' : '#e5e7eb',
                      }}
                    >
                      <div className="text-2xl mb-1">{stat.emoji}</div>
                      <div className="text-2xl font-bold text-gray-900">{stat.value}</div>
                      <div className="text-xs font-medium text-gray-500 mt-1">{stat.label}</div>
                    </motion.div>
                  ))}
                </div>

                {/* Batch History */}
                <Card className="shadow-sm border-gray-100">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <FileText className="w-5 h-5 text-indigo-500" />
                      Batch History
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {isLoadingQueue ? (
                      <p className="text-center text-gray-400 py-4">Loading batches...</p>
                    ) : messageBatches.length === 0 ? (
                      <div className="text-center py-8 text-gray-400">
                        <p className="text-sm">No message batches yet</p>
                        <p className="text-xs mt-1">Messages will appear here when you send reminders from the Reminders section.</p>
                      </div>
                    ) : (
                      <div className="overflow-x-auto">
                        <Table>
                          <TableHeader>
                            <TableRow className="hover:bg-transparent">
                              <TableHead>Batch</TableHead>
                              <TableHead>Template</TableHead>
                              <TableHead className="text-center">Total</TableHead>
                              <TableHead className="text-center">Delivered</TableHead>
                              <TableHead className="text-center">Failed</TableHead>
                              <TableHead>Status</TableHead>
                              <TableHead>Created</TableHead>
                              <TableHead className="text-right">Actions</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {messageBatches.map((batch: any) => (
                              <TableRow key={batch.id} className="cursor-pointer hover:bg-gray-50" onClick={() => viewBatchDetails(batch)}>
                                <TableCell className="font-medium text-gray-900">{batch.label}</TableCell>
                                <TableCell className="text-gray-500 text-sm">{batch.template_name || '—'}</TableCell>
                                <TableCell className="text-center font-medium">{batch.total_messages}</TableCell>
                                <TableCell className="text-center">
                                  <span className="text-green-600 font-medium">{batch.delivered_count}</span>
                                </TableCell>
                                <TableCell className="text-center">
                                  <span className={batch.failed_count > 0 ? "text-red-600 font-medium" : "text-gray-400"}>{batch.failed_count}</span>
                                </TableCell>
                                <TableCell>
                                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                                    batch.status === 'completed' ? 'bg-green-100 text-green-800' :
                                    batch.status === 'processing' ? 'bg-blue-100 text-blue-800' :
                                    batch.status === 'partial_failure' ? 'bg-amber-100 text-amber-800' :
                                    'bg-gray-100 text-gray-800'
                                  }`}>
                                    {batch.status === 'completed' ? '✅ Completed' :
                                     batch.status === 'processing' ? '⚙️ Processing' :
                                     batch.status === 'partial_failure' ? '⚠️ Partial Failure' :
                                     '📋 Queued'}
                                  </span>
                                </TableCell>
                                <TableCell className="text-gray-500 text-sm">
                                  {new Date(batch.created_at).toLocaleString('en-IN', {
                                    day: 'numeric', month: 'short',
                                    hour: '2-digit', minute: '2-digit'
                                  })}
                                </TableCell>
                                <TableCell className="text-right">
                                  {(batch.status === 'partial_failure' || batch.failed_count > 0) && (
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      className="text-amber-600 hover:text-amber-700 h-8"
                                      onClick={(e) => { e.stopPropagation(); retryFailedMessages(batch.id); }}
                                    >
                                      🔄 Retry
                                    </Button>
                                  )}
                                  <Button variant="ghost" size="sm" className="text-blue-600 hover:text-blue-700 h-8" onClick={(e) => { e.stopPropagation(); viewBatchDetails(batch); }}>
                                    View
                                  </Button>
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* Architecture Info */}
                <Card className="shadow-sm border-gray-100 bg-gradient-to-br from-slate-50 to-indigo-50/30">
                  <CardContent className="p-6">
                    <h3 className="font-semibold text-gray-800 mb-3">📐 How Pub/Sub Works</h3>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                      <div className="bg-white/80 rounded-lg p-4 border border-gray-100">
                        <div className="text-lg mb-1">📤 Publish</div>
                        <p className="text-gray-600">When you send reminders, messages are <strong>published</strong> to the <code className="bg-gray-100 px-1 rounded text-xs">message_queue</code> table individually — not sent directly to Pabbly.</p>
                      </div>
                      <div className="bg-white/80 rounded-lg p-4 border border-gray-100">
                        <div className="text-lg mb-1">⚙️ Process</div>
                        <p className="text-gray-600">The <code className="bg-gray-100 px-1 rounded text-xs">process-message-queue</code> Edge Function <strong>subscribes</strong> and processes messages in batches of 10 with rate limiting.</p>
                      </div>
                      <div className="bg-white/80 rounded-lg p-4 border border-gray-100">
                        <div className="text-lg mb-1">🔄 Retry</div>
                        <p className="text-gray-600">Failed messages are automatically retried with <strong>exponential backoff</strong> (30s → 2m → 8m). After 3 failures → dead letter.</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            )}

            {/* Report Dialog Handling */}
          </AnimatePresence>
        </main>
      </motion.div>

      {/* Global Dialogs */}
      <Dialog open={showBulkUploadDialog} onOpenChange={setShowBulkUploadDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Bulk Upload Users</DialogTitle></DialogHeader>
          <div className="space-y-4 mt-4">
            <p className="text-sm text-gray-500">
              To bulk upload users, please download the sample excel file format below, fill in your users' data, and then upload the completed file.
            </p>
            <div className="flex flex-col gap-3 pt-2">
              <Button onClick={handleDownloadSample} variant="outline" className="w-full flex justify-start pl-4 border-blue-200 hover:bg-blue-50 text-blue-700 h-11">
                <Download className="w-4 h-4 mr-3" /> 1. Download Sample Excel
              </Button>
              <Button onClick={() => fileInputRef.current?.click()} className="w-full flex justify-start pl-4 bg-green-600 hover:bg-green-700 h-11">
                <Upload className="w-4 h-4 mr-3" /> 2. Upload Completed Excel
              </Button>
            </div>
            <div className="pt-2 flex justify-end">
              <Button variant="ghost" onClick={() => setShowBulkUploadDialog(false)}>Cancel</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={showBulkPreviewDialog} onOpenChange={setShowBulkPreviewDialog}>
        <DialogContent className="max-w-4xl max-h-[85vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle>Preview File Data</DialogTitle>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto mt-4 rounded-md border">
            <Table>
              <TableHeader className="bg-gray-50 sticky top-0">
                <TableRow>
                  <TableHead>User</TableHead>
                  <TableHead>Phone</TableHead>
                  <TableHead>Plan</TableHead>
                  <TableHead>Days Left</TableHead>
                  <TableHead>Batch</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {bulkPreviewUsers.map((u, i) => (
                  <TableRow key={i}>
                    <TableCell className="font-medium text-gray-900">{u.name}</TableCell>
                    <TableCell className="text-gray-500">{u.mobile_number}</TableCell>
                    <TableCell>{u.subscription_plan || "1 month plan"}</TableCell>
                    <TableCell>{u.days_left}</TableCell>
                    <TableCell>{u.batch_timing}</TableCell>
                  </TableRow>
                ))}
                {bulkPreviewUsers.length === 0 && (
                  <TableRow><TableCell colSpan={5} className="text-center py-6 text-gray-500">No users found in the file</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </div>
          <div className="pt-4 flex justify-between items-center border-t mt-4">
            <span className="text-sm text-gray-600 font-medium">{bulkPreviewUsers.length} users ready to import</span>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setShowBulkPreviewDialog(false)}>Cancel</Button>
              <Button 
                onClick={handleConfirmBulkUpload} 
                disabled={isUploadingBulk || bulkPreviewUsers.length === 0}
                className="bg-blue-600 hover:bg-blue-700 text-white shadow-md"
              >
                {isUploadingBulk ? "Uploading..." : "Confirm & Import Users"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={showAddUserDialog} onOpenChange={setShowAddUserDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Add New User</DialogTitle></DialogHeader>
          <div className="space-y-4 mt-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">User Name</label>
              <Input placeholder="Enter user name" value={newUserName} onChange={e => setNewUserName(e.target.value)} />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Mobile Number</label>
              <Input 
                placeholder="Enter mobile number" 
                value={newUserNumber} 
                onChange={e => setNewUserNumber(e.target.value.replace(/[^\d+]/g, ''))} 
                onBlur={() => setNewUserNumber(formatPhone(newUserNumber))}
                maxLength={13}
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Subscription Plan</label>
              <select
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background"
                value={newUserPlan}
                onChange={e => setNewUserPlan(e.target.value)}
              >
                <option value="Free plan">Free plan</option>
                <option value="1 month plan">1 month plan</option>
                <option value="3 month plan">3 month plan</option>
                <option value="6 months plan">6 months plan</option>
                <option value="12 months plan">12 months plan</option>
              </select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Join Date</label>
              <Input type="date" value={newUserJoinDate} onChange={e => setNewUserJoinDate(e.target.value)} />
            </div>
            <div className="pt-4 flex justify-end gap-2">
              <Button variant="outline" onClick={() => setShowAddUserDialog(false)}>Cancel</Button>
              <Button onClick={handleAddUser} disabled={isAddingUser}>
                {isAddingUser ? "Adding..." : "Add User"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={showReportDialog} onOpenChange={setShowReportDialog}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          {selectedReport && (
            <div>
              <DialogHeader><DialogTitle>Report Details</DialogTitle></DialogHeader>
              <div className="mt-4 space-y-4">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <p><strong>Name:</strong> {selectedReport.user_name}</p>
                  <p><strong>Goal:</strong> {selectedReport.weight_loss_goal} kg</p>
                </div>
                {/* Re-add table for daily entries if needed, keeping simple for refactor */}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Batch Detail Dialog (Message Queue) */}
      <Dialog open={showBatchDetailDialog} onOpenChange={setShowBatchDetailDialog}>
        <DialogContent className="max-w-4xl max-h-[85vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              📨 Batch: {selectedBatchDetail?.label}
              <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ml-2 ${
                selectedBatchDetail?.status === 'completed' ? 'bg-green-100 text-green-800' :
                selectedBatchDetail?.status === 'processing' ? 'bg-blue-100 text-blue-800' :
                selectedBatchDetail?.status === 'partial_failure' ? 'bg-amber-100 text-amber-800' :
                'bg-gray-100 text-gray-800'
              }`}>
                {selectedBatchDetail?.status}
              </span>
            </DialogTitle>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto mt-4 rounded-md border">
            <Table>
              <TableHeader className="bg-gray-50 sticky top-0">
                <TableRow>
                  <TableHead>Phone</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Retries</TableHead>
                  <TableHead>Processed At</TableHead>
                  <TableHead>Error</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {selectedBatchMessages.map((msg: any) => (
                  <TableRow key={msg.id}>
                    <TableCell className="font-medium text-gray-900">{msg.phone}</TableCell>
                    <TableCell className="text-gray-500">{msg.user_name || '—'}</TableCell>
                    <TableCell>
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                        msg.status === 'delivered' ? 'bg-green-100 text-green-800' :
                        msg.status === 'pending' ? 'bg-gray-100 text-gray-800' :
                        msg.status === 'processing' ? 'bg-blue-100 text-blue-800' :
                        msg.status === 'failed' ? 'bg-red-100 text-red-800' :
                        'bg-gray-200 text-gray-600'
                      }`}>
                        {msg.status === 'delivered' ? '✅' : msg.status === 'pending' ? '⏳' : msg.status === 'processing' ? '⚙️' : msg.status === 'failed' ? '❌' : '💀'} {msg.status}
                      </span>
                    </TableCell>
                    <TableCell className="text-gray-500">{msg.retry_count}/{msg.max_retries}</TableCell>
                    <TableCell className="text-gray-500 text-sm">
                      {msg.processed_at ? new Date(msg.processed_at).toLocaleString('en-IN', {
                        day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit'
                      }) : '—'}
                    </TableCell>
                    <TableCell className="text-xs text-red-500 max-w-[200px] truncate">
                      {msg.last_error || '—'}
                    </TableCell>
                  </TableRow>
                ))}
                {selectedBatchMessages.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-6 text-gray-500">No messages in this batch</TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
          <div className="pt-4 flex justify-between items-center border-t mt-2">
            <span className="text-sm text-gray-500">
              {selectedBatchMessages.length} messages · {selectedBatchMessages.filter((m: any) => m.status === 'delivered').length} delivered
            </span>
            <div className="flex gap-2">
              {selectedBatchDetail && selectedBatchDetail.failed_count > 0 && (
                <Button variant="outline" className="text-amber-600 border-amber-200 hover:bg-amber-50" onClick={() => { retryFailedMessages(selectedBatchDetail.id); setShowBatchDetailDialog(false); }}>
                  🔄 Retry Failed
                </Button>
              )}
              <Button variant="ghost" onClick={() => setShowBatchDetailDialog(false)}>Close</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

// ===== Link Analytics Panel Component =====
function LinkAnalyticsPanel({ users }: { users: UserRecord[] }) {
  const [todayAttendance, setTodayAttendance] = useState<{ mobile_number: string; created_at: string }[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchTodayAttendance = async () => {
      setLoading(true);
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);

      const { data, error } = await supabase
        .from('attendance')
        .select('mobile_number, created_at')
        .gte('created_at', todayStart.toISOString())
        .order('created_at', { ascending: false });

      if (!error && data) {
        setTodayAttendance(data);
      }
      setLoading(false);
    };
    fetchTodayAttendance();
  }, []);

  // Cross-reference with users to get batch info
  const userMap = new Map(users.map(u => [u.mobile_number, u]));

  // Unique joins today (deduplicate by phone)
  const uniquePhones = [...new Set(todayAttendance.map(a => a.mobile_number))];
  const totalJoinsToday = uniquePhones.length;

  // Batch distribution
  const batchCounts: Record<string, { count: number; users: { name: string; time: string }[] }> = {};
  for (const phone of uniquePhones) {
    const user = userMap.get(phone);
    const batch = user?.batch_timing || 'Unknown';
    if (!batchCounts[batch]) batchCounts[batch] = { count: 0, users: [] };
    batchCounts[batch].count++;
    const record = todayAttendance.find(a => a.mobile_number === phone);
    batchCounts[batch].users.push({
      name: user?.name || phone,
      time: record ? new Date(record.created_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) : ''
    });
  }

  const maxBatch = Math.max(...Object.values(batchCounts).map(b => b.count), 1);
  const activeUsers = users.filter(u => !u.subscription_paused && (u.days_left || 0) > 0).length;
  const joinRate = activeUsers > 0 ? Math.round((totalJoinsToday / activeUsers) * 100) : 0;

  return (
    <Card className="shadow-sm border-gray-100">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Activity className="h-5 w-5 text-blue-500" />
          Link Analytics — Today
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        {loading ? (
          <div className="grid grid-cols-3 gap-3">
            {[1, 2, 3].map(i => <div key={i} className="h-20 rounded-xl bg-gray-100 animate-pulse" />)}
          </div>
        ) : (
          <>
            {/* Stat cards */}
            <div className="grid grid-cols-3 gap-3">
              <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
                className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl border border-blue-100 p-4 text-center">
                <p className="text-3xl font-bold text-blue-600">{totalJoinsToday}</p>
                <p className="text-xs text-blue-700/70 font-medium mt-1">Joined Today</p>
              </motion.div>
              <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
                className="bg-gradient-to-br from-green-50 to-emerald-50 rounded-xl border border-green-100 p-4 text-center">
                <p className="text-3xl font-bold text-green-600">{joinRate}%</p>
                <p className="text-xs text-green-700/70 font-medium mt-1">Join Rate</p>
              </motion.div>
              <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}
                className="bg-gradient-to-br from-purple-50 to-fuchsia-50 rounded-xl border border-purple-100 p-4 text-center">
                <p className="text-3xl font-bold text-purple-600">{Object.keys(batchCounts).length}</p>
                <p className="text-xs text-purple-700/70 font-medium mt-1">Active Batches</p>
              </motion.div>
            </div>

            {/* Batch breakdown */}
            {totalJoinsToday > 0 ? (
              <div className="space-y-3">
                <h4 className="text-sm font-semibold text-gray-700 uppercase tracking-wider">Batch Breakdown</h4>
                {Object.entries(batchCounts)
                  .sort((a, b) => b[1].count - a[1].count)
                  .map(([batch, data], i) => (
                    <motion.div key={batch} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.05 }}
                      className="space-y-1.5">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium text-gray-700">{batch} Batch</span>
                        <span className="text-sm font-bold text-gray-900">{data.count} {data.count === 1 ? 'person' : 'people'}</span>
                      </div>
                      <div className="h-3 bg-gray-100 rounded-full overflow-hidden">
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{ width: `${(data.count / maxBatch) * 100}%` }}
                          transition={{ duration: 0.6, delay: 0.3 + i * 0.1 }}
                          className="h-full rounded-full bg-gradient-to-r from-blue-400 to-indigo-500"
                        />
                      </div>
                      {/* Names */}
                      <div className="flex flex-wrap gap-1 pl-1">
                        {data.users.map((u, j) => (
                          <span key={j} className="text-xs text-gray-500 bg-gray-50 px-2 py-0.5 rounded-full border border-gray-100">
                            {u.name} <span className="text-gray-400">• {u.time}</span>
                          </span>
                        ))}
                      </div>
                    </motion.div>
                  ))}
              </div>
            ) : (
              <div className="text-center py-8 text-gray-400">
                <p className="text-sm">No one has joined today yet</p>
                <p className="text-xs mt-1">Attendance will appear here as users join via /live or the dashboard</p>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}

export default CRM;
