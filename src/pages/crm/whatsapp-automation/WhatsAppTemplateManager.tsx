import React, { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import {
  Search, Plus, RefreshCw, Copy, Check, Edit3, Trash2, Send,
  Code2, ExternalLink, Phone, Image as ImageIcon, FileText, Video,
  Sparkles, CheckCircle2, Clock, AlertTriangle, XCircle, ChevronRight,
  Filter, Grid, List, HelpCircle, ArrowLeft, Smartphone, Eye, MoreVertical,
  Share2, ShieldCheck, Download, Layers, MessageSquare
} from "lucide-react";
import {
  WhatsAppConfig,
  MetaTemplate,
  fetchMetaTemplates,
  sendMetaMessage,
  createMetaTemplate
} from "@/services/whatsappAutomationService";
import { TemplatePreviewAnalyticsModal } from "./TemplatePreviewAnalyticsModal";

export interface WhatsAppManagedTemplate {
  id: string;
  name: string; // snake_case
  category: "UTILITY" | "MARKETING" | "AUTHENTICATION";
  language: string;
  headerType: "NONE" | "TEXT" | "IMAGE" | "VIDEO" | "DOCUMENT";
  headerText?: string;
  headerMediaUrl?: string;
  bodyText: string;
  sampleVariables: string[];
  footerText?: string;
  buttonMode: "NONE" | "CTA" | "QUICK_REPLY";
  ctaButtons?: Array<{ type: "URL" | "PHONE_NUMBER"; text: string; url?: string; phoneNumber?: string }>;
  quickReplyButtons?: string[];
  status: "APPROVED" | "PENDING" | "REJECTED" | "DRAFT";
  rejectionReason?: string;
  updatedAt: string;
}

// No mock templates — only real templates fetched from Meta Graph API are shown

const LANGUAGES = [
  { code: "en_US", label: "English (US)" },
  { code: "en_GB", label: "English (UK)" },
  { code: "hi_IN", label: "Hindi (हिंदी)" },
  { code: "mr_IN", label: "Marathi (मराठी)" },
  { code: "es_ES", label: "Spanish" }
];

interface WhatsAppTemplateManagerProps {
  config: WhatsAppConfig;
  onCreateNewTemplate?: () => void;
}

export const WhatsAppTemplateManager: React.FC<WhatsAppTemplateManagerProps> = ({ config, onCreateNewTemplate }) => {
  const { toast } = useToast();
  const bodyTextareaRef = useRef<HTMLTextAreaElement>(null);

  // State: Template Collection — starts empty, populated by Meta sync
  const [templates, setTemplates] = useState<WhatsAppManagedTemplate[]>([]);
  const [hasAutoSynced, setHasAutoSynced] = useState(false);

  // Filters & Search State
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("ALL");
  const [selectedStatus, setSelectedStatus] = useState<string>("ALL");
  const [selectedLanguage, setSelectedLanguage] = useState<string>("ALL");
  const [viewMode, setViewMode] = useState<"table" | "grid">("table");

  // Mode: "list" | "editor"
  const [activeView, setActiveView] = useState<"list" | "editor">("list");
  const [editingTemplateId, setEditingTemplateId] = useState<string | null>(null);

  // Form State for Editor
  const [formData, setFormData] = useState<WhatsAppManagedTemplate>({
    id: "",
    name: "new_whatsapp_template_v1",
    category: "UTILITY",
    language: "en_US",
    headerType: "IMAGE",
    headerText: "",
    headerMediaUrl: "https://images.unsplash.com/photo-1544367567-0f2fcb009e0b?auto=format&fit=crop&w=1000&q=80",
    bodyText: "Namaste {{1}} 🙏\n\nYour Snehyoga session details: {{2}}.\n\nAccess link: {{3}}",
    sampleVariables: ["Customer Name", "Morning 6 AM Batch", "https://yoga.snehyoga.com/live"],
    footerText: "Snehyoga Studio • Support Team",
    buttonMode: "CTA",
    ctaButtons: [{ type: "URL", text: "Join Live Class", url: "https://yoga.snehyoga.com/live" }],
    quickReplyButtons: ["I Will Join", "Reschedule"],
    status: "DRAFT",
    updatedAt: new Date().toLocaleString()
  });

  // Modals state
  const [isTestModalOpen, setIsTestModalOpen] = useState(false);
  const [testModalTemplate, setTestModalTemplate] = useState<WhatsAppManagedTemplate | null>(null);
  const [testPhoneCountry, setTestPhoneCountry] = useState("+91");
  const [testPhoneNumber, setTestPhoneNumber] = useState("9145414083");
  const [testVariables, setTestVariables] = useState<Record<string, string>>({});
  const [isSendingTest, setIsSendingTest] = useState(false);

  const [isPayloadModalOpen, setIsPayloadModalOpen] = useState(false);
  const [payloadModalTemplate, setPayloadModalTemplate] = useState<WhatsAppManagedTemplate | null>(null);
  const [analyticsModalTemplate, setAnalyticsModalTemplate] = useState<WhatsAppManagedTemplate | null>(null);
  const [copiedPayload, setCopiedPayload] = useState(false);
  const [copiedName, setCopiedName] = useState<string | null>(null);

  const [isSyncing, setIsSyncing] = useState(false);

  // Filter templates
  const filteredTemplates = templates.filter(t => {
    const matchesSearch = t.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          t.bodyText.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = selectedCategory === "ALL" || t.category === selectedCategory;
    const matchesStatus = selectedStatus === "ALL" || t.status === selectedStatus;
    const matchesLanguage = selectedLanguage === "ALL" || t.language === selectedLanguage;
    return matchesSearch && matchesCategory && matchesStatus && matchesLanguage;
  });

  // Open Create Mode
  const handleOpenCreate = () => {
    const newId = `tpl_${Date.now()}`;
    setEditingTemplateId(null);
    setFormData({
      id: newId,
      name: "new_service_notice_v1",
      category: "UTILITY",
      language: "en_US",
      headerType: "IMAGE",
      headerText: "",
      headerMediaUrl: "https://images.unsplash.com/photo-1544367567-0f2fcb009e0b?auto=format&fit=crop&w=1000&q=80",
      bodyText: "Namaste {{1}} 🙏\n\nYour Snehyoga session details: {{2}}.\n\nAccess link: {{3}}",
      sampleVariables: ["Customer Name", "Morning 6 AM Batch", "https://yoga.snehyoga.com/live"],
      footerText: "Snehyoga Studio Support",
      buttonMode: "CTA",
      ctaButtons: [{ type: "URL", text: "Join Live Class", url: "https://yoga.snehyoga.com/live" }],
      quickReplyButtons: ["Confirm Slot", "Contact Admin"],
      status: "DRAFT",
      updatedAt: new Date().toISOString().replace("T", " ").substring(0, 16)
    });
    setActiveView("editor");
  };

  // Open Edit Mode
  const handleOpenEdit = (tpl: WhatsAppManagedTemplate) => {
    setEditingTemplateId(tpl.id);
    setFormData({ ...tpl });
    setActiveView("editor");
  };

  // Duplicate Template
  const handleDuplicate = (tpl: WhatsAppManagedTemplate) => {
    const duplicated: WhatsAppManagedTemplate = {
      ...tpl,
      id: `tpl_${Date.now()}`,
      name: `${tpl.name}_copy`,
      status: "DRAFT",
      updatedAt: new Date().toISOString().replace("T", " ").substring(0, 16)
    };
    setTemplates([duplicated, ...templates]);
    toast({
      title: "Template Duplicated 📋",
      description: `Created copy "${duplicated.name}".`
    });
  };

  // Delete Template
  const handleDelete = (id: string, name: string) => {
    if (confirm(`Are you sure you want to delete template "${name}"?`)) {
      setTemplates(templates.filter(t => t.id !== id));
      toast({ title: "Template Deleted 🗑️", description: `Template "${name}" has been removed.` });
    }
  };

  // Copy template name
  const handleCopyName = (name: string) => {
    navigator.clipboard.writeText(name);
    setCopiedName(name);
    toast({ title: "Copied to Clipboard!", description: `"${name}" copied.` });
    setTimeout(() => setCopiedName(null), 2000);
  };

  // Sync Meta Templates
  const handleSyncMetaTemplates = async (silent = false) => {
    setIsSyncing(true);
    const res = await fetchMetaTemplates(config);
    setIsSyncing(false);
    if (res.success && res.templates.length > 0) {
      // Map Meta API response to WhatsAppManagedTemplate using full parsed fields
      const syncedMapped: WhatsAppManagedTemplate[] = res.templates.map((mt, idx) => ({
        id: mt.id || `meta_${idx}`,
        name: mt.name,
        category: (mt.category as any) || "UTILITY",
        language: mt.language || "en_US",
        headerType: mt.headerType || "NONE",
        headerText: mt.headerText || "",
        headerMediaUrl: mt.headerUrl || "",
        bodyText: mt.body,
        sampleVariables: mt.sampleVariables || Array.from({ length: mt.paramCount }, (_, i) => `Sample ${i + 1}`),
        footerText: mt.footerText || "",
        buttonMode: mt.buttonMode || "NONE",
        ctaButtons: mt.ctaButtons,
        quickReplyButtons: mt.quickReplyButtons,
        status: (mt.status as any) || "APPROVED",
        rejectionReason: mt.rejectionReason,
        updatedAt: mt.updatedAt || new Date().toISOString().replace("T", " ").substring(0, 16)
      }));

      // Combine removing duplicates by name — Meta templates take priority
      const existingNames = new Set(syncedMapped.map(s => s.name));
      const remainingLocal = templates.filter(t => !existingNames.has(t.name));
      setTemplates([...syncedMapped, ...remainingLocal]);

      if (!silent) {
        toast({
          title: "Meta Templates Synced! 🔄",
          description: `Successfully synchronized ${res.templates.length} templates from Meta WABA.`
        });
      }
    } else {
      if (!silent) {
        toast({
          title: "Sync Result",
          description: res.error || "No templates found on Meta WABA.",
          variant: res.error ? "destructive" : "default"
        });
      }
    }
  };

  // Auto-sync templates from Meta on first mount
  useEffect(() => {
    if (!hasAutoSynced && config.apiToken && config.wabaId) {
      setHasAutoSynced(true);
      handleSyncMetaTemplates(true);
    }
  }, [config.apiToken, config.wabaId]);

  // Editor: Slugify Template Name
  const handleNameChange = (val: string) => {
    const slugified = val.toLowerCase().replace(/[^a-z0-9_]/g, "_");
    setFormData(prev => ({ ...prev, name: slugified }));
  };

  // Editor: Synchronize Sample Variable Inputs with {{x}} regex
  const updateVariablesCount = (newBodyText: string) => {
    const matches = newBodyText.match(/\{\{\d+\}\}/g) || [];
    const count = matches.length;
    setFormData(prev => {
      const next = [...prev.sampleVariables];
      while (next.length < count) next.push(`Sample_${next.length + 1}`);
      return { ...prev, bodyText: newBodyText, sampleVariables: next.slice(0, count) };
    });
  };

  // Editor: Insert Variable Button
  const handleInsertVariable = () => {
    const matches = formData.bodyText.match(/\{\{\d+\}\}/g) || [];
    const nextNum = matches.length + 1;
    const tag = `{{${nextNum}}}`;

    if (bodyTextareaRef.current) {
      const start = bodyTextareaRef.current.selectionStart;
      const end = bodyTextareaRef.current.selectionEnd;
      const updated = formData.bodyText.substring(0, start) + tag + formData.bodyText.substring(end);
      updateVariablesCount(updated);
      setTimeout(() => {
        bodyTextareaRef.current?.focus();
        bodyTextareaRef.current?.setSelectionRange(start + tag.length, start + tag.length);
      }, 50);
    } else {
      const updated = `${formData.bodyText} ${tag}`;
      updateVariablesCount(updated);
    }
  };

  // Editor: Format Text with prefix/suffix
  const handleFormatText = (prefix: string, suffix: string) => {
    if (!bodyTextareaRef.current) return;
    const start = bodyTextareaRef.current.selectionStart;
    const end = bodyTextareaRef.current.selectionEnd;
    const selected = formData.bodyText.substring(start, end) || "text";
    const updated = formData.bodyText.substring(0, start) + prefix + selected + suffix + formData.bodyText.substring(end);
    setFormData(prev => ({ ...prev, bodyText: updated }));
  };

  // Save / Submit Template in Editor
  const handleSaveTemplate = async (status: "APPROVED" | "PENDING" | "DRAFT") => {
    if (!formData.name.trim()) {
      toast({ title: "Template Name Required", description: "Please enter a valid snake_case name.", variant: "destructive" });
      return;
    }
    if (!formData.bodyText.trim()) {
      toast({ title: "Body Required", description: "Message body text cannot be empty.", variant: "destructive" });
      return;
    }

    const updatedTpl: WhatsAppManagedTemplate = {
      ...formData,
      status,
      updatedAt: new Date().toISOString().replace("T", " ").substring(0, 16)
    };

    // Call Meta API if submitting as PENDING / APPROVED
    if (status === "PENDING" || status === "APPROVED") {
      let finalButtons: any[] = [];
      if (formData.buttonMode === "CTA" && formData.ctaButtons) {
        finalButtons = formData.ctaButtons.filter(b => b.text.trim());
      } else if (formData.buttonMode === "QUICK_REPLY" && formData.quickReplyButtons) {
        finalButtons = formData.quickReplyButtons.filter(b => b.trim()).map(text => ({ type: "QUICK_REPLY", text }));
      }

      toast({ title: "Submitting to Meta Cloud API... ⏳", description: "Sending payload to WABA endpoint." });
      const metaRes = await createMetaTemplate(config, {
        name: formData.name,
        category: formData.category,
        language: formData.language,
        headerType: formData.headerType,
        headerText: formData.headerType === "TEXT" ? formData.headerText : undefined,
        headerMediaUrl: formData.headerType !== "NONE" && formData.headerType !== "TEXT" ? formData.headerMediaUrl : undefined,
        bodyText: formData.bodyText,
        sampleBodyVariables: formData.sampleVariables,
        footerText: formData.footerText,
        buttons: finalButtons.length > 0 ? finalButtons : undefined
      });

      if (metaRes.success) {
        toast({ title: "Meta Submission Success! 🎉", description: `Template "${formData.name}" submitted to Meta.` });
      } else {
        toast({ title: "Local Save (Meta API Note)", description: metaRes.error || "Meta credentials pending, saved locally.", variant: "default" });
      }
    }

    // Save locally
    const exists = templates.some(t => t.id === updatedTpl.id);
    if (exists) {
      setTemplates(templates.map(t => t.id === updatedTpl.id ? updatedTpl : t));
    } else {
      setTemplates([updatedTpl, ...templates]);
    }

    toast({ title: "Template Saved ✅", description: `"${updatedTpl.name}" updated successfully.` });
    setActiveView("list");
  };

  // Open Test Modal
  const handleOpenTestModal = (tpl: WhatsAppManagedTemplate) => {
    setTestModalTemplate(tpl);
    const initialVars: Record<string, string> = {};
    (tpl.sampleVariables || []).forEach((val, idx) => {
      initialVars[`${idx + 1}`] = val || `Value_${idx + 1}`;
    });
    setTestVariables(initialVars);
    setIsTestModalOpen(true);
  };

  // Send Test Message
  const handleSendTestMessage = async () => {
    if (!testModalTemplate) return;
    const fullPhone = `${testPhoneCountry}${testPhoneNumber.replace(/\D/g, "")}`;
    if (fullPhone.length < 10) {
      toast({ title: "Invalid Phone Number", description: "Please enter a valid recipient phone number.", variant: "destructive" });
      return;
    }

    setIsSendingTest(true);
    const paramValues = Object.keys(testVariables).sort((a,b) => Number(a)-Number(b)).map(k => testVariables[k]);

    const res = await sendMetaMessage({
      config,
      to: fullPhone,
      type: testModalTemplate.headerType !== "NONE" && testModalTemplate.headerType !== "TEXT" ? (testModalTemplate.headerType.toLowerCase() as any) : "template",
      templateName: testModalTemplate.name,
      templateParams: paramValues,
      languageCode: testModalTemplate.language,
      headerImageUrl: testModalTemplate.headerMediaUrl,
      textBody: testModalTemplate.bodyText
    });

    setIsSendingTest(false);
    if (res.success) {
      toast({
        title: "Test Message Sent! 🚀",
        description: `Delivered template "${testModalTemplate.name}" to WhatsApp number ${fullPhone}.`
      });
      setIsTestModalOpen(false);
    } else {
      toast({
        title: "Test Transmission Result",
        description: res.error || "Message queued. Check WABA API token validity in Tab 1 if unreceived.",
        variant: "destructive"
      });
    }
  };

  // Open Meta JSON Viewer
  const handleOpenPayloadModal = (tpl: WhatsAppManagedTemplate) => {
    setPayloadModalTemplate(tpl);
    setCopiedPayload(false);
    setIsPayloadModalOpen(true);
  };

  // Generate Meta Cloud API JSON representation
  const generateMetaPayloadJson = (tpl: WhatsAppManagedTemplate) => {
    const components: any[] = [];
    if (tpl.headerType === "TEXT" && tpl.headerText) {
      components.push({ type: "HEADER", format: "TEXT", text: tpl.headerText });
    } else if (tpl.headerType !== "NONE") {
      components.push({
        type: "HEADER",
        format: tpl.headerType,
        example: tpl.headerMediaUrl ? { header_handle: [tpl.headerMediaUrl] } : undefined
      });
    }

    const varMatches = tpl.bodyText.match(/\{\{\d+\}\}/g) || [];
    components.push({
      type: "BODY",
      text: tpl.bodyText,
      example: varMatches.length > 0 ? { body_text: [tpl.sampleVariables] } : undefined
    });

    if (tpl.footerText) {
      components.push({ type: "FOOTER", text: tpl.footerText });
    }

    if (tpl.buttonMode === "CTA" && tpl.ctaButtons) {
      components.push({
        type: "BUTTONS",
        buttons: tpl.ctaButtons.map(b => ({
          type: b.type,
          text: b.text,
          url: b.url,
          phone_number: b.phoneNumber
        }))
      });
    } else if (tpl.buttonMode === "QUICK_REPLY" && tpl.quickReplyButtons) {
      components.push({
        type: "BUTTONS",
        buttons: tpl.quickReplyButtons.map(text => ({ type: "QUICK_REPLY", text }))
      });
    }

    return JSON.stringify({
      endpoint: `POST /v20.0/${config.wabaId || "1564657775051850"}/message_templates`,
      headers: {
        "Authorization": "Bearer EAAX2HQ7...",
        "Content-Type": "application/json"
      },
      payload: {
        name: tpl.name,
        category: tpl.category,
        language: tpl.language,
        components
      }
    }, null, 2);
  };

  // Helper: Live Preview parser for Body Text
  const renderLivePreviewBody = (body: string, vars: string[]) => {
    let text = body;
    vars.forEach((v, idx) => {
      const tag = `{{${idx + 1}}}`;
      text = text.replace(new RegExp(tag.replace(/[{()}]/g, "\\$&"), "g"), v || tag);
    });

    // Simple parser for *bold*, _italic_, ~strike~, `code`
    return text.split("\n").map((line, lIdx) => (
      <React.Fragment key={lIdx}>
        {line.split(/(\*[^*]+\*|_[^_]+_|~[^~]+~|`[^`]+`)/g).map((part, pIdx) => {
          if (part.startsWith("*") && part.endsWith("*")) {
            return <strong key={pIdx} className="font-bold text-slate-900">{part.slice(1, -1)}</strong>;
          }
          if (part.startsWith("_") && part.endsWith("_")) {
            return <em key={pIdx} className="italic text-slate-800">{part.slice(1, -1)}</em>;
          }
          if (part.startsWith("~") && part.endsWith("~")) {
            return <span key={pIdx} className="line-through text-slate-500">{part.slice(1, -1)}</span>;
          }
          if (part.startsWith("`") && part.endsWith("`")) {
            return <code key={pIdx} className="bg-slate-100 px-1 py-0.5 rounded font-mono text-[11px] text-emerald-700">{part.slice(1, -1)}</code>;
          }
          return part;
        })}
        {lIdx < text.split("\n").length - 1 && <br />}
      </React.Fragment>
    ));
  };

  return (
    <div className="space-y-6">
      {/* Overview View Header / Navigation */}
      {activeView === "list" ? (
        <div className="space-y-6">
          {/* Top Hero Card */}
          <div className="bg-gradient-to-r from-slate-950 via-indigo-950 to-slate-900 rounded-3xl p-6 sm:p-8 text-white shadow-xl relative overflow-hidden border border-slate-800">
            <div className="absolute top-0 right-0 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
            <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
                  <span className="text-xs font-bold uppercase tracking-widest text-emerald-400">
                    Enterprise WABA Manager
                  </span>
                </div>
                <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white flex items-center gap-2">
                  WhatsApp Template Manager
                </h2>
                <p className="text-xs sm:text-sm text-slate-300 max-w-2xl leading-relaxed">
                  Design, validate, and synchronize high-converting Meta WhatsApp templates with instant variable previews, live smartphone simulation, and single-click Meta submission.
                </p>
              </div>

              <div className="flex items-center gap-3">
                <Button
                  onClick={handleSyncMetaTemplates}
                  disabled={isSyncing}
                  variant="outline"
                  className="bg-white/10 hover:bg-white/20 text-white border-white/10 font-semibold text-xs h-10 px-4 rounded-xl"
                >
                  <RefreshCw className={`w-3.5 h-3.5 mr-2 ${isSyncing ? "animate-spin text-emerald-400" : ""}`} />
                  {isSyncing ? "Syncing Meta..." : "Sync Meta Templates"}
                </Button>

                <Button
                  onClick={onCreateNewTemplate || handleOpenCreate}
                  className="bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-bold text-xs h-10 px-5 rounded-xl shadow-lg shadow-emerald-500/20"
                >
                  <Plus className="w-4 h-4 mr-1.5 stroke-[3]" /> + Create Template
                </Button>
              </div>
            </div>

            {/* Quick Metrics */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-6 pt-6 border-t border-white/10">
              <div className="bg-white/5 backdrop-blur-sm rounded-xl p-3 border border-white/5">
                <span className="text-[11px] text-slate-400 block font-medium">Total Templates</span>
                <span className="text-lg font-bold text-white">{templates.length}</span>
              </div>
              <div className="bg-emerald-500/10 backdrop-blur-sm rounded-xl p-3 border border-emerald-500/20">
                <span className="text-[11px] text-emerald-400 block font-medium">Approved by Meta</span>
                <span className="text-lg font-bold text-emerald-300">
                  {templates.filter(t => t.status === "APPROVED").length}
                </span>
              </div>
              <div className="bg-amber-500/10 backdrop-blur-sm rounded-xl p-3 border border-amber-500/20">
                <span className="text-[11px] text-amber-400 block font-medium">Under Meta Review</span>
                <span className="text-lg font-bold text-amber-300">
                  {templates.filter(t => t.status === "PENDING").length}
                </span>
              </div>
              <div className="bg-rose-500/10 backdrop-blur-sm rounded-xl p-3 border border-rose-500/20">
                <span className="text-[11px] text-rose-400 block font-medium">Rejected</span>
                <span className="text-lg font-bold text-rose-300">
                  {templates.filter(t => t.status === "REJECTED").length}
                </span>
              </div>
            </div>
          </div>

          {/* Search, Filter Toolbar & View Mode Toggle */}
          <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-sm flex flex-col lg:flex-row items-center justify-between gap-4">
            {/* Search Input */}
            <div className="relative w-full lg:w-96">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
              <Input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by template name or body text..."
                className="pl-10 text-xs h-10 border-slate-200 bg-slate-50/50 rounded-xl focus:bg-white"
              />
              {searchQuery && (
                <button onClick={() => setSearchQuery("")} className="absolute right-3 top-3 text-slate-400 text-xs">✕</button>
              )}
            </div>

            {/* Category, Status & Language Filters */}
            <div className="flex flex-wrap items-center gap-2.5 w-full lg:w-auto">
              {/* Category Filter */}
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="h-9 px-3 text-xs font-semibold text-slate-700 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none"
              >
                <option value="ALL">All Categories</option>
                <option value="UTILITY">Utility</option>
                <option value="MARKETING">Marketing</option>
                <option value="AUTHENTICATION">Authentication</option>
              </select>

              {/* Status Filter */}
              <select
                value={selectedStatus}
                onChange={(e) => setSelectedStatus(e.target.value)}
                className="h-9 px-3 text-xs font-semibold text-slate-700 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none"
              >
                <option value="ALL">All Statuses</option>
                <option value="APPROVED">Approved 🟢</option>
                <option value="PENDING">Pending 🟡</option>
                <option value="REJECTED">Rejected 🔴</option>
                <option value="DRAFT">Draft ⚪</option>
              </select>

              {/* Language Filter */}
              <select
                value={selectedLanguage}
                onChange={(e) => setSelectedLanguage(e.target.value)}
                className="h-9 px-3 text-xs font-semibold text-slate-700 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none"
              >
                <option value="ALL">All Languages</option>
                {LANGUAGES.map(l => (
                  <option key={l.code} value={l.code}>{l.label}</option>
                ))}
              </select>

              {/* View Toggle */}
              <div className="flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200 ml-auto">
                <button
                  onClick={() => setViewMode("table")}
                  className={`p-1.5 rounded-lg text-xs font-medium transition-all ${
                    viewMode === "table" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-900"
                  }`}
                  title="Table View"
                >
                  <List className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setViewMode("grid")}
                  className={`p-1.5 rounded-lg text-xs font-medium transition-all ${
                    viewMode === "grid" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-900"
                  }`}
                  title="Card Grid View"
                >
                  <Grid className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>

          {/* MAIN TEMPLATES DISPLAY */}
          {filteredTemplates.length === 0 ? (
            <div className="bg-white rounded-2xl p-12 text-center border border-slate-200 space-y-3">
              <MessageSquare className="w-12 h-12 text-slate-300 mx-auto" />
              <h3 className="text-base font-bold text-slate-800">No WhatsApp Templates Found</h3>
              <p className="text-xs text-slate-500 max-w-sm mx-auto">
                No templates matched your current filter criteria. Try clearing filters or create a new template.
              </p>
              <Button onClick={handleOpenCreate} size="sm" className="bg-emerald-600 text-white font-bold text-xs mt-2">
                + Create First Template
              </Button>
            </div>
          ) : viewMode === "table" ? (
            /* Table View */
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                      <th className="py-3.5 px-4">Template Name</th>
                      <th className="py-3.5 px-4">Category</th>
                      <th className="py-3.5 px-4">Header</th>
                      <th className="py-3.5 px-4">Language</th>
                      <th className="py-3.5 px-4">Meta Status</th>
                      <th className="py-3.5 px-4">Last Updated</th>
                      <th className="py-3.5 px-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-xs">
                    {filteredTemplates.map((t) => (
                      <tr key={t.id} className="hover:bg-slate-50/80 transition-colors group">
                        {/* Name + Copy Button */}
                        <td className="py-3.5 px-4">
                          <div className="flex items-center gap-2">
                            <span
                              onClick={() => setAnalyticsModalTemplate(t)}
                              className="font-mono font-bold text-slate-900 hover:text-indigo-600 transition-colors cursor-pointer underline decoration-slate-300 hover:decoration-indigo-500 underline-offset-4"
                              title="Click to view Preview & Analytics"
                            >
                              {t.name}
                            </span>
                            <button
                              onClick={() => handleCopyName(t.name)}
                              className="text-slate-400 hover:text-indigo-600 transition-colors"
                              title="Copy Template Name"
                            >
                              {copiedName === t.name ? (
                                <Check className="w-3.5 h-3.5 text-emerald-600" />
                              ) : (
                                <Copy className="w-3.5 h-3.5" />
                              )}
                            </button>
                          </div>
                          <p className="text-[10px] text-slate-500 truncate max-w-xs mt-0.5">
                            {t.bodyText.substring(0, 60)}...
                          </p>
                        </td>

                        {/* Category Badge */}
                        <td className="py-3.5 px-4">
                          {t.category === "UTILITY" ? (
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-blue-500/10 text-blue-600 border border-blue-500/20">
                              UTILITY
                            </span>
                          ) : t.category === "MARKETING" ? (
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-purple-500/10 text-purple-600 border border-purple-500/20">
                              MARKETING
                            </span>
                          ) : (
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/10 text-amber-600 border border-amber-500/20">
                              AUTHENTICATION
                            </span>
                          )}
                        </td>

                        {/* Header Type */}
                        <td className="py-3.5 px-4 font-medium text-slate-700">
                          <div className="flex items-center gap-1.5">
                            {t.headerType === "IMAGE" && <ImageIcon className="w-3.5 h-3.5 text-emerald-600" />}
                            {t.headerType === "DOCUMENT" && <FileText className="w-3.5 h-3.5 text-blue-600" />}
                            {t.headerType === "VIDEO" && <Video className="w-3.5 h-3.5 text-purple-600" />}
                            {t.headerType === "TEXT" && <span className="text-xs font-bold">🔤</span>}
                            {t.headerType === "NONE" && <span className="text-slate-400">None</span>}
                            <span className="capitalize text-slate-700">{t.headerType.toLowerCase()}</span>
                          </div>
                        </td>

                        {/* Language */}
                        <td className="py-3.5 px-4">
                          <span className="bg-slate-100 text-slate-700 font-mono text-[10px] px-2 py-0.5 rounded font-bold border border-slate-200">
                            {t.language}
                          </span>
                        </td>

                        {/* Meta Status Badge with live status indicator dot */}
                        <td className="py-3.5 px-4">
                          {t.status === "APPROVED" && (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                              APPROVED
                            </span>
                          )}
                          {t.status === "PENDING" && (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                              <span className="w-2 h-2 rounded-full bg-amber-500 animate-ping" />
                              PENDING
                            </span>
                          )}
                          {t.status === "REJECTED" && (
                            <div className="relative group/tooltip inline-block">
                              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-rose-50 text-rose-700 border border-rose-200 cursor-help">
                                <span className="w-2 h-2 rounded-full bg-rose-500" />
                                REJECTED
                              </span>
                              {t.rejectionReason && (
                                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-56 p-2 bg-slate-900 text-white text-[10px] rounded-lg shadow-xl opacity-0 group-hover/tooltip:opacity-100 transition-opacity pointer-events-none z-30">
                                  <strong>Meta Rejection Reason:</strong>
                                  <p className="mt-0.5 text-slate-300">{t.rejectionReason}</p>
                                </div>
                              )}
                            </div>
                          )}
                          {t.status === "DRAFT" && (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-slate-100 text-slate-600 border border-slate-200">
                              <span className="w-2 h-2 rounded-full bg-slate-400" />
                              DRAFT
                            </span>
                          )}
                        </td>

                        {/* Last Updated */}
                        <td className="py-3.5 px-4 text-slate-500 text-[11px]">
                          {t.updatedAt}
                        </td>

                        {/* Action Menu */}
                        <td className="py-3.5 px-4 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => setAnalyticsModalTemplate(t)}
                              className="h-8 px-2.5 text-xs text-emerald-700 hover:bg-emerald-50 font-bold border border-emerald-200/60 bg-emerald-50/40"
                              title="View Preview & Analytics Modal"
                            >
                              <Eye className="w-3.5 h-3.5 mr-1 text-emerald-600" /> Stats & Preview
                            </Button>

                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleOpenTestModal(t)}
                              className="h-8 px-2.5 text-xs text-indigo-600 hover:bg-indigo-50 font-semibold"
                              title="Send Test WhatsApp Message"
                            >
                              <Send className="w-3.5 h-3.5 mr-1" /> Test
                            </Button>

                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleOpenEdit(t)}
                              className="h-8 px-2.5 text-xs text-slate-700 hover:bg-slate-100 font-semibold"
                              title="Edit Template"
                            >
                              <Edit3 className="w-3.5 h-3.5 mr-1" /> Edit
                            </Button>

                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleOpenPayloadModal(t)}
                              className="h-8 px-2 text-xs text-slate-500 hover:bg-slate-100"
                              title="View Meta JSON Payload"
                            >
                              <Code2 className="w-3.5 h-3.5" />
                            </Button>

                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleDuplicate(t)}
                              className="h-8 px-2 text-xs text-slate-500 hover:bg-slate-100"
                              title="Duplicate Template"
                            >
                              <Copy className="w-3.5 h-3.5" />
                            </Button>

                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleDelete(t.id, t.name)}
                              className="h-8 px-2 text-xs text-rose-600 hover:bg-rose-50"
                              title="Delete Template"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            /* Card Grid View */
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredTemplates.map((t) => (
                <Card key={t.id} className="border border-slate-200/90 shadow-sm hover:shadow-md transition-shadow bg-white flex flex-col">
                  <CardHeader className="p-4 bg-slate-50/80 border-b border-slate-100 flex flex-row items-start justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-2">
                        <span
                          onClick={() => setAnalyticsModalTemplate(t)}
                          className="font-mono font-bold text-sm text-slate-900 truncate max-w-[180px] hover:text-indigo-600 cursor-pointer underline decoration-slate-300 hover:decoration-indigo-500 underline-offset-4"
                          title="Click to view Preview & Analytics"
                        >
                          {t.name}
                        </span>
                        <button onClick={() => handleCopyName(t.name)} className="text-slate-400 hover:text-indigo-600">
                          <Copy className="w-3.5 h-3.5" />
                        </button>
                      </div>
                      <div className="flex items-center gap-2 mt-1">
                        {t.category === "UTILITY" && (
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-500/10 text-blue-600 border border-blue-500/20">UTILITY</span>
                        )}
                        {t.category === "MARKETING" && (
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-purple-500/10 text-purple-600 border border-purple-500/20">MARKETING</span>
                        )}
                        {t.category === "AUTHENTICATION" && (
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/10 text-amber-600 border border-amber-500/20">AUTHENTICATION</span>
                        )}
                        <span className="text-[10px] font-mono text-slate-500">{t.language}</span>
                      </div>
                    </div>

                    {/* Status Badge */}
                    {t.status === "APPROVED" && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" /> APPROVED
                      </span>
                    )}
                    {t.status === "PENDING" && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                        <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-ping" /> PENDING
                      </span>
                    )}
                    {t.status === "REJECTED" && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-200">
                        <span className="w-1.5 h-1.5 rounded-full bg-rose-500" /> REJECTED
                      </span>
                    )}
                    {t.status === "DRAFT" && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-600 border border-slate-200">
                        DRAFT
                      </span>
                    )}
                  </CardHeader>

                  <CardContent className="p-4 flex-1 flex flex-col justify-between space-y-4">
                    {/* Header Image Thumbnail if available */}
                    {t.headerType === "IMAGE" && t.headerMediaUrl && (
                      <div className="h-28 rounded-xl overflow-hidden bg-slate-100 border border-slate-100">
                        <img src={t.headerMediaUrl} alt="Header" className="w-full h-full object-cover" />
                      </div>
                    )}

                    {/* Body Snippet */}
                    <p className="text-xs text-slate-700 leading-relaxed line-clamp-4 font-sans whitespace-pre-wrap">
                      {t.bodyText}
                    </p>

                    {/* Card Footer Actions */}
                    <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
                      <span className="text-[10px] text-slate-400">{t.updatedAt}</span>
                      <div className="flex items-center gap-1">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setAnalyticsModalTemplate(t)}
                          className="h-7 text-[11px] font-bold text-emerald-700 border-emerald-200 hover:bg-emerald-50"
                          title="Preview & Analytics"
                        >
                          <Eye className="w-3 h-3 mr-1 text-emerald-600" /> Stats
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleOpenTestModal(t)}
                          className="h-7 text-[11px] font-bold text-indigo-600 border-indigo-200 hover:bg-indigo-50"
                        >
                          <Send className="w-3 h-3 mr-1" /> Test
                        </Button>
                        <Button
                          size="sm"
                          onClick={() => handleOpenEdit(t)}
                          className="h-7 text-[11px] font-bold bg-slate-900 hover:bg-slate-800 text-white"
                        >
                          Edit
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      ) : (
        /* SPLIT VIEW TEMPLATE EDITOR (60% Form Editor / 40% Smartphone Preview) */
        <div className="space-y-6">
          {/* Editor Header Navigation */}
          <div className="bg-slate-900 text-white rounded-2xl p-5 border border-slate-800 shadow-lg flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <Button
                variant="ghost"
                onClick={() => setActiveView("list")}
                className="text-slate-300 hover:text-white hover:bg-white/10 h-9 px-3 text-xs font-semibold"
              >
                <ArrowLeft className="w-4 h-4 mr-1.5" /> Back to Templates List
              </Button>
              <div className="h-5 w-px bg-white/20 hidden sm:block" />
              <div>
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  {editingTemplateId ? `Editing Template: ${formData.name}` : "Create New WhatsApp Template"}
                </h3>
                <p className="text-[11px] text-slate-400">Configure parameters, variables, and buttons with real-time phone simulator.</p>
              </div>
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto">
              <Button
                onClick={() => handleSaveTemplate("DRAFT")}
                variant="outline"
                className="bg-white/10 text-white border-white/20 hover:bg-white/20 font-bold text-xs h-9 px-4"
              >
                Save Draft
              </Button>
              <Button
                onClick={() => handleSaveTemplate("APPROVED")}
                className="bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-bold text-xs h-9 px-5 shadow-lg shadow-emerald-500/20"
              >
                <Send className="w-3.5 h-3.5 mr-1.5" /> Submit to Meta
              </Button>
            </div>
          </div>

          {/* SPLIT VIEW MAIN CONTAINER */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            {/* LEFT PANE (60% width -> 7 cols) Form Editor */}
            <div className="lg:col-span-7 space-y-5">
              {/* 1. Header Section */}
              <Card className="border border-slate-200/90 shadow-sm bg-white">
                <CardHeader className="p-4 bg-slate-50 border-b border-slate-100">
                  <CardTitle className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2">
                    <span className="w-5 h-5 rounded-full bg-emerald-600 text-white flex items-center justify-center text-[10px]">1</span>
                    Header Section & Metadata
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-5 space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {/* Template Name */}
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-slate-700">Template Name (snake_case)</label>
                      <Input
                        value={formData.name}
                        onChange={(e) => handleNameChange(e.target.value)}
                        placeholder="e.g. account_service_update_v3"
                        className="font-mono text-xs border-slate-200"
                      />
                      <p className="text-[10px] text-slate-400">Lowercase letters, numbers, and underscores only</p>
                    </div>

                    {/* Language Dropdown */}
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-slate-700">Language</label>
                      <select
                        value={formData.language}
                        onChange={(e) => setFormData(prev => ({ ...prev, language: e.target.value }))}
                        className="w-full h-10 px-3 rounded-lg border border-slate-200 text-xs font-medium text-slate-800 bg-white"
                      >
                        {LANGUAGES.map((l) => (
                          <option key={l.code} value={l.code}>{l.label} ({l.code})</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* Category Segmented Selector */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-700">Category</label>
                    <div className="grid grid-cols-3 gap-2">
                      {[
                        { id: "UTILITY", label: "UTILITY", badge: "bg-blue-500/10 text-blue-600 border-blue-500/20" },
                        { id: "MARKETING", label: "MARKETING", badge: "bg-purple-500/10 text-purple-600 border-purple-500/20" },
                        { id: "AUTHENTICATION", label: "AUTHENTICATION", badge: "bg-amber-500/10 text-amber-600 border-amber-500/20" }
                      ].map((cat) => (
                        <button
                          key={cat.id}
                          type="button"
                          onClick={() => setFormData(prev => ({ ...prev, category: cat.id as any }))}
                          className={`py-2 px-3 rounded-xl text-xs font-bold border text-center transition-all ${
                            formData.category === cat.id
                              ? "border-emerald-600 bg-emerald-50 text-emerald-950 shadow-sm"
                              : "border-slate-200 text-slate-600 hover:bg-slate-50"
                          }`}
                        >
                          {cat.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* 2. Header Format Selector */}
              <Card className="border border-slate-200/90 shadow-sm bg-white">
                <CardHeader className="p-4 bg-slate-50 border-b border-slate-100">
                  <CardTitle className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2">
                    <span className="w-5 h-5 rounded-full bg-emerald-600 text-white flex items-center justify-center text-[10px]">2</span>
                    Header Format Selector
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-5 space-y-4">
                  <div className="flex gap-2 flex-wrap">
                    {[
                      { id: "NONE", label: "🚫 None" },
                      { id: "TEXT", label: "🔤 Text" },
                      { id: "IMAGE", label: "🖼️ Image" },
                      { id: "DOCUMENT", label: "📄 Document" },
                      { id: "VIDEO", label: "🎥 Video" }
                    ].map((type) => (
                      <button
                        key={type.id}
                        type="button"
                        onClick={() => setFormData(prev => ({ ...prev, headerType: type.id as any }))}
                        className={`text-xs font-bold px-3.5 py-2 rounded-xl border transition-all ${
                          formData.headerType === type.id
                            ? "bg-slate-900 text-white border-slate-900 shadow-sm"
                            : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50"
                        }`}
                      >
                        {type.label}
                      </button>
                    ))}
                  </div>

                  {formData.headerType === "TEXT" && (
                    <div className="space-y-1">
                      <label className="text-xs font-semibold text-slate-700">Header Text (supports variables)</label>
                      <Input
                        value={formData.headerText || ""}
                        onChange={(e) => setFormData(prev => ({ ...prev, headerText: e.target.value.substring(0, 60) }))}
                        placeholder="e.g. Special Snehyoga Update for {{1}}"
                        className="text-xs"
                        maxLength={60}
                      />
                      <div className="text-right text-[10px] text-slate-400">{(formData.headerText || "").length}/60</div>
                    </div>
                  )}

                  {formData.headerType !== "NONE" && formData.headerType !== "TEXT" && (
                    <div className="space-y-2">
                      <label className="text-xs font-semibold text-slate-700">Media URL Input & Upload Dropzone Preview</label>
                      <Input
                        value={formData.headerMediaUrl || ""}
                        onChange={(e) => setFormData(prev => ({ ...prev, headerMediaUrl: e.target.value }))}
                        placeholder="https://images.unsplash.com/... or your CDN URL"
                        className="text-xs font-mono"
                      />
                      {formData.headerMediaUrl && (
                        <div className="h-32 rounded-xl overflow-hidden border border-slate-200 bg-slate-50 relative group">
                          <img src={formData.headerMediaUrl} alt="Preview" className="w-full h-full object-cover" />
                          <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                            <span className="text-white text-xs font-bold">Dropzone Upload Preview</span>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* 3. Body Text Editor & Formatting Bar */}
              <Card className="border border-slate-200/90 shadow-sm bg-white">
                <CardHeader className="p-4 bg-slate-50 border-b border-slate-100 flex flex-row items-center justify-between">
                  <CardTitle className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2">
                    <span className="w-5 h-5 rounded-full bg-emerald-600 text-white flex items-center justify-center text-[10px]">3</span>
                    Body Text Editor
                  </CardTitle>
                  <span className="text-xs font-bold text-emerald-600 font-mono">
                    {formData.sampleVariables.length} Variables Detected
                  </span>
                </CardHeader>
                <CardContent className="p-5 space-y-4">
                  {/* Rich Text Toolbar */}
                  <div className="flex items-center justify-between bg-slate-50 p-2 rounded-xl border border-slate-200">
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => handleFormatText("*", "*")}
                        className="w-7 h-7 hover:bg-slate-200 rounded font-bold text-xs text-slate-800 flex items-center justify-center"
                        title="Bold (*text*)"
                      >
                        B
                      </button>
                      <button
                        type="button"
                        onClick={() => handleFormatText("_", "_")}
                        className="w-7 h-7 hover:bg-slate-200 rounded italic text-xs text-slate-800 flex items-center justify-center font-serif"
                        title="Italic (_text_)"
                      >
                        I
                      </button>
                      <button
                        type="button"
                        onClick={() => handleFormatText("~", "~")}
                        className="w-7 h-7 hover:bg-slate-200 rounded line-through text-xs text-slate-800 flex items-center justify-center"
                        title="Strikethrough (~text~)"
                      >
                        S
                      </button>
                      <button
                        type="button"
                        onClick={() => handleFormatText("`", "`")}
                        className="w-7 h-7 hover:bg-slate-200 rounded font-mono text-xs text-slate-800 flex items-center justify-center"
                        title="Code (`text`)"
                      >
                        C
                      </button>
                    </div>

                    {/* Add Variable Quick Action */}
                    <Button
                      size="sm"
                      type="button"
                      variant="outline"
                      onClick={handleInsertVariable}
                      className="h-7 text-xs font-bold border-emerald-300 text-emerald-700 hover:bg-emerald-50"
                    >
                      <Plus className="w-3.5 h-3.5 mr-1" /> + Add Variable {`{{${formData.sampleVariables.length + 1}}}`}
                    </Button>
                  </div>

                  {/* Body Textarea */}
                  <textarea
                    ref={bodyTextareaRef}
                    value={formData.bodyText}
                    onChange={(e) => {
                      const val = e.target.value.substring(0, 1024);
                      updateVariablesCount(val);
                    }}
                    rows={6}
                    className="w-full p-3.5 rounded-xl border border-slate-200 text-xs text-slate-800 font-sans leading-relaxed focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    placeholder="Enter message body text. Use {{1}}, {{2}} for dynamic tags."
                  />
                  <div className="flex justify-between items-center text-[10px] text-slate-400">
                    <span>Use placeholders like {`{{1}}`}, {`{{2}}`} sequentially</span>
                    <span>{formData.bodyText.length}/1024 characters</span>
                  </div>

                  {/* Dynamic Sample Values Section */}
                  {formData.sampleVariables.length > 0 && (
                    <div className="p-4 bg-emerald-50/60 rounded-xl border border-emerald-100 space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-emerald-950 flex items-center gap-1.5">
                          <HelpCircle className="w-3.5 h-3.5 text-emerald-600" />
                          Dynamic Sample Values (Real-time Smartphone Sync)
                        </span>
                        <span className="text-[10px] text-emerald-700 font-medium">Synced to right pane preview</span>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                        {formData.sampleVariables.map((val, idx) => (
                          <div key={idx} className="flex items-center gap-2">
                            <span className="text-xs font-mono font-bold text-emerald-900 w-12">{`{{${idx + 1}}}`}:</span>
                            <Input
                              value={val}
                              onChange={(e) => {
                                const next = [...formData.sampleVariables];
                                next[idx] = e.target.value;
                                setFormData(prev => ({ ...prev, sampleVariables: next }));
                              }}
                              placeholder={`Sample for {{${idx + 1}}}`}
                              className="h-8 text-xs bg-white border-emerald-200"
                            />
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* 4. Footer Text */}
              <Card className="border border-slate-200/90 shadow-sm bg-white">
                <CardHeader className="p-4 bg-slate-50 border-b border-slate-100">
                  <CardTitle className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="w-5 h-5 rounded-full bg-emerald-600 text-white flex items-center justify-center text-[10px]">4</span>
                      Footer Text (Optional)
                    </div>
                    <span className="text-xs font-normal text-slate-400">Max 60 chars</span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-5">
                  <Input
                    value={formData.footerText || ""}
                    onChange={(e) => setFormData(prev => ({ ...prev, footerText: e.target.value.substring(0, 60) }))}
                    placeholder="e.g. Yogras Support Team"
                    className="text-xs"
                    maxLength={60}
                  />
                </CardContent>
              </Card>

              {/* 5. Buttons Builder */}
              <Card className="border border-slate-200/90 shadow-sm bg-white">
                <CardHeader className="p-4 bg-slate-50 border-b border-slate-100">
                  <CardTitle className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="w-5 h-5 rounded-full bg-emerald-600 text-white flex items-center justify-center text-[10px]">5</span>
                      Interactive Buttons Builder
                    </div>
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-5 space-y-4">
                  <div className="flex gap-2">
                    {[
                      { id: "NONE", label: "None" },
                      { id: "CTA", label: "Call-to-Action (URL / Call)" },
                      { id: "QUICK_REPLY", label: "Quick Reply (Max 3)" }
                    ].map((b) => (
                      <button
                        key={b.id}
                        type="button"
                        onClick={() => setFormData(prev => ({ ...prev, buttonMode: b.id as any }))}
                        className={`text-xs font-bold px-3 py-1.5 rounded-lg border transition-all ${
                          formData.buttonMode === b.id
                            ? "bg-slate-900 text-white border-slate-900 shadow-sm"
                            : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50"
                        }`}
                      >
                        {b.label}
                      </button>
                    ))}
                  </div>

                  {formData.buttonMode === "CTA" && (
                    <div className="space-y-3 pt-2">
                      {(formData.ctaButtons || []).map((btn, idx) => (
                        <div key={idx} className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                              {btn.type === "URL" ? <ExternalLink className="w-3.5 h-3.5 text-blue-600" /> : <Phone className="w-3.5 h-3.5 text-emerald-600" />}
                              CTA {idx + 1}: {btn.type === "URL" ? "URL Link" : "Phone Call"}
                            </span>
                            <select
                              value={btn.type}
                              onChange={(e) => {
                                const next = [...(formData.ctaButtons || [])];
                                next[idx].type = e.target.value as any;
                                setFormData(prev => ({ ...prev, ctaButtons: next }));
                              }}
                              className="h-7 text-xs border border-slate-200 rounded bg-white px-2"
                            >
                              <option value="URL">Visit Website</option>
                              <option value="PHONE_NUMBER">Call Phone</option>
                            </select>
                          </div>

                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                            <Input
                              value={btn.text}
                              onChange={(e) => {
                                const next = [...(formData.ctaButtons || [])];
                                next[idx].text = e.target.value.substring(0, 25);
                                setFormData(prev => ({ ...prev, ctaButtons: next }));
                              }}
                              placeholder="Button Text e.g. Join Portal"
                              className="h-8 text-xs bg-white"
                              maxLength={25}
                            />
                            {btn.type === "URL" ? (
                              <Input
                                value={btn.url || ""}
                                onChange={(e) => {
                                  const next = [...(formData.ctaButtons || [])];
                                  next[idx].url = e.target.value;
                                  setFormData(prev => ({ ...prev, ctaButtons: next }));
                                }}
                                placeholder="https://domain.com/{{1}}"
                                className="h-8 text-xs bg-white font-mono"
                              />
                            ) : (
                              <Input
                                value={btn.phoneNumber || ""}
                                onChange={(e) => {
                                  const next = [...(formData.ctaButtons || [])];
                                  next[idx].phoneNumber = e.target.value;
                                  setFormData(prev => ({ ...prev, ctaButtons: next }));
                                }}
                                placeholder="+919145414083"
                                className="h-8 text-xs bg-white font-mono"
                              />
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {formData.buttonMode === "QUICK_REPLY" && (
                    <div className="space-y-2 pt-2">
                      {(formData.quickReplyButtons || []).map((btn, idx) => (
                        <div key={idx} className="flex items-center gap-2">
                          <Input
                            value={btn}
                            onChange={(e) => {
                              const next = [...(formData.quickReplyButtons || [])];
                              next[idx] = e.target.value.substring(0, 25);
                              setFormData(prev => ({ ...prev, quickReplyButtons: next }));
                            }}
                            placeholder={`Quick reply pill ${idx + 1}`}
                            className="h-8 text-xs bg-white"
                            maxLength={25}
                          />
                          {(formData.quickReplyButtons || []).length > 1 && (
                            <button
                              type="button"
                              onClick={() => {
                                const next = (formData.quickReplyButtons || []).filter((_, i) => i !== idx);
                                setFormData(prev => ({ ...prev, quickReplyButtons: next }));
                              }}
                              className="p-1 text-slate-400 hover:text-rose-600"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      ))}

                      {(formData.quickReplyButtons || []).length < 3 && (
                        <Button
                          size="sm"
                          type="button"
                          variant="outline"
                          onClick={() => {
                            const next = [...(formData.quickReplyButtons || []), "Talk to Agent"];
                            setFormData(prev => ({ ...prev, quickReplyButtons: next }));
                          }}
                          className="text-xs h-7 border-slate-200"
                        >
                          <Plus className="w-3 h-3 mr-1" /> Add Response Pill
                        </Button>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* RIGHT PANE (40% width -> 5 cols) Real-time Interactive WhatsApp Phone Simulator */}
            <div className="lg:col-span-5 sticky top-6">
              <div className="w-full max-w-[340px] mx-auto bg-slate-900 rounded-[44px] p-3.5 shadow-2xl border-[4px] border-slate-800">
                {/* Dynamic Top Island / Notch & Phone Header */}
                <div className="w-28 h-4 bg-slate-800 rounded-full mx-auto mb-2 flex items-center justify-center">
                  <div className="w-3 h-3 rounded-full bg-slate-950/80" />
                </div>

                {/* Smartphone Display Screen */}
                <div className="bg-[#efeae2] rounded-[32px] overflow-hidden flex flex-col min-h-[580px] shadow-inner relative">
                  {/* WhatsApp App Top Header */}
                  <div className="bg-[#075e54] text-white p-3 flex items-center justify-between shadow-sm">
                    <div className="flex items-center gap-2.5">
                      <span className="text-white text-xs">←</span>
                      <div className="w-8 h-8 rounded-full bg-emerald-400/30 flex items-center justify-center font-bold text-xs border border-white/20">
                        🧘
                      </div>
                      <div>
                        <p className="text-xs font-bold leading-tight flex items-center gap-1">
                          Snehyoga Studio
                          <span className="text-[10px] text-emerald-300 font-bold">✓</span>
                        </p>
                        <p className="text-[10px] text-emerald-200 leading-tight">Business Account</p>
                      </div>
                    </div>
                    <div className="text-[10px] text-emerald-200 font-mono">10:42 AM</div>
                  </div>

                  {/* WhatsApp Chat Wallpaper Background Canvas */}
                  <div className="flex-1 p-3 flex flex-col justify-end space-y-2 bg-[radial-gradient(#075e54_1px,transparent_1px)] [background-size:16px_16px] bg-opacity-5">
                    {/* Date Pill */}
                    <div className="self-center bg-white/80 backdrop-blur-sm px-3 py-1 rounded-full text-[9px] font-bold text-slate-500 shadow-sm uppercase tracking-wider">
                      Today
                    </div>

                    {/* Message Bubble Layout */}
                    <div className="max-w-[95%] bg-white rounded-2xl rounded-tl-none p-3 shadow-md border border-black/5 self-start space-y-2 relative">
                      {/* Header Preview */}
                      {formData.headerType === "TEXT" && formData.headerText && (
                        <p className="text-xs font-bold text-slate-900 leading-tight border-b border-slate-100 pb-1.5">
                          {formData.headerText}
                        </p>
                      )}

                      {formData.headerType !== "NONE" && formData.headerType !== "TEXT" && (
                        <div className="rounded-xl overflow-hidden bg-slate-100 max-h-40 border border-slate-100">
                          {formData.headerType === "IMAGE" ? (
                            <img
                              src={formData.headerMediaUrl || "https://images.unsplash.com/photo-1544367567-0f2fcb009e0b?auto=format&fit=crop&w=600&q=80"}
                              alt="Header Media"
                              className="w-full h-full object-cover"
                              onError={(e) => { (e.target as HTMLElement).style.display = "none"; }}
                            />
                          ) : formData.headerType === "VIDEO" ? (
                            <div className="p-8 text-center bg-slate-900 text-white flex flex-col items-center justify-center">
                              <Video className="w-8 h-8 text-emerald-400 mb-1" />
                              <span className="text-[10px]">Video Header Preview</span>
                            </div>
                          ) : (
                            <div className="p-4 bg-slate-50 text-slate-700 flex items-center gap-2">
                              <FileText className="w-6 h-6 text-indigo-600" />
                              <span className="text-xs font-medium">Document Attachment</span>
                            </div>
                          )}
                        </div>
                      )}

                      {/* Body Preview (Replaces all {{1}}, {{2}} with sample variables in real time!) */}
                      <div className="text-xs text-slate-800 leading-relaxed font-sans">
                        {renderLivePreviewBody(formData.bodyText, formData.sampleVariables)}
                      </div>

                      {/* Footer Preview */}
                      {formData.footerText && (
                        <p className="text-[10px] text-slate-400 border-t border-slate-100 pt-1 mt-1 font-medium">
                          {formData.footerText}
                        </p>
                      )}

                      {/* Timestamp & Double Blue Read Receipts */}
                      <div className="flex items-center justify-end gap-1 text-[9px] text-slate-400 font-mono">
                        <span>10:42 AM</span>
                        <span className="text-blue-500 font-bold">✓✓</span>
                      </div>
                    </div>

                    {/* Interactive Buttons Container */}
                    {formData.buttonMode === "CTA" && (formData.ctaButtons || []).length > 0 && (
                      <div className="space-y-1 max-w-[95%]">
                        {(formData.ctaButtons || []).map((btn, idx) => (
                          <div
                            key={idx}
                            className="bg-white rounded-xl py-2 px-3 text-center text-xs font-bold text-indigo-600 border border-slate-200 shadow-sm flex items-center justify-center gap-1.5 cursor-pointer hover:bg-slate-50"
                          >
                            {btn.type === "URL" ? <ExternalLink className="w-3.5 h-3.5 text-indigo-600" /> : <Phone className="w-3.5 h-3.5 text-emerald-600" />}
                            {btn.text || "CTA Button"}
                          </div>
                        ))}
                      </div>
                    )}

                    {formData.buttonMode === "QUICK_REPLY" && (formData.quickReplyButtons || []).length > 0 && (
                      <div className="space-y-1 max-w-[95%]">
                        {(formData.quickReplyButtons || []).map((btn, idx) => (
                          <div
                            key={idx}
                            className="bg-white rounded-xl py-2 px-3 text-center text-xs font-bold text-emerald-700 border border-slate-200 shadow-sm cursor-pointer hover:bg-emerald-50"
                          >
                            {btn || "Quick Reply"}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TEST MESSAGE MODAL */}
      {isTestModalOpen && testModalTemplate && (
        <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 space-y-5"
          >
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <div>
                <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <Send className="w-4 h-4 text-emerald-600" /> Send Test WhatsApp Message
                </h3>
                <p className="text-xs text-slate-500">Dispatch live test template to verified WhatsApp number.</p>
              </div>
              <button onClick={() => setIsTestModalOpen(false)} className="text-slate-400 hover:text-slate-600">✕</button>
            </div>

            {/* Template Info Card */}
            <div className="bg-slate-50 p-3 rounded-2xl border border-slate-200 space-y-1 text-xs">
              <div className="flex items-center justify-between">
                <span className="font-mono font-bold text-slate-900">{testModalTemplate.name}</span>
                <Badge className="bg-emerald-100 text-emerald-800 text-[10px]">{testModalTemplate.status}</Badge>
              </div>
              <p className="text-slate-600 text-[11px] line-clamp-2">{testModalTemplate.bodyText}</p>
            </div>

            {/* Phone Number Input */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700">Recipient Phone Number</label>
              <div className="flex gap-2">
                <select
                  value={testPhoneCountry}
                  onChange={(e) => setTestPhoneCountry(e.target.value)}
                  className="h-10 px-3 rounded-xl border border-slate-200 text-xs font-semibold text-slate-800 bg-white"
                >
                  <option value="+91">🇮🇳 +91 (India)</option>
                  <option value="+1">🇺🇸 +1 (US)</option>
                  <option value="+44">🇬🇧 +44 (UK)</option>
                  <option value="+971">🇦🇪 +971 (UAE)</option>
                </select>
                <Input
                  value={testPhoneNumber}
                  onChange={(e) => setTestPhoneNumber(e.target.value)}
                  placeholder="10-digit mobile number"
                  className="h-10 text-xs font-mono border-slate-200 flex-1"
                />
              </div>
            </div>

            {/* Dynamic Template Variable Inputs */}
            {Object.keys(testVariables).length > 0 && (
              <div className="space-y-2 pt-2 border-t border-slate-100">
                <label className="text-xs font-bold text-slate-700">Dynamic Variable Values for Test</label>
                <div className="grid grid-cols-1 gap-2 max-h-40 overflow-y-auto pr-1">
                  {Object.keys(testVariables).map((key) => (
                    <div key={key} className="flex items-center gap-2">
                      <span className="text-xs font-mono font-bold text-slate-500 w-12">{`{{${key}}}`}:</span>
                      <Input
                        value={testVariables[key]}
                        onChange={(e) => setTestVariables({ ...testVariables, [key]: e.target.value })}
                        placeholder={`Value for {{${key}}}`}
                        className="h-8 text-xs bg-white"
                      />
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Modal Actions */}
            <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
              <Button variant="outline" onClick={() => setIsTestModalOpen(false)} className="text-xs font-semibold h-10 px-4">
                Cancel
              </Button>
              <Button
                onClick={handleSendTestMessage}
                disabled={isSendingTest}
                className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs h-10 px-6 shadow-md"
              >
                {isSendingTest ? "Sending Test..." : "Send Test WhatsApp Message"}
              </Button>
            </div>
          </motion.div>
        </div>
      )}

      {/* META API PAYLOAD VIEWER MODAL */}
      {isPayloadModalOpen && payloadModalTemplate && (
        <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-slate-900 text-white rounded-3xl max-w-2xl w-full p-6 shadow-2xl border border-slate-800 space-y-4"
          >
            <div className="flex items-center justify-between border-b border-slate-800 pb-4">
              <div>
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <Code2 className="w-4 h-4 text-emerald-400" /> Meta Graph API Payload Viewer
                </h3>
                <p className="text-xs text-slate-400">JSON specification formatted for Meta Cloud API endpoints.</p>
              </div>
              <button onClick={() => setIsPayloadModalOpen(false)} className="text-slate-400 hover:text-white">✕</button>
            </div>

            {/* Code block display */}
            <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800 max-h-96 overflow-y-auto font-mono text-xs text-emerald-300">
              <pre>{generateMetaPayloadJson(payloadModalTemplate)}</pre>
            </div>

            <div className="flex items-center justify-between pt-2 border-t border-slate-800">
              <span className="text-[11px] text-slate-400">Endpoint: POST /v20.0/{config.wabaId || "1564657775051850"}/message_templates</span>
              <div className="flex gap-2">
                <Button
                  onClick={() => {
                    navigator.clipboard.writeText(generateMetaPayloadJson(payloadModalTemplate));
                    setCopiedPayload(true);
                    toast({ title: "Copied JSON Payload! 📋", description: "Meta API format copied to clipboard." });
                    setTimeout(() => setCopiedPayload(false), 2000);
                  }}
                  className="bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-bold text-xs h-9 px-4"
                >
                  {copiedPayload ? <Check className="w-3.5 h-3.5 mr-1" /> : <Copy className="w-3.5 h-3.5 mr-1" />}
                  {copiedPayload ? "Copied!" : "Copy JSON"}
                </Button>
              </div>
            </div>
          </motion.div>
        </div>
      )}

      {/* TEMPLATE PREVIEW & ANALYTICS MODAL */}
      <TemplatePreviewAnalyticsModal
        template={analyticsModalTemplate}
        config={config}
        isOpen={!!analyticsModalTemplate}
        onClose={() => setAnalyticsModalTemplate(null)}
        onEditTemplate={(tpl) => {
          setAnalyticsModalTemplate(null);
          handleOpenEdit(tpl);
        }}
        onDuplicateTemplate={(tpl) => {
          handleDuplicate(tpl);
        }}
        onSendTestMessage={(tpl) => {
          setAnalyticsModalTemplate(null);
          handleOpenTestModal(tpl);
        }}
      />
    </div>
  );
};

export default WhatsAppTemplateManager;
