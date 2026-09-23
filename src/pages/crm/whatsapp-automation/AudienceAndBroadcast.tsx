import React, { useState, useMemo, useRef } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import {
  Users, Upload, FileSpreadsheet, Download, Send, CheckCircle2,
  Filter, Search, Clock, Zap, MessageSquare, Play, Video, Image as ImageIcon,
  AlertCircle, CheckSquare, Square
} from "lucide-react";
import { utils, writeFile, read } from "xlsx";
import { BroadcastContact, MetaTemplate, sendMetaMessage, WhatsAppConfig } from "@/services/whatsappAutomationService";

interface AudienceAndBroadcastProps {
  crmUsers: any[];
  config: WhatsAppConfig;
  selectedTemplate: MetaTemplate | null;
  dynamicParams: string;
  headerImageUrl: string;
  onStartBroadcast: (
    contacts: BroadcastContact[],
    nudgeFormat: "template" | "text" | "video" | "image" | "preset",
    directText: string,
    directMediaUrl: string
  ) => void;
}

export const AudienceAndBroadcast: React.FC<AudienceAndBroadcastProps> = ({
  crmUsers,
  config,
  selectedTemplate,
  dynamicParams,
  headerImageUrl,
  onStartBroadcast
}) => {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Method Selection
  const [method, setMethod] = useState<"crm" | "excel">("crm");

  // Method A Filters
  const [selectedFilter, setSelectedFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedContactPhones, setSelectedContactPhones] = useState<Set<string>>(new Set());

  // 5 Nudge Formats
  const [nudgeFormat, setNudgeFormat] = useState<"template" | "text" | "video" | "image" | "preset">("template");
  const [directText, setDirectText] = useState("Namaste {name}! Welcome to your Snehyoga class today. Click here to join: https://yoga.snehyoga.com/live 🙏");
  const [directMediaUrl, setDirectMediaUrl] = useState("");

  // Method B Excel State
  const [excelContacts, setExcelContacts] = useState<BroadcastContact[]>([]);
  const [excelFileName, setExcelFileName] = useState("");

  // 1. Process CRM Users with Stages & 24h Activity
  const mappedCrmContacts: BroadcastContact[] = useMemo(() => {
    return (crmUsers || []).map((u: any) => {
      const daysLeft = Number(u.days_left ?? 0);
      const isPaid = !u.subscription_paused && daysLeft > 0;
      const batchTiming = u.batch_timing || "6:00 AM";

      // 24h activity calculation
      const lastAttendance = u.last_attendance_date ? new Date(u.last_attendance_date).getTime() : 0;
      const oneDayAgo = Date.now() - 24 * 60 * 60 * 1000;
      const activeToday = lastAttendance > oneDayAgo;

      // Assign Stage if not existing
      let stage = u.stage;
      if (!stage) {
        if (isPaid) stage = "Paid";
        else if (daysLeft < 0) stage = "Follow Up";
        else stage = "New Lead";
      }

      return {
        phone: u.mobile_number || u.phone || "",
        name: u.name || "Student",
        stage,
        activityToday: activeToday,
        batchTiming,
        daysLeft
      };
    }).filter(c => c.phone && c.phone.length >= 8);
  }, [crmUsers]);

  // Filtered CRM List based on dropdown & search
  const filteredCrmContacts = useMemo(() => {
    return mappedCrmContacts.filter((c) => {
      // Search
      const matchesSearch =
        c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        c.phone.includes(searchQuery);

      if (!matchesSearch) return false;

      // Filter categories
      if (selectedFilter === "all") return true;
      if (selectedFilter === "active_paid") return (c.daysLeft || 0) > 0;
      if (selectedFilter === "inactive") return (c.daysLeft || 0) <= 0;
      if (selectedFilter === "batch:6am") return c.batchTiming?.includes("6");
      if (selectedFilter === "batch:11am") return c.batchTiming?.includes("11");
      if (selectedFilter === "batch:4pm") return c.batchTiming?.includes("4");
      if (selectedFilter === "activity:active_today") return c.activityToday;
      if (selectedFilter === "activity:inactive") return !c.activityToday;
      if (selectedFilter.startsWith("stage:")) {
        const stageName = selectedFilter.replace("stage:", "");
        return c.stage?.toLowerCase() === stageName.toLowerCase();
      }
      return true;
    });
  }, [mappedCrmContacts, selectedFilter, searchQuery]);

  // Handle Multi-Select Checkboxes
  const handleToggleSelect = (phone: string) => {
    const updated = new Set(selectedContactPhones);
    if (updated.has(phone)) updated.delete(phone);
    else updated.add(phone);
    setSelectedContactPhones(updated);
  };

  const handleSelectAll = () => {
    if (selectedContactPhones.size === filteredCrmContacts.length) {
      setSelectedContactPhones(new Set());
    } else {
      setSelectedContactPhones(new Set(filteredCrmContacts.map(c => c.phone)));
    }
  };

  // Instant 1-Click Send Nudge for single user in table
  const handleSendSingleNudge = async (contact: BroadcastContact) => {
    toast({ title: "Sending Nudge...", description: `Dispatching to ${contact.name}` });

    const params = dynamicParams.split(",").map(p => {
      const key = p.trim();
      if (key === "name") return contact.name;
      if (key === "batch_time") return contact.batchTiming || "6:00 AM";
      if (key === "days_left") return String(contact.daysLeft || 30);
      return key;
    });

    const res = await sendMetaMessage({
      config,
      to: contact.phone,
      type: nudgeFormat === "template" ? "template" : nudgeFormat === "video" ? "video" : nudgeFormat === "image" ? "image" : "text",
      templateName: selectedTemplate?.name,
      templateParams: params,
      languageCode: selectedTemplate?.language || config.languageCode,
      headerImageUrl: headerImageUrl || selectedTemplate?.headerUrl,
      textBody: directText.replace(/\{name\}/g, contact.name),
      mediaUrl: directMediaUrl,
      userName: contact.name
    });

    if (res.success) {
      toast({ title: "Nudge Delivered ⚡", description: `Message delivered to ${contact.name}` });
    } else {
      toast({ title: "Nudge Failed", description: res.error || "Meta rejection", variant: "destructive" });
    }
  };

  // Method B: Dynamic Sample Excel Generator matching template parameter count
  const handleDownloadSampleExcel = () => {
    const paramCount = selectedTemplate?.paramCount || 2;
    const headerRow: string[] = ["Phone", "Name"];
    for (let i = 1; i <= paramCount; i++) {
      headerRow.push(`Param_${i}`);
    }

    const sampleData = [
      headerRow,
      ["919145414083", "Aarav Patel", ...Array(paramCount).fill("Morning Batch")],
      ["919876543210", "Priya Verma", ...Array(paramCount).fill("Evening Batch")]
    ];

    const ws = utils.aoa_to_sheet(sampleData);
    const wb = utils.book_new();
    utils.book_append_sheet(wb, ws, "Broadcast_Contacts");
    writeFile(wb, `Snehyoga_WhatsApp_Sample_${selectedTemplate?.name || "Broadcast"}.xlsx`);
    toast({ title: "Sample File Downloaded 📄", description: `Matches ${paramCount} template parameters.` });
  };

  // Method B: Handle Excel/CSV file upload
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setExcelFileName(file.name);
    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const bstr = evt.target?.result;
        const wb = read(bstr, { type: "binary" });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const data: any[] = utils.sheet_to_json(ws, { defval: "" });

        if (!data || data.length === 0) {
          toast({ title: "Empty File", description: "Uploaded sheet contains no rows.", variant: "destructive" });
          return;
        }

        // Auto-detect phone and name columns
        const keys = Object.keys(data[0]);
        const phoneCol = keys.find(k => /phone|mobile|contact|number/i.test(k)) || keys[0];
        const nameCol = keys.find(k => /name|student|client|user/i.test(k)) || keys[1] || "";

        const parsed: BroadcastContact[] = data.map((row: any) => {
          const rawPhone = String(row[phoneCol] || "").replace(/\D/g, "");
          const name = String(row[nameCol] || "Student");

          // Extract extra parameter columns
          const paramsMap: Record<string, string> = {};
          keys.forEach(k => {
            if (k !== phoneCol && k !== nameCol) {
              paramsMap[k] = String(row[k] || "");
            }
          });

          return {
            phone: rawPhone,
            name,
            params: paramsMap
          };
        }).filter(c => c.phone.length >= 8);

        setExcelContacts(parsed);
        toast({
          title: "Excel File Loaded ✅",
          description: `Extracted ${parsed.length} recipients. Detected Phone: "${phoneCol}", Name: "${nameCol || 'Default'}"`
        });
      } catch (err: any) {
        toast({ title: "File Parse Error", description: err.message, variant: "destructive" });
      }
    };
    reader.readAsBinaryString(file);
  };

  // Determine active list for broadcast
  const activeContactsToBroadcast: BroadcastContact[] = useMemo(() => {
    if (method === "excel") return excelContacts;
    if (selectedContactPhones.size > 0) {
      return filteredCrmContacts.filter(c => selectedContactPhones.has(c.phone));
    }
    return filteredCrmContacts;
  }, [method, excelContacts, filteredCrmContacts, selectedContactPhones]);

  const handleTriggerBroadcast = () => {
    if (activeContactsToBroadcast.length === 0) {
      toast({ title: "No Recipients", description: "Please select or upload contacts first.", variant: "destructive" });
      return;
    }
    if (nudgeFormat === "template" && !selectedTemplate) {
      toast({ title: "Select Template", description: "Please choose an approved Meta template in the card above.", variant: "destructive" });
      return;
    }

    onStartBroadcast(activeContactsToBroadcast, nudgeFormat, directText, directMediaUrl);
  };

  return (
    <Card className="border border-slate-200/80 shadow-sm bg-white overflow-hidden">
      <CardHeader className="bg-slate-50 border-b border-slate-100 p-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-50 border border-blue-200 flex items-center justify-center text-blue-600">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <CardTitle className="text-base font-bold text-slate-900">
                Target Audience & Broadcast Dispatcher
              </CardTitle>
              <p className="text-xs text-slate-500">Target via CRM segmentation or bulk Excel upload with 5 nudge formats</p>
            </div>
          </div>

          {/* Method Switcher Tabs */}
          <div className="flex rounded-xl bg-slate-200/70 p-1 border border-slate-200 self-start sm:self-auto">
            <button
              onClick={() => setMethod("crm")}
              className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                method === "crm"
                  ? "bg-white text-indigo-700 shadow-sm"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              <Users className="w-3.5 h-3.5" /> Method A: CRM Audience
            </button>
            <button
              onClick={() => setMethod("excel")}
              className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                method === "excel"
                  ? "bg-white text-indigo-700 shadow-sm"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              <FileSpreadsheet className="w-3.5 h-3.5" /> Method B: Excel Upload
            </button>
          </div>
        </div>
      </CardHeader>

      <CardContent className="p-6 space-y-6">
        {/* Nudge Format Selector (5 Options) */}
        <div className="space-y-2">
          <label className="text-xs font-bold uppercase tracking-wider text-slate-700">Choose Nudge Dispatch Format</label>
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5">
            {[
              { id: "template", label: "Meta Template", icon: MessageSquare, color: "text-indigo-600 bg-indigo-50" },
              { id: "text", label: "Direct Text ({name})", icon: Zap, color: "text-emerald-600 bg-emerald-50" },
              { id: "video", label: "Direct Video", icon: Video, color: "text-purple-600 bg-purple-50" },
              { id: "image", label: "Direct Image", icon: ImageIcon, color: "text-blue-600 bg-blue-50" },
              { id: "preset", label: "System Preset", icon: Clock, color: "text-amber-600 bg-amber-50" }
            ].map((f) => (
              <button
                key={f.id}
                type="button"
                onClick={() => setNudgeFormat(f.id as any)}
                className={`flex flex-col items-center justify-center p-3 rounded-xl border text-center transition-all ${
                  nudgeFormat === f.id
                    ? "border-indigo-600 bg-indigo-50/50 shadow-sm ring-1 ring-indigo-500"
                    : "border-slate-200 hover:border-slate-300 bg-white"
                }`}
              >
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center mb-1.5 ${f.color}`}>
                  <f.icon className="w-4 h-4" />
                </div>
                <span className="text-xs font-bold text-slate-800">{f.label}</span>
              </button>
            ))}
          </div>

          {/* Conditional inputs for Direct Text / Video / Image */}
          {nudgeFormat !== "template" && (
            <div className="pt-3 space-y-3 bg-slate-50 p-4 rounded-xl border border-slate-200">
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700">Direct Message Body (Supports {"{name}"} tag)</label>
                <textarea
                  value={directText}
                  onChange={(e) => setDirectText(e.target.value)}
                  className="w-full h-20 p-2.5 rounded-lg border border-slate-300 text-xs bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 font-sans"
                  placeholder="Hello {name}, your yoga session starts in 15 minutes! Join live: https://yoga.snehyoga.com/live"
                />
              </div>

              {(nudgeFormat === "video" || nudgeFormat === "image") && (
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700">Direct Media URL (MP4 / JPG / PNG)</label>
                  <Input
                    value={directMediaUrl}
                    onChange={(e) => setDirectMediaUrl(e.target.value)}
                    placeholder="https://example.com/daily-yoga-flow.mp4"
                    className="text-xs bg-white border-slate-300"
                  />
                </div>
              )}
            </div>
          )}
        </div>

        {/* METHOD A: CRM Audience Filter */}
        {method === "crm" && (
          <div className="space-y-4">
            {/* Filter Dropdown & Search Bar */}
            <div className="flex flex-col sm:flex-row gap-3 items-center justify-between">
              <div className="flex items-center gap-2 w-full sm:w-auto">
                <Filter className="w-4 h-4 text-slate-400 shrink-0" />
                <select
                  value={selectedFilter}
                  onChange={(e) => setSelectedFilter(e.target.value)}
                  className="h-10 px-3 rounded-lg border border-slate-200 bg-white text-xs font-bold text-slate-800 shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <optgroup label="General Audience">
                    <option value="all">All Users ({mappedCrmContacts.length})</option>
                    <option value="active_paid">Active Paid Members</option>
                    <option value="inactive">Inactive / Expired</option>
                  </optgroup>
                  <optgroup label="Batch Timings">
                    <option value="batch:6am">Morning Batch (6:00 AM)</option>
                    <option value="batch:11am">Mid-Day Batch (11:00 AM)</option>
                    <option value="batch:4pm">Evening Batch (4:00 PM)</option>
                  </optgroup>
                  <optgroup label="Lead Stages">
                    <option value="stage:New Lead">Stage: New Lead</option>
                    <option value="stage:Paid">Stage: Paid</option>
                    <option value="stage:Interested">Stage: Interested</option>
                    <option value="stage:Follow Up">Stage: Follow Up</option>
                    <option value="stage:Demo session">Stage: Demo session</option>
                    <option value="stage:Lost">Stage: Lost</option>
                  </optgroup>
                  <optgroup label="24h Activity">
                    <option value="activity:active_today">Active in Last 24 Hours</option>
                    <option value="activity:inactive">Inactive in Last 24 Hours</option>
                  </optgroup>
                </select>
              </div>

              <div className="relative w-full sm:w-64">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <Input
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search name or phone..."
                  className="pl-9 h-10 text-xs border-slate-200"
                />
              </div>
            </div>

            {/* Synced Leads Table */}
            <div className="border border-slate-200 rounded-xl overflow-hidden shadow-sm">
              <div className="bg-slate-50 px-4 py-2.5 border-b border-slate-200 flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleSelectAll}
                    className="text-slate-600 hover:text-slate-900 flex items-center gap-1 font-semibold"
                  >
                    {selectedContactPhones.size === filteredCrmContacts.length && filteredCrmContacts.length > 0 ? (
                      <CheckSquare className="w-4 h-4 text-indigo-600" />
                    ) : (
                      <Square className="w-4 h-4 text-slate-400" />
                    )}
                    <span>Select All ({filteredCrmContacts.length})</span>
                  </button>
                  {selectedContactPhones.size > 0 && (
                    <span className="text-indigo-600 font-bold bg-indigo-50 px-2 py-0.5 rounded-full">
                      {selectedContactPhones.size} selected
                    </span>
                  )}
                </div>

                <span className="text-slate-500 font-medium">Showing {filteredCrmContacts.length} recipients</span>
              </div>

              <div className="max-h-72 overflow-y-auto">
                {filteredCrmContacts.length === 0 ? (
                  <div className="p-8 text-center text-xs text-slate-400">
                    No contacts matched the selected filter or search term.
                  </div>
                ) : (
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50/70 text-slate-600 font-semibold border-b border-slate-100">
                      <tr>
                        <th className="py-2.5 px-3 w-10"></th>
                        <th className="py-2.5 px-3">Student Name</th>
                        <th className="py-2.5 px-3">Phone</th>
                        <th className="py-2.5 px-3">Stage</th>
                        <th className="py-2.5 px-3">24h Status</th>
                        <th className="py-2.5 px-3 text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {filteredCrmContacts.slice(0, 50).map((c) => {
                        const isSelected = selectedContactPhones.has(c.phone);
                        return (
                          <tr key={c.phone} className={`hover:bg-slate-50 transition-colors ${isSelected ? "bg-indigo-50/30" : ""}`}>
                            <td className="py-2 px-3">
                              <input
                                type="checkbox"
                                checked={isSelected}
                                onChange={() => handleToggleSelect(c.phone)}
                                className="rounded text-indigo-600 focus:ring-indigo-500 h-3.5 w-3.5"
                              />
                            </td>
                            <td className="py-2 px-3 font-semibold text-slate-900">{c.name}</td>
                            <td className="py-2 px-3 font-mono text-slate-600">{c.phone}</td>
                            <td className="py-2 px-3">
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-700 border border-slate-200">
                                {c.stage || "New Lead"}
                              </span>
                            </td>
                            <td className="py-2 px-3">
                              {c.activityToday ? (
                                <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" /> Active Today
                                </span>
                              ) : (
                                <span className="text-[10px] font-medium text-slate-400">Inactive</span>
                              )}
                            </td>
                            <td className="py-2 px-3 text-right">
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleSendSingleNudge(c)}
                                className="h-7 text-[11px] font-semibold border-indigo-200 text-indigo-700 hover:bg-indigo-50 shadow-none px-2.5"
                              >
                                <Zap className="w-3 h-3 mr-1 text-indigo-500" /> Nudge
                              </Button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          </div>
        )}

        {/* METHOD B: Excel Upload */}
        {method === "excel" && (
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 p-4 bg-slate-50 rounded-xl border border-slate-200">
              <div className="space-y-0.5">
                <p className="text-xs font-bold text-slate-800">Dynamic Excel File Generator</p>
                <p className="text-[11px] text-slate-500">Generates a template matching your selected template's exact placeholder count</p>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={handleDownloadSampleExcel}
                className="text-xs font-semibold border-indigo-300 text-indigo-700 hover:bg-indigo-50 shrink-0"
              >
                <Download className="w-3.5 h-3.5 mr-1.5" /> Download Sample File
              </Button>
            </div>

            {/* Drag & Drop Upload Zone */}
            <div
              onClick={() => fileInputRef.current?.click()}
              className="cursor-pointer border-2 border-dashed border-indigo-200 hover:border-indigo-400 bg-indigo-50/20 hover:bg-indigo-50/40 rounded-2xl p-8 text-center space-y-3 transition-all"
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx,.xls,.csv"
                onChange={handleFileUpload}
                className="hidden"
              />
              <div className="w-12 h-12 rounded-2xl bg-indigo-100 text-indigo-600 mx-auto flex items-center justify-center shadow-sm">
                <Upload className="w-6 h-6" />
              </div>
              <div>
                <p className="text-sm font-bold text-slate-800">
                  {excelFileName ? `Loaded: ${excelFileName}` : "Click or Drag & Drop Excel/CSV File"}
                </p>
                <p className="text-xs text-slate-500 mt-1">Auto-detects phone and name columns, maps parameter tags</p>
              </div>
            </div>

            {/* Excel Preview */}
            {excelContacts.length > 0 && (
              <div className="p-4 bg-emerald-50/50 rounded-xl border border-emerald-200 flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  <span className="font-bold text-emerald-950">{excelContacts.length} valid contacts ready</span>
                </div>
                <span className="text-slate-500 font-mono">Sample: {excelContacts[0].name} ({excelContacts[0].phone})</span>
              </div>
            )}
          </div>
        )}

        {/* Global Broadcast Trigger Button */}
        <div className="pt-4 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="text-xs text-slate-500">
            Targeting: <strong className="text-indigo-600 font-bold">{activeContactsToBroadcast.length} recipients</strong> via{" "}
            <span className="uppercase font-semibold text-slate-700">{nudgeFormat}</span> format.
          </div>

          <Button
            size="lg"
            onClick={handleTriggerBroadcast}
            disabled={activeContactsToBroadcast.length === 0}
            className="w-full sm:w-auto bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-700 hover:to-blue-700 text-white font-bold text-sm shadow-md px-8 h-12"
          >
            <Play className="w-4 h-4 mr-2 fill-current" />
            Start Bulk Broadcast ({activeContactsToBroadcast.length})
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};
