
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
import { LogOut, Search, Edit2, Save, X, Download, Eye, FileText, MessageCircle, Send, Paperclip, Upload, Users, Link2, BarChart3, ClipboardList, Activity, Calendar, Settings, Plus, Trash2, ToggleLeft, ToggleRight, Play, AlertTriangle } from "lucide-react";
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
import { RetentionDashboard } from "./crm/RetentionDashboard";
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
    if (key === 'batch_timing') return user.batch_timing || '-';
    if (key === 'slug') {
      const match = user.referral_link ? user.referral_link.match(/ref=([^&]+)/) : null;
      return (match && match[1]) ? match[1] : 'default';
    }
    if (key === 'personal_link') {
      const match = user.referral_link ? user.referral_link.match(/ref=([^&]+)/) : null;
      return (match && match[1]) ? `https://yoga.snehyoga.com/${match[1]}` : 'https://yoga.snehyoga.com';
    }
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

type Section = 'users' | 'session-links' | 'analytics' | 'followup' | 'chats' | 'dashboard' | 'message-queue' | 'sap-portal' | 'retention';

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
  
  // Weekly Links state
  const [activeWeek, setActiveWeek] = useState(1);
  const [newActiveWeek, setNewActiveWeek] = useState(1);
  const [weeklyLinks, setWeeklyLinks] = useState<any>({});
  const [newWeeklyLinks, setNewWeeklyLinks] = useState<any>({});

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

  // ── Reminder Schedules (per-slot config) ──────────────────────────
  interface ReminderSchedule {
    id?: string;
    slot: string;
    enabled: boolean;
    audience: string;        // 'active' | 'all' | 'inactive' | 'custom'
    custom_users: { name: string; phone: string }[];
    template_name: string;
    template_id: string;
    template_category: string;
    template_params: string;
  }
  const AUTO_SLOTS = ["5 AM", "6 AM", "8 AM", "5 PM", "6 PM", "7 PM"];
  const [schedules, setSchedules] = useState<Record<string, ReminderSchedule>>({});
  const [editingSlot, setEditingSlot] = useState<string | null>(null);
  const [slotDraft, setSlotDraft] = useState<ReminderSchedule | null>(null);
  const slotDraftRef = useRef<ReminderSchedule | null>(null);
  // Keep ref in sync with state so save handler always gets latest value
  useEffect(() => { slotDraftRef.current = slotDraft; }, [slotDraft]);
  const [isSavingSchedule, setIsSavingSchedule] = useState(false);
  const [slotCustomUserName, setSlotCustomUserName] = useState("");
  const [slotCustomUserPhone, setSlotCustomUserPhone] = useState("");
  const [testingSlot, setTestingSlot] = useState<string | null>(null);

  // Template settings
  const [templateId, setTemplateId] = useState("");
  const [templateName, setTemplateName] = useState("");
  const [templateCategory, setTemplateCategory] = useState("");
  const [templateStatus, setTemplateStatus] = useState("");
  const [templateBody, setTemplateBody] = useState("");
  const [templateVariables, setTemplateVariables] = useState("");
  const [pabblyToken, setPabblyToken] = useState("");
  const [waPhoneNumberId, setWaPhoneNumberId] = useState("808910018982018");
  const [waLanguageCode, setWaLanguageCode] = useState("en");
  const [fetchedTemplates, setFetchedTemplates] = useState<{id: string, name: string, category: string, status: string, body: string}[]>([]);
  const [isFetchingTemplates, setIsFetchingTemplates] = useState(false);
  const [metaBalanceInfo, setMetaBalanceInfo] = useState<any>(null);
  const [isFetchingBalance, setIsFetchingBalance] = useState(false);
  
  // Target Audience settings
  const [targetAudience, setTargetAudience] = useState("batch"); // batch, all, active, inactive, custom
  const [customUsers, setCustomUsers] = useState<{name: string, phone: string}[]>([]);
  const [customUserName, setCustomUserName] = useState("");
  const [customUserPhone, setCustomUserPhone] = useState("");

  // Constants
  const BATCH_TIMINGS = ["5 AM", "6 AM", "7:30 AM", "5 PM", "6 PM", "9:00 PM"];

  type Section = 'users' | 'session-links' | 'analytics' | 'followup' | 'chats' | 'dashboard' | 'reminders' | 'message-queue' | 'sap-portal' | 'retention';

  // Message Queue (Pub/Sub)
  const [messageBatches, setMessageBatches] = useState<any[]>([]);
  const [queueStats, setQueueStats] = useState({ pending: 0, processing: 0, delivered: 0, failed: 0, dead_letter: 0 });
  const [isLoadingQueue, setIsLoadingQueue] = useState(false);
  const [selectedBatchMessages, setSelectedBatchMessages] = useState<any[]>([]);
  const [showBatchDetailDialog, setShowBatchDetailDialog] = useState(false);
  const [selectedBatchDetail, setSelectedBatchDetail] = useState<any>(null);

  // SAP Portal
  interface SapPortalItem {
    id: string;
    title: string;
    description: string;
    pdf_url: string;
    is_visible: boolean;
    order_index: number;
    created_at: string;
  }
  const [sapItems, setSapItems] = useState<SapPortalItem[]>([]);
  const [isSapLoading, setIsSapLoading] = useState(false);
  const [sapNewTitle, setSapNewTitle] = useState("");
  const [sapNewDescription, setSapNewDescription] = useState("");
  const [sapNewPdfUrl, setSapNewPdfUrl] = useState("");
  const [isAddingSapItem, setIsAddingSapItem] = useState(false);
  const [showAddSapDialog, setShowAddSapDialog] = useState(false);

  const fetchSapItems = async () => {
    setIsSapLoading(true);
    try {
      const { data } = await supabase
        .from('sap_portal_items')
        .select('*')
        .order('order_index', { ascending: true });
      setSapItems(data || []);
    } catch (e) {
      console.error('Error fetching SAP portal items:', e);
    } finally {
      setIsSapLoading(false);
    }
  };

  const handleAddSapItem = async () => {
    if (!sapNewTitle.trim() || !sapNewPdfUrl.trim()) return;
    setIsAddingSapItem(true);
    try {
      const maxOrder = sapItems.length > 0 ? Math.max(...sapItems.map(i => i.order_index)) + 1 : 0;
      const { error } = await supabase.from('sap_portal_items').insert({
        title: sapNewTitle.trim(),
        description: sapNewDescription.trim(),
        pdf_url: sapNewPdfUrl.trim(),
        is_visible: true,
        order_index: maxOrder,
      });
      if (error) throw error;
      setSapNewTitle("");
      setSapNewDescription("");
      setSapNewPdfUrl("");
      setShowAddSapDialog(false);
      toast({ title: "Item added to SAP Portal" });
      fetchSapItems();
    } catch (e: any) {
      toast({ title: "Error adding item", description: e.message, variant: "destructive" });
    } finally {
      setIsAddingSapItem(false);
    }
  };

  const handleToggleSapVisibility = async (item: SapPortalItem) => {
    try {
      await supabase.from('sap_portal_items').update({ is_visible: !item.is_visible }).eq('id', item.id);
      setSapItems(prev => prev.map(i => i.id === item.id ? { ...i, is_visible: !i.is_visible } : i));
    } catch (e: any) {
      toast({ title: "Error updating visibility", variant: "destructive" });
    }
  };

  const handleDeleteSapItem = async (id: string) => {
    try {
      await supabase.from('sap_portal_items').delete().eq('id', id);
      setSapItems(prev => prev.filter(i => i.id !== id));
      toast({ title: "Item removed from SAP Portal" });
    } catch (e: any) {
      toast({ title: "Error deleting item", variant: "destructive" });
    }
  };

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

  // Fetch reminder logs + schedules when entering reminders section
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
      const fetchSchedules = async () => {
        try {
          const { data } = await supabase
            .from('reminder_schedules')
            .select('*');
          const map: Record<string, any> = {};
          (data || []).forEach((s: any) => {
            map[s.slot] = {
              ...s,
              custom_users: Array.isArray(s.custom_users) ? s.custom_users : [],
            };
          });
          setSchedules(map);
        } catch (e) {
          console.error('Error fetching reminder schedules:', e);
        }
      };
      fetchLogs();
      fetchSchedules();
    }
  }, [currentSection, isAuthenticated]);

  // Fetch SAP portal items when entering sap-portal section
  useEffect(() => {
    if (currentSection === 'sap-portal' && isAuthenticated) {
      fetchSapItems();
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
        .select('session_link, premium_session_link, pabbly_reminder_url, wa_api_token, wa_phone_number_id, wa_language_code')
        .maybeSingle();

      if (error) {
        console.error('Error fetching session settings:', error);
        return;
      }

      if (data) {
        let parsedLinks: any = {};
        try {
          if (data.session_link && data.session_link.startsWith('{')) {
            parsedLinks = JSON.parse(data.session_link);
          }
        } catch (e) {}

        setActiveWeek(parsedLinks.active_week || 1);
        setNewActiveWeek(parsedLinks.active_week || 1);
        setWeeklyLinks(parsedLinks || {});
        setNewWeeklyLinks(parsedLinks || {});

        setSessionLink(data.session_link || "");
        setNewLink(data.session_link || "");
        setPremiumSessionLink(data.premium_session_link || "");
        setNewPremiumLink(data.premium_session_link || "");
        setPabblyUrl(data.pabbly_reminder_url || "");
        setPabblyToken(data.wa_api_token || "");
        setWaPhoneNumberId(data.wa_phone_number_id || "808910018982018");
        setWaLanguageCode(data.wa_language_code || "en");
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

      const payload = JSON.stringify({
        active_week: newActiveWeek,
        ...newWeeklyLinks
      });

      if (!existingData) {
        // Create new row
        const { error: insertError } = await supabase
          .from('session_settings')
          .insert({
            session_link: payload,
            premium_session_link: "",
            updated_by: username,
            updated_at: new Date().toISOString()
          });
        if (insertError) throw insertError;
      } else {
        // Update existing row
        const { error: updateError } = await supabase
          .from('session_settings')
          .update({
            session_link: payload,
            premium_session_link: "",
            updated_at: new Date().toISOString(),
            updated_by: username
          })
          .eq('id', existingData.id);
        if (updateError) throw updateError;
      }

      setActiveWeek(newActiveWeek);
      setWeeklyLinks(newWeeklyLinks);
      setEditingLink(false);
      toast({ title: "Links Updated! ✅", description: "Your class session links are now live." });
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
                  <CardHeader><CardTitle>Update Daily Links</CardTitle></CardHeader>
                  <CardContent className="space-y-6">
                    <div className="flex items-center space-x-4 mb-4">
                      <label className="text-sm font-bold text-gray-700">Active Week:</label>
                      <select 
                        value={editingLink ? newActiveWeek : activeWeek}
                        disabled={!editingLink}
                        onChange={e => setNewActiveWeek(Number(e.target.value))}
                        className="p-2 border rounded-md"
                      >
                        <option value={1}>Week 1</option>
                        <option value={2}>Week 2</option>
                      </select>

                      {!editingLink && (
                        <div className="ml-6 flex flex-col">
                          <span className="text-xs text-gray-500 uppercase font-semibold">Today's Active Link ({['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][new Date().getDay()]})</span>
                          <span className="text-sm font-medium text-green-700 break-all bg-green-50 px-2 py-1 rounded">
                            {weeklyLinks[`w${activeWeek}_${['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'][new Date().getDay()]}`] || "No link set for today"}
                          </span>
                        </div>
                      )}
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                      {/* Week 1 Links */}
                      <div className="space-y-3">
                        <h3 className="font-bold text-md border-b pb-2">Week 1 Links</h3>
                        {['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'].map((day) => {
                          const isToday = day === ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'][new Date().getDay()];
                          const isActiveCol = isToday && (editingLink ? newActiveWeek : activeWeek) === 1;
                          return (
                            <div key={`w1_${day}`} className="space-y-1">
                              <label className="text-xs font-semibold uppercase">{day} {isActiveCol && <span className="text-green-600 font-bold ml-1">(Today)</span>}</label>
                              <Input 
                                placeholder={`Week 1 ${day} link`}
                                value={editingLink ? (newWeeklyLinks[`w1_${day}`] || '') : (weeklyLinks[`w1_${day}`] || '')} 
                                disabled={!editingLink} 
                                onChange={e => setNewWeeklyLinks({...newWeeklyLinks, [`w1_${day}`]: e.target.value})} 
                                className={isActiveCol ? "border-green-500 bg-green-50 focus-visible:ring-green-500" : ""}
                              />
                            </div>
                          );
                        })}
                      </div>

                      {/* Week 2 Links */}
                      <div className="space-y-3">
                        <h3 className="font-bold text-md border-b pb-2">Week 2 Links</h3>
                        {['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'].map((day) => {
                          const isToday = day === ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'][new Date().getDay()];
                          const isActiveCol = isToday && (editingLink ? newActiveWeek : activeWeek) === 2;
                          return (
                            <div key={`w2_${day}`} className="space-y-1">
                              <label className="text-xs font-semibold uppercase">{day} {isActiveCol && <span className="text-green-600 font-bold ml-1">(Today)</span>}</label>
                              <Input 
                                placeholder={`Week 2 ${day} link`}
                                value={editingLink ? (newWeeklyLinks[`w2_${day}`] || '') : (weeklyLinks[`w2_${day}`] || '')} 
                                disabled={!editingLink} 
                                onChange={e => setNewWeeklyLinks({...newWeeklyLinks, [`w2_${day}`]: e.target.value})} 
                                className={isActiveCol ? "border-green-500 bg-green-50 focus-visible:ring-green-500" : ""}
                              />
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    <div className="pt-4 border-t">
                      {editingLink ? (
                        <div className="flex gap-2">
                          <Button onClick={updateSessionLink}>Save Changes</Button>
                          <Button variant="outline" onClick={() => {
                            setEditingLink(false);
                            setNewWeeklyLinks(weeklyLinks);
                            setNewActiveWeek(activeWeek);
                          }}>Cancel</Button>
                        </div>
                      ) : (
                        <Button onClick={() => {
                          setNewWeeklyLinks({...weeklyLinks});
                          setNewActiveWeek(activeWeek);
                          setEditingLink(true);
                        }}>Edit Links</Button>
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


                {/* ===== LANGUAGE CODE WARNING ===== */}
                <div className="flex items-start gap-3 p-4 rounded-xl border border-amber-200 bg-amber-50/70">
                  <AlertTriangle className="w-5 h-5 text-amber-600 mt-0.5 shrink-0" />
                  <div>
                    <p className="text-sm font-semibold text-amber-800">"Template name does not exist in the translation" error?</p>
                    <p className="text-xs text-amber-700 mt-1">
                      This means the <strong>Language Code</strong> in your WhatsApp Config below doesn't match the template's language.
                      Check your template in <strong>WhatsApp Business Manager</strong> → if it shows <code className="bg-amber-100 px-1 rounded">en_US</code>, set Language Code to <code className="bg-amber-100 px-1 rounded">en_US</code> (not <code className="bg-amber-100 px-1 rounded">en</code>).
                      Common codes: <code className="bg-amber-100 px-1 rounded">en</code>, <code className="bg-amber-100 px-1 rounded">en_US</code>, <code className="bg-amber-100 px-1 rounded">en_GB</code>, <code className="bg-amber-100 px-1 rounded">hi</code>
                    </p>
                  </div>
                </div>

                {/* ===== AUTO-REMINDER SCHEDULER PANEL ===== */}
                <Card className="shadow-sm border-gray-100">
                  <CardHeader className="flex flex-row items-center justify-between">
                    <CardTitle className="flex items-center gap-2">
                      <Activity className="w-5 h-5 text-blue-500" />
                      Auto-Reminder Schedule
                    </CardTitle>
                    <span className="text-xs text-gray-400 bg-gray-50 px-2 py-1 rounded-full">
                      pg_cron → Edge Function → WhatsApp API
                    </span>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {AUTO_SLOTS.map(slot => {
                      const log = reminderLogs.find(l => l.batch_time === slot);
                      const isPending = !log;
                      const isSuccess = log?.status === 'success';
                      const cfg = schedules[slot];
                      const isEnabled = cfg?.enabled !== false;
                      const isEditing = editingSlot === slot;

                      return (
                        <div key={slot} className={`rounded-xl border transition-all ${isEnabled ? 'border-gray-200 bg-white' : 'border-gray-100 bg-gray-50 opacity-60'}`}>
                          {/* Slot Header Row */}
                          <div className="flex items-center justify-between px-4 py-3">
                            <div className="flex items-center gap-3">
                              <span className="text-xl">{isPending ? '⏳' : isSuccess ? '✅' : '❌'}</span>
                              <div>
                                <div className="flex items-center gap-2">
                                  <span className="font-bold text-gray-900">{slot}</span>
                                  {!isEnabled && <span className="text-xs bg-gray-200 text-gray-600 px-1.5 py-0.5 rounded-full">Disabled</span>}
                                  {cfg && isEnabled && (
                                    <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${
                                      cfg.audience === 'active' ? 'bg-green-100 text-green-700' :
                                      cfg.audience === 'all'    ? 'bg-blue-100 text-blue-700' :
                                      cfg.audience === 'inactive' ? 'bg-yellow-100 text-yellow-700' :
                                      'bg-purple-100 text-purple-700'
                                    }`}>
                                      {cfg.audience === 'active' ? '👥 Active Users' :
                                       cfg.audience === 'all' ? '👥 All Users' :
                                       cfg.audience === 'inactive' ? '⏸ Inactive' :
                                       `🎯 Custom (${cfg.custom_users?.length || 0})`}
                                    </span>
                                  )}
                                  {cfg?.template_name && <span className="text-xs text-gray-500 font-mono">📋 {cfg.template_name}</span>}
                                </div>
                                <div className="text-xs text-gray-400 mt-0.5">
                                  {isPending ? 'Not sent today' : new Date(log.created_at).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                                </div>
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              {/* Enable/Disable Toggle */}
                              <button
                                className={`flex items-center gap-1 text-xs px-2 py-1 rounded-lg border transition-colors ${isEnabled ? 'bg-green-50 border-green-200 text-green-700 hover:bg-green-100' : 'bg-gray-100 border-gray-200 text-gray-500 hover:bg-gray-200'}`}
                                onClick={async () => {
                                  const newEnabled = !isEnabled;
                                  try {
                                    const existing = schedules[slot];
                                    if (existing?.id) {
                                      await supabase.from('reminder_schedules').update({ enabled: newEnabled, updated_at: new Date().toISOString() }).eq('id', existing.id);
                                    } else {
                                      await supabase.from('reminder_schedules').upsert({ slot, enabled: newEnabled, audience: 'active', custom_users: [], template_name: '', template_id: '', template_category: '', template_params: 'name,slug', updated_at: new Date().toISOString() }, { onConflict: 'slot' });
                                    }
                                    setSchedules(prev => ({ ...prev, [slot]: { ...(prev[slot] || { slot, audience: 'active', custom_users: [], template_name: '', template_id: '', template_category: '', template_params: 'name,slug' }), enabled: newEnabled } }));
                                    toast({ title: newEnabled ? `${slot} enabled` : `${slot} disabled` });
                                  } catch (e) { toast({ title: 'Error updating schedule', variant: 'destructive' }); }
                                }}
                              >
                                {isEnabled ? <ToggleRight className="w-3.5 h-3.5" /> : <ToggleLeft className="w-3.5 h-3.5" />}
                                {isEnabled ? 'ON' : 'OFF'}
                              </button>
                              {/* Test Now */}
                              <Button
                                variant="outline"
                                size="sm"
                                className="h-7 px-2 text-xs bg-orange-50 border-orange-200 text-orange-700 hover:bg-orange-100"
                                disabled={testingSlot === slot}
                                onClick={async () => {
                                  // Warn if editor is open (unsaved changes)
                                  if (isEditing) {
                                    toast({ title: '⚠️ Save first!', description: 'Click "Save Schedule" before testing. The Test uses saved DB config, not the draft.', variant: 'destructive' });
                                    return;
                                  }
                                  setTestingSlot(slot);
                                  try {
                                    const { data, error } = await supabase.functions.invoke('send-daily-reminders', {
                                      body: { batch_time: slot },
                                    });
                                    if (error) throw error;
                                    const result = typeof data === 'string' ? JSON.parse(data) : data;
                                    if (result.success) {
                                      toast({ title: `✅ ${slot} triggered!`, description: result.message || `Queued ${result.queued || 0} messages` });
                                    } else {
                                      toast({ title: `❌ ${slot} failed`, description: result.error || 'Unknown error', variant: 'destructive' });
                                    }
                                  } catch (e: any) {
                                    toast({ title: `❌ Error triggering ${slot}`, description: e.message, variant: 'destructive' });
                                  } finally {
                                    setTestingSlot(null);
                                  }
                                }}
                              >
                                <Play className="w-3 h-3 mr-1" />
                                {testingSlot === slot ? 'Testing...' : 'Test Now'}
                              </Button>
                              {/* Configure */}
                              <Button
                                variant="outline"
                                size="sm"
                                className="h-7 px-2 text-xs"
                                onClick={() => {
                                  if (isEditing) {
                                    setEditingSlot(null);
                                    setSlotDraft(null);
                                  } else {
                                    const defaults: any = { slot, enabled: true, audience: 'active', custom_users: [], template_name: '', template_id: '', template_category: '', template_params: 'name,slug' };
                                    setSlotDraft({ ...defaults, ...(schedules[slot] || {}), custom_users: schedules[slot]?.custom_users || [] });
                                    setEditingSlot(slot);
                                  }
                                }}
                              >
                                <Settings className="w-3 h-3 mr-1" />
                                {isEditing ? 'Close' : 'Configure'}
                              </Button>
                            </div>
                          </div>

                          {/* ── Inline Editor ── */}
                          {isEditing && slotDraft && (
                            <div className="border-t border-gray-100 px-4 pb-4 pt-3 space-y-4 bg-blue-50/40">
                              {/* Audience */}
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="space-y-1">
                                  <label className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Audience</label>
                                  <select
                                    className="flex h-9 w-full rounded-md border border-input bg-white px-3 text-sm"
                                    value={slotDraft.audience}
                                    onChange={e => setSlotDraft(d => d ? { ...d, audience: e.target.value } : d)}
                                  >
                                    <option value="active">Active Users Only (days_left &gt; 0)</option>
                                    <option value="all">All Users</option>
                                    <option value="inactive">Inactive / Paused Only</option>
                                    <option value="custom">Custom List</option>
                                  </select>
                                </div>
                                <div className="space-y-1">
                                  <label className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Template Name</label>
                                  <Input placeholder="e.g. daily_reminder" value={slotDraft.template_name} onChange={e => setSlotDraft(d => d ? { ...d, template_name: e.target.value } : d)} className="h-9 bg-white" />
                                </div>
                                <div className="space-y-1">
                                  <label className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Template Params <span className="lowercase font-normal text-gray-400">(comma-separated)</span></label>
                                  <Input placeholder="e.g. name,slug" value={slotDraft.template_params} onChange={e => setSlotDraft(d => d ? { ...d, template_params: e.target.value } : d)} className="h-9 bg-white" />
                                  <p className="text-xs text-gray-400">Available: <strong>name, mobile_number, days_left, batch_timing, slug, personal_link</strong></p>
                                </div>
                                <div className="space-y-1">
                                  <label className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Template Category</label>
                                  <Input placeholder="e.g. UTILITY" value={slotDraft.template_category} onChange={e => setSlotDraft(d => d ? { ...d, template_category: e.target.value } : d)} className="h-9 bg-white" />
                                </div>
                              </div>

                              {/* Custom Users */}
                              {slotDraft.audience === 'custom' && (
                                <div className="space-y-2">
                                  <label className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Custom User List</label>
                                  <div className="flex gap-2">
                                    <Input placeholder="Name" value={slotCustomUserName} onChange={e => setSlotCustomUserName(e.target.value)} className="h-8 bg-white text-sm" />
                                    <Input placeholder="Mobile" value={slotCustomUserPhone} onChange={e => setSlotCustomUserPhone(e.target.value)} className="h-8 bg-white text-sm" />
                                    <Button size="sm" variant="secondary" className="h-8 shrink-0" onClick={() => {
                                      console.log('➕ Add clicked. name:', slotCustomUserName, 'phone:', slotCustomUserPhone);
                                      if (slotCustomUserName && slotCustomUserPhone) {
                                        setSlotDraft(d => {
                                          if (!d) return d;
                                          const updated = { ...d, custom_users: [...(d.custom_users || []), { name: slotCustomUserName, phone: slotCustomUserPhone }] };
                                          console.log('➕ Updated custom_users:', updated.custom_users);
                                          return updated;
                                        });
                                        setSlotCustomUserName('');
                                        setSlotCustomUserPhone('');
                                      } else {
                                        console.log('➕ Skipped: name or phone is empty');
                                      }
                                    }}>
                                      <Plus className="w-3 h-3" />
                                    </Button>
                                  </div>
                                  {(slotDraft.custom_users || []).length > 0 && (
                                    <div className="bg-white rounded-lg border p-2 space-y-1 max-h-32 overflow-y-auto">
                                      {(slotDraft.custom_users || []).map((cu, idx) => (
                                        <div key={idx} className="flex justify-between items-center text-xs text-gray-700 px-2 py-1 hover:bg-gray-50 rounded">
                                          <span>{cu.name} — {cu.phone}</span>
                                          <button onClick={() => setSlotDraft(d => d ? { ...d, custom_users: d.custom_users.filter((_, i) => i !== idx) } : d)} className="text-red-400 hover:text-red-600"><Trash2 className="w-3 h-3" /></button>
                                        </div>
                                      ))}
                                    </div>
                                  )}
                                </div>
                              )}

                              {/* Save Button */}
                              <div className="flex justify-end gap-2 pt-1">
                                <Button variant="outline" size="sm" onClick={() => { setEditingSlot(null); setSlotDraft(null); }}>Cancel</Button>
                                <Button
                                  size="sm"
                                  className="bg-blue-600 hover:bg-blue-700 text-white"
                                  disabled={isSavingSchedule}
                                  onClick={async () => {
                                    // Read from ref to avoid stale closure
                                    const draft = slotDraftRef.current;
                                    if (!draft) return;
                                    setIsSavingSchedule(true);
                                    try {
                                      // Auto-add any unsaved text from name/phone inputs
                                      let customUsersList = [...(draft.custom_users || [])];
                                      if (slotCustomUserName && slotCustomUserPhone) {
                                        customUsersList.push({ name: slotCustomUserName, phone: slotCustomUserPhone });
                                        setSlotCustomUserName('');
                                        setSlotCustomUserPhone('');
                                        console.log('💾 Auto-added pending user:', slotCustomUserName, slotCustomUserPhone);
                                      }
                                      const customUsersToSave = JSON.parse(JSON.stringify(customUsersList));
                                      console.log('💾 Saving schedule for slot:', draft.slot);
                                      console.log('💾 custom_users (final):', customUsersToSave);
                                      console.log('💾 audience:', draft.audience);

                                      const payload: Record<string, any> = {
                                        slot: draft.slot,
                                        enabled: draft.enabled !== false,
                                        audience: draft.audience || 'active',
                                        custom_users: customUsersToSave,
                                        template_name: draft.template_name || '',
                                        template_id: draft.template_id || '',
                                        template_category: draft.template_category || '',
                                        template_params: draft.template_params || '',
                                        updated_at: new Date().toISOString(),
                                      };

                                      // Use update if row exists, insert if not
                                      const existingId = schedules[draft.slot]?.id || draft.id;
                                      let error: any = null;

                                      if (existingId) {
                                        console.log('💾 Updating existing row id:', existingId);
                                        const res = await supabase
                                          .from('reminder_schedules')
                                          .update(payload)
                                          .eq('id', existingId);
                                        error = res.error;
                                      } else {
                                        console.log('💾 Inserting new row for slot:', draft.slot);
                                        const res = await supabase
                                          .from('reminder_schedules')
                                          .upsert(payload, { onConflict: 'slot' });
                                        error = res.error;
                                      }

                                      if (error) throw error;

                                      // Verify save by re-fetching
                                      const { data: verifyData } = await supabase
                                        .from('reminder_schedules')
                                        .select('*')
                                        .eq('slot', draft.slot)
                                        .single();
                                      console.log('💾 Verified DB data:', verifyData);
                                      console.log('💾 Verified custom_users:', verifyData?.custom_users);

                                      const savedSchedule = verifyData || { ...draft, custom_users: customUsersToSave };
                                      setSchedules(prev => ({
                                        ...prev,
                                        [draft.slot]: {
                                          ...savedSchedule,
                                          custom_users: Array.isArray(savedSchedule.custom_users) ? savedSchedule.custom_users : [],
                                        }
                                      }));
                                      setEditingSlot(null);
                                      setSlotDraft(null);
                                      toast({ title: `✅ ${slot} schedule saved!`, description: `${customUsersToSave.length} custom user(s) saved` });
                                    } catch (e: any) {
                                      console.error('💾 Save error:', e);
                                      toast({ title: 'Error saving schedule', description: e.message, variant: 'destructive' });
                                    } finally {
                                      setIsSavingSchedule(false);
                                    }
                                  }}
                                >
                                  <Save className="w-3 h-3 mr-1" />
                                  {isSavingSchedule ? 'Saving...' : 'Save Schedule'}
                                </Button>
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </CardContent>
                </Card>

                {/* ===== SEND HISTORY LOG ===== */}
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
                                  <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${log.status === 'success' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                                    {log.status === 'success' ? '✅ Success' : '❌ Failed'}
                                  </span>
                                </TableCell>
                                <TableCell className="text-gray-500 text-sm">
                                  {new Date(log.created_at).toLocaleString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
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

                {/* WhatsApp API Configuration */}
                <Card className="shadow-sm border-gray-100">
                  <CardHeader><CardTitle>WhatsApp API Configuration</CardTitle></CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-2">
                      <label className="text-sm font-medium">API Token</label>
                      <div className="flex gap-2">
                        <Input
                          type="password"
                          placeholder="EAAUtx..."
                          value={pabblyToken}
                          onChange={(e) => setPabblyToken(e.target.value)}
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <label className="text-sm font-medium">Phone Number ID</label>
                        <Input
                          placeholder="808910018982018"
                          value={waPhoneNumberId}
                          onChange={(e) => setWaPhoneNumberId(e.target.value)}
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-sm font-medium">Language Code</label>
                        <Input
                          placeholder="en"
                          value={waLanguageCode}
                          onChange={(e) => setWaLanguageCode(e.target.value)}
                        />
                        <p className="text-xs text-muted-foreground">e.g. en, en_US, hi</p>
                      </div>
                    </div>
                    <Button onClick={async () => {
                      try {
                        const { data: settings } = await supabase.from('session_settings').select('id').single();
                        if (settings) {
                          await supabase.from('session_settings').update({
                            wa_api_token: pabblyToken,
                            wa_phone_number_id: waPhoneNumberId,
                            wa_language_code: waLanguageCode,
                          }).eq('id', settings.id);
                          toast({ title: "Saved", description: "WhatsApp config saved" });
                        }
                      } catch (e) { toast({ title: "Error saving config", variant: "destructive" }); }
                    }}>Save Config</Button>

                    {/* Test Connection */}
                    <div className="pt-4 border-t">
                      <label className="text-sm font-medium">Test — Send Demo Message</label>
                      <div className="flex gap-2 mt-2">
                        <Input placeholder="Mobile e.g. 9145414083" defaultValue="9145414083" id="test-mobile" className="max-w-[220px]" />
                        <Button variant="secondary" onClick={async () => {
                          const testMobile = (document.getElementById('test-mobile') as HTMLInputElement).value;
                          if (!pabblyToken) { toast({ title: "Error", description: "Enter API Token first", variant: "destructive" }); return; }
                          if (!templateName) { toast({ title: "Error", description: "Select a template first", variant: "destructive" }); return; }

                          try {
                            const phone = formatPhoneNumber(testMobile).replace(/\D/g, "");
                            const params = getParamsForUser({ name: "Demo User", phone: testMobile, days_left: 30, batch_timing: "6 AM" }, templateVariables);
                            const res = await fetch(`https://graph.facebook.com/v20.0/${waPhoneNumberId}/messages`, {
                              method: 'POST',
                              headers: {
                                'Content-Type': 'application/json',
                                'Authorization': `Bearer ${pabblyToken}`,
                              },
                              body: JSON.stringify({
                                messaging_product: "whatsapp",
                                to: phone,
                                type: "template",
                                template: {
                                  name: templateName,
                                  language: { code: waLanguageCode || "en" },
                                  components: params.length > 0 ? [{
                                    type: "body",
                                    parameters: params.map((p: string) => ({ type: "text", text: p }))
                                  }] : []
                                }
                              })
                            });
                            const json = await res.json();
                            if (!res.ok || json.error) throw new Error(json.error?.message || `HTTP ${res.status}`);
                            toast({ title: "Sent!", description: `Demo message sent to ${testMobile}` });
                          } catch (e: any) {
                            toast({ title: "Failed to send", description: e.message, variant: "destructive" });
                          }
                        }}>Send Demo</Button>
                      </div>
                    </div>
                    {/* Meta Balance Check */}
                    <div className="pt-4 border-t">
                      <label className="text-sm font-medium">Meta Balance & Limits</label>
                      <div className="flex gap-2 mt-2">
                        <Button 
                          variant="secondary" 
                          disabled={isFetchingBalance || !pabblyToken}
                          onClick={async () => {
                            setIsFetchingBalance(true);
                            try {
                              const url = `https://graph.facebook.com/v20.0/${waPhoneNumberId}?fields=display_phone_number,quality_rating,messaging_limit_tier&access_token=${pabblyToken}`;
                              const res = await fetch(url);
                              const json = await res.json();
                              if (!res.ok || json.error) throw new Error(json.error?.message || "Failed to fetch balance");
                              setMetaBalanceInfo(json);
                              toast({ title: "Fetched", description: "Meta balance info fetched successfully." });
                            } catch (err: any) {
                              toast({ title: "Error", description: err.message, variant: "destructive" });
                            } finally {
                              setIsFetchingBalance(false);
                            }
                          }}
                        >
                          {isFetchingBalance ? "Fetching..." : "Fetch Meta Balance"}
                        </Button>
                      </div>
                      {metaBalanceInfo && (
                        <div className="mt-4 p-3 bg-gray-50 rounded-md text-sm border">
                          <p><strong>Phone Number:</strong> {metaBalanceInfo.display_phone_number || 'N/A'}</p>
                          <p><strong>Quality Rating:</strong> <span className={metaBalanceInfo.quality_rating === 'GREEN' ? 'text-green-600 font-medium' : metaBalanceInfo.quality_rating === 'YELLOW' ? 'text-yellow-600 font-medium' : 'text-red-600 font-medium'}>{metaBalanceInfo.quality_rating || 'N/A'}</span></p>
                          <p><strong>Messaging Limit Tier:</strong> {metaBalanceInfo.messaging_limit_tier || 'N/A'}</p>
                          <p className="text-xs text-gray-500 mt-2">Note: For exact monetary balance, please check Meta Business Suite Billing.</p>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>

                {/* Template Management */}
                <Card className="shadow-sm border-gray-100">
                  <CardHeader><CardTitle>Message Template Settings</CardTitle></CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Fetch Templates from WhatsApp</label>
                      <p className="text-xs text-muted-foreground">Uses the API Token saved in the Configuration card above.</p>
                      <div className="flex gap-2">
                        <Button
                          variant="secondary"
                          disabled={isFetchingTemplates || !pabblyToken}
                          onClick={async () => {
                            setIsFetchingTemplates(true);
                            try {
                              const wabaId = "1530834774801331";
                              const url = `https://graph.facebook.com/v20.0/${wabaId}/message_templates?fields=name,status,category,components&limit=100&access_token=${pabblyToken}`;
                              const res = await fetch(url);
                              const json = await res.json();
                              if (!res.ok || json.error) {
                                throw new Error(json.error?.message || "Failed to fetch templates");
                              }
                              const templates = (json.data || []).map((t: any) => {
                                const bodyComp = t.components?.find((c: any) => c.type === "BODY");
                                return {
                                  id: t.id,
                                  name: t.name,
                                  category: t.category,
                                  status: t.status,
                                  body: bodyComp?.text || "",
                                };
                              });
                              setFetchedTemplates(templates);
                              toast({ title: "Connected", description: `Fetched ${templates.length} templates from WhatsApp.` });
                            } catch (err: any) {
                              toast({ title: "Error fetching templates", description: err.message, variant: "destructive" });
                            } finally {
                              setIsFetchingTemplates(false);
                            }
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
                        <p className="text-xs text-gray-500">Define the template to use. This data will be sent via WhatsApp Business API.</p>
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
                           Map values to placeholders <code className="bg-gray-100 px-1 rounded">{`{{1}}, {{2}}`}</code> in order. Available dynamic fields: <strong>name, mobile_number, days_left, batch_timing, slug, personal_link</strong>. Any other text will be sent exactly as typed.
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
                              targetUsers = customUsers.map(cu => {
                                // Try to find the user in the database to fetch their referral link
                                const phoneStr = String(cu.phone).replace(/\D/g, '');
                                const dbUser = users.find(u => {
                                  const dbPhone = String(u.mobile_number || u.phone).replace(/\D/g, '');
                                  return dbPhone.includes(phoneStr);
                                });
                                return {
                                  name: cu.name || dbUser?.name || 'User',
                                  mobile_number: cu.phone,
                                  days_left: dbUser?.days_left || 0,
                                  batch_timing: dbUser?.batch_timing || '',
                                  referral_link: dbUser?.referral_link || ''
                                };
                              });
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

            {/* SAP PORTAL SECTION */}
            {currentSection === 'sap-portal' && !selectedUser && (
              <motion.div
                key="sap-portal"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="space-y-6"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <h1 className="text-2xl font-bold text-gray-900">SAP Portal</h1>
                    <p className="text-gray-500 text-sm">Manage what PDFs and documents are visible to users in the SAP portal</p>
                  </div>
                  <Button
                    className="bg-blue-600 hover:bg-blue-700 text-white"
                    onClick={() => setShowAddSapDialog(true)}
                  >
                    + Add Item
                  </Button>
                </div>

                {isSapLoading ? (
                  <div className="text-center py-16 text-gray-400">Loading...</div>
                ) : sapItems.length === 0 ? (
                  <Card className="border-none shadow-sm">
                    <CardContent className="py-16 text-center text-gray-400">
                      <FileText size={40} className="mx-auto mb-3 opacity-30" />
                      <p className="font-medium">No items in SAP Portal yet</p>
                      <p className="text-sm mt-1">Click "Add Item" to add a PDF or document</p>
                    </CardContent>
                  </Card>
                ) : (
                  <div className="grid gap-4">
                    {sapItems.map((item) => (
                      <Card key={item.id} className={`border shadow-sm transition-opacity ${!item.is_visible ? 'opacity-50' : ''}`}>
                        <CardContent className="p-5 flex items-start gap-4">
                          <div className="p-3 bg-blue-50 rounded-lg text-blue-600 shrink-0">
                            <FileText size={22} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <h3 className="font-semibold text-gray-900">{item.title}</h3>
                              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${item.is_visible ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                                {item.is_visible ? 'Visible' : 'Hidden'}
                              </span>
                            </div>
                            {item.description && (
                              <p className="text-sm text-gray-500 mt-1">{item.description}</p>
                            )}
                            <a
                              href={item.pdf_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-xs text-blue-500 hover:underline mt-1 block truncate"
                            >
                              {item.pdf_url}
                            </a>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleToggleSapVisibility(item)}
                              className={item.is_visible ? 'border-amber-200 text-amber-700 hover:bg-amber-50' : 'border-green-200 text-green-700 hover:bg-green-50'}
                            >
                              {item.is_visible ? 'Hide' : 'Show'}
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleDeleteSapItem(item.id)}
                              className="border-red-200 text-red-600 hover:bg-red-50"
                            >
                              Delete
                            </Button>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </motion.div>
            )}

            {/* RETENTION OS SECTION */}
            {currentSection === 'retention' && !selectedUser && (
              <RetentionDashboard />
            )}

            {/* Report Dialog Handling */}
          </AnimatePresence>
        </main>
      </motion.div>

      {/* Add SAP Portal Item Dialog */}
      <Dialog open={showAddSapDialog} onOpenChange={setShowAddSapDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Add Item to SAP Portal</DialogTitle></DialogHeader>
          <div className="space-y-4 mt-4">
            <div>
              <label className="text-sm font-medium text-gray-700 block mb-1">Title *</label>
              <Input
                placeholder="e.g. Diet Plan - Week 1"
                value={sapNewTitle}
                onChange={e => setSapNewTitle(e.target.value)}
              />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 block mb-1">Description</label>
              <Input
                placeholder="Optional description"
                value={sapNewDescription}
                onChange={e => setSapNewDescription(e.target.value)}
              />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 block mb-1">PDF URL *</label>
              <Input
                placeholder="https://..."
                value={sapNewPdfUrl}
                onChange={e => setSapNewPdfUrl(e.target.value)}
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="ghost" onClick={() => setShowAddSapDialog(false)}>Cancel</Button>
              <Button
                className="bg-blue-600 hover:bg-blue-700 text-white"
                onClick={handleAddSapItem}
                disabled={isAddingSapItem || !sapNewTitle.trim() || !sapNewPdfUrl.trim()}
              >
                {isAddingSapItem ? "Adding..." : "Add Item"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

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
