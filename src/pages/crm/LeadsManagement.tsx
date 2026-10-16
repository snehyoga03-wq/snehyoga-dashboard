import React, { useState, useEffect, useRef, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { motion } from "framer-motion";
import {
  ClipboardList, Search, RefreshCw, Plus, Download, Upload,
  Trash2, Edit, Save, X, Calendar, User, Phone, CheckCircle, History,
  Users, CheckSquare, FileSpreadsheet, FileCode, Copy, Check, Sparkles, MessageCircle, WifiOff
} from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import * as XLSX from "xlsx";
import { LeadAIBot } from "@/components/crm/LeadAIBot";
import { LeadAiAction } from "@/services/leadAiService";
import { leadSyncService, SyncStatusInfo } from "@/services/leadSyncService";

export const ASSIGNED_USERS = ["Ragini K", "Shreya K", "Tejasswini K"];



// Dropdown Constants
const LEAD_TYPES = [
  "SNEHYOGA 365",
  "FACEYOGA",
  "MSP - 9 Days",
  "AMP - 30 Days",
  "YMC",
  "NIDRA MASTERY",
  "CALM YOUR MIND",
  "1:1 CONSULTATION",
  "OFFLINE"
];

const EXISTING_PLANS = [
  "SY 365 - 399",
  "SY 365 - 2400",
  "SY 365 - 2001",
  "MWS - 6000",
  "MWS - 21000",
  "FY - 1200",
  "FY - 1500",
  "FY - 2100",
  "FY - 99",
  "MWS - 99",
  "YMC - 99",
  "YMC - 66000",
  "OFFLINE - 501",
  "OFFLINE - 199",
  "FTC - 12000",
  "YTC - 39000"
];

const LEAD_STATUSES = [
  { id: "Select Option", label: "Select Option", bg: "bg-gray-100 hover:bg-gray-200", text: "text-gray-700" },
  { id: "Deal Done", label: "Deal Done", bg: "bg-[#14532d] hover:bg-[#166534]", text: "text-white" },
  { id: "Follow Up", label: "Follow Up", bg: "bg-[#991b1b] hover:bg-[#b91c1c]", text: "text-white" },
  { id: "Master Class Follow", label: "Master Class Follow", bg: "bg-purple-700 hover:bg-purple-800", text: "text-white" },
  { id: "Dead", label: "Dead", bg: "bg-[#fef08a] hover:bg-[#fde047]", text: "text-[#854d0e]" }
];

// Patterns that indicate the call was NOT connected
const NOT_CONNECTED_PATTERNS = [
  "call not received",
  "call not picked",
  "not received",
  "not picked",
  "not reachable",
  "unreachable",
  "switched off",
  "switch off",
  "out of coverage",
  "busy",
  "no response",
  "no answer",
  "no ans",
  "not ans",
  "didn't pick",
  "did not pick",
  "didn't answer",
  "did not answer",
  "not responding",
  "phone off",
  "number not working",
  "invalid number",
  "wrong number",
  "disconnected",
  "network issue",
  "network error",
  "rnr",
  "np",
  "cnr",
  "snr",
  "not available",
  "unavailable",
  "ring no reply",
  "call not connected",
  "couldn't connect",
  "could not connect",
  "can't reach",
  "cannot reach"
];

/** Auto-detect call connected status from remark text */
const autoDetectCallConnected = (remark: string | null): string | null => {
  if (!remark || remark.trim() === "" || remark === "No remark") return null;
  const lower = remark.trim().toLowerCase();
  const isNotConnected = NOT_CONNECTED_PATTERNS.some(pattern => lower.includes(pattern));
  return isNotConnected ? "not_connected" : "connected";
};

interface Lead {
  id: string;
  admission_date: string | null;
  calling_date: string | null;
  sr_no: string | null;
  client_name: string;
  contact: string;
  lead_type: string | null;
  lead_existing_plan: string | null;
  lead_status: string;
  remark: string | null;
  call_connected: string | null;
  assigned_to: string | null;
  follow_up_date: string | null;
  created_at: string | null;
}

export interface GroupedLead {
  primaryId: string;
  contact: string;
  normPhone: string;
  client_name: string;
  lead: Lead;
  entries: Lead[];
  entriesCount: number;
}

const EditableCell = ({ value, onUpdate, type = "text", placeholder = "", className = "" }: { value: string | null, onUpdate: (val: string) => void, type?: string, placeholder?: string, className?: string }) => {
  const [val, setVal] = useState(value || "");
  useEffect(() => { setVal(value || ""); }, [value]);
  const handleBlur = () => { if (val !== (value || "")) onUpdate(val); };
  return (
    <Input
      type={type}
      value={val}
      onChange={(e) => setVal(e.target.value)}
      onBlur={handleBlur}
      placeholder={placeholder}
      className={`h-8 text-sm bg-transparent border-transparent hover:border-gray-200 focus:bg-white focus:border-[#2e5a44] focus:ring-1 focus:ring-[#2e5a44] w-full px-2 py-1 shadow-none ${className}`}
    />
  );
};

const LeadRow = React.memo(({ groupedLead, index, isSelected, handlers }: any) => {
  const lead = groupedLead.lead;
  const entriesCount = groupedLead.entriesCount;
  const curStatus = LEAD_STATUSES.find(s => s.id === lead.lead_status) || LEAD_STATUSES[0];
  const {
    handleSelectRow,
    handleUpdateField,
    handleUpdateLeadType,
    handleUpdateExistingPlan,
    handleUpdateStatus,
    handleUpdateAssignedTo,
    handleUpdateCallConnected,
    handleUpdateRemark,
    handleOpenHistory,
    handleOpenEditDialog,
    handleOpenLeadTimeline
  } = handlers;

  return (
    <TableRow className="hover:bg-gray-50 border-b border-gray-100">
      <TableCell className="p-2 text-center sticky left-0 z-10 bg-white">
        <Checkbox
          checked={isSelected}
          onCheckedChange={(val) => handleSelectRow(lead.id, !!val)}
          className="border-gray-300 data-[state=checked]:bg-[#2e5a44] data-[state=checked]:border-[#2e5a44]"
        />
      </TableCell>
      <TableCell className="p-2 text-center text-sm font-medium sticky left-[40px] z-10 bg-white">
        <button
          type="button"
          onClick={() => handleOpenLeadTimeline(groupedLead)}
          className="inline-flex items-center justify-center gap-1.5 px-2 py-1 rounded-md hover:bg-emerald-50 border border-transparent hover:border-emerald-200 transition-all cursor-pointer group"
          title="Click SR NO to view complete entry & calling history for this contact"
        >
          <span className="font-bold text-[#2e5a44] group-hover:underline">
            {index + 1}
          </span>
          {entriesCount > 1 && (
            <span
              className="inline-flex items-center justify-center px-1.5 py-0.2 rounded-full text-[10px] font-extrabold bg-blue-100 text-blue-700 border border-blue-300 shadow-xs"
              title={`${entriesCount} records for this mobile number`}
            >
              {entriesCount}
            </span>
          )}
        </button>
      </TableCell>
      <TableCell className="p-1 sticky left-[96px] z-10 bg-white border-r border-gray-200">
        <EditableCell value={lead.client_name} onUpdate={(val) => handleUpdateField(lead.id, 'client_name', val)} className="font-semibold text-gray-800" />
      </TableCell>
      <TableCell className="p-1">
        <EditableCell value={lead.contact} onUpdate={(val) => handleUpdateField(lead.id, 'contact', val)} />
      </TableCell>
      <TableCell className="p-1">
        <Select value={lead.lead_type || ""} onValueChange={(val) => handleUpdateLeadType(lead.id, val)}>
          <SelectTrigger className="h-8 border-none bg-transparent hover:bg-gray-200 text-xs rounded-md px-3 py-1 font-semibold text-gray-700 w-full focus:ring-1 focus:ring-[#2e5a44] focus:bg-white shadow-none">
            <SelectValue placeholder="Select type" />
          </SelectTrigger>
          <SelectContent>
            {LEAD_TYPES.map(t => (<SelectItem key={t} value={t} className="text-xs font-medium">{t}</SelectItem>))}
          </SelectContent>
        </Select>
      </TableCell>
      <TableCell className="p-1">
        <Select value={lead.lead_existing_plan || ""} onValueChange={(val) => handleUpdateExistingPlan(lead.id, val)}>
          <SelectTrigger className="h-8 border-none bg-transparent hover:bg-gray-200 text-xs rounded-md px-3 py-1 font-semibold text-gray-700 w-full focus:ring-1 focus:ring-[#2e5a44] focus:bg-white shadow-none">
            <SelectValue placeholder="Select plan" />
          </SelectTrigger>
          <SelectContent>
            {EXISTING_PLANS.map(p => (<SelectItem key={p} value={p} className="text-xs font-medium">{p}</SelectItem>))}
          </SelectContent>
        </Select>
      </TableCell>
      <TableCell className="p-1">
        <div className="flex flex-col gap-1 items-center">
          <Select value={lead.lead_status} onValueChange={(val) => handleUpdateStatus(lead.id, val)}>
            <SelectTrigger className={`h-8 border-none text-xs rounded-full px-3 py-1 font-bold text-center w-full focus:ring-1 focus:ring-offset-1 focus:ring-[#2e5a44] shadow-none ${curStatus.bg} ${curStatus.text}`}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {LEAD_STATUSES.map(s => (<SelectItem key={s.id} value={s.id} className="text-xs font-bold">{s.label}</SelectItem>))}
            </SelectContent>
          </Select>
          {entriesCount > 1 && (
            <button
              type="button"
              onClick={() => handleOpenLeadTimeline(groupedLead)}
              className="text-[10px] text-blue-600 hover:text-blue-800 font-semibold text-center hover:underline cursor-pointer flex items-center justify-center gap-1"
              title="View status and call timeline"
            >
              <History className="w-3 h-3 text-blue-500" />
              <span>{entriesCount} entries</span>
            </button>
          )}
        </div>
      </TableCell>
      <TableCell className="p-1">
        <EditableCell type="date" value={lead.follow_up_date} onUpdate={(val) => handleUpdateField(lead.id, 'follow_up_date', val)} />
      </TableCell>
      <TableCell className="p-1">
        <div className="flex items-center gap-1.5">
          <div className="flex-1 min-w-0">
            <EditableCell value={lead.remark} onUpdate={(val) => {
              handlers.handleUpdateRemark(lead.id, val);
            }} placeholder="No remark" />
          </div>
          <Select value={lead.call_connected || "none"} onValueChange={(val) => handlers.handleUpdateCallConnected(lead.id, val === "none" ? null : val)}>
            <SelectTrigger className={`h-7 w-[110px] shrink-0 border-none text-[10px] rounded-full px-2.5 py-0.5 font-bold text-center focus:ring-1 focus:ring-offset-1 shadow-none ${lead.call_connected === "connected"
                ? "bg-emerald-100 text-emerald-800 hover:bg-emerald-200"
                : lead.call_connected === "not_connected"
                  ? "bg-red-100 text-red-700 hover:bg-red-200"
                  : "bg-gray-100 text-gray-500 hover:bg-gray-200"
              }`}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none" className="text-xs text-gray-500">—</SelectItem>
              <SelectItem value="connected" className="text-xs font-bold text-emerald-700">✅ Connected</SelectItem>
              <SelectItem value="not_connected" className="text-xs font-bold text-red-700">❌ Not Connected</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </TableCell>

      <TableCell className="p-2 font-medium text-gray-700 text-sm">
        {lead.created_at ? new Date(lead.created_at).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : "—"}
      </TableCell>
      <TableCell className="p-1">
        <EditableCell type="date" value={lead.admission_date} onUpdate={(val) => handleUpdateField(lead.id, 'admission_date', val)} />
      </TableCell>
      <TableCell className="p-1">
        <EditableCell type="date" value={lead.calling_date} onUpdate={(val) => handleUpdateField(lead.id, 'calling_date', val)} />
      </TableCell>
      <TableCell className="p-1">
        {(() => {
          const rawAssigned = (lead.assigned_to || "").trim().toLowerCase();
          const matchedUser = ASSIGNED_USERS.find(u => {
            const lowerU = u.toLowerCase();
            if (lowerU === rawAssigned) return true;
            if ((lowerU.includes("tejasswin") || lowerU.includes("tejassw")) &&
              (rawAssigned.includes("tejasswin") || rawAssigned.includes("tejassw") || rawAssigned.includes("tejasw") || rawAssigned.includes("janhavi"))) {
              return true;
            }
            return false;
          }) || lead.assigned_to || "";
          return (
            <Select value={matchedUser} onValueChange={(val) => handleUpdateAssignedTo(lead.id, val)}>
              <SelectTrigger className="h-8 border-none bg-transparent hover:bg-gray-200 text-xs rounded-md px-3 py-1 font-semibold text-gray-700 w-full focus:ring-1 focus:ring-[#2e5a44] focus:bg-white shadow-none">
                <SelectValue placeholder="Select user" />
              </SelectTrigger>
              <SelectContent>
                {ASSIGNED_USERS.map(u => (<SelectItem key={u} value={u} className="text-xs font-medium">{u}</SelectItem>))}
              </SelectContent>
            </Select>
          );
        })()}
      </TableCell>
      <TableCell className="text-center p-2">
        <div className="flex justify-center items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-indigo-600 hover:text-indigo-800 hover:bg-indigo-50"
            onClick={() => handleOpenLeadTimeline(groupedLead)}
            title="View Entry Timeline"
          >
            <History className="w-4 h-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-blue-600 hover:text-blue-800 hover:bg-blue-50"
            onClick={() => handleOpenEditDialog(lead)}
            title="Edit Lead"
          >
            <Edit className="w-4 h-4" />
          </Button>
        </div>
      </TableCell>
    </TableRow>
  );
}, (prevProps, nextProps) => {
  return prevProps.groupedLead.lead === nextProps.groupedLead.lead &&
    prevProps.groupedLead.entriesCount === nextProps.groupedLead.entriesCount &&
    prevProps.isSelected === nextProps.isSelected &&
    prevProps.index === nextProps.index;
});

export function LeadsManagement() {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [leads, setLeads] = useState<Lead[]>(() => {
    const cached = leadSyncService.loadCachedLeads<Lead>();
    return cached && cached.length > 0 ? cached : [];
  });
  const [loading, setLoading] = useState(() => {
    const cached = leadSyncService.loadCachedLeads<Lead>();
    return !cached || cached.length === 0;
  });
  const [syncInfo, setSyncInfo] = useState<SyncStatusInfo>(() => leadSyncService.getStatus());

  useEffect(() => {
    return leadSyncService.subscribe(setSyncInfo);
  }, []);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [autoDateFilter, setAutoDateFilter] = useState(new Date().toISOString().split("T")[0]);
  const [addedDateFilter, setAddedDateFilter] = useState("");
  const [assignedToFilter, setAssignedToFilter] = useState(() => {
    const loggedInUser = sessionStorage.getItem("crm_username") || localStorage.getItem("crm_username");
    if (!loggedInUser || loggedInUser.toLowerCase() === "admin" || loggedInUser === "YOG" || loggedInUser.toLowerCase().includes("shreya")) return "all";

    const matched = ASSIGNED_USERS.find(u =>
      u.toLowerCase() === loggedInUser.toLowerCase() ||
      (u.split(" ")[0].length >= 3 && loggedInUser.toLowerCase().includes(u.split(" ")[0].toLowerCase())) ||
      (u.includes("Tejasswin") && (loggedInUser.toLowerCase().includes("tejassw") || loggedInUser.toLowerCase().includes("tejasw") || loggedInUser.toLowerCase().includes("janhavi")))
    );

    return matched || "all";
  });

  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 50;

  const handleApplyAiAction = (action: LeadAiAction) => {
    if (action.statusFilter !== undefined) setStatusFilter(action.statusFilter);
    if (action.typeFilter !== undefined) setTypeFilter(action.typeFilter);
    if (action.assignedToFilter !== undefined) setAssignedToFilter(action.assignedToFilter);
    if (action.autoDateFilter !== undefined) {
      setAutoDateFilter(action.autoDateFilter);
      setAddedDateFilter("");
    }
    if (action.searchQuery !== undefined) setSearchQuery(action.searchQuery);
  };

  // Bulk Selection & Assignment States
  const [selectedLeadIds, setSelectedLeadIds] = useState<string[]>([]);
  const [isBulkAssignOpen, setIsBulkAssignOpen] = useState(false);
  const [bulkAssignMode, setBulkAssignMode] = useState<"single" | "split">("single");
  const [bulkSingleUser, setBulkSingleUser] = useState<string>(ASSIGNED_USERS[0]);
  const [bulkSplitUsers, setBulkSplitUsers] = useState<string[]>(ASSIGNED_USERS);
  const [isBulkAssigning, setIsBulkAssigning] = useState(false);

  // Dialog States
  const [isOpenAddEditDialog, setIsOpenAddEditDialog] = useState(false);
  const [editingLead, setEditingLead] = useState<Lead | null>(null);
  const [isSheetSyncOpen, setIsSheetSyncOpen] = useState(false);
  const [copiedScript, setCopiedScript] = useState(false);

  const topScrollRef = useRef<HTMLDivElement>(null);
  const tableContainerRef = useRef<HTMLDivElement>(null);
  const tableRef = useRef<HTMLTableElement>(null);
  const isScrollingTop = useRef(false);
  const isScrollingBottom = useRef(false);
  const [tableWidth, setTableWidth] = useState(2200);

  useEffect(() => {
    if (tableRef.current) {
      const resizeObserver = new ResizeObserver(entries => {
        for (let entry of entries) {
          setTableWidth(entry.target.scrollWidth);
        }
      });
      resizeObserver.observe(tableRef.current);
      return () => resizeObserver.disconnect();
    }
  }, []);

  const handleTopScroll = (e: React.UIEvent<HTMLDivElement>) => {
    if (isScrollingBottom.current) return;
    isScrollingTop.current = true;
    if (tableContainerRef.current && tableContainerRef.current.scrollLeft !== e.currentTarget.scrollLeft) {
      tableContainerRef.current.scrollLeft = e.currentTarget.scrollLeft;
    }
    // Simple debounce to reset the flag
    setTimeout(() => { isScrollingTop.current = false; }, 50);
  };

  const handleTableScroll = (e: React.UIEvent<HTMLDivElement>) => {
    // Horizontal Sync
    if (!isScrollingTop.current) {
      isScrollingBottom.current = true;
      if (topScrollRef.current && topScrollRef.current.scrollLeft !== e.currentTarget.scrollLeft) {
        topScrollRef.current.scrollLeft = e.currentTarget.scrollLeft;
      }
      setTimeout(() => { isScrollingBottom.current = false; }, 50);
    }

    // Infinite Scroll (vertical)
    const { scrollTop, scrollHeight, clientHeight } = e.currentTarget;
    if (scrollHeight - scrollTop - clientHeight < 100) {
      setCurrentPage(prev => prev + 1);
    }
  };

  // History & Deduplication States
  const [showHistoryDialog, setShowHistoryDialog] = useState(false);
  const [selectedLeadHistory, setSelectedLeadHistory] = useState<any[]>([]);
  const [selectedLeadForHistory, setSelectedLeadForHistory] = useState<Lead | null>(null);

  // Grouped Lead Timeline Modal State
  const [isTimelineOpen, setIsTimelineOpen] = useState(false);
  const [selectedGroupedLead, setSelectedGroupedLead] = useState<GroupedLead | null>(null);

  const handleOpenLeadTimeline = (groupedLead: GroupedLead) => {
    setSelectedGroupedLead(groupedLead);
    setIsTimelineOpen(true);
  };

  const handleAddNewTimelineEntry = () => {
    if (!selectedGroupedLead) return;
    const primary = selectedGroupedLead.lead;
    setEditingLead(null);
    setLeadForm({
      admission_date: primary.admission_date || "",
      calling_date: new Date().toISOString().split("T")[0],
      sr_no: primary.sr_no || "",
      client_name: primary.client_name,
      contact: primary.contact,
      lead_type: primary.lead_type || LEAD_TYPES[0],
      lead_existing_plan: primary.lead_existing_plan || "",
      lead_status: "Follow Up",
      remark: "",
      call_connected: null,
      assigned_to: primary.assigned_to,
      follow_up_date: new Date(Date.now() + 86400000).toISOString().split("T")[0]
    });
    setIsOpenAddEditDialog(true);
  };

  const handleDeleteTimelineEntry = async (entryId: string) => {
    if (!confirm("Are you sure you want to delete this specific entry?")) return;
    try {
      const { error } = await supabase.from("leads").delete().eq("id", entryId);
      if (error) throw error;
      setLeads(prev => prev.filter(l => l.id !== entryId));
      if (selectedGroupedLead) {
        const remaining = selectedGroupedLead.entries.filter(e => e.id !== entryId);
        if (remaining.length === 0) {
          setIsTimelineOpen(false);
          setSelectedGroupedLead(null);
        } else {
          setSelectedGroupedLead({
            ...selectedGroupedLead,
            entries: remaining,
            entriesCount: remaining.length,
            lead: remaining[0]
          });
        }
      }
      toast({ title: "Entry Deleted", description: "The timeline entry was removed successfully." });
    } catch (err: any) {
      toast({ title: "Delete Failed", description: err.message, variant: "destructive" });
    }
  };

  const [isCleanDuplicatesOpen, setIsCleanDuplicatesOpen] = useState(false);
  const [duplicateSummary, setDuplicateSummary] = useState<{
    totalDuplicateGroups: number;
    totalRedundantRows: number;
    redundantIds: string[];
    duplicateGroups: { clientName: string; contact: string; count: number; keptId: string }[];
  }>({ totalDuplicateGroups: 0, totalRedundantRows: 0, redundantIds: [], duplicateGroups: [] });
  const [isCleaningDuplicates, setIsCleaningDuplicates] = useState(false);

  const handleAnalyzeDuplicates = () => {
    const uniqueLeadsById = Array.from(new Map(leads.map(item => [item.id, item])).values());
    const groups: Record<string, Lead[]> = {};

    uniqueLeadsById.forEach(lead => {
      const cleanContact = (lead.contact || "").replace(/\D/g, "");
      const last10 = cleanContact.length >= 10 ? cleanContact.slice(-10) : cleanContact;
      const baseKey = last10 || (lead.client_name || "").trim().toLowerCase();
      const planKey = (lead.lead_existing_plan || "").trim().toLowerCase();

      if (!baseKey) return;
      const key = `${baseKey}|${planKey}`;
      if (!groups[key]) groups[key] = [];
      groups[key].push(lead);
    });

    const duplicateGroupsList: { clientName: string; contact: string; count: number; keptId: string }[] = [];
    const redundantIds: string[] = [];

    Object.values(groups).forEach(groupLeads => {
      if (groupLeads.length > 1) {
        const sorted = [...groupLeads].sort((a, b) => {
          const aHasStatus = a.lead_status && a.lead_status !== 'Select Option' ? 1 : 0;
          const bHasStatus = b.lead_status && b.lead_status !== 'Select Option' ? 1 : 0;
          if (aHasStatus !== bHasStatus) return bHasStatus - aHasStatus;

          const aHasRemark = a.remark ? 1 : 0;
          const bHasRemark = b.remark ? 1 : 0;
          if (aHasRemark !== bHasRemark) return bHasRemark - aHasRemark;

          const aHasAssigned = a.assigned_to ? 1 : 0;
          const bHasAssigned = b.assigned_to ? 1 : 0;
          if (aHasAssigned !== bHasAssigned) return bHasAssigned - aHasAssigned;

          return 0;
        });

        const keptLead = sorted[0];
        const redundant = sorted.slice(1);
        redundant.forEach(r => redundantIds.push(r.id));

        duplicateGroupsList.push({
          clientName: keptLead.client_name,
          contact: keptLead.contact,
          count: groupLeads.length,
          keptId: keptLead.id
        });
      }
    });

    setDuplicateSummary({
      totalDuplicateGroups: duplicateGroupsList.length,
      totalRedundantRows: redundantIds.length,
      redundantIds,
      duplicateGroups: duplicateGroupsList
    });
    setIsCleanDuplicatesOpen(true);
  };

  const handleConfirmCleanDuplicates = async () => {
    if (duplicateSummary.redundantIds.length === 0) return;
    setIsCleaningDuplicates(true);
    try {
      const chunkSize = 50;
      for (let i = 0; i < duplicateSummary.redundantIds.length; i += chunkSize) {
        const chunk = duplicateSummary.redundantIds.slice(i, i + chunkSize);
        const { error } = await supabase.from("leads").delete().in("id", chunk);
        if (error) throw error;
      }

      toast({
        title: "Duplicates Cleaned Successfully",
        description: `Removed ${duplicateSummary.totalRedundantRows} redundant duplicate leads across ${duplicateSummary.totalDuplicateGroups} contacts.`
      });

      setIsCleanDuplicatesOpen(false);
      fetchLeads();
    } catch (err: any) {
      console.error("Error cleaning duplicates:", err);
      toast({
        title: "Clean Duplicates Failed",
        description: err.message,
        variant: "destructive"
      });
    } finally {
      setIsCleaningDuplicates(false);
    }
  };

  const [leadForm, setLeadForm] = useState<Partial<Lead>>({
    admission_date: "",
    calling_date: "",
    sr_no: "",
    client_name: "",
    contact: "",
    lead_type: "",
    lead_existing_plan: "",
    lead_status: "Select Option",
    remark: "",
    call_connected: null,
    assigned_to: null,
    follow_up_date: ""
  });

  useEffect(() => {
    fetchLeads();
  }, []);

  const fetchLeads = async () => {
    if (leads.length === 0) {
      setLoading(true);
    }
    try {
      let allData: Lead[] = [];
      let offset = 0;
      const pageSize = 1000;
      let hasMore = true;

      while (hasMore) {
        const { data, error } = await supabase
          .from("leads")
          .select("*")
          .order("created_at", { ascending: false })
          .range(offset, offset + pageSize - 1);

        if (error) throw error;
        if (!data || data.length === 0) {
          hasMore = false;
        } else {
          allData = allData.concat(data as Lead[]);
          if (data.length < pageSize) {
            hasMore = false;
          } else {
            offset += pageSize;
          }
        }
      }

      const uniqueData = Array.from(new Map((allData || []).map((item: Lead) => [item.id, item])).values());
      // Apply pending offline edits so fresh server fetch does not overwrite user's edits!
      const mergedData = leadSyncService.applyPendingUpdates(uniqueData);
      setLeads(mergedData);
      leadSyncService.saveCachedLeads(mergedData);
    } catch (err: any) {
      console.error("Error fetching leads:", err);
      if (leads.length === 0) {
        toast({
          title: "Network error fetching leads",
          description: "Displaying cached offline data.",
          variant: "destructive"
        });
      }
    } finally {
      setLoading(false);
    }
  };

  const getLastAssignedIndex = (leadsArray: Lead[]) => {
    const lastAssignedLead = leadsArray.find(l => l.assigned_to && ASSIGNED_USERS.includes(l.assigned_to));
    if (lastAssignedLead && lastAssignedLead.assigned_to) {
      return ASSIGNED_USERS.indexOf(lastAssignedLead.assigned_to);
    }
    return -1;
  };

  const logHistory = async (leadId: string, action_type: string, description: string) => {
    try {
      await supabase.from("lead_history").insert([{
        lead_id: leadId,
        action_type,
        description,
        created_by: "CRM User"
      }]);
    } catch (e) {
      console.error("Failed to log history", e);
    }
  };

  const handleOpenHistory = async (lead: Lead) => {
    setSelectedLeadForHistory(lead);
    setShowHistoryDialog(true);
    const { data } = await supabase.from("lead_history").select("*").eq("lead_id", lead.id).order("created_at", { ascending: false });
    setSelectedLeadHistory(data || []);
  };

  const handleOpenAddDialog = () => {
    setEditingLead(null);
    setLeadForm({
      admission_date: new Date().toISOString().split("T")[0],
      calling_date: new Date().toISOString().split("T")[0],
      sr_no: "",
      client_name: "",
      contact: "",
      lead_type: LEAD_TYPES[0],
      lead_existing_plan: EXISTING_PLANS[0],
      lead_status: "Select Option",
      remark: "",
      call_connected: null,
      assigned_to: null,
      follow_up_date: ""
    });
    setIsOpenAddEditDialog(true);
  };

  const handleOpenEditDialog = (lead: Lead) => {
    setEditingLead(lead);
    setLeadForm({
      admission_date: lead.admission_date || "",
      calling_date: lead.calling_date || "",
      sr_no: lead.sr_no || "",
      client_name: lead.client_name,
      contact: lead.contact,
      lead_type: lead.lead_type || "",
      lead_existing_plan: lead.lead_existing_plan || "",
      lead_status: lead.lead_status,
      remark: lead.remark || "",
      call_connected: lead.call_connected || null,
      assigned_to: lead.assigned_to,
      follow_up_date: lead.follow_up_date || ""
    });
    setIsOpenAddEditDialog(true);
  };

  const handleSaveLead = async () => {
    if (!leadForm.client_name || !leadForm.contact) {
      toast({
        title: "Validation Error",
        description: "Client Name and Contact are required.",
        variant: "destructive"
      });
      return;
    }

    try {
      let finalFollowUpDate = leadForm.follow_up_date || null;
      if (leadForm.lead_status === "Follow Up" && !finalFollowUpDate) {
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        finalFollowUpDate = tomorrow.toISOString().split("T")[0];
      } else if (leadForm.lead_status === "Dead") {
        finalFollowUpDate = null;
      }

      if (editingLead) {
        // Optimistic instant update
        const updates = {
          admission_date: leadForm.admission_date || null,
          calling_date: leadForm.calling_date || null,
          sr_no: leadForm.sr_no || null,
          client_name: leadForm.client_name,
          contact: leadForm.contact,
          lead_type: leadForm.lead_type || null,
          lead_existing_plan: leadForm.lead_existing_plan || null,
          lead_status: leadForm.lead_status || "Select Option",
          remark: leadForm.remark || null,
          call_connected: leadForm.call_connected || autoDetectCallConnected(leadForm.remark || null),
          assigned_to: leadForm.assigned_to || null,
          follow_up_date: finalFollowUpDate
        };

        setLeads(prev => {
          const updated = prev.map(l => l.id === editingLead.id ? { ...l, ...updates } : l);
          leadSyncService.saveCachedLeads(updated);
          return updated;
        });

        if (selectedGroupedLead) {
          setSelectedGroupedLead(prev => {
            if (!prev) return null;
            const updatedEntries = prev.entries.map(e => e.id === editingLead.id ? { ...e, ...updates } : e);
            return {
              ...prev,
              entries: updatedEntries,
              lead: updatedEntries[0]
            };
          });
        }

        leadSyncService.enqueueUpdate(editingLead.id, updates, {
          action_type: "Updated",
          description: "Lead details were updated manually."
        });

        setIsOpenAddEditDialog(false);
        toast({ title: "Saved ✅", description: "Lead updated instantly and saved to local cache" });
      } else {
        // Create
        const tempId = crypto.randomUUID();
        const newLead: Lead = {
          id: tempId,
          admission_date: leadForm.admission_date || null,
          calling_date: leadForm.calling_date || null,
          sr_no: leadForm.sr_no || null,
          client_name: leadForm.client_name,
          contact: leadForm.contact,
          lead_type: leadForm.lead_type || null,
          lead_existing_plan: leadForm.lead_existing_plan || null,
          lead_status: leadForm.lead_status || "Select Option",
          remark: leadForm.remark || null,
          call_connected: leadForm.call_connected || autoDetectCallConnected(leadForm.remark || null),
          assigned_to: leadForm.assigned_to || null,
          follow_up_date: finalFollowUpDate,
          created_at: new Date().toISOString()
        };

        setLeads(prev => {
          const updated = [newLead, ...prev];
          leadSyncService.saveCachedLeads(updated);
          return updated;
        });

        setIsOpenAddEditDialog(false);
        toast({ title: "Success", description: "Lead added successfully" });

        supabase
          .from("leads")
          .insert([{
            admission_date: newLead.admission_date,
            calling_date: newLead.calling_date,
            sr_no: newLead.sr_no,
            client_name: newLead.client_name,
            contact: newLead.contact,
            lead_type: newLead.lead_type,
            lead_existing_plan: newLead.lead_existing_plan,
            lead_status: newLead.lead_status,
            remark: newLead.remark,
            call_connected: newLead.call_connected,
            assigned_to: newLead.assigned_to,
            follow_up_date: newLead.follow_up_date
          }])
          .select()
          .then(({ data, error }) => {
            if (error) {
              console.error("Error creating lead in Supabase:", error);
            } else if (data && data[0]) {
              const realId = data[0].id;
              setLeads(prev => prev.map(l => l.id === tempId ? { ...l, id: realId } : l));
              logHistory(realId, "Created", "Lead created manually.");
            }
          });
      }
    } catch (err: any) {
      console.error("Error saving lead:", err);
      toast({
        title: "Error saving lead",
        description: err.message,
        variant: "destructive"
      });
    }
  };

  const handleUpdateStatus = (leadId: string, status: string) => {
    const targetLead = leads.find(l => l.id === leadId);
    const previousFollowUpDate = targetLead ? targetLead.follow_up_date : null;

    let updatedFollowUpDate = previousFollowUpDate;
    if (status === "Follow Up" && !updatedFollowUpDate) {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      updatedFollowUpDate = tomorrow.toISOString().split("T")[0];
    } else if (status === "Dead") {
      updatedFollowUpDate = null;
    }

    const updates = { lead_status: status, follow_up_date: updatedFollowUpDate };

    // Instant local UI update (0ms lag)
    setLeads(prev => {
      const updated = prev.map(lead => lead.id === leadId ? { ...lead, ...updates } : lead);
      leadSyncService.saveCachedLeads(updated);
      return updated;
    });

    if (selectedGroupedLead) {
      setSelectedGroupedLead(prev => {
        if (!prev) return null;
        const updatedEntries = prev.entries.map(e => e.id === leadId ? { ...e, ...updates } : e);
        return { ...prev, entries: updatedEntries, lead: updatedEntries[0] };
      });
    }

    // Persist in background queue
    leadSyncService.enqueueUpdate(leadId, updates, {
      action_type: "Status Changed",
      description: `Lead status changed to ${status}`
    });
  };

  const handleUpdateLeadType = (leadId: string, type: string) => {
    const updates = { lead_type: type };
    setLeads(prev => {
      const updated = prev.map(lead => lead.id === leadId ? { ...lead, ...updates } : lead);
      leadSyncService.saveCachedLeads(updated);
      return updated;
    });

    if (selectedGroupedLead) {
      setSelectedGroupedLead(prev => {
        if (!prev) return null;
        const updatedEntries = prev.entries.map(e => e.id === leadId ? { ...e, ...updates } : e);
        return { ...prev, entries: updatedEntries, lead: updatedEntries[0] };
      });
    }

    leadSyncService.enqueueUpdate(leadId, updates, {
      action_type: "Type Changed",
      description: `Lead type changed to ${type}`
    });
  };

  const handleUpdateExistingPlan = (leadId: string, plan: string) => {
    const updates = { lead_existing_plan: plan };
    setLeads(prev => {
      const updated = prev.map(lead => lead.id === leadId ? { ...lead, ...updates } : lead);
      leadSyncService.saveCachedLeads(updated);
      return updated;
    });

    if (selectedGroupedLead) {
      setSelectedGroupedLead(prev => {
        if (!prev) return null;
        const updatedEntries = prev.entries.map(e => e.id === leadId ? { ...e, ...updates } : e);
        return { ...prev, entries: updatedEntries, lead: updatedEntries[0] };
      });
    }

    leadSyncService.enqueueUpdate(leadId, updates, {
      action_type: "Plan Changed",
      description: `Plan changed to ${plan}`
    });
  };

  const handleUpdateAssignedTo = (leadId: string, assignedTo: string) => {
    const updates = { assigned_to: assignedTo };
    setLeads(prev => {
      const updated = prev.map(lead => lead.id === leadId ? { ...lead, ...updates } : lead);
      leadSyncService.saveCachedLeads(updated);
      return updated;
    });

    if (selectedGroupedLead) {
      setSelectedGroupedLead(prev => {
        if (!prev) return null;
        const updatedEntries = prev.entries.map(e => e.id === leadId ? { ...e, ...updates } : e);
        return { ...prev, entries: updatedEntries, lead: updatedEntries[0] };
      });
    }

    leadSyncService.enqueueUpdate(leadId, updates, {
      action_type: "Reassigned",
      description: `Lead reassigned to ${assignedTo}`
    });
  };

  const handleUpdateField = (leadId: string, field: string, value: any) => {
    const updates = { [field]: value };
    setLeads(prev => {
      const updated = prev.map(lead => lead.id === leadId ? { ...lead, ...updates } : lead);
      leadSyncService.saveCachedLeads(updated);
      return updated;
    });

    if (selectedGroupedLead) {
      setSelectedGroupedLead(prev => {
        if (!prev) return null;
        const updatedEntries = prev.entries.map(e => e.id === leadId ? { ...e, ...updates } : e);
        return { ...prev, entries: updatedEntries, lead: updatedEntries[0] };
      });
    }

    leadSyncService.enqueueUpdate(leadId, updates, {
      action_type: "Updated",
      description: `${field} updated manually.`
    });
  };

  const handleUpdateCallConnected = (leadId: string, callConnected: string | null) => {
    const updates = { call_connected: callConnected };
    setLeads(prev => {
      const updated = prev.map(lead => lead.id === leadId ? { ...lead, ...updates } : lead);
      leadSyncService.saveCachedLeads(updated);
      return updated;
    });

    if (selectedGroupedLead) {
      setSelectedGroupedLead(prev => {
        if (!prev) return null;
        const updatedEntries = prev.entries.map(e => e.id === leadId ? { ...e, ...updates } : e);
        return { ...prev, entries: updatedEntries, lead: updatedEntries[0] };
      });
    }

    leadSyncService.enqueueUpdate(leadId, updates, {
      action_type: "Call Status",
      description: `Call status set to ${callConnected === "connected" ? "Connected" : callConnected === "not_connected" ? "Not Connected" : "None"}`
    });
  };

  const handleUpdateRemark = (leadId: string, remark: string) => {
    const detected = autoDetectCallConnected(remark);
    const updates = { remark, call_connected: detected };
    setLeads(prev => {
      const updated = prev.map(lead => lead.id === leadId ? { ...lead, ...updates } : lead);
      leadSyncService.saveCachedLeads(updated);
      return updated;
    });

    if (selectedGroupedLead) {
      setSelectedGroupedLead(prev => {
        if (!prev) return null;
        const updatedEntries = prev.entries.map(e => e.id === leadId ? { ...e, ...updates } : e);
        return { ...prev, entries: updatedEntries, lead: updatedEntries[0] };
      });
    }

    leadSyncService.enqueueUpdate(leadId, updates, {
      action_type: "Remark Updated",
      description: `Remark updated: ${remark || "Cleared"} (${detected === "connected" ? "Connected" : detected === "not_connected" ? "Not Connected" : "None"})`
    });
  };

  const handleDeleteLead = async (leadId: string) => {
    if (!confirm("Are you sure you want to delete this lead?")) return;
    try {
      const { error } = await supabase
        .from("leads")
        .delete()
        .eq("id", leadId);

      if (error) throw error;
      setLeads(prev => prev.filter(lead => lead.id !== leadId));
      toast({ title: "Deleted", description: "Lead deleted successfully" });
    } catch (err: any) {
      console.error("Error deleting lead:", err);
      toast({
        title: "Error deleting lead",
        description: err.message,
        variant: "destructive"
      });
    }
  };

  const handleBulkDelete = async () => {
    if (selectedLeadIds.length === 0) return;
    if (!confirm(`Are you sure you want to delete ${selectedLeadIds.length} selected lead(s)?`)) return;
    try {
      const { error } = await supabase
        .from("leads")
        .delete()
        .in("id", selectedLeadIds);

      if (error) throw error;
      setLeads(prev => prev.filter(lead => !selectedLeadIds.includes(lead.id)));
      setSelectedLeadIds([]);
      toast({ title: "Deleted", description: `${selectedLeadIds.length} leads deleted successfully` });
    } catch (err: any) {
      console.error("Error deleting bulk leads:", err);
      toast({
        title: "Error deleting leads",
        description: err.message,
        variant: "destructive"
      });
    }
  };

  const handleBulkAssignSubmit = async () => {
    if (selectedLeadIds.length === 0) return;
    setIsBulkAssigning(true);
    try {
      if (bulkAssignMode === "single") {
        if (!bulkSingleUser) {
          toast({ title: "Validation Error", description: "Please select a user to assign.", variant: "destructive" });
          setIsBulkAssigning(false);
          return;
        }
        const { error } = await supabase
          .from("leads")
          .update({ assigned_to: bulkSingleUser })
          .in("id", selectedLeadIds);

        if (error) throw error;

        const historyLogs = selectedLeadIds.map(id => ({
          lead_id: id,
          action_type: "Bulk Assigned",
          description: `Lead bulk assigned to ${bulkSingleUser}`,
          created_by: "CRM User"
        }));
        await supabase.from("lead_history").insert(historyLogs);

        setLeads(prev => {
          const updated = prev.map(lead => selectedLeadIds.includes(lead.id) ? { ...lead, assigned_to: bulkSingleUser } : lead);
          leadSyncService.saveCachedLeads(updated);
          return updated;
        });
        toast({ title: "Success", description: `${selectedLeadIds.length} leads assigned to ${bulkSingleUser}` });
      } else {
        if (bulkSplitUsers.length === 0) {
          toast({ title: "Validation Error", description: "Please select at least one user for round-robin distribution.", variant: "destructive" });
          setIsBulkAssigning(false);
          return;
        }

        // Group leads by target user for round-robin assignment
        const groups: Record<string, string[]> = {};
        bulkSplitUsers.forEach(u => groups[u] = []);
        selectedLeadIds.forEach((id, idx) => {
          const targetUser = bulkSplitUsers[idx % bulkSplitUsers.length];
          groups[targetUser].push(id);
        });

        const historyLogs: any[] = [];
        for (const [user, ids] of Object.entries(groups)) {
          if (ids.length > 0) {
            const { error } = await supabase
              .from("leads")
              .update({ assigned_to: user })
              .in("id", ids);
            if (error) throw error;

            ids.forEach(id => {
              historyLogs.push({
                lead_id: id,
                action_type: "Bulk Assigned",
                description: `Lead bulk assigned to ${user} via round-robin distribution`,
                created_by: "CRM User"
              });
            });
          }
        }
        if (historyLogs.length > 0) {
          await supabase.from("lead_history").insert(historyLogs);
        }

        setLeads(prev => {
          const updated = prev.map(lead => {
            const idx = selectedLeadIds.indexOf(lead.id);
            if (idx !== -1) {
              return { ...lead, assigned_to: bulkSplitUsers[idx % bulkSplitUsers.length] };
            }
            return lead;
          });
          leadSyncService.saveCachedLeads(updated);
          return updated;
        });
        toast({ title: "Success", description: `${selectedLeadIds.length} leads distributed among ${bulkSplitUsers.length} user(s)` });
      }

      setSelectedLeadIds([]);
      setIsBulkAssignOpen(false);
    } catch (err: any) {
      console.error("Error during bulk assignment:", err);
      toast({
        title: "Bulk Assignment Failed",
        description: err.message,
        variant: "destructive"
      });
    } finally {
      setIsBulkAssigning(false);
    }
  };

  // Export to Excel / CSV
  const handleExport = () => {
    if (leads.length === 0) {
      toast({ title: "No data", description: "No leads to export." });
      return;
    }

    const formattedData = filteredLeads.map(lead => ({
      "Admission Date": lead.admission_date || "",
      "Calling Date": lead.calling_date || "",
      "SR NO": lead.sr_no || "",
      "Client Name": lead.client_name,
      "Contact": lead.contact,
      "Lead Type": lead.lead_type || "",
      "Lead Existing Plan": lead.lead_existing_plan || "",
      "Lead Status": lead.lead_status,
      "Remark": lead.remark || "",
      "Call Connected": lead.call_connected === "connected" ? "Connected" : lead.call_connected === "not_connected" ? "Not Connected" : ""
    }));

    const worksheet = XLSX.utils.json_to_sheet(formattedData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Leads");

    // Auto-fit column widths
    const maxColsWidth = formattedData.reduce((acc, row) => {
      Object.keys(row).forEach((key, idx) => {
        const val = row[key as keyof typeof row] || "";
        const len = val.toString().length;
        acc[idx] = Math.max(acc[idx] || 10, len + 3);
      });
      return acc;
    }, [] as number[]);
    worksheet["!cols"] = maxColsWidth.map(w => ({ wch: w }));

    XLSX.writeFile(workbook, `Leads_Export_${new Date().toISOString().split("T")[0]}.xlsx`);
    toast({ title: "Export Success", description: "Leads exported to Excel file." });
  };

  // Download Sample Template Sheet
  const handleDownloadSample = () => {
    const sampleData = [
      {
        "Admission Date": "2026-07-01",
        "Calling Date": "2026-07-01",
        "SR NO": "SY-001",
        "Client Name": "John Doe",
        "Contact": "+91 9876543210",
        "Lead Type": "SNEHYOGA 365",
        "Lead Existing Plan": "SY 365 - 399",
        "Lead Status": "Deal Done",
        "Remark": "Interested in annual subscription"
      },
      {
        "Admission Date": "2026-07-02",
        "Calling Date": "2026-07-02",
        "SR NO": "SY-002",
        "Client Name": "Priya Sharma",
        "Contact": "+91 9123456789",
        "Lead Type": "FACEYOGA",
        "Lead Existing Plan": "FY - 1200",
        "Lead Status": "Follow Up",
        "Remark": "Call back tomorrow evening"
      },
      {
        "Admission Date": "2026-07-02",
        "Calling Date": "2026-07-02",
        "SR NO": "SY-003",
        "Client Name": "Sneha Gupta",
        "Contact": "+91 9988776655",
        "Lead Type": "MSP - 9 Days",
        "Lead Existing Plan": "MWS - 6000",
        "Lead Status": "Select Option",
        "Remark": "New inquiry from Instagram"
      }
    ];

    const worksheet = XLSX.utils.json_to_sheet(sampleData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Leads Sample");

    // Auto-fit column widths
    const colsWidth = [
      { wch: 15 }, // Admission Date
      { wch: 15 }, // Calling Date
      { wch: 10 }, // SR NO
      { wch: 20 }, // Client Name
      { wch: 18 }, // Contact
      { wch: 18 }, // Lead Type
      { wch: 20 }, // Lead Existing Plan
      { wch: 15 }, // Lead Status
      { wch: 30 }  // Remark
    ];
    worksheet["!cols"] = colsWidth;

    XLSX.writeFile(workbook, "Leads_Sample_Template.xlsx");
    toast({ title: "Sample Downloaded", description: "Sample template sheet downloaded successfully." });
  };

  // Import from Excel / CSV
  const handleImportClick = () => {
    fileInputRef.current?.click();
  };

  const parseDate = (val: any): string | null => {
    if (!val) return null;

    // Check if Excel serial date number
    if (typeof val === "number") {
      try {
        const dateObj = XLSX.SSF.parse_date_code(val);
        const y = dateObj.y;
        const m = String(dateObj.m).padStart(2, "0");
        const d = String(dateObj.d).padStart(2, "0");
        return `${y}-${m}-${d}`;
      } catch (e) {
        console.error("Excel serial date parse error:", e);
      }
    }

    const valStr = String(val).trim();
    if (!valStr) return null;

    // Check YYYY-MM-DD
    if (/^\d{4}-\d{2}-\d{2}$/.test(valStr)) {
      return valStr;
    }

    // Try DD/MM/YYYY or DD-MM-YYYY
    const dmyRegex = /^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/;
    const match = valStr.match(dmyRegex);
    if (match) {
      const [_, day, month, year] = match;
      return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
    }

    // fallback standard parse
    try {
      const date = new Date(valStr);
      if (!isNaN(date.getTime())) {
        return date.toISOString().split("T")[0];
      }
    } catch (_) { }

    return null;
  };

  const handleFileImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setLoading(true);
    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const data = evt.target?.result;
        const workbook = XLSX.read(data, { type: "binary" });
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];
        const rawData = XLSX.utils.sheet_to_json(sheet, { header: 1 }) as any[][];

        let headerRowIndex = -1;
        for (let i = 0; i < rawData.length; i++) {
          const rowStr = rawData[i].map(c => String(c || '').toLowerCase()).join(' ');
          if (rowStr.includes('name') || rowStr.includes('client')) {
            headerRowIndex = i;
            break;
          }
        }

        if (headerRowIndex === -1) {
          toast({
            title: "Empty or Invalid File",
            description: "Could not find a header row with a Client Name column.",
            variant: "destructive"
          });
          setLoading(false);
          return;
        }

        const rows = XLSX.utils.sheet_to_json(sheet, { range: headerRowIndex }) as any[];

        if (rows.length === 0) {
          toast({
            title: "Empty File",
            description: "No data rows found in the uploaded file.",
            variant: "destructive"
          });
          setLoading(false);
          return;
        }

        // let currentIndex = getLastAssignedIndex(leads);
        const validLeads: Partial<Lead>[] = [];
        for (const row of rows) {
          // Normalize keys case-insensitively
          const normalizedRow: Record<string, any> = {};
          Object.keys(row).forEach(k => {
            normalizedRow[k.trim().toLowerCase()] = row[k];
          });

          // Extract Client Name (required)
          const clientName = normalizedRow["client name"] || normalizedRow["clientname"] || normalizedRow["name"];
          // Extract Contact (optional now)
          const contact = normalizedRow["contact"] || normalizedRow["phone"] || normalizedRow["mobile"] || normalizedRow["contact number"];

          if (!clientName) continue; // Skip if no client name

          // Map other columns
          const admissionDateRaw = normalizedRow["admission date"] || normalizedRow["admissiondate"] || normalizedRow["date"];
          const callingDateRaw = normalizedRow["calling date"] || normalizedRow["callingdate"];
          const srNo = normalizedRow["sr no"] || normalizedRow["srno"] || normalizedRow["serial"];
          const leadType = normalizedRow["lead type"] || normalizedRow["leadtype"] || normalizedRow["type"];
          const existingPlan = normalizedRow["lead existing plan"] || normalizedRow["plan"] || normalizedRow["existing plan"];
          const leadStatus = normalizedRow["lead status"] || normalizedRow["status"] || normalizedRow["leadstatus"];
          const remark = normalizedRow["remark"] || normalizedRow["remarks"] || normalizedRow["note"];

          // Clean Lead Status
          let finalStatus = "Select Option";
          if (leadStatus) {
            const statusStr = String(leadStatus).trim().toLowerCase();
            if (statusStr.includes("done") || statusStr.includes("deal")) finalStatus = "Deal Done";
            else if (statusStr.includes("dead")) finalStatus = "Dead";
            else if (statusStr.includes("master")) finalStatus = "Master Class Follow";
            else if (statusStr.includes("follow")) finalStatus = "Follow Up";
          }

          // Clean Lead Type
          let finalType = null;
          if (leadType) {
            const typeStr = String(leadType).trim().toUpperCase();
            const match = LEAD_TYPES.find(t => t.toUpperCase() === typeStr);
            if (match) finalType = match;
            else if (typeStr === "SY 365") finalType = "SNEHYOGA 365";
            else finalType = typeStr; // Fallback raw text capitalized
          }

          // Clean Plan
          let finalPlan = null;
          if (existingPlan) {
            const rawPlanStr = String(existingPlan).trim().toLowerCase();
            const normalizedInputStr = rawPlanStr.replace(/\s*-\s*/g, " ").replace(/\s+/g, " ");
            const match = EXISTING_PLANS.find(p => {
              const pLower = p.toLowerCase();
              const pNorm = pLower.replace(/\s*-\s*/g, " ").replace(/\s+/g, " ");
              return pLower === rawPlanStr || pNorm === normalizedInputStr;
            });
            if (match) finalPlan = match;
            else finalPlan = String(existingPlan).trim();
          }

          const assignedToRaw = normalizedRow["assigned to"] || normalizedRow["assignedto"] || normalizedRow["assigned"] || normalizedRow["assigned_to"];
          const callConnectedRaw = normalizedRow["call connected"] || normalizedRow["callconnected"] || normalizedRow["call status"] || normalizedRow["call_connected"];

          let finalAssignedTo: string | null = assignedToRaw ? String(assignedToRaw).trim() : null;
          if (finalAssignedTo) {
            const lower = finalAssignedTo.toLowerCase();
            if (lower.includes("janhavi") || lower.includes("tejasswi") || lower.includes("tejasswini") || lower.includes("tejaswi")) {
              finalAssignedTo = "Tejasswini K";
            } else {
              const match = ASSIGNED_USERS.find(u => u.toLowerCase() === lower);
              if (match) finalAssignedTo = match;
            }
          }

          validLeads.push({
            admission_date: parseDate(admissionDateRaw),
            calling_date: parseDate(callingDateRaw),
            sr_no: srNo ? String(srNo).trim() : null,
            client_name: String(clientName).trim(),
            contact: contact ? String(contact).trim() : "-",
            lead_type: finalType,
            lead_existing_plan: finalPlan,
            lead_status: finalStatus,
            remark: remark ? String(remark).trim() : null,
            call_connected: callConnectedRaw
              ? (String(callConnectedRaw).trim().toLowerCase().includes("not") ? "not_connected" : "connected")
              : autoDetectCallConnected(remark ? String(remark).trim() : null),
            assigned_to: finalAssignedTo
          });
        }

        if (validLeads.length === 0) {
          toast({
            title: "Import Error",
            description: "No valid rows containing client names and contact numbers were found.",
            variant: "destructive"
          });
          setLoading(false);
          return;
        }

        // Deduplicate against existing contacts & plans/dates in state
        // Option 2 (Recall logic):
        // If the same lead has a NEW or DIFFERENT admission date or plan,
        // it is treated as a RECALL and allowed to create a brand new entry in CRM!
        const existingLeadsByPhone: Record<string, Lead[]> = {};
        leads.forEach(l => {
          const clean = (l.contact || "").replace(/\D/g, "");
          const last10 = clean.length >= 10 ? clean.slice(-10) : clean;
          if (last10) {
            if (!existingLeadsByPhone[last10]) existingLeadsByPhone[last10] = [];
            existingLeadsByPhone[last10].push(l);
          }
        });

        const seenImportKeys = new Set<string>();

        const nonDuplicateLeads = validLeads.filter(l => {
          const clean = (l.contact || "").replace(/\D/g, "");
          const last10 = clean.length >= 10 ? clean.slice(-10) : clean;
          if (!last10) return true; // keep entries without phone number

          const inAdmissionDate = (l.admission_date || "").split("T")[0].trim();
          const todayYMD = new Date().toISOString().split("T")[0];
          const inCreatedDate = (l.created_at || todayYMD).split("T")[0].trim();

          // 1. Deduplicate identical rows within the uploaded file itself on the same date
          const fileKey = `${last10}|${inCreatedDate}|${inAdmissionDate}`;
          if (seenImportKeys.has(fileKey)) return false;

          // 2. Check if a lead with same phone ALREADY exists on the SAME Added Date or Admission Date in CRM
          const existingMatches = existingLeadsByPhone[last10] || [];
          const isSameDateDuplicate = existingMatches.some(ex => {
            const exCreatedDate = (ex.created_at || "").split("T")[0].trim();
            const exAdmissionDate = (ex.admission_date || "").split("T")[0].trim();

            const isSameAddedDate = inCreatedDate && exCreatedDate && inCreatedDate === exCreatedDate;
            const isSameAdmissionDate = inAdmissionDate && exAdmissionDate && inAdmissionDate === exAdmissionDate;

            return isSameAddedDate || isSameAdmissionDate;
          });

          if (isSameDateDuplicate) return false;

          seenImportKeys.add(fileKey);
          return true;
        });

        if (nonDuplicateLeads.length === 0) {
          toast({
            title: "All Duplicates Skipped",
            description: `All ${validLeads.length} leads in the file already exist in the database.`,
          });
          setLoading(false);
          return;
        }

        const skippedCount = validLeads.length - nonDuplicateLeads.length;

        // Bulk insert to Supabase
        const { data: insertedLeads, error } = await supabase.from("leads").insert(nonDuplicateLeads).select('id, client_name, assigned_to');
        if (error) throw error;

        if (insertedLeads && insertedLeads.length > 0) {
          const historyLogs = insertedLeads.map(l => ({
            lead_id: l.id,
            action_type: "Imported",
            description: `Lead imported from bulk upload.`,
            created_by: "System"
          }));
          await supabase.from("lead_history").insert(historyLogs);
        }

        toast({
          title: "Import Successful",
          description: `Successfully imported ${nonDuplicateLeads.length} leads.${skippedCount > 0 ? ` (${skippedCount} duplicates skipped)` : ""}`
        });
        fetchLeads();
      } catch (err: any) {
        console.error("Error importing data:", err);
        toast({
          title: "Import Failed",
          description: err.message,
          variant: "destructive"
        });
        setLoading(false);
      }
    };
    reader.readAsBinaryString(file);

    // Reset file input value to allow uploading the same file again
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, statusFilter, typeFilter, assignedToFilter, autoDateFilter, addedDateFilter]);

  const formatLocalDateYMD = (dateVal: string | null | undefined): string => {
    if (!dateVal) return "";
    const d = new Date(dateVal);
    if (isNaN(d.getTime())) return "";
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  };

  const matchesDateFilter = (dateVal: string | null | undefined, filterDate: string): boolean => {
    if (!dateVal || !filterDate) return false;
    if (typeof dateVal === "string" && dateVal.startsWith(filterDate)) return true;

    const d = new Date(dateVal);
    if (isNaN(d.getTime())) return false;

    const localYMD = formatLocalDateYMD(dateVal);
    if (localYMD === filterDate) return true;

    try {
      const utcYMD = d.toISOString().split("T")[0];
      if (utcYMD === filterDate) return true;
    } catch (e) {
      // ignore invalid date
    }

    return false;
  };

  // Group all leads by Unique Mobile Number (Contact)
  // Each unique contact gets 1 primary row, and all duplicate/previous records are stored in entries[]
  const groupedLeads: GroupedLead[] = useMemo(() => {
    const phoneMap = new Map<string, Lead[]>();
    const unkeyedLeads: Lead[] = [];

    leads.forEach(lead => {
      const rawContact = lead.contact || "";
      const cleanDigits = rawContact.replace(/\D/g, "");
      const phoneKey = cleanDigits.length >= 10 ? cleanDigits.slice(-10) : (cleanDigits || (lead.client_name || "").trim().toLowerCase());

      if (!phoneKey) {
        unkeyedLeads.push(lead);
        return;
      }

      if (!phoneMap.has(phoneKey)) {
        phoneMap.set(phoneKey, []);
      }
      phoneMap.get(phoneKey)!.push(lead);
    });

    const statusPriority: Record<string, number> = {
      "Deal Done": 5,
      "Follow Up": 4,
      "Master Class Follow": 3,
      "Dead": 2,
      "Select Option": 1
    };

    const result: GroupedLead[] = [];

    phoneMap.forEach((entries, key) => {
      // Sort entries so that the LATEST entry (newest admission_date or created_at) is primary (index 0).
      // If a user was added again for a new plan and new date, their newest record is displayed in the main table.
      entries.sort((a, b) => {
        // 1. Compare by admission_date (business date of admission / plan start)
        const admA = a.admission_date ? new Date(a.admission_date).getTime() : 0;
        const admB = b.admission_date ? new Date(b.admission_date).getTime() : 0;

        // 2. Compare by created_at (database insertion timestamp)
        const crA = a.created_at ? new Date(a.created_at).getTime() : 0;
        const crB = b.created_at ? new Date(b.created_at).getTime() : 0;

        // Effective newest timestamp (whichever is newer between admission_date and created_at)
        const effA = Math.max(admA, crA);
        const effB = Math.max(admB, crB);

        if (effB !== effA) return effB - effA;

        // If effective dates are equal, prioritize the record that has a plan specified
        const hasPlanA = (a.lead_existing_plan && a.lead_existing_plan.trim().length > 0) ? 1 : 0;
        const hasPlanB = (b.lead_existing_plan && b.lead_existing_plan.trim().length > 0) ? 1 : 0;
        if (hasPlanB !== hasPlanA) return hasPlanB - hasPlanA;

        // Fallback to status priority if dates are identical
        const pA = statusPriority[a.lead_status] || 0;
        const pB = statusPriority[b.lead_status] || 0;
        if (pA !== pB) return pB - pA;

        // Has follow-up date
        const fA = a.follow_up_date ? 1 : 0;
        const fB = b.follow_up_date ? 1 : 0;
        if (fA !== fB) return fB - fA;

        // Has remark
        const rA = a.remark && a.remark.trim().length > 0 ? 1 : 0;
        const rB = b.remark && b.remark.trim().length > 0 ? 1 : 0;
        if (rA !== rB) return rB - rA;

        return 0;
      });

      const primaryLead = entries[0];
      result.push({
        primaryId: primaryLead.id,
        contact: primaryLead.contact,
        normPhone: key,
        client_name: primaryLead.client_name,
        lead: primaryLead,
        entries: entries,
        entriesCount: entries.length
      });
    });

    unkeyedLeads.forEach(lead => {
      result.push({
        primaryId: lead.id,
        contact: lead.contact,
        normPhone: "",
        client_name: lead.client_name,
        lead: lead,
        entries: [lead],
        entriesCount: 1
      });
    });

    return result;
  }, [leads]);

  const filteredGroupedLeads = useMemo(() => {
    return groupedLeads.filter(groupedLead => {
      const lead = groupedLead.lead;

      // Search matches any entry in this contact's history or primary lead
      const matchesSearch = !searchQuery ||
        groupedLead.entries.some(e =>
          (e.client_name || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
          (e.contact || "").includes(searchQuery) ||
          (e.remark || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
          (e.sr_no || "").toLowerCase().includes(searchQuery.toLowerCase())
        );

      const matchesStatus = statusFilter === "all" || lead.lead_status === statusFilter;
      const matchesType = typeFilter === "all" || lead.lead_type === typeFilter;
      const matchesAssignedTo = assignedToFilter === "all" ||
        (assignedToFilter === "unassigned"
          ? (!lead.assigned_to || lead.assigned_to === "")
          : (!!lead.assigned_to && (() => {
            const normAssigned = lead.assigned_to.trim().toLowerCase();
            const normFilter = assignedToFilter.trim().toLowerCase();
            if (normAssigned === normFilter) return true;
            if ((normFilter.includes("tejasswin") || normFilter.includes("tejassw") || normFilter.includes("tejasw") || normFilter.includes("janhavi")) &&
              (normAssigned.includes("tejasswin") || normAssigned.includes("tejassw") || normAssigned.includes("tejasw") || normAssigned.includes("janhavi"))) {
              return true;
            }
            const filterFirstName = normFilter.split(" ")[0];
            return normAssigned.includes(filterFirstName);
          })())
        );

      let matchesAutoDate = true;
      if (autoDateFilter && !addedDateFilter) {
        const isMasterClassFollow = lead.lead_status === "Master Class Follow";
        if (!lead.created_at) {
          matchesAutoDate = matchesDateFilter(lead.follow_up_date, autoDateFilter) || isMasterClassFollow;
        } else {
          const isCreatedToday = matchesDateFilter(lead.created_at, autoDateFilter);
          const isFollowUpToday = matchesDateFilter(lead.follow_up_date, autoDateFilter);
          const localLeadDate = formatLocalDateYMD(lead.created_at);
          const isUntouchedCarryForward = localLeadDate < autoDateFilter &&
            lead.lead_status === "Select Option" &&
            !lead.follow_up_date;

          matchesAutoDate = isCreatedToday || isFollowUpToday || isUntouchedCarryForward || isMasterClassFollow;
        }
      }

      let matchesAddedDate = true;
      if (addedDateFilter) {
        const matchesCreated = matchesDateFilter(lead.created_at, addedDateFilter);
        const matchesAdmission = matchesDateFilter(lead.admission_date, addedDateFilter);
        matchesAddedDate = matchesCreated || matchesAdmission;
      }

      return matchesSearch && matchesStatus && matchesType && matchesAssignedTo && matchesAutoDate && matchesAddedDate;
    });
  }, [groupedLeads, searchQuery, statusFilter, typeFilter, assignedToFilter, autoDateFilter, addedDateFilter]);

  const targetSortDate = autoDateFilter || addedDateFilter || new Date().toISOString().split("T")[0];
  const sortedFilteredGroupedLeads = useMemo(() => {
    return [...filteredGroupedLeads].sort((a, b) => {
      if (addedDateFilter) {
        const dateA = a.lead.created_at ? new Date(a.lead.created_at).getTime() : 0;
        const dateB = b.lead.created_at ? new Date(b.lead.created_at).getTime() : 0;
        return dateB - dateA;
      }
      const aIsTargetDate = a.lead.follow_up_date === targetSortDate;
      const bIsTargetDate = b.lead.follow_up_date === targetSortDate;
      if (aIsTargetDate && !bIsTargetDate) return -1;
      if (!aIsTargetDate && bIsTargetDate) return 1;
      return 0;
    });
  }, [filteredGroupedLeads, addedDateFilter, targetSortDate]);

  // Backward-compatible flat array for components/exports
  const filteredLeads = useMemo(() => sortedFilteredGroupedLeads.map(gl => gl.lead), [sortedFilteredGroupedLeads]);

  const totalPages = Math.ceil(sortedFilteredGroupedLeads.length / itemsPerPage);
  const paginatedGroupedLeads = sortedFilteredGroupedLeads.slice(0, currentPage * itemsPerPage);

  const isAllSelected = sortedFilteredGroupedLeads.length > 0 && sortedFilteredGroupedLeads.every(gl => selectedLeadIds.includes(gl.primaryId));

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      const currentIds = sortedFilteredGroupedLeads.map(gl => gl.primaryId);
      setSelectedLeadIds(Array.from(new Set([...selectedLeadIds, ...currentIds])));
    } else {
      const currentIds = new Set(sortedFilteredGroupedLeads.map(gl => gl.primaryId));
      setSelectedLeadIds(selectedLeadIds.filter(id => !currentIds.has(id)));
    }
  };

  const handleSelectRow = (leadId: string, checked: boolean) => {
    if (checked) {
      setSelectedLeadIds(prev => [...prev, leadId]);
    } else {
      setSelectedLeadIds(prev => prev.filter(id => id !== leadId));
    }
  };

  return (
    <div className="space-y-6">
      {/* Header Panel */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
              <ClipboardList className="text-[#2e5a44]" /> Leads Management
            </h1>
            {syncInfo.state === "idle" && (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 text-xs font-semibold rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                <CheckCircle className="w-3.5 h-3.5 text-emerald-600" />
                All changes saved
              </span>
            )}
            {syncInfo.state === "syncing" && (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 text-xs font-semibold rounded-full bg-blue-50 text-blue-700 border border-blue-200 animate-pulse">
                <RefreshCw className="w-3.5 h-3.5 animate-spin text-blue-600" />
                Saving {syncInfo.pendingCount} update{syncInfo.pendingCount > 1 ? "s" : ""}...
              </span>
            )}
            {syncInfo.state === "offline" && (
              <button
                type="button"
                onClick={() => leadSyncService.syncNow()}
                className="inline-flex items-center gap-1.5 px-2.5 py-0.5 text-xs font-semibold rounded-full bg-amber-50 text-amber-800 border border-amber-300 hover:bg-amber-100 transition-colors cursor-pointer"
                title="Internet is offline. Updates are safely stored in browser cache. Click to retry sync."
              >
                <WifiOff className="w-3.5 h-3.5 text-amber-600" />
                Offline ({syncInfo.pendingCount} saved locally - Retry)
              </button>
            )}
            {syncInfo.state === "pending" && (
              <button
                type="button"
                onClick={() => leadSyncService.syncNow()}
                className="inline-flex items-center gap-1.5 px-2.5 py-0.5 text-xs font-semibold rounded-full bg-blue-50 text-blue-800 border border-blue-200 hover:bg-blue-100 transition-colors cursor-pointer"
                title="Updates saved locally. Syncing in background. Click to sync immediately."
              >
                <RefreshCw className="w-3.5 h-3.5 text-blue-600 animate-spin" />
                {syncInfo.pendingCount} pending • Syncing
              </button>
            )}
          </div>
          <p className="text-sm text-gray-500 mt-1">Manage leads, update plans, change statuses, and import/export data sheets.</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button variant="outline" size="sm" onClick={fetchLeads} disabled={loading}>
            <RefreshCw className={`w-4 h-4 mr-1 ${loading ? "animate-spin" : ""}`} /> Refresh
          </Button>
          <Button variant="outline" size="sm" className="border-gray-200" onClick={handleExport}>
            <Download className="w-4 h-4 mr-1" /> Export Data
          </Button>
          <input
            type="file"
            ref={fileInputRef}
            className="hidden"
            accept=".xlsx,.xls,.csv"
            onChange={handleFileImport}
          />
          <Button variant="outline" size="sm" className="border-emerald-300 text-[#2e5a44] hover:bg-emerald-50 font-semibold" onClick={handleDownloadSample}>
            <FileSpreadsheet className="w-4 h-4 mr-1 text-[#2e5a44]" /> Sample Sheet
          </Button>
          <Button variant="outline" size="sm" className="border-gray-200" onClick={handleImportClick}>
            <Upload className="w-4 h-4 mr-1" /> Import Data
          </Button>
          <Button variant="outline" size="sm" className="border-amber-300 text-amber-800 hover:bg-amber-50 font-semibold" onClick={handleAnalyzeDuplicates}>
            <Sparkles className="w-4 h-4 mr-1 text-amber-600" /> Clean Duplicates
          </Button>
          <Button variant="outline" size="sm" className="border-blue-300 text-blue-700 hover:bg-blue-50 font-semibold" onClick={() => setIsSheetSyncOpen(true)}>
            <FileCode className="w-4 h-4 mr-1 text-blue-600" /> Google Sheet Sync
          </Button>
          <Button size="sm" className="bg-[#2e5a44] hover:bg-[#203f2f] text-white" onClick={handleOpenAddDialog}>
            <Plus className="w-4 h-4 mr-1" /> Add Lead
          </Button>
        </div>
      </div>

      {/* Filters Card */}
      <Card className="border-none shadow-sm bg-white">
        <CardContent className="pt-6">
          <div className="grid grid-cols-1 sm:grid-cols-6 gap-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <Input
                placeholder="Search name, contact, remark..."
                className="pl-10 h-10"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
              />
            </div>

            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger className="bg-white h-10">
                <SelectValue placeholder="All Lead Types" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Lead Types</SelectItem>
                {LEAD_TYPES.map(t => (
                  <SelectItem key={t} value={t}>{t}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="bg-white h-10">
                <SelectValue placeholder="All Statuses" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                {LEAD_STATUSES.map(s => (
                  <SelectItem key={s.id} value={s.id}>{s.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={assignedToFilter} onValueChange={setAssignedToFilter}>
              <SelectTrigger className="bg-white h-10">
                <SelectValue placeholder="All Users / Unassigned" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Assigned Users</SelectItem>
                <SelectItem value="unassigned" className="text-amber-700 font-semibold">Unassigned Only</SelectItem>
                {ASSIGNED_USERS.map(u => (
                  <SelectItem key={u} value={u}>{u}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <div className="relative" title="Auto Date Filter">
              <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none">
                <Calendar className="w-4 h-4 text-[#2e5a44]" />
              </div>
              <Input
                type="date"
                className="pl-10 bg-white text-gray-700 h-10 cursor-pointer"
                value={autoDateFilter}
                onClick={e => e.currentTarget.showPicker?.()}
                onChange={e => {
                  setAutoDateFilter(e.target.value);
                  if (e.target.value) setAddedDateFilter("");
                }}
              />
              {autoDateFilter && (
                <button
                  onClick={() => setAutoDateFilter("")}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
              <span className="absolute -top-2.5 left-2 bg-white px-1 text-[10px] text-gray-500">Auto Date</span>
            </div>

            <div className="relative" title="Filter by Added Date or Admission Date">
              <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none">
                <Calendar className="w-4 h-4 text-gray-400" />
              </div>
              <Input
                type="date"
                className="pl-10 bg-white text-gray-700 h-10 cursor-pointer"
                value={addedDateFilter}
                onClick={e => e.currentTarget.showPicker?.()}
                onChange={e => {
                  setAddedDateFilter(e.target.value);
                  if (e.target.value) setAutoDateFilter("");
                }}
              />
              {addedDateFilter && (
                <button
                  onClick={() => setAddedDateFilter("")}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
              <span className="absolute -top-2.5 left-2 bg-white px-1 text-[10px] text-gray-500">Added Date</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Bulk Action Toolbar */}
      {selectedLeadIds.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-[#2e5a44] text-white px-4 py-3 rounded-lg shadow-md flex flex-wrap items-center justify-between gap-4 border border-[#3f7a5d]"
        >
          <div className="flex items-center gap-2 font-medium">
            <CheckSquare className="w-5 h-5 text-green-300" />
            <span><strong className="text-white text-base">{selectedLeadIds.length}</strong> lead{selectedLeadIds.length > 1 ? "s" : ""} selected</span>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <Button
              size="sm"
              onClick={() => setIsBulkAssignOpen(true)}
              className="bg-white text-[#2e5a44] hover:bg-gray-100 font-bold shadow-sm"
            >
              <Users className="w-4 h-4 mr-1.5" /> Bulk Assign Users
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={handleBulkDelete}
              className="border-red-400 text-red-100 hover:bg-red-800/40 hover:text-white bg-transparent"
            >
              <Trash2 className="w-4 h-4 mr-1" /> Delete Selected
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setSelectedLeadIds([])}
              className="text-gray-200 hover:text-white hover:bg-[#203f2f]"
            >
              Clear Selection
            </Button>
          </div>
        </motion.div>
      )}

      {/* Leads Table Card */}
      <Card className="border-none shadow-md overflow-hidden bg-white w-full max-w-full min-w-0">

        {/* Top Horizontal Scrollbar Container */}
        <div
          ref={topScrollRef}
          onScroll={handleTopScroll}
          className="w-full overflow-x-auto overflow-y-hidden table-container border-b border-gray-100"
        >
          <div style={{ width: `${tableWidth}px`, height: '1px' }}></div>
        </div>

        {/* Main Table Container */}
        <div
          ref={tableContainerRef}
          onScroll={handleTableScroll}
          className="w-full max-w-full min-w-0 rounded-b-lg table-container max-h-[calc(100vh-260px)] overflow-auto relative"
        >
          <table ref={tableRef} className="w-full min-w-[2200px] relative border-collapse caption-bottom text-sm" style={{ tableLayout: 'auto' }}>
            <TableHeader className="bg-[#2e5a44] shadow-md sticky top-0 z-20">
              <TableRow className="hover:bg-[#2e5a44] border-none">
                <TableHead className="w-10 sticky top-0 left-0 z-30 bg-[#2e5a44] p-2 text-center">
                  <Checkbox
                    checked={isAllSelected}
                    onCheckedChange={handleSelectAll}
                    className="border-white/70 data-[state=checked]:bg-white data-[state=checked]:text-[#2e5a44]"
                  />
                </TableHead>
                <TableHead className="text-white font-semibold w-14 sticky top-0 left-[40px] z-30 bg-[#2e5a44]">SR NO</TableHead>
                <TableHead className="text-white font-semibold w-[160px] sticky top-0 left-[96px] z-30 bg-[#2e5a44] border-r border-[#3a6e54]">CLIENT NAME</TableHead>
                <TableHead className="text-white font-semibold min-w-[140px] sticky top-0 z-20 bg-[#2e5a44]">CONTACT</TableHead>
                <TableHead className="text-white font-semibold min-w-[160px] sticky top-0 z-20 bg-[#2e5a44]">LEAD TYPE</TableHead>
                <TableHead className="text-white font-semibold min-w-[180px] sticky top-0 z-20 bg-[#2e5a44]">LEAD EXISTING PLAN</TableHead>
                <TableHead className="text-white font-semibold min-w-[140px] sticky top-0 z-20 bg-[#2e5a44]">LEAD STATUS</TableHead>
                <TableHead className="text-white font-semibold min-w-[140px] sticky top-0 z-20 bg-[#2e5a44]">FOLLOW-UP DATE</TableHead>
                <TableHead className="text-white font-semibold min-w-[320px] sticky top-0 z-20 bg-[#2e5a44]">REMARK & CALL STATUS</TableHead>
                <TableHead className="text-white font-semibold min-w-[120px] sticky top-0 z-20 bg-[#2e5a44]">Added Date</TableHead>
                <TableHead className="text-white font-semibold min-w-[140px] sticky top-0 z-20 bg-[#2e5a44]">Admission Date</TableHead>
                <TableHead className="text-white font-semibold min-w-[140px] sticky top-0 z-20 bg-[#2e5a44]">Calling Date</TableHead>
                <TableHead className="text-white font-semibold min-w-[140px] sticky top-0 z-20 bg-[#2e5a44]">ASSIGNED TO</TableHead>
                <TableHead className="text-white font-semibold text-center min-w-24 sticky top-0 z-20 bg-[#2e5a44]">ACTIONS</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paginatedGroupedLeads.map((groupedLead, index) => (
                <LeadRow
                  key={groupedLead.primaryId}
                  groupedLead={groupedLead}
                  index={index}
                  isSelected={selectedLeadIds.includes(groupedLead.primaryId)}
                  handlers={{
                    handleSelectRow,
                    handleUpdateField,
                    handleUpdateLeadType,
                    handleUpdateExistingPlan,
                    handleUpdateStatus,
                    handleUpdateAssignedTo,
                    handleUpdateCallConnected,
                    handleUpdateRemark,
                    handleOpenHistory,
                    handleOpenEditDialog,
                    handleOpenLeadTimeline
                  }}
                />
              ))}

              {filteredGroupedLeads.length === 0 && (
                <TableRow>
                  <TableCell colSpan={14} className="text-center py-12 text-gray-400">
                    {loading ? (
                      <div className="flex justify-center items-center gap-2">
                        <RefreshCw className="animate-spin w-4 h-4" /> Fetching leads...
                      </div>
                    ) : (
                      "No leads matching current search/filter."
                    )}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </table>
        </div>

        {/* Infinite Scroll Indicator */}
        {sortedFilteredGroupedLeads.length > 0 && (
          <div className="flex justify-center items-center px-4 py-3 bg-gray-50 border-t border-gray-200 rounded-b-lg">
            <div className="text-sm text-gray-500 font-medium">
              {currentPage < totalPages
                ? "Scroll down to load more..."
                : `Showing all ${sortedFilteredGroupedLeads.length} unique contacts (${leads.length} total entries)`}
            </div>
          </div>
        )}
      </Card>

      {/* Add / Edit Dialog */}
      <Dialog open={isOpenAddEditDialog} onOpenChange={setIsOpenAddEditDialog}>
        <DialogContent className="max-w-md bg-white">
          <DialogHeader>
            <DialogTitle className="text-[#2e5a44] font-bold">
              {editingLead ? "Edit Lead Details" : "Add New Lead"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="admission_date" className="flex items-center gap-1 text-gray-700">
                  <Calendar className="w-3.5 h-3.5" /> Admission Date
                </Label>
                <Input
                  id="admission_date"
                  type="date"
                  value={leadForm.admission_date}
                  onChange={e => setLeadForm(prev => ({ ...prev, admission_date: e.target.value }))}
                />
              </div>
              <div>
                <Label htmlFor="calling_date" className="flex items-center gap-1 text-gray-700">
                  <Calendar className="w-3.5 h-3.5" /> Calling Date
                </Label>
                <Input
                  id="calling_date"
                  type="date"
                  value={leadForm.calling_date}
                  onChange={e => setLeadForm(prev => ({ ...prev, calling_date: e.target.value }))}
                />
              </div>
            </div>

            <div>
              <Label htmlFor="client_name" className="flex items-center gap-1 text-gray-700">
                <User className="w-3.5 h-3.5" /> Client Name *
              </Label>
              <Input
                id="client_name"
                placeholder="John Doe"
                value={leadForm.client_name || ""}
                onChange={e => setLeadForm(prev => ({ ...prev, client_name: e.target.value }))}
              />
            </div>

            <div>
              <Label htmlFor="contact" className="flex items-center gap-1 text-gray-700">
                <Phone className="w-3.5 h-3.5" /> Contact / Phone *
              </Label>
              <Input
                id="contact"
                placeholder="e.g. +91 9876543210"
                value={leadForm.contact || ""}
                onChange={e => setLeadForm(prev => ({ ...prev, contact: e.target.value }))}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-gray-700">Lead Type</Label>
                <Select
                  value={leadForm.lead_type || ""}
                  onValueChange={val => setLeadForm(prev => ({ ...prev, lead_type: val }))}
                >
                  <SelectTrigger className="bg-white">
                    <SelectValue placeholder="Select type" />
                  </SelectTrigger>
                  <SelectContent>
                    {LEAD_TYPES.map(t => (
                      <SelectItem key={t} value={t}>{t}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label className="text-gray-700">Existing Plan</Label>
                <Select
                  value={leadForm.lead_existing_plan || ""}
                  onValueChange={val => setLeadForm(prev => ({ ...prev, lead_existing_plan: val }))}
                >
                  <SelectTrigger className="bg-white">
                    <SelectValue placeholder="Select plan" />
                  </SelectTrigger>
                  <SelectContent>
                    {EXISTING_PLANS.map(p => (
                      <SelectItem key={p} value={p}>{p}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <Label className="text-gray-700">Lead Status</Label>
              <Select
                value={leadForm.lead_status}
                onValueChange={val => setLeadForm(prev => ({ ...prev, lead_status: val }))}
              >
                <SelectTrigger className="bg-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {LEAD_STATUSES.map(s => (
                    <SelectItem key={s.id} value={s.id} className="font-semibold">{s.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="remark" className="text-gray-700">Remark / Notes</Label>
                <Input
                  id="remark"
                  placeholder="Details of followup discussion..."
                  value={leadForm.remark || ""}
                  onChange={e => {
                    const newRemark = e.target.value;
                    const detected = autoDetectCallConnected(newRemark);
                    setLeadForm(prev => ({ ...prev, remark: newRemark, call_connected: detected }));
                  }}
                />
              </div>
              <div>
                <Label className="text-gray-700">Call Status</Label>
                <Select
                  value={leadForm.call_connected || "none"}
                  onValueChange={val => setLeadForm(prev => ({ ...prev, call_connected: val === "none" ? null : val }))}
                >
                  <SelectTrigger className={`${leadForm.call_connected === "connected"
                      ? "bg-emerald-50 border-emerald-300 text-emerald-800"
                      : leadForm.call_connected === "not_connected"
                        ? "bg-red-50 border-red-300 text-red-700"
                        : "bg-white"
                    }`}>
                    <SelectValue placeholder="Auto-detect" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none" className="text-gray-500">— None —</SelectItem>
                    <SelectItem value="connected" className="font-bold text-emerald-700">✅ Connected</SelectItem>
                    <SelectItem value="not_connected" className="font-bold text-red-700">❌ Not Connected</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="follow_up_date" className="flex items-center gap-1 text-gray-700">
                  <Calendar className="w-3.5 h-3.5" /> Follow-Up Date
                </Label>
                <Input
                  id="follow_up_date"
                  type="date"
                  value={leadForm.follow_up_date || ""}
                  onChange={e => setLeadForm(prev => ({ ...prev, follow_up_date: e.target.value }))}
                />
              </div>
              <div>
                <Label className="flex items-center gap-1 text-gray-700">
                  <User className="w-3.5 h-3.5" /> Assigned To
                </Label>
                <Select
                  value={leadForm.assigned_to || "unassigned"}
                  onValueChange={val => setLeadForm(prev => ({ ...prev, assigned_to: val === "unassigned" ? null : val }))}
                >
                  <SelectTrigger className="bg-white">
                    <SelectValue placeholder="Select user" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="unassigned" className="text-gray-500">— Unassigned —</SelectItem>
                    {ASSIGNED_USERS.map(u => (
                      <SelectItem key={u} value={u}>{u}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setIsOpenAddEditDialog(false)}>
              Cancel
            </Button>
            <Button className="bg-[#2e5a44] hover:bg-[#203f2f] text-white" onClick={handleSaveLead}>
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Bulk Assign Dialog */}
      <Dialog open={isBulkAssignOpen} onOpenChange={setIsBulkAssignOpen}>
        <DialogContent className="max-w-md bg-white">
          <DialogHeader>
            <DialogTitle className="text-[#2e5a44] font-bold flex items-center gap-2">
              <Users className="w-5 h-5" /> Bulk Assign Leads ({selectedLeadIds.length})
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-5 py-3">
            <div className="flex gap-2 p-1 bg-gray-100 rounded-lg">
              <button
                type="button"
                onClick={() => setBulkAssignMode("single")}
                className={`flex-1 py-1.5 text-xs font-semibold rounded-md transition-all ${bulkAssignMode === "single" ? "bg-white text-[#2e5a44] shadow-sm" : "text-gray-600 hover:text-gray-900"}`}
              >
                Single User Assignment
              </button>
              <button
                type="button"
                onClick={() => setBulkAssignMode("split")}
                className={`flex-1 py-1.5 text-xs font-semibold rounded-md transition-all ${bulkAssignMode === "split" ? "bg-white text-[#2e5a44] shadow-sm" : "text-gray-600 hover:text-gray-900"}`}
              >
                Round-Robin Distribution
              </button>
            </div>

            {bulkAssignMode === "single" ? (
              <div className="space-y-2">
                <Label className="text-gray-700 font-medium">Select User to Assign All {selectedLeadIds.length} Leads:</Label>
                <Select value={bulkSingleUser} onValueChange={setBulkSingleUser}>
                  <SelectTrigger className="bg-white border-gray-200 h-10 font-medium">
                    <SelectValue placeholder="Select user" />
                  </SelectTrigger>
                  <SelectContent>
                    {ASSIGNED_USERS.map(u => (
                      <SelectItem key={u} value={u} className="font-medium">{u}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-gray-500 mt-1">All selected leads will be assigned directly to <strong className="text-gray-700">{bulkSingleUser}</strong>.</p>
              </div>
            ) : (
              <div className="space-y-3">
                <Label className="text-gray-700 font-medium">Select Staff Members for Equal Distribution:</Label>
                <div className="space-y-2 border border-gray-200 rounded-lg p-3 bg-gray-50/50">
                  {ASSIGNED_USERS.map(user => {
                    const isChecked = bulkSplitUsers.includes(user);
                    return (
                      <label
                        key={user}
                        className="flex items-center gap-3 p-2 rounded-md hover:bg-white cursor-pointer transition-colors border border-transparent hover:border-gray-200"
                      >
                        <Checkbox
                          checked={isChecked}
                          onCheckedChange={(checked) => {
                            if (checked) {
                              setBulkSplitUsers(prev => [...prev, user]);
                            } else {
                              setBulkSplitUsers(prev => prev.filter(u => u !== user));
                            }
                          }}
                          className="data-[state=checked]:bg-[#2e5a44] data-[state=checked]:border-[#2e5a44]"
                        />
                        <span className="text-sm font-semibold text-gray-800">{user}</span>
                      </label>
                    );
                  })}
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  {selectedLeadIds.length} leads will be distributed equally among the <strong className="text-gray-700">{bulkSplitUsers.length}</strong> selected user(s).
                </p>
              </div>
            )}
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setIsBulkAssignOpen(false)} disabled={isBulkAssigning}>
              Cancel
            </Button>
            <Button
              className="bg-[#2e5a44] hover:bg-[#203f2f] text-white font-semibold"
              onClick={handleBulkAssignSubmit}
              disabled={isBulkAssigning || (bulkAssignMode === "split" && bulkSplitUsers.length === 0)}
            >
              {isBulkAssigning ? (
                <div className="flex items-center gap-2">
                  <RefreshCw className="animate-spin w-4 h-4" /> Assigning...
                </div>
              ) : (
                `Confirm Assignment (${selectedLeadIds.length})`
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Lead History Dialog */}
      <Dialog open={showHistoryDialog} onOpenChange={setShowHistoryDialog}>
        <DialogContent className="max-w-lg bg-white">
          <DialogHeader>
            <DialogTitle className="text-[#2e5a44] font-bold">
              Lead History - {selectedLeadForHistory?.client_name}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4 max-h-[60vh] overflow-y-auto pr-2">
            {selectedLeadHistory.length > 0 ? (
              selectedLeadHistory.map((history) => (
                <div key={history.id} className="bg-gray-50 p-3 rounded-lg border border-gray-100">
                  <div className="flex justify-between items-start mb-1">
                    <span className="font-semibold text-sm text-[#2e5a44]">{history.action_type}</span>
                    <span className="text-xs text-gray-400">
                      {new Date(history.created_at).toLocaleString("en-IN", {
                        day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit"
                      })}
                    </span>
                  </div>
                  <p className="text-sm text-gray-600 mt-1">{history.description}</p>
                </div>
              ))
            ) : (
              <p className="text-center text-gray-500 py-8">No history available for this lead.</p>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Google Sheet Auto Sync Dialog */}
      <Dialog open={isSheetSyncOpen} onOpenChange={setIsSheetSyncOpen}>
        <DialogContent className="max-w-2xl bg-white max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-[#2e5a44] font-bold text-xl flex items-center gap-2">
              <FileCode className="w-6 h-6 text-[#2e5a44]" /> Google Sheet 1-Minute Auto-Sync Setup
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2 text-sm text-gray-700">
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-blue-900 text-xs leading-relaxed">
              <strong>⚡ Automated 1-Minute Scanner:</strong> This script scans your Google Sheet every minute, extracts <strong>Client Name</strong>, <strong>Contact</strong>, and <strong>Admission Date</strong>, checks if the lead is already in our CRM system, and adds only new, non-existing leads!
            </div>

            <div className="border border-gray-200 rounded-lg p-3 bg-gray-50 space-y-2">
              <p className="font-semibold text-gray-900 text-xs uppercase tracking-wider">Required Sheet Header Columns (Row 1):</p>
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 text-xs font-mono">
                <span className="bg-emerald-100 text-emerald-800 px-2 py-1 rounded font-bold border border-emerald-300">1. Client Name *</span>
                <span className="bg-emerald-100 text-emerald-800 px-2 py-1 rounded font-bold border border-emerald-300">2. Contact *</span>
                <span className="bg-gray-200 text-gray-700 px-2 py-1 rounded">3. Email</span>
                <span className="bg-gray-200 text-gray-700 px-2 py-1 rounded">4. Amount Paid</span>
                <span className="bg-emerald-100 text-emerald-800 px-2 py-1 rounded font-bold border border-emerald-300">5. Admission Date *</span>
                <span className="bg-gray-200 text-gray-700 px-2 py-1 rounded">6. End Date</span>
                <span className="bg-gray-200 text-gray-700 px-2 py-1 rounded">7. Plan</span>
                <span className="bg-gray-200 text-gray-700 px-2 py-1 rounded">8. Status</span>
                <span className="bg-amber-100 text-amber-800 px-2 py-1 rounded font-bold border border-amber-300">9. ASSIGNED TO</span>
                <span className="bg-blue-100 text-blue-800 px-2 py-1 rounded font-bold border border-blue-300">10. lead CRM status</span>
              </div>
            </div>

            <div className="space-y-2">
              <p className="font-bold text-gray-900">Step-by-Step Setup Instructions:</p>
              <ol className="list-decimal pl-5 space-y-1.5 text-xs text-gray-600">
                <li>Open your Google Sheet containing the lead data.</li>
                <li>In top menu, click <strong>Extensions &gt; Apps Script</strong>.</li>
                <li>Delete any default code inside the Apps Script editor.</li>
                <li>Copy the script below and paste it into the Apps Script editor.</li>
                <li>Click <strong>Save</strong> (Ctrl + S or Cmd + S).</li>
                <li>From the top toolbar dropdown, select the function <strong className="text-[#2e5a44]">setup1MinuteTrigger</strong> and click <strong>Run</strong>.</li>
                <li>Grant standard permissions when Google prompts you. You're all set!</li>
              </ol>
            </div>

            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <span className="font-semibold text-xs text-gray-700">Google Apps Script Code:</span>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    const scriptCode = `var SUPABASE_URL = "https://bzqwaxqzggejpejyxhde.supabase.co";
var SUPABASE_KEY = "sb_publishable_aWZ6_LgTmBCAj7RHgmoDwg_YB4H1Ts4";

function scanAndSyncLeads() {
  try {
    var sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
    var data = sheet.getDataRange().getValues();
    if (data.length <= 1) return;

    var headerRow = data[0].map(function(h) { return String(h || "").trim().toLowerCase(); });
    var clientNameIdx = headerRow.indexOf("client name");
    var contactIdx = headerRow.indexOf("contact");
    var admissionDateIdx = headerRow.indexOf("admission date");
    
    var assignedToIdx = -1;
    for (var c = 0; c < headerRow.length; c++) {
      var h = headerRow[c];
      if (h.indexOf("assigned to") !== -1 || h.indexOf("assigned") !== -1) {
        assignedToIdx = c;
        break;
      }
    }

    var planIdx = -1;
    for (var c = 0; c < headerRow.length; c++) {
      var h = headerRow[c];
      if (h.indexOf("plan") !== -1 || h.indexOf("program") !== -1) {
        planIdx = c;
        break;
      }
    }

    var crmStatusIdx = -1;
    for (var c = 0; c < headerRow.length; c++) {
      var h = headerRow[c];
      if (h.indexOf("lead crm status") !== -1 || h.indexOf("crm status") !== -1) {
        crmStatusIdx = c;
        break;
      }
    }

    if (clientNameIdx === -1) clientNameIdx = headerRow.findIndex(function(h) { return h.includes("client") || h.includes("name"); });
    if (contactIdx === -1) contactIdx = headerRow.findIndex(function(h) { return h.includes("contact") || h.includes("phone") || h.includes("mobile"); });
    if (admissionDateIdx === -1) admissionDateIdx = headerRow.findIndex(function(h) { return h.includes("admission") || h.includes("date"); });

    if (clientNameIdx === -1 || contactIdx === -1) return;

    if (crmStatusIdx === -1) {
      crmStatusIdx = 9;
      sheet.getRange(1, 10).setValue("lead CRM status").setFontWeight("bold");
    }

    var KNOWN_STAFF = ["Mayuri K", "Ragini K", "Shreya K", "Tejasswini K", "Tejasswi K", "Janhavi V", "Janhavi Vaidya"];
    function formatAssignedTo(val) {
      if (!val) return null;
      var str = String(val).trim();
      if (!str) return null;
      var lower = str.toLowerCase();
      if (lower.indexOf("janhavi") !== -1 || lower.indexOf("tejasswi") !== -1 || lower.indexOf("tejasswini") !== -1 || lower.indexOf("tejaswi") !== -1) {
        return "Tejasswini K";
      }
      for (var s = 0; s < KNOWN_STAFF.length; s++) {
        if (KNOWN_STAFF[s].toLowerCase() === lower) return KNOWN_STAFF[s];
      }
      return str;
    }

    function cleanPhoneLast10(val) {
      if (!val) return "";
      var digits = String(val).replace(/\\D/g, "");
      return digits.length >= 10 ? digits.slice(-10) : digits;
    }

    function normalizeDateStr(d) {
      if (!d) return "";
      if (d instanceof Date && !isNaN(d.getTime())) {
        return Utilities.formatDate(d, Session.getScriptTimeZone(), "yyyy-MM-dd");
      }
      return String(d).split("T")[0].trim();
    }

    function normalizePlanStr(p) {
      return String(p || "").trim().toLowerCase().replace(/\\s+/g, " ");
    }

    // 2. Fetch ALL existing leads from Supabase using PAGINATION
    var existingLeads = [];
    var offset = 0;
    var pageSize = 1000;
    var hasMore = true;

    while (hasMore) {
      var getOptions = {
        method: "get",
        headers: { "apikey": SUPABASE_KEY, "Authorization": "Bearer " + SUPABASE_KEY },
        muteHttpExceptions: true
      };
      var fetchUrl = SUPABASE_URL + "/rest/v1/leads?select=id,contact,client_name,assigned_to,admission_date,lead_existing_plan&offset=" + offset + "&limit=" + pageSize;
      var response = UrlFetchApp.fetch(fetchUrl, getOptions);
      if (response.getResponseCode() !== 200) break;

      var pageData = JSON.parse(response.getContentText());
      if (!pageData || pageData.length === 0) {
        hasMore = false;
      } else {
        existingLeads = existingLeads.concat(pageData);
        if (pageData.length < pageSize) {
          hasMore = false;
        } else {
          offset += pageSize;
        }
      }
    }

    var existingByPhone = {};
    function addToLookup(leadObj) {
      if (leadObj.contact) {
        var phoneKey = cleanPhoneLast10(leadObj.contact);
        if (phoneKey) {
          if (!existingByPhone[phoneKey]) existingByPhone[phoneKey] = [];
          existingByPhone[phoneKey].push(leadObj);
        }
      }
      if (leadObj.client_name && leadObj.contact) {
        var combo = (String(leadObj.client_name).trim() + "_" + String(leadObj.contact).trim()).toLowerCase();
        if (!existingByPhone[combo]) existingByPhone[combo] = [];
        existingByPhone[combo].push(leadObj);
      }
    }

    for (var i = 0; i < existingLeads.length; i++) {
      addToLookup(existingLeads[i]);
    }

    var newLeadsToInsert = [];
    var existingLeadsToUpdate = [];

    for (var r = 1; r < data.length; r++) {
      var row = data[r];
      var clientName = String(row[clientNameIdx] || "").trim();
      var contact = String(row[contactIdx] || "").trim();
      var rawAdmissionDate = admissionDateIdx !== -1 ? row[admissionDateIdx] : null;
      var rawAssignedTo = assignedToIdx !== -1 ? row[assignedToIdx] : null;
      var rawPlan = planIdx !== -1 ? row[planIdx] : null;
      var crmStatus = crmStatusIdx !== -1 ? String(row[crmStatusIdx] || "").trim().toLowerCase() : "";

      if (!clientName || !contact) continue;

      var phoneKey = cleanPhoneLast10(contact);
      var comboKey = (clientName + "_" + contact).toLowerCase();
      var candidates = (phoneKey && existingByPhone[phoneKey]) || existingByPhone[comboKey] || [];
      var assignedTo = formatAssignedTo(rawAssignedTo);
      var cleanPlan = rawPlan ? String(rawPlan).trim() : null;

      var formattedAdmissionDate = parseSheetDate(rawAdmissionDate);
      var inDateNorm = normalizeDateStr(formattedAdmissionDate);
      var inPlanNorm = normalizePlanStr(cleanPlan);
      var isDoneInSheet = (crmStatus === "done");

      // Case A: Contact already exists in database -> Never duplicate! Update assignment if needed and mark Done
      if (candidates.length > 0) {
        var latestCand = candidates[0];
        if (assignedTo && (latestCand.assigned_to || "").toLowerCase() !== assignedTo.toLowerCase()) {
          existingLeadsToUpdate.push({ id: latestCand.id, assigned_to: assignedTo });
          latestCand.assigned_to = assignedTo;
        }
        sheet.getRange(r + 1, crmStatusIdx + 1).setValue("Done");
        continue;
      }

      // Case B: Sheet already marked Done
      if (isDoneInSheet) {
        continue;
      }

      // Case C: Brand new contact -> prepare for insert
      var newLeadItem = {
        client_name: clientName,
        contact: contact,
        admission_date: formattedAdmissionDate,
        lead_existing_plan: cleanPlan,
        assigned_to: assignedTo,
        lead_status: "Select Option",
        created_at: new Date().toISOString(),
        rowIndex: r + 1
      };
      newLeadsToInsert.push(newLeadItem);
      addToLookup(newLeadItem);
    }

    if (existingLeadsToUpdate.length > 0) {
      for (var u = 0; u < existingLeadsToUpdate.length; u++) {
        var updateObj = existingLeadsToUpdate[u];
        UrlFetchApp.fetch(SUPABASE_URL + "/rest/v1/leads?id=eq." + updateObj.id, {
          method: "patch",
          headers: { "apikey": SUPABASE_KEY, "Authorization": "Bearer " + SUPABASE_KEY, "Content-Type": "application/json", "Prefer": "return=minimal" },
          payload: JSON.stringify({ assigned_to: updateObj.assigned_to }),
          muteHttpExceptions: true
        });
      }
    }

    if (newLeadsToInsert.length > 0) {
      var chunkSize = 50;
      for (var c = 0; c < newLeadsToInsert.length; c += chunkSize) {
        var chunk = newLeadsToInsert.slice(c, c + chunkSize);
        var payloadData = chunk.map(function(item) {
          return {
            client_name: item.client_name,
            contact: item.contact,
            admission_date: item.admission_date,
            lead_existing_plan: item.lead_existing_plan,
            assigned_to: item.assigned_to,
            lead_status: item.lead_status,
            created_at: item.created_at
          };
        });

        var postResponse = UrlFetchApp.fetch(SUPABASE_URL + "/rest/v1/leads", {
          method: "post",
          headers: {
            "apikey": SUPABASE_KEY,
            "Authorization": "Bearer " + SUPABASE_KEY,
            "Content-Type": "application/json",
            "Prefer": "return=minimal"
          },
          payload: JSON.stringify(payloadData),
          muteHttpExceptions: true
        });

        var statusCode = postResponse.getResponseCode();
        if (statusCode === 201 || statusCode === 200) {
          for (var k = 0; k < chunk.length; k++) {
            sheet.getRange(chunk[k].rowIndex, crmStatusIdx + 1).setValue("Done");
          }
        }
      }
    }

    SpreadsheetApp.flush();
  } catch (err) { Logger.log("Error: " + err.toString()); }
}

function parseSheetDate(val) {
  if (!val) return null;
  if (val instanceof Date) {
    if (isNaN(val.getTime())) return null;
    return Utilities.formatDate(val, Session.getScriptTimeZone(), "yyyy-MM-dd");
  }
  var strVal = String(val).trim();
  if (!strVal) return null;
  if (/^\\d{4}-\\d{2}-\\d{2}$/.test(strVal)) return strVal;
  var parsed = new Date(strVal);
  if (!isNaN(parsed.getTime())) return Utilities.formatDate(parsed, Session.getScriptTimeZone(), "yyyy-MM-dd");
  return null;
}

function setup1MinuteTrigger() {
  deleteExistingTriggers();
  ScriptApp.newTrigger("scanAndSyncLeads").timeBased().everyMinutes(1).create();
}

function deleteExistingTriggers() {
  var triggers = ScriptApp.getProjectTriggers();
  for (var i = 0; i < triggers.length; i++) {
    if (triggers[i].getHandlerFunction() === "scanAndSyncLeads") ScriptApp.deleteTrigger(triggers[i]);
  }
}`;
                    navigator.clipboard.writeText(scriptCode);
                    setCopiedScript(true);
                    toast({ title: "Script Copied!", description: "Google Apps Script code copied to clipboard." });
                    setTimeout(() => setCopiedScript(false), 3000);
                  }}
                >
                  {copiedScript ? <Check className="w-3.5 h-3.5 mr-1 text-green-600" /> : <Copy className="w-3.5 h-3.5 mr-1" />}
                  {copiedScript ? "Copied!" : "Copy Script"}
                </Button>
              </div>
              <textarea
                readOnly
                rows={8}
                className="w-full text-xs font-mono p-3 bg-gray-900 text-gray-100 rounded-lg focus:outline-none"
                value={`// Read full code in google-apps-script.js file in repository or click Copy Script above!
var SUPABASE_URL = "https://bzqwaxqzggejpejyxhde.supabase.co";
var SUPABASE_KEY = "sb_publishable_aWZ6_LgTmBCAj7RHgmoDwg_YB4H1Ts4";

function scanAndSyncLeads() {
  // Scans sheet every 1 minute -> checks database for duplicates -> inserts new Client Name, Contact, Admission Date
}`}
              />
            </div>
          </div>

          <DialogFooter>
            <Button className="bg-[#2e5a44] hover:bg-[#203f2f] text-white" onClick={() => setIsSheetSyncOpen(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Clean Duplicates Confirmation Dialog */}
      <Dialog open={isCleanDuplicatesOpen} onOpenChange={setIsCleanDuplicatesOpen}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold flex items-center gap-2 text-amber-700">
              <Sparkles className="w-5 h-5 text-amber-600" /> Deduplicate & Clean Lead Records
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 pt-2 flex-1 overflow-y-auto">
            {duplicateSummary.totalDuplicateGroups === 0 ? (
              <div className="p-8 text-center bg-emerald-50 rounded-xl border border-emerald-100">
                <CheckCircle className="w-10 h-10 text-emerald-600 mx-auto mb-2" />
                <h4 className="font-bold text-gray-900 text-lg">No Duplicate Leads Found!</h4>
                <p className="text-xs text-gray-600 mt-1">All contact numbers in your CRM are unique. No cleanup required.</p>
              </div>
            ) : (
              <>
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-amber-50 p-4 rounded-xl border border-amber-200">
                    <span className="text-xs text-amber-800 font-semibold block uppercase">Duplicate Contacts</span>
                    <span className="text-2xl font-extrabold text-amber-900">{duplicateSummary.totalDuplicateGroups}</span>
                    <span className="text-[11px] text-amber-700 block mt-0.5">Contacts with multiple entries</span>
                  </div>
                  <div className="bg-red-50 p-4 rounded-xl border border-red-200">
                    <span className="text-xs text-red-800 font-semibold block uppercase">Redundant Rows to Delete</span>
                    <span className="text-2xl font-extrabold text-red-900">{duplicateSummary.totalRedundantRows}</span>
                    <span className="text-[11px] text-red-700 block mt-0.5">Duplicate records will be removed</span>
                  </div>
                </div>

                <div className="border rounded-xl overflow-hidden text-xs">
                  <div className="bg-gray-100 p-3 font-bold text-gray-700 uppercase flex justify-between border-b">
                    <span>Client / Contact</span>
                    <span>Total Copies (1 kept, rest deleted)</span>
                  </div>
                  <div className="max-h-60 overflow-y-auto divide-y divide-gray-100">
                    {duplicateSummary.duplicateGroups.map((g, idx) => (
                      <div key={idx} className="p-3 flex justify-between items-center hover:bg-gray-50">
                        <div>
                          <span className="font-bold text-gray-900 block">{g.clientName}</span>
                          <span className="text-gray-500">{g.contact}</span>
                        </div>
                        <span className="px-2.5 py-1 rounded-full bg-red-100 text-red-800 font-bold">
                          {g.count} copies
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </>
            )}
          </div>

          <DialogFooter className="pt-3 border-t">
            <Button variant="outline" onClick={() => setIsCleanDuplicatesOpen(false)}>
              Cancel
            </Button>
            {duplicateSummary.totalRedundantRows > 0 && (
              <Button
                onClick={handleConfirmCleanDuplicates}
                disabled={isCleaningDuplicates}
                className="bg-red-600 hover:bg-red-700 text-white font-bold"
              >
                {isCleaningDuplicates ? "Cleaning Duplicates..." : `Delete ${duplicateSummary.totalRedundantRows} Duplicate Rows`}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {/* Lead Timeline Modal (Complete History by Unique Contact Number) */}
      <Dialog open={isTimelineOpen} onOpenChange={setIsTimelineOpen}>
        <DialogContent className="max-w-6xl max-h-[92vh] overflow-hidden flex flex-col bg-white p-6 shadow-2xl rounded-2xl border border-gray-100">
          <DialogHeader className="border-b pb-4">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <span className="w-9 h-9 rounded-full bg-[#2e5a44] text-white flex items-center justify-center font-bold text-sm shadow-xs">
                    <User className="w-5 h-5" />
                  </span>
                  <div>
                    <DialogTitle className="text-xl font-bold text-gray-900 flex items-center gap-2">
                      <span>{selectedGroupedLead?.client_name || "Lead Record History"}</span>
                      <span className="text-sm font-semibold text-gray-500 font-mono">
                        ({selectedGroupedLead?.contact || "No Contact"})
                      </span>
                    </DialogTitle>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="inline-flex items-center gap-1 text-xs px-2.5 py-0.5 rounded-full font-bold bg-blue-100 text-blue-800 border border-blue-200">
                        <History className="w-3.5 h-3.5" />
                        {selectedGroupedLead?.entriesCount || 1} Total {selectedGroupedLead?.entriesCount === 1 ? "Record" : "Records"} for this Contact
                      </span>
                      <span className="text-xs text-gray-400">• Master Unique Identifier: Mobile Number</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Action Buttons: WhatsApp, Call, Add Follow-up Entry */}
              <div className="flex items-center gap-2 flex-wrap">
                {selectedGroupedLead?.contact && (
                  <>
                    <a
                      href={`https://wa.me/91${(selectedGroupedLead.contact || "").replace(/\D/g, "").slice(-10)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs transition-colors"
                    >
                      <MessageCircle className="w-3.5 h-3.5" /> WhatsApp
                    </a>
                    <a
                      href={`tel:${selectedGroupedLead.contact}`}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white shadow-xs transition-colors"
                    >
                      <Phone className="w-3.5 h-3.5" /> Call
                    </a>
                  </>
                )}
                <Button
                  size="sm"
                  onClick={handleAddNewTimelineEntry}
                  className="bg-[#2e5a44] hover:bg-[#203f2f] text-white text-xs font-bold shadow-xs"
                >
                  <Plus className="w-3.5 h-3.5 mr-1" /> Add Follow-up Entry
                </Button>
              </div>
            </div>
          </DialogHeader>

          {/* Table Container displaying all 12 requested columns */}
          <div className="flex-1 overflow-auto rounded-lg border border-gray-200 mt-2">
            <table className="w-full text-xs text-left border-collapse">
              <thead className="bg-[#2e5a44] text-white sticky top-0 z-10 font-semibold uppercase text-[11px] tracking-wider">
                <tr>
                  <th className="p-2.5 text-center w-12">SR NO</th>
                  <th className="p-2.5 min-w-[140px]">CLIENT NAME</th>
                  <th className="p-2.5 min-w-[120px]">CONTACT</th>
                  <th className="p-2.5 min-w-[130px]">LEAD TYPE</th>
                  <th className="p-2.5 min-w-[140px]">LEAD EXISTING PLAN</th>
                  <th className="p-2.5 min-w-[130px] text-center">LEAD STATUS</th>
                  <th className="p-2.5 min-w-[120px]">FOLLOW-UP DATE</th>
                  <th className="p-2.5 min-w-[220px]">REMARK & CALL STATUS</th>
                  <th className="p-2.5 min-w-[110px]">Added Date</th>
                  <th className="p-2.5 min-w-[110px]">Admission Date</th>
                  <th className="p-2.5 min-w-[100px]">Calling Date</th>
                  <th className="p-2.5 min-w-[130px]">ASSIGNED TO</th>
                  <th className="p-2.5 text-center w-16">ACTIONS</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 bg-white">
                {selectedGroupedLead?.entries.map((entry, idx) => {
                  const curStatus = LEAD_STATUSES.find(s => s.id === entry.lead_status) || LEAD_STATUSES[0];
                  const isPrimary = idx === 0;
                  return (
                    <tr
                      key={entry.id}
                      className={`hover:bg-gray-50 transition-colors ${isPrimary ? "bg-emerald-50/40" : ""}`}
                    >
                      <td className="p-2.5 text-center font-bold text-gray-700">
                        <div className="flex items-center justify-center gap-1">
                          <span>{idx + 1}</span>
                          {isPrimary && (
                            <span className="px-1.5 py-0.2 rounded text-[9px] font-extrabold bg-emerald-100 text-emerald-800 border border-emerald-300">
                              Active
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="p-2 font-semibold text-gray-900">{entry.client_name}</td>
                      <td className="p-2 text-gray-600 font-mono">{entry.contact}</td>
                      <td className="p-2 text-gray-700 font-medium">{entry.lead_type || "—"}</td>
                      <td className="p-2 text-gray-700">{entry.lead_existing_plan || "—"}</td>
                      <td className="p-2 text-center">
                        <span className={`inline-block px-2.5 py-1 rounded-full text-[11px] font-bold ${curStatus.bg} ${curStatus.text}`}>
                          {curStatus.label}
                        </span>
                      </td>
                      <td className="p-2 text-gray-600 font-mono">{entry.follow_up_date || "—"}</td>
                      <td className="p-2 text-gray-700">
                        <div className="space-y-1">
                          {entry.call_connected && (
                            <span className={`inline-block text-[10px] font-bold px-2 py-0.5 rounded-full ${entry.call_connected === "connected"
                                ? "bg-emerald-100 text-emerald-800"
                                : "bg-red-100 text-red-700"
                              }`}>
                              {entry.call_connected === "connected" ? "✅ Connected" : "❌ Not Connected"}
                            </span>
                          )}
                          <div className="text-gray-800 break-words">{entry.remark || <span className="text-gray-400 italic">No remark</span>}</div>
                        </div>
                      </td>
                      <td className="p-2 text-gray-500 font-mono text-[11px]">
                        {entry.created_at ? formatLocalDateYMD(entry.created_at) : "—"}
                      </td>
                      <td className="p-2 text-gray-600 font-mono">{entry.admission_date || "—"}</td>
                      <td className="p-2 text-gray-600 font-mono">{entry.calling_date || "—"}</td>
                      <td className="p-2 text-gray-700 font-medium">
                        {entry.assigned_to ? (
                          <span className="px-2 py-0.5 bg-gray-100 rounded text-gray-800 font-semibold">
                            {entry.assigned_to}
                          </span>
                        ) : (
                          <span className="text-gray-400 italic">Unassigned</span>
                        )}
                      </td>
                      <td className="p-2 text-center">
                        <div className="flex items-center justify-center gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-blue-600 hover:text-blue-800 hover:bg-blue-50"
                            onClick={() => {
                              handleOpenEditDialog(entry);
                            }}
                            title="Edit this entry"
                          >
                            <Edit className="w-3.5 h-3.5" />
                          </Button>
                          {selectedGroupedLead.entries.length > 1 && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 text-red-500 hover:text-red-700 hover:bg-red-50"
                              onClick={() => handleDeleteTimelineEntry(entry.id)}
                              title="Delete this specific duplicate record"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <DialogFooter className="border-t pt-3 flex justify-between items-center sm:justify-between">
            <div className="text-xs text-gray-500">
              💡 Tip: The primary entry on the main table is determined by status priority and most recent activity.
            </div>
            <Button
              className="bg-[#2e5a44] hover:bg-[#203f2f] text-white"
              onClick={() => setIsTimelineOpen(false)}
            >
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Floating AI Bot Assistant */}
      <LeadAIBot leads={leads} onApplyAction={handleApplyAiAction} />
    </div>
  );
}
