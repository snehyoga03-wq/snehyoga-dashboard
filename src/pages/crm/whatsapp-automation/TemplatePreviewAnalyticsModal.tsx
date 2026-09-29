import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import {
  Eye, BarChart3, Send, Copy, Check, Edit3, X,
  ExternalLink, Phone, Image as ImageIcon, FileText, Video,
  RefreshCw, Code2, Layers, ShieldCheck, Info, MessageSquare,
  ChevronRight, ArrowUpRight
} from "lucide-react";
import { WhatsAppManagedTemplate } from "./WhatsAppTemplateManager";
import {
  WhatsAppConfig,
  fetchMetaTemplateAnalytics,
  TemplateAnalyticsMetrics
} from "@/services/whatsappAutomationService";

interface TemplatePreviewAnalyticsModalProps {
  template: WhatsAppManagedTemplate | null;
  config: WhatsAppConfig;
  isOpen: boolean;
  onClose: () => void;
  onEditTemplate: (template: WhatsAppManagedTemplate) => void;
  onDuplicateTemplate: (template: WhatsAppManagedTemplate) => void;
  onSendTestMessage: (template: WhatsAppManagedTemplate) => void;
}

export const TemplatePreviewAnalyticsModal: React.FC<TemplatePreviewAnalyticsModalProps> = ({
  template,
  config,
  isOpen,
  onClose,
  onEditTemplate,
  onDuplicateTemplate,
  onSendTestMessage
}) => {
  const { toast } = useToast();
  // Active Tab: "preview" = Template Preview, "analytics" = Meta Analytics & Insights
  const [activeTab, setActiveTab] = useState<"preview" | "analytics">("analytics");

  // Date Range Controls
  const [dateRangePreset, setDateRangePreset] = useState<"Today" | "7D" | "14D" | "30D" | "90D">("7D");
  const [startDateStr, setStartDateStr] = useState<string>(() => {
    const d = new Date(); d.setDate(d.getDate() - 7);
    return d.toISOString().split("T")[0];
  });
  const [endDateStr, setEndDateStr] = useState<string>(() => new Date().toISOString().split("T")[0]);

  // Live Analytics Data State
  const [isFetchingAnalytics, setIsFetchingAnalytics] = useState<boolean>(false);
  const [analyticsData, setAnalyticsData] = useState<TemplateAnalyticsMetrics>({
    amountSpent: 0,
    costPerDelivered: 0.06,
    messagesSent: 0,
    messagesDelivered: 0,
    deliveryRate: 0,
    messagesRead: 0,
    readRate: 0,
    uniqueReplies: 0,
    buttonClicks: 0,
    dailyTrend: [],
    buttonBreakdown: []
  });

  const [copiedJson, setCopiedJson] = useState(false);

  // Fetch Live Analytics whenever template, date range, or modal state changes
  const loadLiveAnalytics = async () => {
    if (!template) return;
    setIsFetchingAnalytics(true);
    const res = await fetchMetaTemplateAnalytics(config, template.name, startDateStr, endDateStr);
    setIsFetchingAnalytics(false);
    if (res.success && res.data) {
      setAnalyticsData(res.data);
    }
  };

  useEffect(() => {
    if (isOpen && template) {
      loadLiveAnalytics();
    }
  }, [isOpen, template, startDateStr, endDateStr]);

  // Handle Date Range Presets
  const handlePresetSelect = (preset: "Today" | "7D" | "14D" | "30D" | "90D") => {
    setDateRangePreset(preset);
    const end = new Date();
    const start = new Date();

    if (preset === "Today") start.setDate(end.getDate());
    else if (preset === "7D") start.setDate(end.getDate() - 7);
    else if (preset === "14D") start.setDate(end.getDate() - 14);
    else if (preset === "30D") start.setDate(end.getDate() - 30);
    else if (preset === "90D") start.setDate(end.getDate() - 90);

    setStartDateStr(start.toISOString().split("T")[0]);
    setEndDateStr(end.toISOString().split("T")[0]);
  };

  // Keyboard shortcut listener (ESC to close)
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen || !template) return null;

  const mockMetaId = "2323786955034394";

  // Helper to format live preview body text
  const renderLivePreviewBody = (body: string, vars: string[]) => {
    let text = body;
    vars.forEach((v, idx) => {
      const tag = `{{${idx + 1}}}`;
      text = text.replace(new RegExp(tag.replace(/[{()}]/g, "\\$&"), "g"), v || tag);
    });

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

  // Generate formatted Meta JSON Payload
  const generateMetaPayloadJson = () => {
    const components: any[] = [];
    if (template.headerType === "TEXT" && template.headerText) {
      components.push({ type: "HEADER", format: "TEXT", text: template.headerText });
    } else if (template.headerType !== "NONE") {
      components.push({
        type: "HEADER",
        format: template.headerType,
        example: template.headerMediaUrl ? { header_handle: [template.headerMediaUrl] } : undefined
      });
    }

    const varMatches = template.bodyText.match(/\{\{\d+\}\}/g) || [];
    components.push({
      type: "BODY",
      text: template.bodyText,
      example: varMatches.length > 0 ? { body_text: [template.sampleVariables] } : undefined
    });

    if (template.footerText) {
      components.push({ type: "FOOTER", text: template.footerText });
    }

    if (template.buttonMode === "CTA" && template.ctaButtons) {
      components.push({
        type: "BUTTONS",
        buttons: template.ctaButtons.map((b) => ({
          type: b.type,
          text: b.text,
          url: b.url,
          phone_number: b.phoneNumber
        }))
      });
    } else if (template.buttonMode === "QUICK_REPLY" && template.quickReplyButtons) {
      components.push({
        type: "BUTTONS",
        buttons: template.quickReplyButtons.map((text) => ({ type: "QUICK_REPLY", text }))
      });
    }

    return JSON.stringify(
      {
        endpoint: `POST /v20.0/${config.wabaId || "1564657775051850"}/message_templates`,
        headers: {
          Authorization: `Bearer ${config.apiToken || "EAAX2HQ7..."}`,
          "Content-Type": "application/json"
        },
        payload: {
          name: template.name,
          category: template.category,
          language: template.language,
          components
        }
      },
      null,
      2
    );
  };

  // Smooth Bezier Curve Generator for Chart
  const trendData = analyticsData.dailyTrend || [];
  const maxVal = 1000;
  const chartHeight = 180;
  const chartWidth = 720;
  const paddingX = 40;
  const stepX = (chartWidth - paddingX * 2) / Math.max(1, trendData.length - 1);

  const getPoints = (key: "sent" | "delivered" | "read" | "replied" | "clicks") => {
    return trendData.map((d, idx) => {
      const x = paddingX + idx * stepX;
      const y = chartHeight - (d[key] / maxVal) * chartHeight;
      return { x, y };
    });
  };

  const createBezierPath = (points: Array<{ x: number; y: number }>) => {
    if (points.length === 0) return "";
    let d = `M ${points[0].x},${points[0].y}`;
    for (let i = 0; i < points.length - 1; i++) {
      const p0 = points[i];
      const p1 = points[i + 1];
      const cx = (p0.x + p1.x) / 2;
      d += ` C ${cx},${p0.y} ${cx},${p1.y} ${p1.x},${p1.y}`;
    }
    return d;
  };

  const createAreaPath = (points: Array<{ x: number; y: number }>) => {
    if (points.length === 0) return "";
    const linePath = createBezierPath(points);
    const lastX = points[points.length - 1].x;
    const firstX = points[0].x;
    return `${linePath} L ${lastX},${chartHeight} L ${firstX},${chartHeight} Z`;
  };

  return (
    <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-md z-50 flex items-center justify-center p-3 sm:p-6 overflow-y-auto">
      <motion.div
        initial={{ opacity: 0, scale: 0.97, y: 15 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.97, y: 15 }}
        className="bg-[#f8fafc] border border-slate-200 rounded-3xl max-w-6xl w-full shadow-2xl overflow-hidden text-slate-900 flex flex-col max-h-[94vh]"
      >
        {/* MODAL HEADER TOP BAR */}
        <div className="p-5 bg-white border-b border-slate-200 flex items-center justify-between shrink-0">
          <h2 className="text-base font-bold text-slate-700 flex items-center gap-2">
            Template: <span className="font-mono font-extrabold text-slate-900">{template.name}</span>
          </h2>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-800 hover:bg-slate-100 transition-colors"
            title="Close modal (Esc)"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* TOP SEGMENTED PILL TAB SELECTOR */}
        <div className="p-4 bg-[#f1f5f9] border-b border-slate-200 shrink-0">
          <div className="max-w-xl mx-auto bg-slate-200/80 p-1.5 rounded-2xl flex items-center gap-1.5 shadow-inner">
            <button
              onClick={() => setActiveTab("preview")}
              className={`flex-1 py-2.5 px-4 rounded-xl text-xs sm:text-sm font-bold flex items-center justify-center gap-2 transition-all ${
                activeTab === "preview"
                  ? "bg-white text-slate-800 shadow-sm"
                  : "text-slate-500 hover:text-slate-900"
              }`}
            >
              <Eye className="w-4 h-4 text-indigo-600" />
              <span>Template Preview</span>
            </button>

            <button
              onClick={() => setActiveTab("analytics")}
              className={`flex-1 py-2.5 px-4 rounded-xl text-xs sm:text-sm font-bold flex items-center justify-center gap-2 transition-all ${
                activeTab === "analytics"
                  ? "bg-white text-indigo-700 shadow-sm"
                  : "text-slate-500 hover:text-slate-900"
              }`}
            >
              <BarChart3 className="w-4 h-4 text-indigo-600" />
              <span>Meta Analytics & Insights</span>
            </button>
          </div>
        </div>

        {/* MAIN TAB CONTENT CANVAS */}
        <div className="p-6 overflow-y-auto flex-1 space-y-6">
          {activeTab === "analytics" ? (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-5">
              {/* 1. HEADER META INFORMATION & FILTERS CARD */}
              <div className="bg-white rounded-2xl p-5 border border-slate-200/90 shadow-sm space-y-4">
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                  {/* Left Metadata */}
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2.5">
                      <h3 className="text-lg sm:text-xl font-mono font-extrabold text-slate-900">
                        {template.name}
                      </h3>
                      <span className="border border-slate-200 text-slate-600 font-mono text-xs px-2.5 py-0.5 rounded-md font-semibold">
                        {template.language || "en_US"}
                      </span>
                      <span className="bg-[#10b981] text-white font-extrabold text-xs px-3 py-0.5 rounded-full uppercase tracking-wider">
                        APPROVED
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 font-medium">
                      Category: <strong className="text-slate-800 font-semibold">{template.category}</strong> • Template ID: <span className="font-mono text-slate-700">{mockMetaId}</span>
                    </p>
                  </div>

                  {/* Right Filters & Controls */}
                  <div className="flex flex-wrap items-center gap-3">
                    {/* Preset Pills */}
                    <div className="bg-slate-100 p-1 rounded-xl flex items-center gap-1 border border-slate-200/70">
                      {(["Today", "7D", "14D", "30D", "90D"] as const).map((p) => (
                        <button
                          key={p}
                          type="button"
                          onClick={() => handlePresetSelect(p)}
                          className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                            dateRangePreset === p
                              ? "bg-white text-indigo-700 border border-slate-200 shadow-sm"
                              : "text-slate-500 hover:text-slate-900"
                          }`}
                        >
                          {p}
                        </button>
                      ))}
                    </div>

                    {/* Date Inputs */}
                    <div className="flex items-center gap-1.5 bg-white border border-slate-200 rounded-xl px-2.5 py-1 text-xs">
                      <Input
                        type="date"
                        value={startDateStr}
                        onChange={(e) => setStartDateStr(e.target.value)}
                        className="h-7 border-none text-xs text-slate-700 p-0 w-28 focus-visible:ring-0"
                      />
                      <span className="text-slate-400 font-medium">to</span>
                      <Input
                        type="date"
                        value={endDateStr}
                        onChange={(e) => setEndDateStr(e.target.value)}
                        className="h-7 border-none text-xs text-slate-700 p-0 w-28 focus-visible:ring-0"
                      />
                    </div>

                    {/* Refresh Button */}
                    <Button
                      onClick={loadLiveAnalytics}
                      disabled={isFetchingAnalytics}
                      variant="outline"
                      className="h-9 w-9 p-0 rounded-xl border-slate-200 text-slate-600 hover:bg-slate-50"
                      title="Refresh Meta Analytics"
                    >
                      <RefreshCw className={`w-4 h-4 ${isFetchingAnalytics ? "animate-spin text-indigo-600" : ""}`} />
                    </Button>
                  </div>
                </div>
              </div>

              {/* 2. LIVE META ANALYTICS ALERT BANNER */}
              <div className="bg-[#fffbeb] border border-[#fef3c7] text-[#b45309] rounded-2xl p-4 flex items-center gap-3 text-xs font-medium shadow-sm">
                <Info className="w-4 h-4 text-[#b45309] shrink-0" />
                <span>
                  <strong>Live Meta Analytics:</strong> Insights show total engagement and performance fetched directly from Meta Graph Cloud API for the selected date range.
                </span>
              </div>

              {/* 3. ROW OF 6 KPI SCORECARDS */}
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3.5">
                {/* Scorecard 1: Amount spent */}
                <div className="bg-white p-4 rounded-2xl border border-slate-200/90 shadow-sm space-y-1">
                  <div className="flex items-center justify-between text-slate-500 text-xs">
                    <span className="font-semibold">Amount spent</span>
                    <span className="text-emerald-600 font-bold">$</span>
                  </div>
                  <strong className="text-xl sm:text-2xl font-extrabold text-slate-900 block">
                    ₹{analyticsData.amountSpent.toFixed(2)}
                  </strong>
                </div>

                {/* Scorecard 2: Cost per delivered */}
                <div className="bg-white p-4 rounded-2xl border border-slate-200/90 shadow-sm space-y-1">
                  <div className="flex items-center justify-between text-slate-500 text-xs">
                    <span className="font-semibold flex items-center gap-1">
                      Cost per delivered <Info className="w-3 h-3 text-sky-500" />
                    </span>
                  </div>
                  <strong className="text-xl sm:text-2xl font-extrabold text-slate-900 block">
                    ₹{analyticsData.costPerDelivered.toFixed(2)}
                  </strong>
                </div>

                {/* Scorecard 3: Messages sent */}
                <div className="bg-white p-4 rounded-2xl border border-slate-200/90 shadow-sm space-y-1">
                  <div className="flex items-center justify-between text-slate-500 text-xs">
                    <span className="font-semibold">Messages sent</span>
                    <Send className="w-3.5 h-3.5 text-rose-500" />
                  </div>
                  <strong className="text-xl sm:text-2xl font-extrabold text-slate-900 block">
                    {analyticsData.messagesSent.toLocaleString()}
                  </strong>
                </div>

                {/* Scorecard 4: Messages delivered */}
                <div className="bg-white p-4 rounded-2xl border border-slate-200/90 shadow-sm space-y-1">
                  <div className="flex items-center justify-between text-slate-500 text-xs">
                    <span className="font-semibold">Messages delivered</span>
                    <span className="text-purple-500 font-bold">✓✓</span>
                  </div>
                  <div className="flex items-baseline gap-2">
                    <strong className="text-xl sm:text-2xl font-extrabold text-slate-900 block">
                      {analyticsData.messagesDelivered.toLocaleString()}
                    </strong>
                    <span className="text-[10px] font-bold text-emerald-600">
                      ↑ {analyticsData.deliveryRate}%
                    </span>
                  </div>
                </div>

                {/* Scorecard 5: Messages read */}
                <div className="bg-white p-4 rounded-2xl border border-slate-200/90 shadow-sm space-y-1">
                  <div className="flex items-center justify-between text-slate-500 text-xs">
                    <span className="font-semibold">Messages read</span>
                    <Eye className="w-3.5 h-3.5 text-emerald-500" />
                  </div>
                  <div className="flex items-baseline gap-2">
                    <strong className="text-xl sm:text-2xl font-extrabold text-slate-900 block">
                      {analyticsData.messagesRead.toLocaleString()}
                    </strong>
                    <span className="text-[10px] font-bold text-emerald-600">
                      ({analyticsData.readRate}%)
                    </span>
                  </div>
                </div>

                {/* Scorecard 6: Unique replies */}
                <div className="bg-white p-4 rounded-2xl border border-slate-200/90 shadow-sm space-y-1">
                  <div className="flex items-center justify-between text-slate-500 text-xs">
                    <span className="font-semibold">Unique replies</span>
                    <MessageSquare className="w-3.5 h-3.5 text-indigo-500" />
                  </div>
                  <strong className="text-xl sm:text-2xl font-extrabold text-slate-900 block">
                    {analyticsData.uniqueReplies}
                  </strong>
                </div>
              </div>

              {/* 4. PERFORMANCE OVER TIME CHART CARD */}
              <div className="bg-white rounded-2xl p-6 border border-slate-200/90 shadow-sm space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
                  <div>
                    <h4 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                      <BarChart3 className="w-4 h-4 text-indigo-600" /> Performance Over Time
                    </h4>
                    <p className="text-xs text-slate-500">Daily breakdown of template messages delivered, read, and engaged.</p>
                  </div>

                  {/* Legend Items */}
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="bg-rose-50 text-rose-600 border border-rose-200 px-2.5 py-0.5 rounded-full text-xs font-bold flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-rose-500" /> Sent
                    </span>
                    <span className="bg-purple-50 text-purple-600 border border-purple-200 px-2.5 py-0.5 rounded-full text-xs font-bold flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-purple-500" /> Delivered
                    </span>
                    <span className="bg-emerald-50 text-emerald-600 border border-emerald-200 px-2.5 py-0.5 rounded-full text-xs font-bold flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-emerald-500" /> Read
                    </span>
                    <span className="bg-indigo-50 text-indigo-600 border border-indigo-200 px-2.5 py-0.5 rounded-full text-xs font-bold flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-indigo-500" /> Replied
                    </span>
                    <span className="bg-sky-50 text-sky-600 border border-sky-200 px-2.5 py-0.5 rounded-full text-xs font-bold flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-sky-500" /> Clicks
                    </span>
                  </div>
                </div>

                {/* SMOOTH BEZIER AREA CHART SVG */}
                <div className="relative pt-2">
                  <svg viewBox={`0 0 ${chartWidth} ${chartHeight + 30}`} className="w-full h-64 overflow-visible">
                    <defs>
                      <linearGradient id="gradSent" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#f43f5e" stopOpacity="0.25" />
                        <stop offset="100%" stopColor="#f43f5e" stopOpacity="0.0" />
                      </linearGradient>
                      <linearGradient id="gradDelivered" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#a855f7" stopOpacity="0.25" />
                        <stop offset="100%" stopColor="#a855f7" stopOpacity="0.0" />
                      </linearGradient>
                      <linearGradient id="gradRead" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#10b981" stopOpacity="0.25" />
                        <stop offset="100%" stopColor="#10b981" stopOpacity="0.0" />
                      </linearGradient>
                      <linearGradient id="gradClicks" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#0284c7" stopOpacity="0.25" />
                        <stop offset="100%" stopColor="#0284c7" stopOpacity="0.0" />
                      </linearGradient>
                    </defs>

                    {/* Y-AXIS HORIZONTAL DASHED LINES & LABELS */}
                    {[1000, 750, 500, 250, 0].map((val) => {
                      const y = chartHeight - (val / maxVal) * chartHeight;
                      return (
                        <g key={val}>
                          <line x1="30" y1={y} x2={chartWidth} y2={y} stroke="#f1f5f9" strokeDasharray="4 4" strokeWidth="1" />
                          <text x="22" y={y + 4} textAnchor="end" fill="#94a3b8" fontSize="10" fontFamily="sans-serif">
                            {val}
                          </text>
                        </g>
                      );
                    })}

                    {/* AREA FILLS */}
                    <path d={createAreaPath(getPoints("sent"))} fill="url(#gradSent)" />
                    <path d={createAreaPath(getPoints("delivered"))} fill="url(#gradDelivered)" />
                    <path d={createAreaPath(getPoints("read"))} fill="url(#gradRead)" />
                    <path d={createAreaPath(getPoints("clicks"))} fill="url(#gradClicks)" />

                    {/* LINES */}
                    <path d={createBezierPath(getPoints("sent"))} fill="none" stroke="#f43f5e" strokeWidth="2.5" />
                    <path d={createBezierPath(getPoints("delivered"))} fill="none" stroke="#a855f7" strokeWidth="2.5" />
                    <path d={createBezierPath(getPoints("read"))} fill="none" stroke="#10b981" strokeWidth="2.5" />
                    <path d={createBezierPath(getPoints("replied"))} fill="none" stroke="#6366f1" strokeWidth="2" />
                    <path d={createBezierPath(getPoints("clicks"))} fill="none" stroke="#0284c7" strokeWidth="2.5" />

                    {/* X-AXIS LABELS */}
                    {trendData.map((d, idx) => {
                      const x = paddingX + idx * stepX;
                      return (
                        <text key={idx} x={x} y={chartHeight + 20} textAnchor="middle" fill="#64748b" fontSize="10" fontFamily="sans-serif">
                          {d.dateStr}
                        </text>
                      );
                    })}
                  </svg>
                </div>
              </div>

              {/* 5. BUTTON CLICKS BREAKDOWN CARD */}
              <div className="bg-white rounded-2xl p-6 border border-slate-200/90 shadow-sm space-y-4">
                <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                  <h4 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                    <span className="text-base">💥</span> Button Clicks Breakdown
                  </h4>
                  <span className="text-xs text-slate-500 font-medium">
                    {(template.ctaButtons?.length || 0) + (template.quickReplyButtons?.length || 0) || 3} button(s) configured
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {analyticsData.buttonBreakdown.map((btn, idx) => (
                    <div key={idx} className="p-4 bg-slate-50 rounded-xl border border-slate-200/80 space-y-2">
                      <div className="flex items-center justify-between text-xs">
                        <strong className="font-bold text-slate-800 truncate">{btn.text}</strong>
                        <span className="text-[10px] font-mono text-slate-500 uppercase">{btn.type}</span>
                      </div>
                      <div className="flex items-baseline justify-between">
                        <span className="text-lg font-bold text-indigo-700">{btn.clicks.toLocaleString()} clicks</span>
                        <span className="text-xs font-bold text-emerald-600">{btn.ctr}% CTR</span>
                      </div>
                      <div className="h-1.5 bg-slate-200 rounded-full overflow-hidden">
                        <div className="h-full bg-indigo-600 rounded-full" style={{ width: `${btn.ctr}%` }} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </motion.div>
          ) : (
            /* TEMPLATE PREVIEW TAB */
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
              {/* Left Column: Phone Frame Preview */}
              <div className="lg:col-span-5">
                <div className="w-full max-w-[340px] mx-auto bg-slate-900 rounded-[44px] p-3.5 shadow-2xl border-[4px] border-slate-800">
                  <div className="w-28 h-4 bg-slate-800 rounded-full mx-auto mb-2 flex items-center justify-center">
                    <div className="w-3 h-3 rounded-full bg-slate-950" />
                  </div>

                  <div className="bg-[#efeae2] rounded-[32px] overflow-hidden flex flex-col min-h-[560px] shadow-inner relative text-slate-900">
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

                    <div className="flex-1 p-3 flex flex-col justify-end space-y-2 bg-[radial-gradient(#075e54_1px,transparent_1px)] [background-size:16px_16px] bg-opacity-5">
                      <div className="self-center bg-white/80 backdrop-blur-sm px-3 py-1 rounded-full text-[9px] font-bold text-slate-500 shadow-sm uppercase tracking-wider">
                        Today
                      </div>

                      <div className="max-w-[95%] bg-white rounded-2xl rounded-tl-none p-3 shadow-md border border-black/5 self-start space-y-2 relative">
                        {template.headerType === "TEXT" && template.headerText && (
                          <p className="text-xs font-bold text-slate-900 leading-tight border-b border-slate-100 pb-1.5">
                            {template.headerText}
                          </p>
                        )}

                        {template.headerType !== "NONE" && template.headerType !== "TEXT" && (
                          <div className="rounded-xl overflow-hidden bg-slate-100 max-h-40 border border-slate-100">
                            {template.headerType === "IMAGE" ? (
                              <img
                                src={template.headerMediaUrl || "https://images.unsplash.com/photo-1544367567-0f2fcb009e0b?auto=format&fit=crop&w=600&q=80"}
                                alt="Header Media"
                                className="w-full h-full object-cover"
                              />
                            ) : template.headerType === "VIDEO" ? (
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

                        <div className="text-xs text-slate-800 leading-relaxed font-sans">
                          {renderLivePreviewBody(template.bodyText, template.sampleVariables)}
                        </div>

                        {template.footerText && (
                          <p className="text-[10px] text-slate-400 border-t border-slate-100 pt-1 mt-1 font-medium">
                            {template.footerText}
                          </p>
                        )}

                        <div className="flex items-center justify-end gap-1 text-[9px] text-slate-400 font-mono">
                          <span>10:42 AM</span>
                          <span className="text-blue-500 font-bold">✓✓</span>
                        </div>
                      </div>

                      {template.buttonMode === "CTA" && (template.ctaButtons || []).length > 0 && (
                        <div className="space-y-1 max-w-[95%]">
                          {(template.ctaButtons || []).map((btn, idx) => (
                            <div
                              key={idx}
                              className="bg-white rounded-xl py-2 px-3 text-center text-xs font-bold text-indigo-600 border border-slate-200 shadow-sm flex items-center justify-center gap-1.5"
                            >
                              {btn.type === "URL" ? <ExternalLink className="w-3.5 h-3.5 text-indigo-600" /> : <Phone className="w-3.5 h-3.5 text-emerald-600" />}
                              {btn.text || "CTA Button"}
                            </div>
                          ))}
                        </div>
                      )}

                      {template.buttonMode === "QUICK_REPLY" && (template.quickReplyButtons || []).length > 0 && (
                        <div className="space-y-1 max-w-[95%]">
                          {(template.quickReplyButtons || []).map((btn, idx) => (
                            <div
                              key={idx}
                              className="bg-white rounded-xl py-2 px-3 text-center text-xs font-bold text-emerald-700 border border-slate-200 shadow-sm"
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

              {/* Right Column: Parameters & Raw Payload */}
              <div className="lg:col-span-7 space-y-6">
                <div className="bg-white p-5 rounded-2xl border border-slate-200/90 shadow-sm space-y-4">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-2">
                    <ShieldCheck className="w-4 h-4 text-emerald-600" /> Meta Template Specifications
                  </h4>

                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    <div className="bg-slate-50 p-3 rounded-xl border border-slate-200">
                      <span className="text-[10px] text-slate-500 block font-medium">Meta Template ID</span>
                      <strong className="font-mono text-xs text-slate-900 block mt-0.5">{mockMetaId}</strong>
                    </div>

                    <div className="bg-slate-50 p-3 rounded-xl border border-slate-200">
                      <span className="text-[10px] text-slate-500 block font-medium">Quality Rating</span>
                      <strong className="text-xs text-emerald-600 block mt-0.5">High ⭐⭐⭐⭐⭐</strong>
                    </div>

                    <div className="bg-slate-50 p-3 rounded-xl border border-slate-200">
                      <span className="text-[10px] text-slate-500 block font-medium">Language Code</span>
                      <strong className="font-mono text-xs text-slate-900 block mt-0.5">{template.language}</strong>
                    </div>
                  </div>
                </div>

                <div className="bg-white p-5 rounded-2xl border border-slate-200/90 shadow-sm space-y-3">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center justify-between">
                    <span className="flex items-center gap-2">
                      <Layers className="w-4 h-4 text-indigo-600" /> Variable Parameter Map
                    </span>
                    <span className="text-[10px] font-mono text-indigo-600 font-bold">
                      {template.sampleVariables.length} Dynamic Placeholders
                    </span>
                  </h4>

                  <div className="overflow-x-auto rounded-xl border border-slate-200">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead>
                        <tr className="bg-slate-50 text-[10px] uppercase font-bold text-slate-500 border-b border-slate-200">
                          <th className="py-2.5 px-3">Placeholder</th>
                          <th className="py-2.5 px-3">Param Type</th>
                          <th className="py-2.5 px-3">Test Sample Value</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {template.sampleVariables.map((sample, idx) => (
                          <tr key={idx} className="hover:bg-slate-50">
                            <td className="py-2.5 px-3 font-mono font-bold text-indigo-600">{`{{${idx + 1}}}`}</td>
                            <td className="py-2.5 px-3 text-slate-500">
                              <span className="px-2 py-0.5 rounded bg-slate-100 text-[10px] font-mono border border-slate-200 font-semibold">text</span>
                            </td>
                            <td className="py-2.5 px-3 font-sans text-slate-800">{sample}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                <div className="bg-slate-900 text-white p-5 rounded-2xl border border-slate-800 space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-2">
                      <Code2 className="w-4 h-4 text-emerald-400" /> Meta API JSON Payload
                    </h4>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        navigator.clipboard.writeText(generateMetaPayloadJson());
                        setCopiedJson(true);
                        toast({ title: "Copied JSON Payload! 📋" });
                        setTimeout(() => setCopiedJson(false), 2000);
                      }}
                      className="h-7 text-xs text-emerald-400 hover:bg-slate-800"
                    >
                      {copiedJson ? <Check className="w-3.5 h-3.5 mr-1" /> : <Copy className="w-3.5 h-3.5 mr-1" />}
                      {copiedJson ? "Copied" : "Copy JSON"}
                    </Button>
                  </div>

                  <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 font-mono text-[11px] text-emerald-300 max-h-48 overflow-y-auto">
                    <pre>{generateMetaPayloadJson()}</pre>
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </div>
      </motion.div>
    </div>
  );
};

export default TemplatePreviewAnalyticsModal;
