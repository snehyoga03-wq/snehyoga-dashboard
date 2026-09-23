import React, { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  MessageSquare, FileCode, Zap, Radio, ShieldCheck, Sparkles,
  BarChart3, RefreshCw, Send, CheckCircle2, AlertCircle, PlusCircle
} from "lucide-react";
import {
  WhatsAppConfig,
  MetaTemplate,
  BroadcastContact,
  BroadcastProgress,
  DEFAULT_CONFIG,
  loadWhatsAppConfig,
  fetchMetaTemplates,
  executeBroadcast
} from "@/services/whatsappAutomationService";
import { CredentialsCard } from "./CredentialsCard";
import { TemplateSettingsCard } from "./TemplateSettingsCard";
import { SpeedModeToggle } from "./SpeedModeToggle";
import { AudienceAndBroadcast } from "./AudienceAndBroadcast";
import { LiveBroadcastDashboard } from "./LiveBroadcastDashboard";
import { CampaignsAnalytics } from "./CampaignsAnalytics";
import { MetaTemplateCreator } from "./MetaTemplateCreator";

interface WhatsAppAutomationProps {
  users?: any[];
}

export const WhatsAppAutomation: React.FC<WhatsAppAutomationProps> = ({ users = [] }) => {
  // Primary Tab: "broadcast" = Core Config & Broadcast, "create_template" = Create Template in Meta (AiSensy style)
  const [activeTab, setActiveTab] = useState<"broadcast" | "create_template">("broadcast");

  // Configuration State
  const [config, setConfig] = useState<WhatsAppConfig>(DEFAULT_CONFIG);
  const [templates, setTemplates] = useState<MetaTemplate[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<MetaTemplate | null>(null);
  const [dynamicParams, setDynamicParams] = useState("name, batch_time, days_left");
  const [headerImageUrl, setHeaderImageUrl] = useState("");
  const [speedMode, setSpeedMode] = useState<"turbo" | "standard">("turbo");

  // Live Broadcast Execution State
  const [isBroadcasting, setIsBroadcasting] = useState(false);
  const [broadcastProgress, setBroadcastProgress] = useState<BroadcastProgress>({
    total: 0,
    processed: 0,
    delivered: 0,
    failed: 0,
    blocked: 0,
    isPaused: false,
    isStopped: false,
    percent: 0,
    logs: []
  });

  const stopRequestedRef = useRef(false);
  const pauseRequestedRef = useRef(false);

  // Initial Data Fetching
  const refreshAllData = async () => {
    const loadedConfig = await loadWhatsAppConfig();
    setConfig(loadedConfig);

    // Fetch templates if credentials exist
    if (loadedConfig.apiToken && loadedConfig.wabaId) {
      const tplRes = await fetchMetaTemplates(loadedConfig);
      if (tplRes.success && tplRes.templates.length > 0) {
        setTemplates(tplRes.templates);
        if (!selectedTemplate) {
          setSelectedTemplate(tplRes.templates[0]);
        }
      }
    }
  };

  useEffect(() => {
    refreshAllData();
  }, []);

  // Handle Starting a Broadcast
  const handleStartBroadcast = async (
    contacts: BroadcastContact[],
    nudgeFormat: "template" | "text" | "video" | "image" | "preset",
    directText: string,
    directMediaUrl: string
  ) => {
    stopRequestedRef.current = false;
    pauseRequestedRef.current = false;

    setBroadcastProgress({
      total: contacts.length,
      processed: 0,
      delivered: 0,
      failed: 0,
      blocked: 0,
      isPaused: false,
      isStopped: false,
      percent: 0,
      logs: []
    });

    setIsBroadcasting(true);

    try {
      await executeBroadcast({
        batchName: `${selectedTemplate?.name || nudgeFormat.toUpperCase()} Broadcast`,
        targetAudience: "CRM Filtered Selection",
        contacts,
        config,
        nudgeFormat,
        template: selectedTemplate || undefined,
        dynamicParamsTemplate: dynamicParams,
        directText,
        headerImageUrl,
        directMediaUrl,
        speedMode,
        onProgress: (p) => setBroadcastProgress(p),
        checkStop: () => stopRequestedRef.current,
        checkPause: () => pauseRequestedRef.current
      });
    } catch (err) {
      console.error("Broadcast run error:", err);
    }
  };

  return (
    <div className="space-y-6 pb-16">
      {/* Top Glassmorphic Navigation Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 rounded-3xl p-6 sm:p-8 text-white shadow-xl relative overflow-hidden border border-slate-800">
        <div className="absolute top-0 right-0 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl -mr-20 -mt-20 pointer-events-none" />
        <div className="absolute bottom-0 left-1/3 w-64 h-64 bg-emerald-500/10 rounded-full blur-2xl pointer-events-none" />

        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="flex items-center gap-2.5">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-xs font-bold tracking-widest uppercase text-emerald-400">
                Enterprise Meta Cloud Automation
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white">
              WhatsApp Config & Automation
            </h1>
            <p className="text-xs sm:text-sm text-slate-300 max-w-2xl leading-relaxed">
              Meta Graph API integration, Turbo broadcast engine, AiSensy-style Meta Template Creator with live preview, and CRM audience analytics.
            </p>
          </div>

          {/* Quick Metrics Bar */}
          <div className="flex items-center gap-3">
            <div className="bg-white/10 backdrop-blur-md rounded-2xl px-4 py-3 border border-white/10 text-center">
              <span className="text-[11px] text-slate-300 font-medium block">Total Students</span>
              <strong className="text-lg font-bold text-white">{users.length}</strong>
            </div>

            <div className="bg-white/10 backdrop-blur-md rounded-2xl px-4 py-3 border border-white/10 text-center">
              <span className="text-[11px] text-slate-300 font-medium block">Meta Templates</span>
              <span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-400">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                {templates.length} Synced
              </span>
            </div>

            <div className="bg-white/10 backdrop-blur-md rounded-2xl px-4 py-3 border border-white/10 text-center">
              <span className="text-[11px] text-slate-300 font-medium block">Speed Mode</span>
              <span className="text-xs font-bold text-amber-300">{speedMode === "turbo" ? "⚡ Turbo" : "🐢 1/sec"}</span>
            </div>
          </div>
        </div>

        {/* Primary Tabs Navigation Bar */}
        <div className="mt-8 flex gap-2 border-b border-white/10 pb-0">
          <button
            onClick={() => setActiveTab("broadcast")}
            className={`flex items-center gap-2 px-5 py-3 rounded-t-2xl text-xs sm:text-sm font-bold transition-all relative ${
              activeTab === "broadcast"
                ? "bg-white text-slate-900 shadow-lg"
                : "text-slate-300 hover:text-white hover:bg-white/5"
            }`}
          >
            <MessageSquare className="w-4 h-4 text-indigo-600" />
            <span>TAB 1: Core Config & Broadcast</span>
            {activeTab === "broadcast" && (
              <motion.div
                layoutId="activeTabIndicator"
                className="absolute -bottom-px left-0 right-0 h-1 bg-indigo-600 rounded-t-full"
              />
            )}
          </button>

          <button
            onClick={() => setActiveTab("create_template")}
            className={`flex items-center gap-2 px-5 py-3 rounded-t-2xl text-xs sm:text-sm font-bold transition-all relative ${
              activeTab === "create_template"
                ? "bg-white text-slate-900 shadow-lg"
                : "text-slate-300 hover:text-white hover:bg-white/5"
            }`}
          >
            <PlusCircle className="w-4 h-4 text-emerald-600" />
            <span>TAB 2: Create Template in Meta (AiSensy Style)</span>
            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 ml-1">
              New
            </span>
            {activeTab === "create_template" && (
              <motion.div
                layoutId="activeTabIndicator"
                className="absolute -bottom-px left-0 right-0 h-1 bg-emerald-600 rounded-t-full"
              />
            )}
          </button>
        </div>
      </div>

      {/* Main Tab Content */}
      <AnimatePresence mode="wait">
        {activeTab === "broadcast" ? (
          <motion.div
            key="tab-broadcast"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="space-y-6"
          >
            {/* 1. WhatsApp API Credentials Card */}
            <CredentialsCard
              config={config}
              onChange={setConfig}
              onRefreshTemplates={refreshAllData}
            />

            {/* 2. Template Settings Card */}
            <TemplateSettingsCard
              config={config}
              templates={templates}
              selectedTemplate={selectedTemplate}
              onSelectTemplate={setSelectedTemplate}
              onTemplatesFetched={setTemplates}
              dynamicParams={dynamicParams}
              onDynamicParamsChange={setDynamicParams}
              headerImageUrl={headerImageUrl}
              onHeaderImageUrlChange={setHeaderImageUrl}
            />

            {/* 3. Speed Mode Toggle */}
            <SpeedModeToggle
              speedMode={speedMode}
              onChange={setSpeedMode}
            />

            {/* 4. Target Audience & Broadcast Dispatcher */}
            <AudienceAndBroadcast
              crmUsers={users}
              config={config}
              selectedTemplate={selectedTemplate}
              dynamicParams={dynamicParams}
              headerImageUrl={headerImageUrl}
              onStartBroadcast={handleStartBroadcast}
            />

            {/* 5. Campaigns & Analytics */}
            <CampaignsAnalytics />
          </motion.div>
        ) : (
          <motion.div
            key="tab-create-template"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="space-y-6"
          >
            {/* AiSensy-style Meta Template Creator & Live Phone Simulator */}
            <MetaTemplateCreator
              config={config}
              onTemplateCreated={refreshAllData}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Live Broadcast Execution Terminal Overlay */}
      {isBroadcasting && (
        <LiveBroadcastDashboard
          progress={broadcastProgress}
          onPause={() => {
            pauseRequestedRef.current = true;
          }}
          onResume={() => {
            pauseRequestedRef.current = false;
          }}
          onStop={() => {
            stopRequestedRef.current = true;
          }}
          onClose={() => setIsBroadcasting(false)}
        />
      )}
    </div>
  );
};

export default WhatsAppAutomation;
