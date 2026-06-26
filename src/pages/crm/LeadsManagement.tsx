import { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { motion } from "framer-motion";
import {
  ClipboardList, Search, RefreshCw, Plus, Download, Upload,
  Trash2, Edit, Save, X, Calendar, User, Phone, CheckCircle, History
} from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import * as XLSX from "xlsx";

const ASSIGNED_USERS = ["Mayuri K", "Ragini K", "Shreya K"];

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
  "OFFLINE - 199"
];

const LEAD_STATUSES = [
  { id: "Select Option", label: "Select Option", bg: "bg-gray-100 hover:bg-gray-200", text: "text-gray-700" },
  { id: "Deal Done", label: "Deal Done", bg: "bg-[#14532d] hover:bg-[#166534]", text: "text-white" },
  { id: "Follow Up", label: "Follow Up", bg: "bg-[#991b1b] hover:bg-[#b91c1c]", text: "text-white" },
  { id: "Dead", label: "Dead", bg: "bg-[#fef08a] hover:bg-[#fde047]", text: "text-[#854d0e]" }
];

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
  assigned_to: string | null;
  follow_up_date: string | null;
  created_at: string | null;
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

export function LeadsManagement() {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [addedDateFilter, setAddedDateFilter] = useState(new Date().toISOString().split("T")[0]);

  // Dialog States
  const [isOpenAddEditDialog, setIsOpenAddEditDialog] = useState(false);
  const [editingLead, setEditingLead] = useState<Lead | null>(null);

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
    if (isScrollingTop.current) return;
    isScrollingBottom.current = true;
    if (topScrollRef.current && topScrollRef.current.scrollLeft !== e.currentTarget.scrollLeft) {
      topScrollRef.current.scrollLeft = e.currentTarget.scrollLeft;
    }
    setTimeout(() => { isScrollingBottom.current = false; }, 50);
  };

  // History States
  const [showHistoryDialog, setShowHistoryDialog] = useState(false);
  const [selectedLeadHistory, setSelectedLeadHistory] = useState<any[]>([]);
  const [selectedLeadForHistory, setSelectedLeadForHistory] = useState<Lead | null>(null);

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
    assigned_to: null,
    follow_up_date: ""
  });

  useEffect(() => {
    fetchLeads();
  }, []);

  const fetchLeads = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("leads")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;
      setLeads(data || []);
    } catch (err: any) {
      console.error("Error fetching leads:", err);
      toast({
        title: "Error fetching leads",
        description: err.message,
        variant: "destructive"
      });
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
      if (editingLead) {
        // Update
        const { error } = await supabase
          .from("leads")
          .update({
            admission_date: leadForm.admission_date || null,
            calling_date: leadForm.calling_date || null,
            sr_no: leadForm.sr_no || null,
            client_name: leadForm.client_name,
            contact: leadForm.contact,
            lead_type: leadForm.lead_type || null,
            lead_existing_plan: leadForm.lead_existing_plan || null,
            lead_status: leadForm.lead_status || "Select Option",
            remark: leadForm.remark || null,
            follow_up_date: leadForm.follow_up_date || null
          })
          .eq("id", editingLead.id);

        if (error) throw error;
        await logHistory(editingLead.id, "Updated", "Lead details were updated manually.");
        toast({ title: "Success", description: "Lead updated successfully" });
      } else {
        // Create
        // let nextUserIndex = (getLastAssignedIndex(leads) + 1) % 3;
        // const assignedTo = ASSIGNED_USERS[nextUserIndex];

        const { data, error } = await supabase
          .from("leads")
          .insert([{
            admission_date: leadForm.admission_date || null,
            calling_date: leadForm.calling_date || null,
            sr_no: leadForm.sr_no || null,
            client_name: leadForm.client_name,
            contact: leadForm.contact,
            lead_type: leadForm.lead_type || null,
            lead_existing_plan: leadForm.lead_existing_plan || null,
            lead_status: leadForm.lead_status || "Select Option",
            remark: leadForm.remark || null,
            assigned_to: null,
            follow_up_date: leadForm.follow_up_date || null
          }]).select();

        if (error) throw error;
        if (data && data.length > 0) {
          await logHistory(data[0].id, "Created", `Lead created manually.`);
        }
        toast({ title: "Success", description: "Lead added successfully" });
      }
      setIsOpenAddEditDialog(false);
      fetchLeads();
    } catch (err: any) {
      console.error("Error saving lead:", err);
      toast({
        title: "Error saving lead",
        description: err.message,
        variant: "destructive"
      });
    }
  };

  const handleUpdateStatus = async (leadId: string, status: string) => {
    try {
      const { error } = await supabase
        .from("leads")
        .update({ lead_status: status })
        .eq("id", leadId);

      if (error) throw error;
      await logHistory(leadId, "Status Changed", `Lead status changed to ${status}`);
      setLeads(prev => prev.map(lead => lead.id === leadId ? { ...lead, lead_status: status } : lead));
      toast({ title: "Status Updated", description: `Lead status changed to ${status}` });
    } catch (err: any) {
      console.error("Error updating status:", err);
      toast({
        title: "Error updating status",
        description: err.message,
        variant: "destructive"
      });
    }
  };

  const handleUpdateLeadType = async (leadId: string, type: string) => {
    try {
      const { error } = await supabase
        .from("leads")
        .update({ lead_type: type })
        .eq("id", leadId);

      if (error) throw error;
      await logHistory(leadId, "Type Changed", `Lead type changed to ${type}`);
      setLeads(prev => prev.map(lead => lead.id === leadId ? { ...lead, lead_type: type } : lead));
      toast({ title: "Lead Type Updated", description: `Lead type changed to ${type}` });
    } catch (err: any) {
      console.error("Error updating lead type:", err);
      toast({
        title: "Error updating lead type",
        description: err.message,
        variant: "destructive"
      });
    }
  };

  const handleUpdateExistingPlan = async (leadId: string, plan: string) => {
    try {
      const { error } = await supabase
        .from("leads")
        .update({ lead_existing_plan: plan })
        .eq("id", leadId);

      if (error) throw error;
      await logHistory(leadId, "Plan Changed", `Plan changed to ${plan}`);
      setLeads(prev => prev.map(lead => lead.id === leadId ? { ...lead, lead_existing_plan: plan } : lead));
      toast({ title: "Plan Updated", description: `Plan changed to ${plan}` });
    } catch (err: any) {
      console.error("Error updating plan:", err);
      toast({
        title: "Error updating plan",
        description: err.message,
        variant: "destructive"
      });
    }
  };

  const handleUpdateAssignedTo = async (leadId: string, assignedTo: string) => {
    try {
      const { error } = await supabase
        .from("leads")
        .update({ assigned_to: assignedTo })
        .eq("id", leadId);

      if (error) throw error;
      await logHistory(leadId, "Reassigned", `Lead reassigned to ${assignedTo}`);
      setLeads(prev => prev.map(lead => lead.id === leadId ? { ...lead, assigned_to: assignedTo } : lead));
      toast({ title: "Assigned To Updated", description: `Lead assigned to ${assignedTo}` });
    } catch (err: any) {
      console.error("Error updating assigned to:", err);
      toast({
        title: "Error updating assignment",
        description: err.message,
        variant: "destructive"
      });
    }
  };

  const handleUpdateField = async (leadId: string, field: string, value: any) => {
    try {
      const { error } = await supabase
        .from("leads")
        .update({ [field]: value })
        .eq("id", leadId);

      if (error) throw error;
      await logHistory(leadId, "Updated", `${field} updated manually.`);
      setLeads(prev => prev.map(lead => lead.id === leadId ? { ...lead, [field]: value } : lead));
    } catch (err: any) {
      console.error(`Error updating ${field}:`, err);
      toast({
        title: `Error updating ${field}`,
        description: err.message,
        variant: "destructive"
      });
    }
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
      "Remark": lead.remark || ""
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
            const match = EXISTING_PLANS.find(p => p.toLowerCase() === String(existingPlan).trim().toLowerCase());
            if (match) finalPlan = match;
            else finalPlan = String(existingPlan).trim();
          }

          // currentIndex = (currentIndex + 1) % 3;
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
            assigned_to: null
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

        // Bulk insert to Supabase
        const { data: insertedLeads, error } = await supabase.from("leads").insert(validLeads).select('id, client_name, assigned_to');
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
          description: `Successfully imported ${validLeads.length} leads.`
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

  const filteredLeads = leads.filter(lead => {
    const matchesSearch = !searchQuery ||
      (lead.client_name || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
      (lead.contact || "").includes(searchQuery) ||
      (lead.remark || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
      (lead.sr_no || "").toLowerCase().includes(searchQuery.toLowerCase());

    const matchesStatus = statusFilter === "all" || lead.lead_status === statusFilter;
    const matchesType = typeFilter === "all" || lead.lead_type === typeFilter;
    
    let matchesAddedDate = true;
    if (addedDateFilter) {
      if (!lead.created_at) {
        matchesAddedDate = false;
      } else {
        const leadDate = new Date(lead.created_at).toISOString().split('T')[0];
        matchesAddedDate = leadDate === addedDateFilter;
      }
    }

    return matchesSearch && matchesStatus && matchesType && matchesAddedDate;
  });

  const todayStr = new Date().toISOString().split("T")[0];
  const sortedFilteredLeads = [...filteredLeads].sort((a, b) => {
    const aIsToday = a.follow_up_date === todayStr;
    const bIsToday = b.follow_up_date === todayStr;
    if (aIsToday && !bIsToday) return -1;
    if (!aIsToday && bIsToday) return 1;
    return 0;
  });

  return (
    <div className="space-y-6">
      {/* Header Panel */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <ClipboardList className="text-[#2e5a44]" /> Leads Management
          </h1>
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
          <Button variant="outline" size="sm" className="border-gray-200" onClick={handleImportClick}>
            <Upload className="w-4 h-4 mr-1" /> Import Data
          </Button>
          <Button size="sm" className="bg-[#2e5a44] hover:bg-[#203f2f] text-white" onClick={handleOpenAddDialog}>
            <Plus className="w-4 h-4 mr-1" /> Add Lead
          </Button>
        </div>
      </div>

      {/* Filters Card */}
      <Card className="border-none shadow-sm bg-white">
        <CardContent className="pt-6">
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
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

            <div className="relative">
              <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none">
                <Calendar className="w-4 h-4 text-gray-400" />
              </div>
              <Input
                type="date"
                className="pl-10 bg-white text-gray-700 h-10"
                value={addedDateFilter}
                onChange={e => setAddedDateFilter(e.target.value)}
              />
              {addedDateFilter && (
                <button 
                  onClick={() => setAddedDateFilter("")}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

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
                <TableHead className="text-white font-semibold w-16 sticky top-0 left-0 z-30 bg-[#2e5a44]">SR NO</TableHead>
                <TableHead className="text-white font-semibold w-[160px] sticky top-0 left-[64px] z-30 bg-[#2e5a44] border-r border-[#3a6e54]">CLIENT NAME</TableHead>
                <TableHead className="text-white font-semibold min-w-[140px] sticky top-0 z-20 bg-[#2e5a44]">CONTACT</TableHead>
                <TableHead className="text-white font-semibold min-w-[160px] sticky top-0 z-20 bg-[#2e5a44]">LEAD TYPE</TableHead>
                <TableHead className="text-white font-semibold min-w-[180px] sticky top-0 z-20 bg-[#2e5a44]">LEAD EXISTING PLAN</TableHead>
                <TableHead className="text-white font-semibold min-w-[140px] sticky top-0 z-20 bg-[#2e5a44]">LEAD STATUS</TableHead>
                <TableHead className="text-white font-semibold min-w-[140px] sticky top-0 z-20 bg-[#2e5a44]">FOLLOW-UP DATE</TableHead>
                <TableHead className="text-white font-semibold min-w-[200px] sticky top-0 z-20 bg-[#2e5a44]">REMARK</TableHead>
                <TableHead className="text-white font-semibold min-w-[120px] sticky top-0 z-20 bg-[#2e5a44]">Added Date</TableHead>
                <TableHead className="text-white font-semibold min-w-[140px] sticky top-0 z-20 bg-[#2e5a44]">Admission Date</TableHead>
                <TableHead className="text-white font-semibold min-w-[140px] sticky top-0 z-20 bg-[#2e5a44]">Calling Date</TableHead>
                <TableHead className="text-white font-semibold min-w-[140px] sticky top-0 z-20 bg-[#2e5a44]">ASSIGNED TO</TableHead>
                <TableHead className="text-white font-semibold text-center min-w-24 sticky top-0 z-20 bg-[#2e5a44]">ACTIONS</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sortedFilteredLeads.map((lead, index) => {
                const curStatus = LEAD_STATUSES.find(s => s.id === lead.lead_status) || LEAD_STATUSES[0];

                return (
                  <TableRow key={lead.id} className="hover:bg-gray-50 border-b border-gray-100">
                    {/* SR NO */}
                    <TableCell className="p-2 text-center text-sm font-medium text-gray-500 sticky left-0 z-10 bg-white">
                      {index + 1}
                    </TableCell>

                    {/* CLIENT NAME */}
                    <TableCell className="p-1 sticky left-[64px] z-10 bg-white border-r border-gray-200">
                      <EditableCell value={lead.client_name} onUpdate={(val) => handleUpdateField(lead.id, 'client_name', val)} className="font-semibold text-gray-800" />
                    </TableCell>

                    {/* CONTACT */}
                    <TableCell className="p-1">
                      <EditableCell value={lead.contact} onUpdate={(val) => handleUpdateField(lead.id, 'contact', val)} />
                    </TableCell>

                    {/* LEAD TYPE */}
                    <TableCell className="p-1">
                      <Select
                        value={lead.lead_type || ""}
                        onValueChange={(val) => handleUpdateLeadType(lead.id, val)}
                      >
                        <SelectTrigger className="h-8 border-none bg-transparent hover:bg-gray-200 text-xs rounded-md px-3 py-1 font-semibold text-gray-700 w-full focus:ring-1 focus:ring-[#2e5a44] focus:bg-white shadow-none">
                          <SelectValue placeholder="Select type" />
                        </SelectTrigger>
                        <SelectContent>
                          {LEAD_TYPES.map(t => (
                            <SelectItem key={t} value={t} className="text-xs font-medium">
                              {t}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </TableCell>

                    {/* LEAD EXISTING PLAN */}
                    <TableCell className="p-1">
                      <Select
                        value={lead.lead_existing_plan || ""}
                        onValueChange={(val) => handleUpdateExistingPlan(lead.id, val)}
                      >
                        <SelectTrigger className="h-8 border-none bg-transparent hover:bg-gray-200 text-xs rounded-md px-3 py-1 font-semibold text-gray-700 w-full focus:ring-1 focus:ring-[#2e5a44] focus:bg-white shadow-none">
                          <SelectValue placeholder="Select plan" />
                        </SelectTrigger>
                        <SelectContent>
                          {EXISTING_PLANS.map(p => (
                            <SelectItem key={p} value={p} className="text-xs font-medium">
                              {p}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </TableCell>

                    {/* LEAD STATUS */}
                    <TableCell className="p-1">
                      <Select
                        value={lead.lead_status}
                        onValueChange={(val) => handleUpdateStatus(lead.id, val)}
                      >
                        <SelectTrigger className={`h-8 border-none text-xs rounded-full px-3 py-1 font-bold text-center w-full focus:ring-1 focus:ring-offset-1 focus:ring-[#2e5a44] shadow-none ${curStatus.bg} ${curStatus.text}`}>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {LEAD_STATUSES.map(s => (
                            <SelectItem key={s.id} value={s.id} className="text-xs font-bold">
                              {s.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </TableCell>

                    {/* FOLLOW-UP DATE */}
                    <TableCell className="p-1">
                      <EditableCell type="date" value={lead.follow_up_date} onUpdate={(val) => handleUpdateField(lead.id, 'follow_up_date', val)} />
                    </TableCell>

                    {/* REMARK */}
                    <TableCell className="p-1">
                      <EditableCell value={lead.remark} onUpdate={(val) => handleUpdateField(lead.id, 'remark', val)} placeholder="No remark" />
                    </TableCell>

                    {/* Added Date (created_at - uneditable) */}
                    <TableCell className="p-2 font-medium text-gray-700 text-sm">
                      {lead.created_at ? new Date(lead.created_at).toLocaleDateString("en-IN", {
                        day: "numeric",
                        month: "short",
                        year: "numeric"
                      }) : "—"}
                    </TableCell>

                    {/* Admission Date */}
                    <TableCell className="p-1">
                      <EditableCell type="date" value={lead.admission_date} onUpdate={(val) => handleUpdateField(lead.id, 'admission_date', val)} />
                    </TableCell>

                    {/* Calling Date */}
                    <TableCell className="p-1">
                      <EditableCell type="date" value={lead.calling_date} onUpdate={(val) => handleUpdateField(lead.id, 'calling_date', val)} />
                    </TableCell>

                    {/* ASSIGNED TO */}
                    <TableCell className="p-1">
                      <Select
                        value={lead.assigned_to || ""}
                        onValueChange={(val) => handleUpdateAssignedTo(lead.id, val)}
                      >
                        <SelectTrigger className="h-8 border-none bg-transparent hover:bg-gray-200 text-xs rounded-md px-3 py-1 font-semibold text-gray-700 w-full focus:ring-1 focus:ring-[#2e5a44] focus:bg-white shadow-none">
                          <SelectValue placeholder="Select user" />
                        </SelectTrigger>
                        <SelectContent>
                          {ASSIGNED_USERS.map(u => (
                            <SelectItem key={u} value={u} className="text-xs font-medium">
                              {u}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </TableCell>

                    {/* ACTIONS */}
                    <TableCell className="text-center p-2">
                      <div className="flex justify-center items-center gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-indigo-600 hover:text-indigo-800 hover:bg-indigo-50"
                          onClick={() => handleOpenHistory(lead)}
                        >
                          <History className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-blue-600 hover:text-blue-800 hover:bg-blue-50"
                          onClick={() => handleOpenEditDialog(lead)}
                        >
                          <Edit className="w-4 h-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}

              {filteredLeads.length === 0 && (
                <TableRow>
                  <TableCell colSpan={13} className="text-center py-12 text-gray-400">
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
                  onChange={e => setLeadForm(prev => ({ ...prev, remark: e.target.value }))}
                />
              </div>
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
    </div>
  );
}
