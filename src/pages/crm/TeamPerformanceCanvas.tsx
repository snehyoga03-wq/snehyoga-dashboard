import React, { useState, useEffect, useRef, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import {
  Calendar, Users, PhoneCall, CheckCircle, Clock, ListTodo, XCircle,
  TrendingUp, RefreshCw, ChevronUp, ChevronDown, Award, Target,
  ArrowUpRight, ArrowDownRight, RotateCcw, AlertTriangle, Sparkles,
  BarChart3, UserCheck, PhoneForwarded, HelpCircle, ShieldAlert,
  SlidersHorizontal, Trophy, ArrowUpDown, ChevronLeft, ChevronRight,
  Info, CheckCheck, FileText, Copy, Check
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip,
  Legend, ResponsiveContainer, AreaChart, Area, PieChart, Pie, Cell
} from 'recharts';
import type { Lead } from '@/integrations/supabase/types';
import { motion, AnimatePresence } from 'framer-motion';
import { calculateCallTargetLedgers, UserTargetLedger } from '@/utils/callTargetLedger';
import { getLeadCallStatus, isLeadWorkedInPeriod, isDateInFilter } from '@/utils/callStatusUtils';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';

const ASSIGNED_USERS = ["Ragini K", "Shreya K", "Tejasswini K"];
const LEAD_STATUSES = ["Select Option", "Follow Up", "Master Class Follow", "Deal Done", "Dead"];

const isUserMatch = (assignedTo: string | null | undefined, createdBy: string | null | undefined, targetUser: string): boolean => {
  if (!targetUser || targetUser === 'all') return true;
  const normTarget = targetUser.trim().toLowerCase();
  const targetFirstName = normTarget.split(' ')[0];

  const normAssigned = (assignedTo || "").trim().toLowerCase();
  const normCreatedBy = (createdBy || "").trim().toLowerCase();

  const isTargetTejas = normTarget.includes("tejasswin") || normTarget.includes("tejassw") || normTarget.includes("tejasw") || normTarget.includes("janhavi");
  const isAssignedTejas = normAssigned.includes("tejasswin") || normAssigned.includes("tejassw") || normAssigned.includes("tejasw") || normAssigned.includes("janhavi");
  const isCreatedTejas = normCreatedBy.includes("tejasswin") || normCreatedBy.includes("tejassw") || normCreatedBy.includes("tejasw") || normCreatedBy.includes("janhavi");

  if (isTargetTejas && (isAssignedTejas || isCreatedTejas)) {
    return true;
  }

  return (
    normAssigned.includes(normTarget) ||
    normAssigned.includes(targetFirstName) ||
    normCreatedBy.includes(normTarget) ||
    normCreatedBy.includes(targetFirstName)
  );
};

export interface MemberPerformance {
  name: string;
  callsCompleted: number;
  connectedCalls: number;
  notConnectedCalls: number;
  leadsHandled: number;
  followUpsCompleted: number;
  pendingFollowUps: number;
  leadsConverted: number;
  conversionRate: number;
  tasksCompleted: number;
  overdueTasks: number;
  overallScore: number;
  performanceRating: 'high' | 'average' | 'needs_improvement';
  rank: number;
  newAssignedLeads?: number;
  followUpCallsDone?: number;
}

const generateUserOverviewSentence = (userStats: {
  name: string;
  callsDone: number;
  connectedCalls: number;
  followupCallsDone: number;
  pendingFollowups: number;
  overdueTasks: number;
  dealsConverted: number;
  overallScore: number;
  newAssignedLeads: number;
}): string => {
  const { name, callsDone, connectedCalls, followupCallsDone, pendingFollowups, overdueTasks, dealsConverted, overallScore } = userStats;

  if (callsDone === 0) {
    return `❌ Inactive status today: No calls, notes, or status changes were logged for ${name} across assigned leads. Immediate check-in required.`;
  }
  if (overallScore >= 75 || connectedCalls >= 50) {
    return `🌟 Outstanding performance today: ${name} achieved a high score of ${overallScore}/100 with ${callsDone} total calls (${connectedCalls} connected), cleared ${followupCallsDone} follow-ups, and converted ${dealsConverted} deal(s). Daily target fully exceeded.`;
  }
  if (overallScore >= 60 || callsDone >= 40) {
    return `👍 Steady & consistent work today: ${name} logged ${callsDone} calls (${connectedCalls} connected) with ${followupCallsDone} follow-ups cleared. Maintaining solid outreach pace and active lead engagement.`;
  }
  if (pendingFollowups > 10 || overdueTasks > 0) {
    return `⚠️ Attention required on follow-up backlog: While ${name} made ${callsDone} calls, there are ${pendingFollowups} pending follow-ups (${overdueTasks} overdue). Priority must be placed on clearing overdue follow-up leads first.`;
  }
  return `📈 Moderate pace today: ${name} completed ${callsDone} calls (${connectedCalls} connected) with ${followupCallsDone} follow-up calls done (Score: ${overallScore}/100). Higher call volume needed to reach the 60-call target.`;
};

const generateTeamOverviewSentence = (teamStats: {
  callsDone: number;
  connectedCalls: number;
  dealsConverted: number;
  pendingFollowups: number;
  overdueTasks: number;
  topPerformerName: string;
}): string => {
  const { callsDone, connectedCalls, dealsConverted, pendingFollowups, overdueTasks, topPerformerName } = teamStats;
  if (callsDone === 0) {
    return `⚠️ No call outreach activity logged by the team for this period yet. Immediate dialing campaign required.`;
  }
  return `📊 Team achieved ${dealsConverted} deal(s) across ${callsDone} total calls (${connectedCalls} connected). Lead performer: ${topPerformerName || 'N/A'}. ${overdueTasks > 0 ? `Notice: ${overdueTasks} follow-ups are overdue and require urgent attention.` : `Follow-up tasks are in healthy standing.`}`;
};

export function TeamPerformanceCanvas() {
  const [loading, setLoading] = useState(true);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [history, setHistory] = useState<any[]>([]);
  const [selectedLedgerUser, setSelectedLedgerUser] = useState<UserTargetLedger | null>(null);

  // Daily Report Modal State
  const [dailyReportOpen, setDailyReportOpen] = useState(false);
  const [reportType, setReportType] = useState<'team' | 'user'>('team');
  const [selectedReportUser, setSelectedReportUser] = useState<string>(ASSIGNED_USERS[0]);
  const [reportCopied, setReportCopied] = useState(false);

  // Active Tab
  const [activeTab, setActiveTab] = useState<'overview' | 'members' | 'trends' | 'ledger'>('overview');

  // Filters
  const [datePreset, setDatePreset] = useState<'today' | 'this_week' | 'last_week' | 'this_month' | 'custom'>('this_week');
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [dailyDate, setDailyDate] = useState("");

  const userRole = sessionStorage.getItem("crm_user_role");
  const username = sessionStorage.getItem("crm_username");
  const isRestrictedStaff = userRole === "staff" && username !== "Shreya K";

  const [selectedMember, setSelectedMember] = useState<string>(() => {
    if (isRestrictedStaff && username) return username;
    return "all";
  });
  const [selectedStatus, setSelectedStatus] = useState<string>("all");

  const effectiveMember = isRestrictedStaff && username ? username : selectedMember;

  // Sorting and pagination for member table
  const [sortField, setSortField] = useState<keyof MemberPerformance>('overallScore');
  const [sortAsc, setSortAsc] = useState(false);
  const [memberPage, setMemberPage] = useState(1);
  const membersPerPage = 10;

  // Setup Date Range Preset on load
  useEffect(() => {
    applyDatePreset('this_week');
  }, []);

  const formatLocalDate = (d: Date): string => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  };

  const applyDatePreset = (preset: 'today' | 'this_week' | 'last_week' | 'this_month' | 'custom') => {
    setDatePreset(preset);
    const now = new Date();

    if (preset === 'today') {
      const todayStr = formatLocalDate(now);
      setDailyDate(todayStr);
      setStartDate(todayStr);
      setEndDate(todayStr);
    } else if (preset === 'this_week') {
      const day = now.getDay();
      const diffToMonday = (day === 0 ? -6 : 1) - day;
      const monday = new Date(now);
      monday.setDate(now.getDate() + diffToMonday);
      const sunday = new Date(monday);
      sunday.setDate(monday.getDate() + 6);
      setStartDate(formatLocalDate(monday));
      setEndDate(formatLocalDate(sunday));
      setDailyDate("");
    } else if (preset === 'last_week') {
      const day = now.getDay();
      const diffToMonday = (day === 0 ? -6 : 1) - day - 7;
      const monday = new Date(now);
      monday.setDate(now.getDate() + diffToMonday);
      const sunday = new Date(monday);
      sunday.setDate(monday.getDate() + 6);
      setStartDate(formatLocalDate(monday));
      setEndDate(formatLocalDate(sunday));
      setDailyDate("");
    } else if (preset === 'this_month') {
      const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
      const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0);
      setStartDate(formatLocalDate(firstDay));
      setEndDate(formatLocalDate(lastDay));
      setDailyDate("");
    }
  };

  const fetchIdRef = useRef(0);

  const fetchData = async () => {
    const currentFetchId = ++fetchIdRef.current;
    setLoading(true);
    try {
      // 1. Fetch leads
      let allLeads: Lead[] = [];
      let offset = 0;
      const pageSize = 1000;
      let hasMore = true;

      while (hasMore) {
        let leadsQuery = supabase
          .from('leads')
          .select('*')
          .order('created_at', { ascending: false })
          .range(offset, offset + pageSize - 1);

        if (selectedStatus !== 'all') {
          leadsQuery = leadsQuery.eq('lead_status', selectedStatus);
        }

        const { data: chunk, error: leadsError } = await leadsQuery;
        if (leadsError) throw leadsError;

        if (!chunk || chunk.length === 0) {
          hasMore = false;
        } else {
          allLeads = allLeads.concat(chunk as Lead[]);
          if (chunk.length < pageSize) {
            hasMore = false;
          } else {
            offset += pageSize;
          }
        }
      }

      const uniqueLeads = Array.from(new Map(allLeads.map(l => [l.id, l])).values());

      // 2. Fetch history
      const { data: historyData, error: historyError } = await supabase
        .from('lead_history')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(5000);

      if (historyError) throw historyError;

      if (currentFetchId === fetchIdRef.current) {
        setLeads(uniqueLeads);
        setHistory(historyData || []);
      }
    } catch (err) {
      if (currentFetchId === fetchIdRef.current) {
        console.error("[TeamPerformanceCanvas] Error fetching CRM data:", err);
      }
    } finally {
      if (currentFetchId === fetchIdRef.current) {
        setLoading(false);
      }
    }
  };

  useEffect(() => {
    fetchData();
  }, [selectedStatus]);

  // Date Filtering Logic
  const isDateRange = Boolean(startDate && endDate);
  const targetDate = dailyDate || startDate || endDate || formatLocalDate(new Date());

  const formatLocalDateYMD = (dateVal: string | null | undefined): string => {
    if (!dateVal) return "";
    const d = new Date(dateVal);
    if (isNaN(d.getTime())) return "";
    return formatLocalDate(d);
  };

  const matchesDateFilter = (dateVal: string | null | undefined, filterDate: string): boolean => {
    if (!dateVal || !filterDate) return false;
    if (typeof dateVal === "string" && dateVal.startsWith(filterDate)) return true;
    const d = new Date(dateVal);
    if (isNaN(d.getTime())) return false;
    return formatLocalDate(d) === filterDate;
  };

  const matchesFilterRange = (lead: Lead): boolean => {
    if (isDateRange) {
      if (!lead.created_at) return true;
      const isFollowUpInRange = Boolean(lead.follow_up_date && lead.follow_up_date >= startDate && lead.follow_up_date <= endDate);
      const isCreatedInRange = Boolean(lead.created_at && lead.created_at >= startDate && lead.created_at <= (endDate + "T23:59:59"));
      return isCreatedInRange || isFollowUpInRange || lead.lead_status === "Master Class Follow";
    }

    if (!targetDate) return true;
    const isMasterClassFollow = lead.lead_status === "Master Class Follow";
    if (!lead.created_at) {
      return matchesDateFilter(lead.follow_up_date, targetDate) || isMasterClassFollow;
    }
    const isCreatedToday = matchesDateFilter(lead.created_at, targetDate);
    const isFollowUpToday = matchesDateFilter(lead.follow_up_date, targetDate);
    const localLeadDate = formatLocalDateYMD(lead.created_at);
    const isUntouchedCarryForward = localLeadDate < targetDate && lead.lead_status === "Select Option" && !lead.follow_up_date;
    return isCreatedToday || isFollowUpToday || isUntouchedCarryForward || isMasterClassFollow;
  };

  // Filtered Leads
  const filteredLeads = useMemo(() => {
    return leads.filter(l =>
      isUserMatch(l.assigned_to, null, effectiveMember) &&
      matchesFilterRange(l)
    );
  }, [leads, effectiveMember, startDate, endDate, dailyDate, isDateRange]);

  const assignedLeadIds = useMemo(() => new Set(filteredLeads.map(l => l.id)), [filteredLeads]);

  // Filtered History
  const filteredHistory = useMemo(() => {
    return history.filter(h => {
      const matchesUser = isUserMatch(null, h.created_by, effectiveMember);
      const matchesAssignedLead = targetDate ? assignedLeadIds.has(h.lead_id) : true;
      return matchesUser || matchesAssignedLead;
    });
  }, [history, effectiveMember, assignedLeadIds, targetDate]);

  // Today string for overdue task detection
  const todayStr = useMemo(() => formatLocalDate(new Date()), []);

  // Team Overview Metrics Calculation
  const teamMetrics = useMemo(() => {
    let totalConnected = 0;
    let totalNotConnected = 0;
    let followUpsCompleted = 0;
    let pendingFollowUps = 0;
    let converted = 0;
    let overdueTasks = 0;
    let tasksCompleted = 0;
    let newAssignedLeads = 0;
    let followUpCallsDone = 0;

    const filter = isDateRange ? { startDate, endDate } : { targetDate };

    filteredLeads.forEach(l => {
      const st = getLeadCallStatus(l, filteredHistory, filter);
      if (st === 'connected') totalConnected++;
      else if (st === 'not_connected') totalNotConnected++;

      const isWorkedOn = isLeadWorkedInPeriod(l, filteredHistory, filter);

      if (isDateInFilter(l.created_at, filter)) {
        newAssignedLeads++;
      }

      if (l.lead_status === 'Deal Done') {
        converted++;
      } else if (l.lead_status === 'Follow Up') {
        if (!isWorkedOn) {
          pendingFollowUps++;
          if (l.follow_up_date && l.follow_up_date < todayStr) {
            overdueTasks++;
          }
        }
      }

      // Tasks and Follow-ups are ONLY completed if telecaller actually worked on/contacted the lead in this period!
      if (isWorkedOn) {
        tasksCompleted++;
        if (l.follow_up_date) {
          followUpsCompleted++;
        }
        if (st !== 'not_called' && l.follow_up_date && l.follow_up_date <= (isDateRange ? (endDate || targetDate) : targetDate)) {
          followUpCallsDone++;
        }
      }
    });

    const totalCalls = totalConnected + totalNotConnected;
    const totalLeads = filteredLeads.length;
    const conversionRate = totalLeads > 0 ? (converted / totalLeads) * 100 : 0;

    return {
      totalCalls,
      totalConnected,
      totalNotConnected,
      totalLeads,
      followUpsCompleted,
      pendingFollowUps,
      converted,
      conversionRate,
      tasksCompleted,
      overdueTasks,
      newAssignedLeads,
      followUpCallsDone,
    };
  }, [filteredLeads, filteredHistory, todayStr, isDateRange, startDate, endDate, targetDate]);

  // Individual Team Member Calculations
  const displayedUsers = useMemo(() => {
    return effectiveMember === 'all' ? ASSIGNED_USERS : [effectiveMember];
  }, [effectiveMember]);

  const memberPerformanceList: MemberPerformance[] = useMemo(() => {
    const filter = isDateRange ? { startDate, endDate } : { targetDate };

    const list: Omit<MemberPerformance, 'rank'>[] = displayedUsers.map(user => {
      const userLeads = leads.filter(l => isUserMatch(l.assigned_to, null, user) && matchesFilterRange(l));
      const userLeadIds = new Set(userLeads.map(l => l.id));
      const userHistory = history.filter(h => {
        const matchesUser = isUserMatch(null, h.created_by, user);
        const matchesAssignedLead = targetDate ? userLeadIds.has(h.lead_id) : true;
        return matchesUser || matchesAssignedLead;
      });

      let connected = 0;
      let notConnected = 0;
      let converted = 0;
      let pendingFollowUps = 0;
      let overdueTasks = 0;
      let tasksCompleted = 0;
      let followUpsCompleted = 0;
      let newAssignedLeads = 0;
      let followUpCallsDone = 0;

      userLeads.forEach(l => {
        const st = getLeadCallStatus(l, userHistory, filter);
        if (st === 'connected') connected++;
        else if (st === 'not_connected') notConnected++;

        const isWorkedOn = isLeadWorkedInPeriod(l, userHistory, filter);

        if (isDateInFilter(l.created_at, filter)) {
          newAssignedLeads++;
        }

        if (l.lead_status === 'Deal Done') {
          converted++;
        } else if (l.lead_status === 'Follow Up') {
          if (!isWorkedOn) {
            pendingFollowUps++;
            if (l.follow_up_date && l.follow_up_date < todayStr) {
              overdueTasks++;
            }
          }
        }

        if (isWorkedOn) {
          tasksCompleted++;
          if (l.follow_up_date) {
            followUpsCompleted++;
          }
          if (st !== 'not_called' && l.follow_up_date && l.follow_up_date <= (isDateRange ? (endDate || targetDate) : targetDate)) {
            followUpCallsDone++;
          }
        }
      });

      const callsCompleted = connected + notConnected;
      const leadsHandled = userLeads.length;
      const conversionRate = leadsHandled > 0 ? (converted / leadsHandled) * 100 : 0;

      // Transparent Score Calculation (out of 100)
      // 1. Call activity benchmark: 40% weight
      const callScore = Math.min(100, Math.round((connected / Math.max(1, 30)) * 100));
      // 2. Conversion rate benchmark (target ~10%): 35% weight
      const convScore = Math.min(100, Math.round((conversionRate / 10) * 100));
      // 3. Follow-up clearance & overdue penalty: 25% weight
      const totalFollowUps = followUpsCompleted + overdueTasks;
      const clearanceScore = totalFollowUps > 0
        ? Math.max(0, Math.round(((followUpsCompleted) / totalFollowUps) * 100))
        : 100;

      const overallScore = Math.min(100, Math.max(0, Math.round(callScore * 0.40 + convScore * 0.35 + clearanceScore * 0.25)));

      let performanceRating: 'high' | 'average' | 'needs_improvement' = 'average';
      if (overallScore >= 75) performanceRating = 'high';
      else if (overallScore < 45) performanceRating = 'needs_improvement';

      return {
        name: user,
        callsCompleted,
        connectedCalls: connected,
        notConnectedCalls: notConnected,
        leadsHandled,
        followUpsCompleted,
        pendingFollowUps,
        leadsConverted: converted,
        conversionRate,
        tasksCompleted,
        overdueTasks,
        overallScore,
        performanceRating,
        newAssignedLeads,
        followUpCallsDone,
      };
    });

    // Rank list by overallScore descending
    const sorted = [...list].sort((a, b) => b.overallScore - a.overallScore);
    return sorted.map((item, idx) => ({ ...item, rank: idx + 1 }));
  }, [displayedUsers, leads, history, matchesFilterRange, targetDate, todayStr, isDateRange, startDate, endDate]);

  // Sorted and Paginated Members for table
  const sortedMembers = useMemo(() => {
    return [...memberPerformanceList].sort((a, b) => {
      const valA = a[sortField];
      const valB = b[sortField];
      if (typeof valA === 'string' && typeof valB === 'string') {
        return sortAsc ? valA.localeCompare(valB) : valB.localeCompare(valA);
      }
      return sortAsc ? Number(valA) - Number(valB) : Number(valB) - Number(valA);
    });
  }, [memberPerformanceList, sortField, sortAsc]);

  const paginatedMembers = useMemo(() => {
    const start = (memberPage - 1) * membersPerPage;
    return sortedMembers.slice(start, start + membersPerPage);
  }, [sortedMembers, memberPage]);

  const totalMemberPages = Math.ceil(sortedMembers.length / membersPerPage) || 1;

  // Chart Data: Member comparison
  const memberComparisonChartData = useMemo(() => {
    return memberPerformanceList.map(m => ({
      name: m.name.split(' ')[0],
      "Calls Completed": m.callsCompleted,
      "Connected": m.connectedCalls,
      "Not Connected": m.notConnectedCalls,
      "Leads Handled": m.leadsHandled,
      "Converted": m.leadsConverted,
      "Score": m.overallScore,
    }));
  }, [memberPerformanceList]);

  // Chart Data: Status Funnel
  const statusFunnelData = useMemo(() => {
    const statusCounts: Record<string, number> = {};
    filteredLeads.forEach(l => {
      const st = l.lead_status || 'Select Option';
      statusCounts[st] = (statusCounts[st] || 0) + 1;
    });

    const colors: Record<string, string> = {
      "Deal Done": "#10b981",
      "Follow Up": "#f59e0b",
      "Master Class Follow": "#8b5cf6",
      "Dead": "#ef4444",
      "Select Option": "#94a3b8",
    };

    return Object.entries(statusCounts).map(([status, count]) => ({
      name: status,
      value: count,
      color: colors[status] || "#64748b",
    }));
  }, [filteredLeads]);

  // Chart Data: Daily Trend over the period
  const dailyTrendData = useMemo(() => {
    const daysMap: Record<string, { date: string; calls: number; connected: number; converted: number }> = {};

    // Get last 7 days or date range days
    const datesList: string[] = [];
    if (startDate && endDate) {
      let cur = new Date(startDate);
      const end = new Date(endDate);
      while (cur <= end && datesList.length < 14) {
        datesList.push(formatLocalDate(cur));
        cur.setDate(cur.getDate() + 1);
      }
    } else {
      for (let i = 6; i >= 0; i--) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        datesList.push(formatLocalDate(d));
      }
    }

    datesList.forEach(dStr => {
      daysMap[dStr] = { date: dStr.slice(5), calls: 0, connected: 0, converted: 0 };
    });

    filteredLeads.forEach(l => {
      const leadDate = formatLocalDateYMD(l.created_at || l.calling_date || l.admission_date);
      if (daysMap[leadDate]) {
        const st = getLeadCallStatus(l, filteredHistory, { targetDate: leadDate });
        daysMap[leadDate].calls += st !== 'not_called' ? 1 : 0;
        if (st === 'connected') daysMap[leadDate].connected += 1;
        if (l.lead_status === 'Deal Done') daysMap[leadDate].converted += 1;
      }
    });

    return Object.values(daysMap);
  }, [filteredLeads, filteredHistory, startDate, endDate]);

  // Target & Deficit Ledgers (Existing logic preserved)
  const targetLedgers = useMemo(() => {
    return calculateCallTargetLedgers(
      filteredHistory,
      leads,
      displayedUsers,
      isDateRange ? startDate : targetDate,
      isDateRange ? endDate : targetDate
    );
  }, [filteredHistory, leads, displayedUsers, isDateRange, startDate, endDate, targetDate]);

  // Actionable Insights Calculation
  const actionableInsights = useMemo(() => {
    const insights: Array<{ type: 'top' | 'warning' | 'alert' | 'coaching' | 'opportunity'; title: string; desc: string }> = [];

    // Top Performer
    const topPerformer = memberPerformanceList[0];
    if (topPerformer && topPerformer.overallScore > 0) {
      insights.push({
        type: 'top',
        title: `🏆 Top Performer: ${topPerformer.name}`,
        desc: `${topPerformer.name} leads the canvas with an overall score of ${topPerformer.overallScore}% and ${topPerformer.leadsConverted} successful deal(s) (${topPerformer.conversionRate.toFixed(1)}% conversion).`,
      });
    }

    // Overdue Tasks Alert
    if (teamMetrics.overdueTasks > 0) {
      insights.push({
        type: 'alert',
        title: `🚨 ${teamMetrics.overdueTasks} Overdue Follow-up Task(s)`,
        desc: `Action required: ${teamMetrics.overdueTasks} scheduled follow-ups have passed their due date without a logged call. Immediate follow-up recommended to prevent lead cold-off.`,
      });
    }

    // Conversion Opportunity / Coaching
    const needsCoaching = memberPerformanceList.find(m => m.callsCompleted >= 30 && m.conversionRate < 5);
    if (needsCoaching) {
      insights.push({
        type: 'coaching',
        title: `💡 Coaching Opportunity: ${needsCoaching.name}`,
        desc: `${needsCoaching.name} has solid call volume (${needsCoaching.callsCompleted} calls) but conversion rate is at ${needsCoaching.conversionRate.toFixed(1)}%. Closing-script review or masterclass follow-up training could boost revenue.`,
      });
    }

    // High Unconnected Ratio Alert
    if (teamMetrics.totalCalls > 0 && (teamMetrics.totalNotConnected / teamMetrics.totalCalls) > 0.6) {
      insights.push({
        type: 'warning',
        title: `⚠️ High Unreachable Call Ratio (${Math.round((teamMetrics.totalNotConnected / teamMetrics.totalCalls) * 100)}%)`,
        desc: `Over 60% of attempted calls were busy, switched off, or unanswered. Consider shifting outreach time windows to 11 AM - 1 PM or 5 PM - 7 PM for better connectivity.`,
      });
    }

    // Deficit payback highlight
    const deficitUser = Object.values(targetLedgers).find(l => l.totalOutstandingDeficit > 0);
    if (deficitUser) {
      insights.push({
        type: 'opportunity',
        title: `📈 Target Recovery: ${deficitUser.userName}`,
        desc: `${deficitUser.userName} has ${deficitUser.totalOutstandingDeficit} deficit call(s) remaining for the 60-call daily target. Surplus calls from upcoming sessions will auto-adjust this balance.`,
      });
    }

    return insights;
  }, [memberPerformanceList, teamMetrics, targetLedgers]);

  const getTeamReportText = () => {
    const reportDate = isDateRange ? `${startDate} to ${endDate}` : (dailyDate || targetDate || formatLocalDate(new Date()));
    const topPerformer = memberPerformanceList[0];
    const teamOverviewSentence = generateTeamOverviewSentence({
      callsDone: teamMetrics.totalCalls,
      connectedCalls: teamMetrics.totalConnected,
      dealsConverted: teamMetrics.converted,
      pendingFollowups: teamMetrics.pendingFollowUps,
      overdueTasks: teamMetrics.overdueTasks,
      topPerformerName: topPerformer?.name || '',
    });

    let text = `📊 *SNEH YOGA CRM — TEAM DAILY PERFORMANCE REPORT*\n`;
    text += `📅 *Date*: ${reportDate}\n`;
    text += `👥 *Total Active Telecallers*: ${displayedUsers.length}\n\n`;
    text += `━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
    text += `📈 *DAILY TEAM TOTALS*\n`;
    text += `• 🎯 *Total Target Calls*: ${displayedUsers.length * 60}\n`;
    text += `• 📥 *Today New Assigned Leads*: ${teamMetrics.newAssignedLeads}\n`;
    text += `• 📞 *Total Calls Done*: ${teamMetrics.totalCalls}\n`;
    text += `    ↳ ✅ Connected Calls: ${teamMetrics.totalConnected}\n`;
    text += `    ↳ ❌ Not Connected Calls: ${teamMetrics.totalNotConnected}\n`;
    text += `• 🔄 *Follow-up Calls Done*: ${teamMetrics.followUpCallsDone}\n`;
    text += `• ⏳ *Pending Follow-ups*: ${teamMetrics.pendingFollowUps}\n`;
    text += `• 💰 *Deals Converted*: ${teamMetrics.converted} (${teamMetrics.conversionRate.toFixed(1)}%)\n`;
    text += `• 📋 *Tasks Completed*: ${teamMetrics.tasksCompleted}\n\n`;
    text += `━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
    text += `🏆 *TELECALLER BREAKDOWN*\n`;
    memberPerformanceList.forEach(m => {
      const userSentence = generateUserOverviewSentence({
        name: m.name,
        callsDone: m.callsCompleted,
        connectedCalls: m.connectedCalls,
        followupCallsDone: m.followUpCallsDone || 0,
        pendingFollowups: m.pendingFollowUps,
        overdueTasks: m.overdueTasks,
        dealsConverted: m.leadsConverted,
        overallScore: m.overallScore,
        newAssignedLeads: m.newAssignedLeads || 0,
      });
      text += `👤 *${m.name}* (Rank #${m.rank} | Score: ${m.overallScore}/100):\n`;
      text += `   • Calls Done: ${m.callsCompleted} (${m.connectedCalls} Connected, ${m.notConnectedCalls} Not Connected)\n`;
      text += `   • New Leads Assigned: ${m.newAssignedLeads || 0}\n`;
      text += `   • Follow-up Calls Done: ${m.followUpCallsDone || 0} (Pending: ${m.pendingFollowUps})\n`;
      text += `   • Deals Converted: ${m.leadsConverted}\n`;
      text += `   • Overview: ${userSentence}\n\n`;
    });
    text += `━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
    text += `📝 *TODAY'S TEAM OVERVIEW*\n`;
    text += `${teamOverviewSentence}\n`;
    return text;
  };

  const getUserReportText = (user: MemberPerformance) => {
    const reportDate = isDateRange ? `${startDate} to ${endDate}` : (dailyDate || targetDate || formatLocalDate(new Date()));
    const ledger = targetLedgers[user.name];
    const userSentence = generateUserOverviewSentence({
      name: user.name,
      callsDone: user.callsCompleted,
      connectedCalls: user.connectedCalls,
      followupCallsDone: user.followUpCallsDone || 0,
      pendingFollowups: user.pendingFollowUps,
      overdueTasks: user.overdueTasks,
      dealsConverted: user.leadsConverted,
      overallScore: user.overallScore,
      newAssignedLeads: user.newAssignedLeads || 0,
    });

    let text = `👤 *SNEH YOGA CRM — TELECALLER DAILY REPORT*\n`;
    text += `📅 *Date*: ${reportDate}\n`;
    text += `👤 *Telecaller*: ${user.name}\n`;
    text += `🏆 *Team Rank*: #${user.rank} | *Score*: ${user.overallScore}/100 (${user.performanceRating.toUpperCase()})\n\n`;
    text += `━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
    text += `📊 *TODAY'S CALL ACTIVITY*\n`;
    text += `• 🎯 *Daily Call Target*: 60 Connected Calls\n`;
    text += `• 📥 *Today New Assigned Leads*: ${user.newAssignedLeads || 0}\n`;
    text += `• 📞 *Total Calls Done*: ${user.callsCompleted}\n`;
    text += `    ↳ ✅ Connected Calls: ${user.connectedCalls}\n`;
    text += `    ↳ ❌ Not Connected Calls: ${user.notConnectedCalls}\n`;
    text += `• 🔄 *Follow-up Calls Done*: ${user.followUpCallsDone || 0}\n`;
    text += `• ⏳ *Pending Follow-ups*: ${user.pendingFollowUps}\n`;
    text += `• ⚠️ *Overdue Tasks*: ${user.overdueTasks}\n`;
    text += `• 💰 *Deals Converted*: ${user.leadsConverted} (${user.conversionRate.toFixed(1)}%)\n`;
    if (ledger) {
      text += `• 🏦 *Surplus Bank*: ${ledger.surplusBankBalance > 0 ? `+${ledger.surplusBankBalance}` : '0'} Calls | *Outstanding Deficit*: ${ledger.totalOutstandingDeficit > 0 ? `-${ledger.totalOutstandingDeficit}` : '0'}\n`;
    }
    text += `\n━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
    text += `💬 *TODAY'S REPORT OVERVIEW*\n`;
    text += `${userSentence}\n`;
    return text;
  };

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5 flex-wrap">
            <div className="p-2.5 bg-[#2e5a44]/10 rounded-xl text-[#2e5a44]">
              <BarChart3 className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-2xl font-black text-gray-900 tracking-tight flex items-center gap-2">
                Team Performance Canvas
                <Badge variant="outline" className="text-xs font-bold border-emerald-300 bg-emerald-50 text-emerald-800">
                  Live Analytics
                </Badge>
              </h1>
              <p className="text-sm text-gray-500 mt-0.5">
                Executive dashboard for manager oversight, individual KPIs, calling targets, and lead conversion trends.
              </p>
            </div>
          </div>
        </div>

        {/* Global Refresh & Status */}
        <div className="flex items-center gap-2">
          <Button
            onClick={() => {
              setReportCopied(false);
              setDailyReportOpen(true);
            }}
            className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold shadow-sm text-xs"
          >
            <FileText className="w-4 h-4 mr-2" />
            Daily Report Generator
          </Button>

          <Button
            onClick={fetchData}
            disabled={loading}
            className="bg-[#2e5a44] hover:bg-[#203f2f] text-white font-bold shadow-sm text-xs"
          >
            <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Refresh Canvas
          </Button>
        </div>
      </div>

      {/* Filter Control Bar */}
      <Card className="border-none shadow-sm bg-white">
        <CardContent className="pt-6">
          <div className="space-y-4">
            {/* Quick Date Presets */}
            <div className="flex flex-wrap items-center gap-2 pb-3 border-b border-gray-100">
              <span className="text-xs font-bold text-gray-500 uppercase tracking-wider flex items-center gap-1.5 mr-2">
                <Calendar className="w-3.5 h-3.5 text-gray-400" /> Presets:
              </span>
              <Button
                variant={datePreset === 'today' ? 'default' : 'outline'}
                size="sm"
                className={`text-xs font-semibold rounded-full h-8 ${datePreset === 'today' ? 'bg-[#2e5a44] text-white hover:bg-[#203f2f]' : 'text-gray-700'}`}
                onClick={() => applyDatePreset('today')}
              >
                Today
              </Button>
              <Button
                variant={datePreset === 'this_week' ? 'default' : 'outline'}
                size="sm"
                className={`text-xs font-semibold rounded-full h-8 ${datePreset === 'this_week' ? 'bg-[#2e5a44] text-white hover:bg-[#203f2f]' : 'text-gray-700'}`}
                onClick={() => applyDatePreset('this_week')}
              >
                This Week
              </Button>
              <Button
                variant={datePreset === 'last_week' ? 'default' : 'outline'}
                size="sm"
                className={`text-xs font-semibold rounded-full h-8 ${datePreset === 'last_week' ? 'bg-[#2e5a44] text-white hover:bg-[#203f2f]' : 'text-gray-700'}`}
                onClick={() => applyDatePreset('last_week')}
              >
                Last Week
              </Button>
              <Button
                variant={datePreset === 'this_month' ? 'default' : 'outline'}
                size="sm"
                className={`text-xs font-semibold rounded-full h-8 ${datePreset === 'this_month' ? 'bg-[#2e5a44] text-white hover:bg-[#203f2f]' : 'text-gray-700'}`}
                onClick={() => applyDatePreset('this_month')}
              >
                This Month
              </Button>
              <Button
                variant={datePreset === 'custom' ? 'default' : 'outline'}
                size="sm"
                className={`text-xs font-semibold rounded-full h-8 ${datePreset === 'custom' ? 'bg-[#2e5a44] text-white hover:bg-[#203f2f]' : 'text-gray-700'}`}
                onClick={() => setDatePreset('custom')}
              >
                Custom Range
              </Button>

              <div className="ml-auto text-xs text-gray-500 font-medium">
                Active: <span className="font-bold text-gray-800">{isDateRange ? `${startDate} to ${endDate}` : targetDate}</span>
              </div>
            </div>

            {/* Detailed Filters Form */}
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-3 items-end">
              <div>
                <label className="text-xs font-bold text-gray-600 mb-1 block">Start Date</label>
                <Input
                  type="date"
                  value={startDate}
                  onChange={e => {
                    setStartDate(e.target.value);
                    setDailyDate("");
                    setDatePreset('custom');
                  }}
                  className="h-9 text-xs"
                />
              </div>
              <div>
                <label className="text-xs font-bold text-gray-600 mb-1 block">End Date</label>
                <Input
                  type="date"
                  value={endDate}
                  onChange={e => {
                    setEndDate(e.target.value);
                    setDailyDate("");
                    setDatePreset('custom');
                  }}
                  className="h-9 text-xs"
                />
              </div>

              {!isRestrictedStaff && (
                <div>
                  <label className="text-xs font-bold text-gray-600 mb-1 block">Team Member</label>
                  <Select value={selectedMember} onValueChange={setSelectedMember}>
                    <SelectTrigger className="h-9 text-xs">
                      <SelectValue placeholder="All Members" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Members</SelectItem>
                      {ASSIGNED_USERS.map(u => <SelectItem key={u} value={u}>{u}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              )}

              <div>
                <label className="text-xs font-bold text-gray-600 mb-1 block">Lead Status</label>
                <Select value={selectedStatus} onValueChange={setSelectedStatus}>
                  <SelectTrigger className="h-9 text-xs">
                    <SelectValue placeholder="All Statuses" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Statuses</SelectItem>
                    {LEAD_STATUSES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Button
                  onClick={fetchData}
                  disabled={loading}
                  className="w-full h-9 bg-gray-900 hover:bg-black text-white font-bold text-xs shadow-xs"
                >
                  <SlidersHorizontal className="w-3.5 h-3.5 mr-1.5" /> Apply Filters
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Tabs Navigation */}
      <Tabs value={activeTab} onValueChange={(val: any) => setActiveTab(val)} className="space-y-6">
        <TabsList className="bg-white p-1 rounded-xl shadow-xs border border-gray-100 w-full sm:w-auto flex flex-wrap h-auto">
          <TabsTrigger value="overview" className="text-xs font-bold data-[state=active]:bg-[#2e5a44] data-[state=active]:text-white">
            <BarChart3 className="w-3.5 h-3.5 mr-1.5" /> Team Overview
          </TabsTrigger>
          <TabsTrigger value="members" className="text-xs font-bold data-[state=active]:bg-[#2e5a44] data-[state=active]:text-white">
            <Users className="w-3.5 h-3.5 mr-1.5" /> Member Leaderboard
          </TabsTrigger>
          <TabsTrigger value="trends" className="text-xs font-bold data-[state=active]:bg-[#2e5a44] data-[state=active]:text-white">
            <TrendingUp className="w-3.5 h-3.5 mr-1.5" /> Weekly & Daily Trends
          </TabsTrigger>
          <TabsTrigger value="ledger" className="text-xs font-bold data-[state=active]:bg-[#2e5a44] data-[state=active]:text-white">
            <Award className="w-3.5 h-3.5 mr-1.5" /> 60-Call Daily Target Ledger
          </TabsTrigger>
        </TabsList>

        {/* TAB 1: TEAM OVERVIEW */}
        <TabsContent value="overview" className="space-y-6">
          {/* Summary Cards Grid (8 Core Manager Metrics) */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <MetricCard
              title="Calls Completed"
              subtitle={`Connected: ${teamMetrics.totalConnected} | Not Connected: ${teamMetrics.totalNotConnected}`}
              value={teamMetrics.totalCalls}
              icon={<PhoneCall size={20} />}
              color="indigo"
              badge="Total Attempted"
            />
            <MetricCard
              title="Leads Assigned"
              subtitle="Total leads in filtered scope"
              value={teamMetrics.totalLeads}
              icon={<Users size={20} />}
              color="blue"
              badge="Active Leads"
            />
            <MetricCard
              title="Follow-ups Completed"
              subtitle="Outreach actions logged"
              value={teamMetrics.followUpsCompleted}
              icon={<PhoneForwarded size={20} />}
              color="emerald"
              badge="Clearance"
            />
            <MetricCard
              title="Pending Follow-ups"
              subtitle="Awaiting scheduled follow-up"
              value={teamMetrics.pendingFollowUps}
              icon={<Clock size={20} />}
              color="amber"
              badge="Scheduled"
            />
            <MetricCard
              title="Leads Converted"
              subtitle="Closed deals (Deal Done)"
              value={teamMetrics.converted}
              icon={<CheckCircle size={20} />}
              color="green"
              badge="Deal Done"
            />
            <MetricCard
              title="Conversion Rate"
              subtitle="Deals / Total Leads Assigned"
              value={`${teamMetrics.conversionRate.toFixed(1)}%`}
              icon={<TrendingUp size={20} />}
              color="purple"
              badge="Efficiency"
            />
            <MetricCard
              title="Tasks Completed"
              subtitle="Scheduled calls & notes finished"
              value={teamMetrics.tasksCompleted}
              icon={<CheckCheck size={20} />}
              color="teal"
              badge="Operational Tasks"
            />
            <MetricCard
              title="Overdue Tasks"
              subtitle="Follow-ups past scheduled date"
              value={teamMetrics.overdueTasks}
              icon={<AlertTriangle size={20} />}
              color={teamMetrics.overdueTasks > 0 ? "red" : "gray"}
              badge={teamMetrics.overdueTasks > 0 ? "Immediate Action" : "Clear"}
            />
          </div>

          {/* Actionable Insights Panel */}
          {actionableInsights.length > 0 && (
            <Card className="border-none shadow-sm bg-gradient-to-r from-emerald-50/50 via-white to-amber-50/40 border border-emerald-100">
              <CardHeader className="pb-3">
                <CardTitle className="text-base font-bold text-gray-900 flex items-center gap-2">
                  <Sparkles className="w-5 h-5 text-amber-600" /> Actionable Management Insights
                </CardTitle>
                <CardDescription className="text-xs">
                  Automated performance observations derived from live call connectivity, conversion rates, and task clearance.
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {actionableInsights.map((insight, idx) => (
                    <div
                      key={idx}
                      className={`p-3.5 rounded-xl border text-xs space-y-1 transition-all ${
                        insight.type === 'top'
                          ? 'bg-emerald-50/80 border-emerald-200 text-emerald-950'
                          : insight.type === 'alert'
                          ? 'bg-red-50/80 border-red-200 text-red-950'
                          : insight.type === 'coaching'
                          ? 'bg-blue-50/80 border-blue-200 text-blue-950'
                          : insight.type === 'warning'
                          ? 'bg-amber-50/80 border-amber-200 text-amber-950'
                          : 'bg-indigo-50/80 border-indigo-200 text-indigo-950'
                      }`}
                    >
                      <h4 className="font-bold text-sm">{insight.title}</h4>
                      <p className="leading-relaxed opacity-90">{insight.desc}</p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Individual Performance Cards Overview */}
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <h3 className="font-bold text-lg text-gray-900 flex items-center gap-2">
                <Trophy className="w-5 h-5 text-amber-600" /> Team Performance Snapshot
              </h3>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setActiveTab('members')}
                className="text-xs font-bold text-[#2e5a44] hover:text-[#203f2f]"
              >
                View Full Leaderboard & Table →
              </Button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {memberPerformanceList.map((m) => (
                <div
                  key={m.name}
                  className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm hover:shadow-md transition-all flex flex-col justify-between"
                >
                  <div>
                    {/* Header with Rank & Rating */}
                    <div className="flex justify-between items-start mb-3">
                      <div className="flex items-center gap-2.5">
                        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#2e5a44] to-[#1c3a2b] text-white flex items-center justify-center font-bold text-sm shadow-xs">
                          {m.name.split(' ').map(n => n[0]).join('')}
                        </div>
                        <div>
                          <h4 className="font-bold text-gray-900 text-base">{m.name}</h4>
                          <span className="text-xs text-gray-400">Rank #{m.rank} in Team</span>
                        </div>
                      </div>

                      <RatingBadge rating={m.performanceRating} score={m.overallScore} />
                    </div>

                    {/* Overall Score Progress Bar */}
                    <div className="space-y-1.5 mb-4">
                      <div className="flex justify-between text-xs font-bold">
                        <span className="text-gray-500">Performance Score</span>
                        <span className="text-gray-900">{m.overallScore} / 100</span>
                      </div>
                      <Progress
                        value={m.overallScore}
                        className={`h-2 ${
                          m.performanceRating === 'high'
                            ? '[&>div]:bg-emerald-600'
                            : m.performanceRating === 'average'
                            ? '[&>div]:bg-amber-500'
                            : '[&>div]:bg-red-500'
                        }`}
                      />
                    </div>

                    {/* 4 Key Metrics Grid */}
                    <div className="grid grid-cols-2 gap-2 text-xs mb-3">
                      <div className="bg-gray-50 p-2.5 rounded-xl border border-gray-100">
                        <span className="text-gray-400 text-[10px] uppercase font-bold block">Calls Done</span>
                        <span className="font-extrabold text-gray-800 text-base">{m.callsCompleted}</span>
                        <span className="text-[10px] text-emerald-600 block">{m.connectedCalls} Connected</span>
                      </div>
                      <div className="bg-gray-50 p-2.5 rounded-xl border border-gray-100">
                        <span className="text-gray-400 text-[10px] uppercase font-bold block">Leads Handled</span>
                        <span className="font-extrabold text-gray-800 text-base">{m.leadsHandled}</span>
                        <span className="text-[10px] text-blue-600 block">{m.pendingFollowUps} Pending</span>
                      </div>
                      <div className="bg-gray-50 p-2.5 rounded-xl border border-gray-100">
                        <span className="text-gray-400 text-[10px] uppercase font-bold block">Conversions</span>
                        <span className="font-extrabold text-emerald-700 text-base">{m.leadsConverted}</span>
                        <span className="text-[10px] text-gray-500 block">{m.conversionRate.toFixed(1)}% Rate</span>
                      </div>
                      <div className="bg-gray-50 p-2.5 rounded-xl border border-gray-100">
                        <span className="text-gray-400 text-[10px] uppercase font-bold block">Overdue Tasks</span>
                        <span className={`font-extrabold text-base ${m.overdueTasks > 0 ? 'text-red-600' : 'text-gray-800'}`}>
                          {m.overdueTasks}
                        </span>
                        <span className="text-[10px] text-gray-500 block">{m.tasksCompleted} Done</span>
                      </div>
                    </div>
                  </div>

                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setSelectedMember(m.name);
                      setActiveTab('trends');
                    }}
                    className="w-full text-xs font-semibold text-[#2e5a44] border-[#2e5a44]/30 hover:bg-[#2e5a44]/10 mt-2"
                  >
                    View Member Analytics →
                  </Button>
                </div>
              ))}
            </div>
          </div>
        </TabsContent>

        {/* TAB 2: INDIVIDUAL MEMBER LEADERBOARD & COMPARISONS */}
        <TabsContent value="members" className="space-y-6">
          <Card className="border-none shadow-sm bg-white overflow-hidden">
            <CardHeader className="pb-3 border-b border-gray-100 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <CardTitle className="text-lg font-bold text-gray-900 flex items-center gap-2">
                  <Users className="w-5 h-5 text-[#2e5a44]" /> Team Member Performance Table
                </CardTitle>
                <CardDescription className="text-xs">
                  Compare team productivity, call volumes, conversion rates, and task clearance with transparent scoring.
                </CardDescription>
              </div>

              {/* Sorting Indicator */}
              <div className="text-xs text-gray-500 flex items-center gap-2">
                <span>Sort by:</span>
                <Select
                  value={sortField}
                  onValueChange={(val: any) => {
                    setSortField(val);
                  }}
                >
                  <SelectTrigger className="h-8 text-xs w-[180px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="overallScore">Overall Score</SelectItem>
                    <SelectItem value="callsCompleted">Calls Completed</SelectItem>
                    <SelectItem value="leadsConverted">Leads Converted</SelectItem>
                    <SelectItem value="conversionRate">Conversion Rate</SelectItem>
                    <SelectItem value="leadsHandled">Leads Handled</SelectItem>
                    <SelectItem value="overdueTasks">Overdue Tasks</SelectItem>
                  </SelectContent>
                </Select>
                <Button
                  variant="outline"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => setSortAsc(!sortAsc)}
                  title={sortAsc ? "Ascending" : "Descending"}
                >
                  <ArrowUpDown className="w-3.5 h-3.5 text-gray-600" />
                </Button>
              </div>
            </CardHeader>

            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left">
                  <thead className="bg-gray-50/80 font-bold text-gray-600 uppercase border-b border-gray-100 tracking-wider">
                    <tr>
                      <th className="p-3.5 text-center">Rank</th>
                      <th className="p-3.5">Team Member</th>
                      <th className="p-3.5 text-center">Score</th>
                      <th className="p-3.5 text-center">Rating</th>
                      <th className="p-3.5 text-center">Calls Done</th>
                      <th className="p-3.5 text-center">Connected</th>
                      <th className="p-3.5 text-center">Leads Handled</th>
                      <th className="p-3.5 text-center">Follow-ups Done</th>
                      <th className="p-3.5 text-center">Pending Follow-ups</th>
                      <th className="p-3.5 text-center">Deals Closed</th>
                      <th className="p-3.5 text-center">Conversion %</th>
                      <th className="p-3.5 text-center">Overdue Tasks</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {paginatedMembers.map((m) => (
                      <tr key={m.name} className="hover:bg-gray-50/80 transition-colors">
                        <td className="p-3 text-center font-bold text-gray-700">
                          {m.rank === 1 ? '🥇 1' : m.rank === 2 ? '🥈 2' : m.rank === 3 ? '🥉 3' : `#${m.rank}`}
                        </td>
                        <td className="p-3 font-bold text-gray-900 flex items-center gap-2">
                          <div className="w-7 h-7 rounded-lg bg-emerald-100 text-emerald-800 flex items-center justify-center font-bold text-xs">
                            {m.name[0]}
                          </div>
                          <span>{m.name}</span>
                        </td>
                        <td className="p-3 text-center">
                          <span className="font-extrabold text-sm text-gray-900">{m.overallScore}</span>
                          <span className="text-[10px] text-gray-400 block">/ 100</span>
                        </td>
                        <td className="p-3 text-center">
                          <RatingBadge rating={m.performanceRating} score={m.overallScore} />
                        </td>
                        <td className="p-3 text-center font-bold text-indigo-700">{m.callsCompleted}</td>
                        <td className="p-3 text-center font-bold text-emerald-700">{m.connectedCalls}</td>
                        <td className="p-3 text-center font-medium text-gray-700">{m.leadsHandled}</td>
                        <td className="p-3 text-center font-semibold text-blue-700">{m.followUpsCompleted}</td>
                        <td className="p-3 text-center font-semibold text-amber-700">{m.pendingFollowUps}</td>
                        <td className="p-3 text-center font-bold text-emerald-700">{m.leadsConverted}</td>
                        <td className="p-3 text-center font-extrabold text-purple-700">
                          {m.conversionRate.toFixed(1)}%
                        </td>
                        <td className="p-3 text-center">
                          {m.overdueTasks > 0 ? (
                            <span className="px-2 py-0.5 rounded-full bg-red-100 text-red-800 font-bold text-[10px]">
                              {m.overdueTasks} Overdue
                            </span>
                          ) : (
                            <span className="text-gray-400">0</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              <div className="flex items-center justify-between p-3 border-t border-gray-100 bg-gray-50/50">
                <span className="text-xs text-gray-500 font-medium">
                  Showing {paginatedMembers.length} of {sortedMembers.length} team members
                </span>
                <div className="flex items-center gap-1">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={memberPage <= 1}
                    onClick={() => setMemberPage(p => Math.max(1, p - 1))}
                    className="h-8 text-xs"
                  >
                    <ChevronLeft className="w-3.5 h-3.5 mr-1" /> Previous
                  </Button>
                  <span className="text-xs font-bold text-gray-700 px-2">
                    {memberPage} / {totalMemberPages}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={memberPage >= totalMemberPages}
                    onClick={() => setMemberPage(p => Math.min(totalMemberPages, p + 1))}
                    className="h-8 text-xs"
                  >
                    Next <ChevronRight className="w-3.5 h-3.5 ml-1" />
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Performance Criteria Info Card */}
          <Card className="border border-blue-100 bg-blue-50/30 shadow-none">
            <CardContent className="p-4 flex items-start gap-3 text-xs text-blue-900">
              <Info className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
              <div>
                <h4 className="font-bold text-sm">Transparent Scoring & Rating Criteria</h4>
                <p className="mt-1 leading-relaxed opacity-90">
                  Performance Scores are calculated using a weighted composite formula:
                  <span className="font-semibold"> 40% Call Activity</span> (evaluated against daily targets),
                  <span className="font-semibold"> 35% Conversion Efficiency</span> (benchmarked against expected lead close rate), and
                  <span className="font-semibold"> 25% Task & Follow-up Clearance</span> (scheduled follow-ups contacted on time without backlog).
                  Ratings: <strong>High (≥75)</strong>, <strong>Average (45–74)</strong>, <strong>Needs Improvement (&lt;45)</strong>.
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* TAB 3: WEEKLY & DAILY TRENDS (CHARTS) */}
        <TabsContent value="trends" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Chart 1: Member Comparison Bar Chart */}
            <Card className="border-none shadow-sm bg-white">
              <CardHeader className="pb-2">
                <CardTitle className="text-base font-bold text-gray-900 flex items-center gap-2">
                  <BarChart3 className="w-4 h-4 text-[#2e5a44]" /> Calls & Conversion by Team Member
                </CardTitle>
                <CardDescription className="text-xs">
                  Side-by-side comparison of calls completed vs leads converted.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-[280px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={memberComparisonChartData} margin={{ top: 15, right: 20, left: -10, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                      <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 11, fontWeight: 600 }} />
                      <YAxis axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 11 }} />
                      <RechartsTooltip contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 8px 20px -4px rgb(0 0 0 / 0.1)' }} />
                      <Legend iconType="circle" wrapperStyle={{ paddingTop: '10px', fontSize: '12px' }} />
                      <Bar dataKey="Calls Completed" fill="#6366f1" radius={[4, 4, 0, 0]} barSize={16} />
                      <Bar dataKey="Connected" fill="#10b981" radius={[4, 4, 0, 0]} barSize={16} />
                      <Bar dataKey="Converted" fill="#f59e0b" radius={[4, 4, 0, 0]} barSize={16} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            {/* Chart 2: Daily Productivity Trend */}
            <Card className="border-none shadow-sm bg-white">
              <CardHeader className="pb-2">
                <CardTitle className="text-base font-bold text-gray-900 flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-emerald-600" /> Daily Productivity Trend
                </CardTitle>
                <CardDescription className="text-xs">
                  Day-by-day trajectory of attempted calls and closed deals.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-[280px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={dailyTrendData} margin={{ top: 15, right: 20, left: -10, bottom: 5 }}>
                      <defs>
                        <linearGradient id="colorCalls" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#6366f1" stopOpacity={0.4}/>
                          <stop offset="95%" stopColor="#6366f1" stopOpacity={0.0}/>
                        </linearGradient>
                        <linearGradient id="colorConn" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#10b981" stopOpacity={0.4}/>
                          <stop offset="95%" stopColor="#10b981" stopOpacity={0.0}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                      <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 11 }} />
                      <YAxis axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 11 }} />
                      <RechartsTooltip contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 8px 20px -4px rgb(0 0 0 / 0.1)' }} />
                      <Legend iconType="circle" wrapperStyle={{ paddingTop: '10px', fontSize: '12px' }} />
                      <Area type="monotone" dataKey="calls" name="Total Calls" stroke="#6366f1" strokeWidth={2} fillOpacity={1} fill="url(#colorCalls)" />
                      <Area type="monotone" dataKey="connected" name="Connected Calls" stroke="#10b981" strokeWidth={2} fillOpacity={1} fill="url(#colorConn)" />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            {/* Chart 3: Lead Status Breakdown (Funnel) */}
            <Card className="border-none shadow-sm bg-white">
              <CardHeader className="pb-2">
                <CardTitle className="text-base font-bold text-gray-900 flex items-center gap-2">
                  <PieChart className="w-4 h-4 text-purple-600" /> Active Lead Status Distribution
                </CardTitle>
                <CardDescription className="text-xs">
                  Proportion of leads by current status in the filtered pipeline.
                </CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col sm:flex-row items-center justify-around">
                <div className="h-[240px] w-[240px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={statusFunnelData}
                        cx="50%"
                        cy="50%"
                        innerRadius={55}
                        outerRadius={85}
                        paddingAngle={3}
                        dataKey="value"
                      >
                        {statusFunnelData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <RechartsTooltip />
                    </PieChart>
                  </ResponsiveContainer>
                </div>

                <div className="space-y-2 mt-4 sm:mt-0 text-xs">
                  {statusFunnelData.map(item => (
                    <div key={item.name} className="flex items-center gap-2">
                      <span className="w-3 h-3 rounded-full" style={{ backgroundColor: item.color }} />
                      <span className="font-medium text-gray-700">{item.name}:</span>
                      <span className="font-bold text-gray-900">{item.value}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Chart 4: Tasks Completed vs Overdue by Member */}
            <Card className="border-none shadow-sm bg-white">
              <CardHeader className="pb-2">
                <CardTitle className="text-base font-bold text-gray-900 flex items-center gap-2">
                  <ListTodo className="w-4 h-4 text-amber-600" /> Follow-up Tasks Completed vs Overdue
                </CardTitle>
                <CardDescription className="text-xs">
                  Evaluation of on-time follow-up actions and overdue scheduled calls.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-[240px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={memberPerformanceList.map(m => ({
                        name: m.name.split(' ')[0],
                        "Completed": m.tasksCompleted,
                        "Overdue": m.overdueTasks,
                      }))}
                      margin={{ top: 15, right: 20, left: -10, bottom: 5 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                      <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 11 }} />
                      <YAxis axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 11 }} />
                      <RechartsTooltip contentStyle={{ borderRadius: '12px', border: 'none' }} />
                      <Legend iconType="circle" wrapperStyle={{ paddingTop: '10px', fontSize: '12px' }} />
                      <Bar dataKey="Completed" fill="#10b981" radius={[4, 4, 0, 0]} barSize={20} />
                      <Bar dataKey="Overdue" fill="#ef4444" radius={[4, 4, 0, 0]} barSize={20} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* TAB 4: 60-CALL DAILY TARGET & DEFICIT LEDGER (PRESERVED) */}
        <TabsContent value="ledger" className="space-y-6">
          <Card className="border-none shadow-sm bg-gradient-to-br from-amber-50/40 via-white to-emerald-50/30 overflow-hidden border border-amber-100/60">
            <CardHeader className="pb-3 border-b border-gray-100 flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-lg font-bold text-gray-900 flex items-center gap-2">
                  <Award className="w-5 h-5 text-amber-600" /> Target Performance & Appreciation Ledger
                </CardTitle>
                <p className="text-xs text-gray-500 mt-1">
                  Daily Target: <span className="font-semibold text-gray-700">60 Connected Calls/Day</span>. Surplus connected calls automatically pay back past deficits.
                </p>
              </div>
              <span className="px-3 py-1 bg-amber-100 text-amber-800 text-xs font-bold rounded-full border border-amber-200">
                Target: 60 Connected Calls/Day
              </span>
            </CardHeader>
            <CardContent className="pt-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {displayedUsers.map(user => {
                  const ledger = targetLedgers[user];
                  if (!ledger) return null;

                  const isHighAppreciation = ledger.appreciationPercentage >= 80;
                  const hasDeficits = ledger.totalOutstandingDeficit > 0;

                  return (
                    <div key={user} className="bg-white rounded-xl p-4 border border-gray-100 shadow-sm hover:shadow-md transition-all">
                      <div className="flex justify-between items-start mb-3">
                        <div>
                          <h4 className="font-bold text-gray-900">{user}</h4>
                          <p className="text-xs text-gray-500">
                            {ledger.appreciationDaysEarned} / {ledger.totalActiveDays} Days Target Met
                          </p>
                        </div>
                        <div className={`px-2.5 py-1 rounded-full text-xs font-bold flex items-center gap-1 ${
                          isHighAppreciation
                            ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                            : 'bg-amber-100 text-amber-800 border border-amber-200'
                        }`}>
                          <Award className="w-3.5 h-3.5" />
                          {ledger.appreciationPercentage}% Score
                        </div>
                      </div>

                      {/* 4 Cells Grid */}
                      <div className="grid grid-cols-2 gap-2 text-xs mb-3">
                        <div className="bg-gray-50 p-2.5 rounded-lg border border-gray-100">
                          <span className="text-gray-500 block text-[10px] uppercase font-semibold">Call Assign</span>
                          <span className="font-extrabold text-gray-800 text-sm">{ledger.totalAssigned}</span>
                          <span className="text-gray-400 text-[10px] block">Target: 60</span>
                        </div>

                        <div className="bg-indigo-50/50 p-2.5 rounded-lg border border-indigo-100">
                          <span className="text-indigo-600 block text-[10px] uppercase font-semibold">Adjusted Calls</span>
                          <span className="font-extrabold text-indigo-700 text-sm flex items-center gap-1">
                            {ledger.totalAdjustedCalls}
                            {ledger.totalDeficitPaidBack > 0 && (
                              <span className="text-[9px] text-emerald-600 font-bold">(+{ledger.totalDeficitPaidBack})</span>
                            )}
                          </span>
                          <span className="text-indigo-400 text-[10px] block">Done: {ledger.totalCallsDone}</span>
                        </div>

                        <div className="bg-emerald-50/50 p-2.5 rounded-lg border border-emerald-100">
                          <span className="text-emerald-700 block text-[10px] uppercase font-semibold">Connected Call</span>
                          <span className="font-extrabold text-emerald-700 text-sm">{ledger.totalConnectedCalls}</span>
                          <span className="text-emerald-600 text-[10px] block">Target Basis</span>
                        </div>

                        <div className="bg-red-50/50 p-2.5 rounded-lg border border-red-100">
                          <span className="text-red-600 block text-[10px] uppercase font-semibold">Not Connected Call</span>
                          <span className="font-extrabold text-red-700 text-sm">{ledger.totalNotConnectedCalls}</span>
                          <span className="text-red-400 text-[10px] block">Unreachable</span>
                        </div>
                      </div>

                      {/* Outstanding Deficit */}
                      {hasDeficits ? (
                        <div className="flex items-center justify-between text-xs bg-red-50 text-red-700 p-2 rounded-lg border border-red-100 mb-2">
                          <span className="font-medium flex items-center gap-1">
                            <ArrowDownRight className="w-3.5 h-3.5 text-red-500" /> Outstanding Deficit
                          </span>
                          <span className="font-bold">-{ledger.totalOutstandingDeficit} Calls</span>
                        </div>
                      ) : (
                        <div className="flex items-center justify-between text-xs bg-emerald-50 text-emerald-700 p-2 rounded-lg border border-emerald-100 mb-2">
                          <span className="font-medium flex items-center gap-1">
                            <CheckCircle className="w-3.5 h-3.5 text-emerald-500" /> Deficits Fully Paid Back
                          </span>
                          <span className="font-bold">0 Pending</span>
                        </div>
                      )}

                      {/* Surplus Bank Balance */}
                      <div className={`flex items-center justify-between text-xs p-2 rounded-lg border mb-3 ${
                        ledger.surplusBankBalance > 0
                          ? 'bg-blue-50 text-blue-700 border-blue-100'
                          : 'bg-gray-50 text-gray-500 border-gray-100'
                      }`}>
                        <span className="font-medium flex items-center gap-1">
                          🏦 Surplus Bank Balance
                        </span>
                        <span className="font-bold">
                          {ledger.surplusBankBalance > 0 ? `+${ledger.surplusBankBalance}` : '0'} Calls
                        </span>
                      </div>

                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setSelectedLedgerUser(ledger)}
                        className="w-full text-xs font-semibold text-[#2e5a44] border-[#2e5a44]/30 hover:bg-[#2e5a44]/10"
                      >
                        View Daily Ledger Details
                      </Button>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Daily Target Ledger Inspection Dialog */}
      <Dialog open={!!selectedLedgerUser} onOpenChange={(open) => !open && setSelectedLedgerUser(null)}>
        <DialogContent className="max-w-4xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold flex items-center gap-2">
              <Award className="text-amber-600" /> Daily Target & Back-Adjustment Ledger: {selectedLedgerUser?.userName}
            </DialogTitle>
          </DialogHeader>

          {selectedLedgerUser && (
            <div className="space-y-4 pt-2">
              <div className="grid grid-cols-2 md:grid-cols-6 gap-2 bg-gray-50 p-4 rounded-xl text-center">
                <div>
                  <span className="text-[10px] text-gray-500 font-semibold block uppercase">Call Assign</span>
                  <span className="text-base font-bold text-gray-800">{selectedLedgerUser.totalAssigned}</span>
                </div>
                <div>
                  <span className="text-[10px] text-gray-500 font-semibold block uppercase">Calls Done</span>
                  <span className="text-base font-bold text-indigo-700">{selectedLedgerUser.totalCallsDone}</span>
                </div>
                <div>
                  <span className="text-[10px] text-gray-500 font-semibold block uppercase">Connected</span>
                  <span className="text-base font-bold text-emerald-700">{selectedLedgerUser.totalConnectedCalls}</span>
                </div>
                <div>
                  <span className="text-[10px] text-gray-500 font-semibold block uppercase">Not Connected</span>
                  <span className="text-base font-bold text-red-700">{selectedLedgerUser.totalNotConnectedCalls}</span>
                </div>
                <div>
                  <span className="text-[10px] text-gray-500 font-semibold block uppercase">Back-Adjusted</span>
                  <span className="text-base font-bold text-emerald-600">+{selectedLedgerUser.totalDeficitPaidBack}</span>
                </div>
                <div>
                  <span className="text-[10px] text-gray-500 font-semibold block uppercase">Appreciation Score</span>
                  <span className="text-base font-bold text-amber-700">{selectedLedgerUser.appreciationPercentage}%</span>
                </div>
              </div>

              <div className="border rounded-xl overflow-hidden">
                <table className="w-full text-xs text-left">
                  <thead className="bg-gray-100 font-semibold text-gray-700 uppercase border-b">
                    <tr>
                      <th className="p-3">Date</th>
                      <th className="p-3 text-center">Call Assign</th>
                      <th className="p-3 text-center">Calls Done</th>
                      <th className="p-3 text-center text-emerald-700">Connected</th>
                      <th className="p-3 text-center text-red-700">Not Connected</th>
                      <th className="p-3 text-center">Target</th>
                      <th className="p-3 text-center">Back-Adjusted</th>
                      <th className="p-3 text-center">Final Balance</th>
                      <th className="p-3 text-center">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {selectedLedgerUser.dailyEntries.map(entry => (
                      <tr key={entry.date} className="hover:bg-gray-50/80">
                        <td className="p-3 font-medium text-gray-800">{entry.date}</td>
                        <td className="p-3 text-center text-gray-700 font-medium">{entry.assigned}</td>
                        <td className="p-3 text-center font-semibold text-indigo-700">{entry.callsDone}</td>
                        <td className="p-3 text-center font-bold text-emerald-700">{entry.connectedCalls}</td>
                        <td className="p-3 text-center font-semibold text-red-600">{entry.notConnectedCalls}</td>
                        <td className="p-3 text-center text-gray-500">60</td>
                        <td className="p-3 text-center">
                          {entry.deficitPaidByFuture > 0 ? (
                            <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-bold">
                              +{entry.deficitPaidByFuture} Covered
                            </span>
                          ) : entry.surplusGivenToPast > 0 ? (
                            <span className="px-2 py-0.5 rounded-full bg-blue-100 text-blue-800 font-medium">
                              -{entry.surplusGivenToPast} Paid Back
                            </span>
                          ) : (
                            <span className="text-gray-400">—</span>
                          )}
                        </td>
                        <td className="p-3 text-center font-bold">
                          {entry.adjustedCalls} / 60
                        </td>
                        <td className="p-3 text-center">
                          {entry.connectedCalls >= 60 ? (
                            <span className="px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-800 font-bold text-[10px]">
                              Target Met (Direct)
                            </span>
                          ) : entry.isTargetMet ? (
                            <span className="px-2.5 py-1 rounded-full bg-indigo-100 text-indigo-800 font-bold text-[10px] flex items-center justify-center gap-1">
                              <RotateCcw className="w-3 h-3" /> Back-Adjusted
                            </span>
                          ) : (
                            <span className="px-2.5 py-1 rounded-full bg-red-100 text-red-800 font-bold text-[10px]">
                              Deficit (-{entry.unresolvedDeficit})
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* DAILY REPORT GENERATOR MODAL */}
      <Dialog open={dailyReportOpen} onOpenChange={setDailyReportOpen}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto bg-white p-6 rounded-2xl shadow-2xl border border-gray-100">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold flex items-center justify-between">
              <span className="flex items-center gap-2">
                <FileText className="w-5 h-5 text-indigo-600" />
                Daily Performance Report Generator
              </span>
              <Badge className="bg-indigo-100 text-indigo-800 text-[10px] font-bold">
                WhatsApp Ready
              </Badge>
            </DialogTitle>
            <DialogDescription className="text-xs text-gray-500">
              Live variable-based daily report with dynamic concluding overview that auto-adapts to individual telecaller performance.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 pt-2">
            {/* Report Mode Switcher */}
            <div className="flex flex-wrap items-center justify-between gap-3 p-2 bg-gray-50 rounded-xl border border-gray-100">
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant={reportType === 'team' ? 'default' : 'outline'}
                  onClick={() => setReportType('team')}
                  className={`text-xs font-bold rounded-lg ${reportType === 'team' ? 'bg-indigo-600 hover:bg-indigo-700 text-white' : 'text-gray-700'}`}
                >
                  <Users className="w-3.5 h-3.5 mr-1.5" />
                  Team Performance Report
                </Button>
                <Button
                  size="sm"
                  variant={reportType === 'user' ? 'default' : 'outline'}
                  onClick={() => setReportType('user')}
                  className={`text-xs font-bold rounded-lg ${reportType === 'user' ? 'bg-indigo-600 hover:bg-indigo-700 text-white' : 'text-gray-700'}`}
                >
                  <UserCheck className="w-3.5 h-3.5 mr-1.5" />
                  Individual User Report
                </Button>
              </div>

              {reportType === 'user' && (
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold text-gray-600">Select Telecaller:</span>
                  <Select value={selectedReportUser} onValueChange={setSelectedReportUser}>
                    <SelectTrigger className="h-8 text-xs font-bold w-[140px] bg-white">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {displayedUsers.map(u => (
                        <SelectItem key={u} value={u} className="text-xs font-bold">{u}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>

            {/* Formatted Report Preview Box */}
            {(() => {
              const activeUserPerformance = memberPerformanceList.find(m => m.name === selectedReportUser) || memberPerformanceList[0];
              const reportText = reportType === 'team'
                ? getTeamReportText()
                : (activeUserPerformance ? getUserReportText(activeUserPerformance) : "No user data available.");

              return (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-gray-700 uppercase tracking-wider flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                      Generated Report Content
                    </span>
                    <Button
                      size="sm"
                      onClick={() => {
                        navigator.clipboard.writeText(reportText);
                        setReportCopied(true);
                        setTimeout(() => setReportCopied(false), 2000);
                      }}
                      className={`text-xs font-bold rounded-lg ${reportCopied ? 'bg-emerald-600 text-white hover:bg-emerald-700' : 'bg-gray-900 text-white hover:bg-black'}`}
                    >
                      {reportCopied ? (
                        <>
                          <Check className="w-3.5 h-3.5 mr-1.5" /> Copied to Clipboard!
                        </>
                      ) : (
                        <>
                          <Copy className="w-3.5 h-3.5 mr-1.5" /> Copy WhatsApp Report
                        </>
                      )}
                    </Button>
                  </div>

                  <div className="bg-slate-900 text-slate-100 p-4 rounded-xl font-mono text-xs leading-relaxed whitespace-pre-wrap max-h-[380px] overflow-y-auto border border-slate-800 shadow-inner select-all">
                    {reportText}
                  </div>
                </div>
              );
            })()}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function RatingBadge({ rating, score }: { rating: 'high' | 'average' | 'needs_improvement'; score: number }) {
  if (rating === 'high') {
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
        <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 animate-pulse" />
        High ({score}%)
      </span>
    );
  }
  if (rating === 'average') {
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-100 text-amber-800 border border-amber-200">
        <span className="w-1.5 h-1.5 rounded-full bg-amber-600" />
        Average ({score}%)
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-rose-100 text-rose-800 border border-rose-200">
      <span className="w-1.5 h-1.5 rounded-full bg-rose-600" />
      Needs Coaching ({score}%)
    </span>
  );
}

function MetricCard({
  title,
  subtitle,
  value,
  icon,
  color,
  badge
}: {
  title: string;
  subtitle?: string;
  value: number | string;
  icon: React.ReactNode;
  color: string;
  badge?: string;
}) {
  const colorMap: Record<string, { bg: string; iconBg: string; border: string }> = {
    blue: { bg: "bg-blue-50/50 hover:bg-blue-50", iconBg: "bg-blue-100 text-blue-700", border: "border-blue-100" },
    indigo: { bg: "bg-indigo-50/50 hover:bg-indigo-50", iconBg: "bg-indigo-100 text-indigo-700", border: "border-indigo-100" },
    emerald: { bg: "bg-emerald-50/50 hover:bg-emerald-50", iconBg: "bg-emerald-100 text-emerald-700", border: "border-emerald-100" },
    green: { bg: "bg-green-50/50 hover:bg-green-50", iconBg: "bg-green-100 text-green-700", border: "border-green-100" },
    purple: { bg: "bg-purple-50/50 hover:bg-purple-50", iconBg: "bg-purple-100 text-purple-700", border: "border-purple-100" },
    amber: { bg: "bg-amber-50/50 hover:bg-amber-50", iconBg: "bg-amber-100 text-amber-700", border: "border-amber-100" },
    teal: { bg: "bg-teal-50/50 hover:bg-teal-50", iconBg: "bg-teal-100 text-teal-700", border: "border-teal-100" },
    red: { bg: "bg-rose-50/50 hover:bg-rose-50", iconBg: "bg-rose-100 text-rose-700", border: "border-rose-100" },
    gray: { bg: "bg-gray-50/50 hover:bg-gray-50", iconBg: "bg-gray-100 text-gray-600", border: "border-gray-100" }
  };

  const scheme = colorMap[color] || colorMap.blue;

  return (
    <motion.div
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      whileHover={{ y: -3, transition: { duration: 0.15 } }}
    >
      <Card className={`border shadow-xs transition-all duration-200 bg-white ${scheme.border} hover:shadow-sm`}>
        <CardContent className="p-4 flex flex-col justify-between h-full gap-2">
          <div className="flex items-start justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-gray-500">
              {title}
            </span>
            <div className={`p-2 rounded-xl ${scheme.iconBg}`}>
              {icon}
            </div>
          </div>

          <div>
            <h3 className="text-2xl font-black text-gray-900 tracking-tight">
              {value}
            </h3>
            {subtitle && (
              <p className="text-[11px] text-gray-500 font-medium mt-0.5 truncate">
                {subtitle}
              </p>
            )}
          </div>

          {badge && (
            <div className="pt-1.5 border-t border-gray-100/80 flex items-center justify-between">
              <span className="text-[10px] font-semibold text-gray-400">Status</span>
              <span className="text-[10px] font-bold text-gray-700 bg-gray-100 px-2 py-0.5 rounded-full">
                {badge}
              </span>
            </div>
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
}

export default TeamPerformanceCanvas;
