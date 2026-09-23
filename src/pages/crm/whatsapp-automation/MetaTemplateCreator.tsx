import React, { useState, useRef } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import {
  FileCode, Plus, Sparkles, Send, CheckCircle2, AlertCircle,
  ExternalLink, Phone, Image as ImageIcon, Video, FileText,
  Trash2, Copy, Eye, HelpCircle, Check, ArrowRight, RefreshCw, Smartphone
} from "lucide-react";
import {
  WhatsAppConfig,
  MetaTemplate,
  createMetaTemplate,
  CreateTemplatePayload
} from "@/services/whatsappAutomationService";

interface MetaTemplateCreatorProps {
  config: WhatsAppConfig;
  onTemplateCreated?: () => void;
}

const LANGUAGES = [
  { code: "en", label: "English" },
  { code: "en_US", label: "English (US)" },
  { code: "en_GB", label: "English (UK)" },
  { code: "hi", label: "Hindi (हिंदी)" },
  { code: "mr", label: "Marathi (मराठी)" },
  { code: "gu", label: "Gujarati (ગુજરાતી)" },
  { code: "ta", label: "Tamil (தமிழ்)" },
  { code: "te", label: "Telugu (తెలుగు)" }
];

const PRESET_SAMPLES = [
  {
    name: "daily_class_reminder",
    category: "UTILITY" as const,
    headerType: "IMAGE" as const,
    headerMediaUrl: "https://images.unsplash.com/photo-1544367567-0f2fcb009e0b?auto=format&fit=crop&w=1000&q=80",
    body: "Namaste {{1}} 🙏\n\nYour Snehyoga session starts in 15 minutes at {{2}}.\n\nKeep your yoga mat ready and join via your personalized student link below. See you on the mat!",
    sampleVars: ["Rahul", "6:00 AM"],
    footer: "Snehyoga Studio • Mon to Fri",
    buttons: [
      { type: "URL" as const, text: "Join Live Class", url: "https://yoga.snehyoga.com/live" },
      { type: "PHONE_NUMBER" as const, text: "Call Support", phoneNumber: "+919145414083" }
    ]
  },
  {
    name: "membership_renewal_offer",
    category: "MARKETING" as const,
    headerType: "TEXT" as const,
    headerText: "Special 20% Renewal Privilege",
    body: "Hello {{1}}! Your Snehyoga 365 pass is completing in {{2}} days.\n\nRenew today to lock in your daily morning yoga batch timing and unlock our brand new Faceyoga Mastery course for free! 🧘",
    sampleVars: ["Priya", "7"],
    footer: "Reply STOP to unsubscribe",
    buttons: [
      { type: "URL" as const, text: "Renew Plan Now", url: "https://yoga.snehyoga.com/renew" },
      { type: "QUICK_REPLY" as const, text: "I Have a Question" }
    ]
  },
  {
    name: "complimentary_demo_pass",
    category: "MARKETING" as const,
    headerType: "IMAGE" as const,
    headerMediaUrl: "https://images.unsplash.com/photo-1506126613408-eca07ce68773?auto=format&fit=crop&w=1000&q=80",
    body: "Welcome to Snehyoga, {{1}}! 🌿\n\nYour complimentary pass for our Mind & Spine Yoga therapy demo is confirmed for {{2}}.\n\nTap below to confirm your attendance slot.",
    sampleVars: ["Amit", "Tomorrow 11:00 AM"],
    footer: "Snehyoga Wellness Team",
    buttons: [
      { type: "QUICK_REPLY" as const, text: "Confirm My Seat" },
      { type: "QUICK_REPLY" as const, text: "Reschedule Batch" }
    ]
  }
];

export const MetaTemplateCreator: React.FC<MetaTemplateCreatorProps> = ({ config, onTemplateCreated }) => {
  const { toast } = useToast();
  const bodyTextareaRef = useRef<HTMLTextAreaElement>(null);

  // Form State
  const [templateName, setTemplateName] = useState("snehyoga_class_reminder_01");
  const [category, setCategory] = useState<"MARKETING" | "UTILITY" | "AUTHENTICATION">("UTILITY");
  const [language, setLanguage] = useState("en_US");

  // Header State
  const [headerType, setHeaderType] = useState<"NONE" | "TEXT" | "IMAGE" | "VIDEO" | "DOCUMENT">("IMAGE");
  const [headerText, setHeaderText] = useState("");
  const [headerMediaUrl, setHeaderMediaUrl] = useState("https://images.unsplash.com/photo-1544367567-0f2fcb009e0b?auto=format&fit=crop&w=1000&q=80");

  // Body State
  const [bodyText, setBodyText] = useState(
    "Namaste {{1}} 🙏\n\nYour Snehyoga session starts in 15 minutes at {{2}}.\n\nKeep your yoga mat ready and join via your personalized student link below. See you on the mat!"
  );
  const [sampleVariables, setSampleVariables] = useState<string[]>(["Rahul", "6:00 AM"]);

  // Footer State
  const [footerText, setFooterText] = useState("Snehyoga Studio • Mon to Fri");

  // Buttons State
  const [buttonMode, setButtonMode] = useState<"NONE" | "CTA" | "QUICK_REPLY">("CTA");
  const [ctaButtons, setCtaButtons] = useState<Array<{ type: "URL" | "PHONE_NUMBER"; text: string; url?: string; phoneNumber?: string }>>([
    { type: "URL", text: "Join Live Class", url: "https://yoga.snehyoga.com/live" },
    { type: "PHONE_NUMBER", text: "Call Support", phoneNumber: "+919145414083" }
  ]);
  const [quickReplyButtons, setQuickReplyButtons] = useState<string[]>(["I Will Attend", "Reschedule"]);

  // Loading & Submission State
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submissionResult, setSubmissionResult] = useState<{ success: boolean; id?: string; error?: string } | null>(null);

  // Auto-slugify template name
  const handleNameChange = (val: string) => {
    const slugified = val.toLowerCase().replace(/[^a-z0-9_]/g, "_");
    setTemplateName(slugified);
  };

  // Detect and synchronize sample variables whenever bodyText changes
  const updateVariablesCount = (newBodyText: string) => {
    const matches = newBodyText.match(/\{\{\d+\}\}/g) || [];
    const count = matches.length;
    setSampleVariables((prev) => {
      const next = [...prev];
      while (next.length < count) next.push(`Sample_${next.length + 1}`);
      return next.slice(0, count);
    });
  };

  // Insert Variable at cursor position
  const handleInsertVariable = () => {
    const matches = bodyText.match(/\{\{\d+\}\}/g) || [];
    const nextVarNum = matches.length + 1;
    const tag = `{{${nextVarNum}}}`;

    if (bodyTextareaRef.current) {
      const start = bodyTextareaRef.current.selectionStart;
      const end = bodyTextareaRef.current.selectionEnd;
      const updated = bodyText.substring(0, start) + tag + bodyText.substring(end);
      setBodyText(updated);
      updateVariablesCount(updated);
      setTimeout(() => {
        bodyTextareaRef.current?.focus();
        bodyTextareaRef.current?.setSelectionRange(start + tag.length, start + tag.length);
      }, 50);
    } else {
      const updated = `${bodyText} ${tag}`;
      setBodyText(updated);
      updateVariablesCount(updated);
    }
  };

  // Insert Markdown formatting around selected text
  const handleFormatText = (prefix: string, suffix: string) => {
    if (!bodyTextareaRef.current) return;
    const start = bodyTextareaRef.current.selectionStart;
    const end = bodyTextareaRef.current.selectionEnd;
    const selected = bodyText.substring(start, end) || "text";
    const updated = bodyText.substring(0, start) + prefix + selected + suffix + bodyText.substring(end);
    setBodyText(updated);
  };

  // Load Preset
  const handleLoadPreset = (preset: typeof PRESET_SAMPLES[0]) => {
    setTemplateName(preset.name);
    setCategory(preset.category);
    setHeaderType(preset.headerType);
    setHeaderText((preset as any).headerText || "");
    setHeaderMediaUrl(preset.headerMediaUrl || "");
    setBodyText(preset.body);
    setSampleVariables(preset.sampleVars);
    setFooterText(preset.footer);

    if (preset.buttons[0]?.type === "QUICK_REPLY") {
      setButtonMode("QUICK_REPLY");
      setQuickReplyButtons(preset.buttons.map(b => b.text));
    } else {
      setButtonMode("CTA");
      setCtaButtons(preset.buttons as any);
    }
    toast({ title: "Template Preset Applied 📋", description: `Loaded "${preset.name}" layout.` });
  };

  // Parse Body for Live Smartphone Preview
  const renderPreviewBody = () => {
    let text = bodyText;
    sampleVariables.forEach((sample, i) => {
      text = text.replace(new RegExp(`\\{\\{${i + 1}\\}\\}`, "g"), sample || `[Variable ${i + 1}]`);
    });
    return text;
  };

  // Submit to Meta Graph API
  const handleSubmitToMeta = async () => {
    if (!config.apiToken || !config.wabaId) {
      toast({
        title: "Missing Meta Credentials",
        description: "Please configure your WABA Account ID and API Token in Tab 1 before submitting.",
        variant: "destructive"
      });
      return;
    }

    if (!templateName.trim()) {
      toast({ title: "Template Name Required", description: "Please enter a valid template name.", variant: "destructive" });
      return;
    }

    if (!bodyText.trim()) {
      toast({ title: "Body Required", description: "Template message body cannot be empty.", variant: "destructive" });
      return;
    }

    // Assemble buttons
    let finalButtons: any[] = [];
    if (buttonMode === "CTA") {
      finalButtons = ctaButtons.filter(b => b.text.trim());
    } else if (buttonMode === "QUICK_REPLY") {
      finalButtons = quickReplyButtons.filter(t => t.trim()).map(text => ({ type: "QUICK_REPLY", text }));
    }

    const payload: CreateTemplatePayload = {
      name: templateName,
      category,
      language,
      headerType,
      headerText: headerType === "TEXT" ? headerText : undefined,
      headerMediaUrl: headerType !== "NONE" && headerType !== "TEXT" ? headerMediaUrl : undefined,
      bodyText,
      sampleBodyVariables: sampleVariables,
      footerText: footerText.trim() || undefined,
      buttons: finalButtons.length > 0 ? finalButtons : undefined
    };

    setIsSubmitting(true);
    setSubmissionResult(null);

    const res = await createMetaTemplate(config, payload);
    setIsSubmitting(false);

    if (res.success) {
      setSubmissionResult({ success: true, id: res.data?.id });
      toast({
        title: "Template Created on Meta! 🚀",
        description: `Template "${templateName}" was created successfully and submitted to Meta for review.`
      });
      if (onTemplateCreated) onTemplateCreated();
    } else {
      setSubmissionResult({ success: false, error: res.error });
      toast({
        title: "Meta Submission Rejected",
        description: res.error || "Meta rejected the template format.",
        variant: "destructive"
      });
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Banner with Presets */}
      <div className="bg-gradient-to-r from-emerald-950 via-slate-900 to-indigo-950 rounded-2xl p-6 text-white border border-slate-800 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-400">
              AiSensy-Style Template Builder
            </span>
          </div>
          <h2 className="text-xl font-bold text-white mt-1">Create Meta WhatsApp Template</h2>
          <p className="text-xs text-slate-300 mt-0.5">
            Design compliant message templates with headers, variables, CTA buttons, and sync directly to Meta WABA.
          </p>
        </div>

        {/* Quick Load Presets */}
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs text-slate-400 font-medium">Quick Presets:</span>
          {PRESET_SAMPLES.map((p, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => handleLoadPreset(p)}
              className="text-xs font-semibold bg-white/10 hover:bg-emerald-500/20 text-white hover:text-emerald-300 border border-white/10 hover:border-emerald-500/30 px-3 py-1.5 rounded-lg transition-all"
            >
              {p.category === "UTILITY" ? "⏰ " : "🏷️ "}
              {p.name.replace(/_/g, " ")}
            </button>
          ))}
        </div>
      </div>

      {/* Split-Screen Main Builder */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column: Form Builder Controls (7 cols) */}
        <div className="lg:col-span-7 space-y-5">
          {/* Card 1: Basic Information */}
          <Card className="border border-slate-200/80 shadow-sm bg-white">
            <CardHeader className="p-4 bg-slate-50 border-b border-slate-100">
              <CardTitle className="text-sm font-bold text-slate-800 flex items-center gap-2">
                <span className="w-5 h-5 rounded-full bg-indigo-600 text-white flex items-center justify-center text-xs">1</span>
                Template Basic Information
              </CardTitle>
            </CardHeader>
            <CardContent className="p-5 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold uppercase tracking-wider text-slate-700">Template Name</label>
                  <Input
                    value={templateName}
                    onChange={(e) => handleNameChange(e.target.value)}
                    placeholder="e.g. daily_class_reminder"
                    className="font-mono text-xs border-slate-200"
                  />
                  <p className="text-[10px] text-slate-500">Lowercase letters, numbers, and underscores only</p>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold uppercase tracking-wider text-slate-700">Language</label>
                  <select
                    value={language}
                    onChange={(e) => setLanguage(e.target.value)}
                    className="w-full h-10 px-3 rounded-lg border border-slate-200 text-xs font-medium text-slate-800 bg-white"
                  >
                    {LANGUAGES.map((l) => (
                      <option key={l.code} value={l.code}>{l.label} ({l.code})</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Category Selector Tabs */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold uppercase tracking-wider text-slate-700">Template Category</label>
                <div className="grid grid-cols-3 gap-2.5">
                  {[
                    { id: "UTILITY", label: "Utility", icon: "⚙️", desc: "Reminders & class updates" },
                    { id: "MARKETING", label: "Marketing", icon: "🏷️", desc: "Promotions, offers & demo" },
                    { id: "AUTHENTICATION", label: "Authentication", icon: "🔐", desc: "OTP & verification" }
                  ].map((cat) => (
                    <div
                      key={cat.id}
                      onClick={() => setCategory(cat.id as any)}
                      className={`cursor-pointer p-3 rounded-xl border transition-all text-center ${
                        category === cat.id
                          ? "border-indigo-600 bg-indigo-50/50 shadow-sm"
                          : "border-slate-200 hover:border-slate-300 bg-white"
                      }`}
                    >
                      <span className="text-lg">{cat.icon}</span>
                      <p className="text-xs font-bold text-slate-900 mt-1">{cat.label}</p>
                      <p className="text-[10px] text-slate-500 leading-tight mt-0.5">{cat.desc}</p>
                    </div>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Card 2: Header (Optional) */}
          <Card className="border border-slate-200/80 shadow-sm bg-white">
            <CardHeader className="p-4 bg-slate-50 border-b border-slate-100">
              <CardTitle className="text-sm font-bold text-slate-800 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="w-5 h-5 rounded-full bg-indigo-600 text-white flex items-center justify-center text-xs">2</span>
                  Header (Optional)
                </div>
                <span className="text-xs font-normal text-slate-500">Visual attention at message top</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-5 space-y-4">
              <div className="flex gap-2 flex-wrap">
                {[
                  { id: "NONE", label: "None" },
                  { id: "TEXT", label: "Text Header" },
                  { id: "IMAGE", label: "Image Media" },
                  { id: "VIDEO", label: "Video Media" },
                  { id: "DOCUMENT", label: "Document" }
                ].map((type) => (
                  <button
                    key={type.id}
                    type="button"
                    onClick={() => setHeaderType(type.id as any)}
                    className={`text-xs font-semibold px-3 py-1.5 rounded-lg border transition-all ${
                      headerType === type.id
                        ? "bg-indigo-600 text-white border-indigo-600 shadow-sm"
                        : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50"
                    }`}
                  >
                    {type.label}
                  </button>
                ))}
              </div>

              {headerType === "TEXT" && (
                <div className="space-y-1">
                  <Input
                    value={headerText}
                    onChange={(e) => setHeaderText(e.target.value.substring(0, 60))}
                    placeholder="e.g. Snehyoga Morning Batch"
                    className="text-xs"
                    maxLength={60}
                  />
                  <div className="text-right text-[10px] text-slate-400">{headerText.length}/60</div>
                </div>
              )}

              {headerType !== "NONE" && headerType !== "TEXT" && (
                <div className="space-y-1">
                  <label className="text-[11px] font-semibold text-slate-600">Sample Media URL ({headerType})</label>
                  <Input
                    value={headerMediaUrl}
                    onChange={(e) => setHeaderMediaUrl(e.target.value)}
                    placeholder="https://images.unsplash.com/... or your CDN link"
                    className="text-xs font-mono"
                  />
                  <p className="text-[10px] text-slate-400">Meta requires a sample media URL to review media templates.</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Card 3: Message Body (Mandatory) */}
          <Card className="border border-slate-200/80 shadow-sm bg-white">
            <CardHeader className="p-4 bg-slate-50 border-b border-slate-100">
              <CardTitle className="text-sm font-bold text-slate-800 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="w-5 h-5 rounded-full bg-indigo-600 text-white flex items-center justify-center text-xs">3</span>
                  Message Body (Required)
                </div>
                <span className="text-xs font-bold text-indigo-600 font-mono">
                  {sampleVariables.length} Variables Detected
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-5 space-y-4">
              {/* Rich Formatting Toolbar */}
              <div className="flex items-center justify-between bg-slate-50 p-2 rounded-lg border border-slate-200">
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => handleFormatText("*", "*")}
                    className="p-1.5 hover:bg-slate-200 rounded text-slate-700 font-bold text-xs w-7 h-7 flex items-center justify-center"
                    title="Bold (*text*)"
                  >
                    B
                  </button>
                  <button
                    type="button"
                    onClick={() => handleFormatText("_", "_")}
                    className="p-1.5 hover:bg-slate-200 rounded text-slate-700 italic text-xs w-7 h-7 flex items-center justify-center font-serif"
                    title="Italic (_text_)"
                  >
                    I
                  </button>
                  <button
                    type="button"
                    onClick={() => handleFormatText("~", "~")}
                    className="p-1.5 hover:bg-slate-200 rounded text-slate-700 line-through text-xs w-7 h-7 flex items-center justify-center"
                    title="Strikethrough (~text~)"
                  >
                    S
                  </button>
                  <button
                    type="button"
                    onClick={() => handleFormatText("```", "```")}
                    className="p-1.5 hover:bg-slate-200 rounded text-slate-700 font-mono text-xs w-7 h-7 flex items-center justify-center"
                    title="Monospace (```text```)"
                  >
                    M
                  </button>
                </div>

                {/* + Add Variable Button */}
                <Button
                  size="sm"
                  type="button"
                  variant="outline"
                  onClick={handleInsertVariable}
                  className="h-7 text-xs font-bold border-indigo-200 text-indigo-700 hover:bg-indigo-50"
                >
                  <Plus className="w-3.5 h-3.5 mr-1 text-indigo-600" /> Add Variable ({`{{${sampleVariables.length + 1}}}`})
                </Button>
              </div>

              {/* Textarea */}
              <textarea
                ref={bodyTextareaRef}
                value={bodyText}
                onChange={(e) => {
                  const val = e.target.value.substring(0, 1024);
                  setBodyText(val);
                  updateVariablesCount(val);
                }}
                rows={5}
                className="w-full p-3 rounded-xl border border-slate-200 text-xs font-sans text-slate-800 leading-relaxed focus:outline-none focus:ring-2 focus:ring-indigo-500"
                placeholder="Enter your message text. Use {{1}}, {{2}} for dynamic tags."
              />
              <div className="flex justify-between items-center text-[10px] text-slate-400">
                <span>Avoid consecutive variables like {`{{1}}{{2}}`} per Meta guidelines</span>
                <span>{bodyText.length}/1024 characters</span>
              </div>

              {/* Sample Variables Table (Required by Meta for Review) */}
              {sampleVariables.length > 0 && (
                <div className="p-3.5 bg-indigo-50/50 rounded-xl border border-indigo-100 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-indigo-950 flex items-center gap-1.5">
                      <HelpCircle className="w-3.5 h-3.5 text-indigo-600" />
                      Sample Values for Review (Meta Requirement)
                    </span>
                    <span className="text-[10px] text-indigo-600 font-medium">Auto-populated for preview</span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {sampleVariables.map((val, idx) => (
                      <div key={idx} className="flex items-center gap-2">
                        <span className="text-xs font-mono font-bold text-slate-600 w-12">{`{{${idx + 1}}}`}:</span>
                        <Input
                          value={val}
                          onChange={(e) => {
                            const updated = [...sampleVariables];
                            updated[idx] = e.target.value;
                            setSampleVariables(updated);
                          }}
                          placeholder={`Sample ${idx + 1}`}
                          className="h-8 text-xs bg-white border-indigo-200 font-sans"
                        />
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Card 4: Footer (Optional) */}
          <Card className="border border-slate-200/80 shadow-sm bg-white">
            <CardHeader className="p-4 bg-slate-50 border-b border-slate-100">
              <CardTitle className="text-sm font-bold text-slate-800 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="w-5 h-5 rounded-full bg-indigo-600 text-white flex items-center justify-center text-xs">4</span>
                  Footer (Optional)
                </div>
                <span className="text-xs font-normal text-slate-500">Muted disclaimer / brand line</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-5">
              <Input
                value={footerText}
                onChange={(e) => setFooterText(e.target.value.substring(0, 60))}
                placeholder="e.g. Reply STOP to unsubscribe"
                className="text-xs"
                maxLength={60}
              />
              <div className="text-right text-[10px] text-slate-400 mt-1">{footerText.length}/60</div>
            </CardContent>
          </Card>

          {/* Card 5: Interactive Buttons */}
          <Card className="border border-slate-200/80 shadow-sm bg-white">
            <CardHeader className="p-4 bg-slate-50 border-b border-slate-100">
              <CardTitle className="text-sm font-bold text-slate-800 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="w-5 h-5 rounded-full bg-indigo-600 text-white flex items-center justify-center text-xs">5</span>
                  Interactive Buttons
                </div>
                <span className="text-xs font-normal text-slate-500">Drive user clicks & replies</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-5 space-y-4">
              <div className="flex gap-2">
                {[
                  { id: "NONE", label: "No Buttons" },
                  { id: "CTA", label: "Call To Action (Website & Call)" },
                  { id: "QUICK_REPLY", label: "Quick Replies (Max 3)" }
                ].map((b) => (
                  <button
                    key={b.id}
                    type="button"
                    onClick={() => setButtonMode(b.id as any)}
                    className={`text-xs font-semibold px-3 py-1.5 rounded-lg border transition-all ${
                      buttonMode === b.id
                        ? "bg-indigo-600 text-white border-indigo-600 shadow-sm"
                        : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50"
                    }`}
                  >
                    {b.label}
                  </button>
                ))}
              </div>

              {buttonMode === "CTA" && (
                <div className="space-y-3 pt-2">
                  {ctaButtons.map((btn, idx) => (
                    <div key={idx} className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                          {btn.type === "URL" ? <ExternalLink className="w-3.5 h-3.5 text-blue-600" /> : <Phone className="w-3.5 h-3.5 text-emerald-600" />}
                          {btn.type === "URL" ? "Visit Website Link" : "Phone Call Action"}
                        </span>
                        <select
                          value={btn.type}
                          onChange={(e) => {
                            const updated = [...ctaButtons];
                            updated[idx].type = e.target.value as any;
                            setCtaButtons(updated);
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
                            const updated = [...ctaButtons];
                            updated[idx].text = e.target.value.substring(0, 25);
                            setCtaButtons(updated);
                          }}
                          placeholder="Button Text (max 25)"
                          className="h-8 text-xs bg-white"
                          maxLength={25}
                        />
                        {btn.type === "URL" ? (
                          <Input
                            value={btn.url || ""}
                            onChange={(e) => {
                              const updated = [...ctaButtons];
                              updated[idx].url = e.target.value;
                              setCtaButtons(updated);
                            }}
                            placeholder="https://yoga.snehyoga.com"
                            className="h-8 text-xs bg-white font-mono"
                          />
                        ) : (
                          <Input
                            value={btn.phoneNumber || ""}
                            onChange={(e) => {
                              const updated = [...ctaButtons];
                              updated[idx].phoneNumber = e.target.value;
                              setCtaButtons(updated);
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

              {buttonMode === "QUICK_REPLY" && (
                <div className="space-y-2 pt-2">
                  {quickReplyButtons.map((btn, idx) => (
                    <div key={idx} className="flex items-center gap-2">
                      <Input
                        value={btn}
                        onChange={(e) => {
                          const updated = [...quickReplyButtons];
                          updated[idx] = e.target.value.substring(0, 25);
                          setQuickReplyButtons(updated);
                        }}
                        placeholder={`Button ${idx + 1} text`}
                        className="h-8 text-xs"
                        maxLength={25}
                      />
                      {quickReplyButtons.length > 1 && (
                        <button
                          type="button"
                          onClick={() => setQuickReplyButtons(quickReplyButtons.filter((_, i) => i !== idx))}
                          className="p-1 text-slate-400 hover:text-rose-600"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  ))}

                  {quickReplyButtons.length < 3 && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setQuickReplyButtons([...quickReplyButtons, "Quick Reply"])}
                      className="text-xs h-7 border-slate-200"
                    >
                      <Plus className="w-3 h-3 mr-1" /> Add Quick Reply Button
                    </Button>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Submission Bar */}
          <div className="pt-2 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="text-xs text-slate-500">
              Target Meta WABA: <strong className="text-slate-800 font-mono">{config.wabaId || "1564657775051850"}</strong>
            </div>

            <Button
              size="lg"
              onClick={handleSubmitToMeta}
              disabled={isSubmitting}
              className="w-full sm:w-auto bg-gradient-to-r from-emerald-600 to-indigo-600 hover:from-emerald-700 hover:to-indigo-700 text-white font-bold text-sm shadow-md px-8 h-11"
            >
              {isSubmitting ? (
                <>
                  <RefreshCw className="w-4 h-4 mr-2 animate-spin" /> Submitting to Meta...
                </>
              ) : (
                <>
                  <Send className="w-4 h-4 mr-2" /> Submit Template to Meta
                </>
              )}
            </Button>
          </div>

          {/* Submission Result Notification */}
          {submissionResult && (
            <div className={`p-4 rounded-xl border text-xs flex items-start gap-3 ${
              submissionResult.success
                ? "bg-emerald-50 border-emerald-200 text-emerald-900"
                : "bg-rose-50 border-rose-200 text-rose-900"
            }`}>
              {submissionResult.success ? (
                <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
              ) : (
                <AlertCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
              )}
              <div>
                <p className="font-bold">
                  {submissionResult.success ? "Template Submitted to Meta ✅" : "Submission Failed ❌"}
                </p>
                <p className="mt-0.5">
                  {submissionResult.success
                    ? `Template ID: ${submissionResult.id || "Created"}. Meta review generally takes between 1 minute to 24 hours.`
                    : submissionResult.error}
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Right Column: AiSensy-Style Live Smartphone Preview (5 cols) */}
        <div className="lg:col-span-5 sticky top-6">
          <div className="w-full max-w-[340px] mx-auto bg-slate-900 rounded-[44px] p-3.5 shadow-2xl border-[4px] border-slate-800">
            {/* Notch */}
            <div className="w-28 h-4 bg-slate-800 rounded-full mx-auto mb-2" />

            {/* Smartphone Screen Container */}
            <div className="bg-[#efeae2] rounded-[32px] overflow-hidden flex flex-col min-h-[580px] shadow-inner relative">
              {/* WhatsApp App Header */}
              <div className="bg-[#075e54] text-white p-3 flex items-center gap-2.5 shadow-sm">
                <div className="w-8 h-8 rounded-full bg-emerald-400/30 flex items-center justify-center font-bold text-xs">
                  🧘
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-bold leading-tight truncate">Snehyoga Studio</p>
                  <p className="text-[10px] text-emerald-200 leading-tight">Official Account • online</p>
                </div>
                <div className="w-2 h-2 rounded-full bg-emerald-400" />
              </div>

              {/* Chat Canvas */}
              <div className="flex-1 p-3 flex flex-col justify-end space-y-2">
                {/* Bubble Container */}
                <div className="max-w-[95%] bg-white rounded-2xl rounded-tl-none p-3 shadow-md border border-black/5 self-start space-y-2">
                  {/* Header Preview */}
                  {headerType === "TEXT" && headerText && (
                    <p className="text-xs font-bold text-slate-900 leading-tight border-b border-slate-100 pb-1.5">
                      {headerText}
                    </p>
                  )}

                  {headerType !== "NONE" && headerType !== "TEXT" && (
                    <div className="rounded-xl overflow-hidden bg-slate-100 max-h-40 border border-slate-100">
                      {headerType === "IMAGE" ? (
                        <img
                          src={headerMediaUrl || "https://images.unsplash.com/photo-1544367567-0f2fcb009e0b?auto=format&fit=crop&w=600&q=80"}
                          alt="Header Media"
                          className="w-full h-full object-cover"
                          onError={(e) => {
                            (e.target as HTMLElement).style.display = "none";
                          }}
                        />
                      ) : headerType === "VIDEO" ? (
                        <div className="p-8 text-center text-slate-500 bg-slate-900 text-white flex flex-col items-center justify-center">
                          <Video className="w-8 h-8 text-emerald-400 mb-1" />
                          <span className="text-[10px]">Video Header Preview</span>
                        </div>
                      ) : (
                        <div className="p-4 text-center text-slate-700 bg-slate-50 flex items-center gap-2">
                          <FileText className="w-6 h-6 text-indigo-600" />
                          <span className="text-xs font-medium">Document Attachment</span>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Body Preview with Formatted Markdown */}
                  <p className="text-xs text-slate-800 whitespace-pre-wrap leading-relaxed font-sans">
                    {renderPreviewBody()}
                  </p>

                  {/* Footer Text */}
                  {footerText && (
                    <p className="text-[10px] text-slate-400 border-t border-slate-100 pt-1 leading-normal font-sans">
                      {footerText}
                    </p>
                  )}

                  {/* WhatsApp Timestamp & Blue Double Ticks */}
                  <div className="flex justify-end items-center gap-1 text-[10px] text-slate-400 pt-0.5">
                    <span>10:45 AM</span>
                    <span className="text-blue-500 font-bold">✓✓</span>
                  </div>
                </div>

                {/* Interactive Action Buttons Preview */}
                {buttonMode === "CTA" && ctaButtons.filter(b => b.text).length > 0 && (
                  <div className="space-y-1.5 pt-1">
                    {ctaButtons.filter(b => b.text).map((btn, idx) => (
                      <div
                        key={idx}
                        className="bg-white rounded-xl py-2 px-3 shadow-sm border border-slate-200/80 text-center text-xs font-bold text-blue-600 flex items-center justify-center gap-1.5"
                      >
                        {btn.type === "URL" ? (
                          <ExternalLink className="w-3.5 h-3.5 text-blue-500" />
                        ) : (
                          <Phone className="w-3.5 h-3.5 text-emerald-500" />
                        )}
                        <span>{btn.text}</span>
                      </div>
                    ))}
                  </div>
                )}

                {buttonMode === "QUICK_REPLY" && quickReplyButtons.filter(t => t.trim()).length > 0 && (
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {quickReplyButtons.filter(t => t.trim()).map((text, idx) => (
                      <div
                        key={idx}
                        className="flex-1 min-w-[120px] bg-white rounded-xl py-2 px-3 shadow-sm border border-slate-200/80 text-center text-xs font-bold text-slate-700"
                      >
                        {text}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Home Indicator */}
            <div className="w-24 h-1 bg-slate-700 rounded-full mx-auto mt-3" />
          </div>
        </div>
      </div>
    </div>
  );
};
