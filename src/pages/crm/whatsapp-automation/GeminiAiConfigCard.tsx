import React, { useState } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { Bot, Sparkles, Key, Send, ShieldCheck, RefreshCw, Terminal, Eye, EyeOff } from "lucide-react";
import {
  WhatsAppConfig,
  KnowledgeBaseItem,
  saveWhatsAppConfig,
  askGeminiAutoResponder,
  GeminiRouterResponse
} from "@/services/whatsappAutomationService";

interface GeminiAiConfigCardProps {
  config: WhatsAppConfig;
  knowledgeBase: KnowledgeBaseItem[];
  onChange: (updated: WhatsAppConfig) => void;
}

const PERSONA_PRESETS = [
  {
    title: "🧘 Virtual Yoga Counselor",
    prompt:
      "You are the official Snehyoga AI Counselor. Assist students warmly with batch timings (6 AM, 11 AM, 4 PM), subscription plans, yoga therapy guidelines, and joining links. Always be courteous, inspiring, and concise (under 80 words)."
  },
  {
    title: "💳 Membership & Plans Advisor",
    prompt:
      "You are Snehyoga's Membership Specialist. Explain Snehyoga 365, Mind & Spine (MSP), and Faceyoga plans with pricing benefits. Offer demo bookings when inquiries are from new students."
  },
  {
    title: "🥗 Yoga Nutrition & Pre-Class Guide",
    prompt:
      "You are Snehyoga's Yoga Diet Guide. Advise students on pre-class hydration (warm water/lemon water 20 min before), empty stomach guidelines, and post-yoga recovery snacks."
  }
];

export const GeminiAiConfigCard: React.FC<GeminiAiConfigCardProps> = ({ config, knowledgeBase, onChange }) => {
  const { toast } = useToast();
  const [showKey, setShowKey] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Live Simulator state
  const [testMessage, setTestMessage] = useState("What are today's class timings and how do I join?");
  const [testPhone, setTestPhone] = useState("919145414083");
  const [isSimulating, setIsSimulating] = useState(false);
  const [simulatorResponse, setSimulatorResponse] = useState<GeminiRouterResponse | null>(null);

  const handleSave = async () => {
    setIsSaving(true);
    const res = await saveWhatsAppConfig(config);
    setIsSaving(false);
    if (res.success) {
      toast({ title: "AI Config Saved ✅", description: "Google Gemini settings & prompt persona saved." });
    } else {
      toast({ title: "Save Error", description: res.message, variant: "destructive" });
    }
  };

  const handleRunSimulation = async () => {
    if (!testMessage.trim()) return;
    setIsSimulating(true);
    const res = await askGeminiAutoResponder(testMessage, config, knowledgeBase, testPhone);
    setIsSimulating(false);
    setSimulatorResponse(res);
  };

  return (
    <Card className="border border-slate-200/80 shadow-sm bg-white overflow-hidden">
      <CardHeader className="bg-gradient-to-r from-purple-950 via-slate-900 to-indigo-950 text-white p-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-purple-500/20 border border-purple-400/30 flex items-center justify-center text-purple-300">
              <Bot className="w-5 h-5" />
            </div>
            <div>
              <CardTitle className="text-lg font-bold text-white flex items-center gap-2">
                Google Gemini AI Auto-Responder
                <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-300 border border-purple-500/30">
                  gemini-flash-lite-latest
                </span>
              </CardTitle>
              <p className="text-xs text-slate-300 mt-0.5">
                AI student assistant answering incoming WhatsApp inquiries with dynamic Knowledge Base context
              </p>
            </div>
          </div>

          {/* Master AI Toggle */}
          <div className="flex items-center gap-3 bg-white/10 px-4 py-2 rounded-2xl border border-white/10 self-start sm:self-auto">
            <div className="text-right">
              <p className="text-xs font-bold text-white">Master Auto-Reply</p>
              <p className="text-[10px] text-slate-300">{config.aiEnabled ? "ACTIVE (Responding)" : "DISABLED (Muted)"}</p>
            </div>
            <Switch
              checked={config.aiEnabled}
              onCheckedChange={(val) => {
                onChange({ ...config, aiEnabled: val });
                toast({
                  title: val ? "AI Auto-Responder Enabled 🤖" : "AI Auto-Responder Muted ⏸️",
                  description: val ? "Incoming unhandled WhatsApp messages will now be answered by Gemini." : "AI responses paused."
                });
              }}
            />
          </div>
        </div>
      </CardHeader>

      <CardContent className="p-6 space-y-6">
        {/* Google AI Studio Key */}
        <div className="space-y-1.5">
          <div className="flex justify-between items-center">
            <label className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
              <Key className="w-3.5 h-3.5 text-purple-600" /> Google AI Studio API Key
            </label>
            <a
              href="https://aistudio.google.com/app/apikey"
              target="_blank"
              rel="noopener noreferrer"
              className="text-[11px] text-purple-600 hover:underline font-semibold"
            >
              Get free Gemini Key ↗
            </a>
          </div>
          <div className="relative">
            <Input
              type={showKey ? "text" : "password"}
              placeholder="AIzaSy... (Enter Google AI Studio Key)"
              value={config.googleAiStudioKey}
              onChange={(e) => onChange({ ...config, googleAiStudioKey: e.target.value })}
              className="pr-10 font-mono text-xs border-slate-200 focus-visible:ring-purple-500"
            />
            <button
              type="button"
              onClick={() => setShowKey(!showKey)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
            >
              {showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
          <p className="text-[11px] text-slate-500">
            Powers real-time reasoning with <code>gemini-flash-lite-latest</code> (ultra-low latency under 500ms).
          </p>
        </div>

        {/* AI System Prompt & Persona Presets */}
        <div className="space-y-2">
          <div className="flex justify-between items-center">
            <label className="text-xs font-bold uppercase tracking-wider text-slate-700">
              AI Persona & System Prompt
            </label>
            <div className="flex items-center gap-1.5">
              {PERSONA_PRESETS.map((p, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => onChange({ ...config, aiSystemPrompt: p.prompt })}
                  className="text-[10px] font-semibold bg-slate-100 hover:bg-purple-100 text-slate-700 hover:text-purple-700 px-2.5 py-1 rounded-lg border border-slate-200 transition-colors"
                >
                  {p.title}
                </button>
              ))}
            </div>
          </div>
          <textarea
            value={config.aiSystemPrompt}
            onChange={(e) => onChange({ ...config, aiSystemPrompt: e.target.value })}
            className="w-full h-28 p-3.5 rounded-xl border border-slate-200 text-xs font-sans text-slate-800 focus:outline-none focus:ring-2 focus:ring-purple-500 leading-relaxed"
            placeholder="Define the bot persona, tone, guidelines, and rules..."
          />
        </div>

        {/* Allowed Numbers Whitelist Filter */}
        <div className="space-y-1.5">
          <div className="flex justify-between items-center">
            <label className="text-xs font-bold uppercase tracking-wider text-slate-700">
              Whitelist Security Filter (Allowed Numbers)
            </label>
            <span className="text-[11px] text-slate-400">Use * for all users or comma-separated test numbers</span>
          </div>
          <Input
            value={config.aiAllowedNumbers}
            onChange={(e) => onChange({ ...config, aiAllowedNumbers: e.target.value })}
            placeholder="* or 919145414083, 919876543210"
            className="font-mono text-xs border-slate-200"
          />
          <p className="text-[11px] text-slate-500">
            For safe staging rollouts, specify admin and tester phone numbers. Only numbers matching this whitelist will trigger Gemini AI.
          </p>
        </div>

        {/* Save Config Button */}
        <div className="pt-2">
          <Button
            onClick={handleSave}
            disabled={isSaving}
            className="bg-purple-600 hover:bg-purple-700 text-white font-semibold text-xs shadow-sm"
          >
            {isSaving ? <RefreshCw className="w-4 h-4 mr-2 animate-spin" /> : <ShieldCheck className="w-4 h-4 mr-2" />}
            Save AI Configuration
          </Button>
        </div>

        {/* Interactive Live AI Test Playground */}
        <div className="pt-4 border-t border-slate-100">
          <div className="bg-slate-900 text-slate-100 rounded-2xl p-5 border border-slate-800 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Terminal className="w-4 h-4 text-purple-400" />
                <span className="text-xs font-bold uppercase tracking-wider text-purple-300">
                  Interactive AI Decision Playground
                </span>
              </div>
              <span className="text-[11px] font-mono text-slate-400">JSON Schema Evaluator</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="sm:col-span-2">
                <Input
                  value={testMessage}
                  onChange={(e) => setTestMessage(e.target.value)}
                  placeholder="Ask a student question (e.g. When is the morning batch?)"
                  className="bg-slate-800 border-slate-700 text-xs text-white placeholder:text-slate-500 focus-visible:ring-purple-500"
                />
              </div>
              <div className="flex gap-2">
                <Input
                  value={testPhone}
                  onChange={(e) => setTestPhone(e.target.value)}
                  placeholder="Test Phone"
                  className="bg-slate-800 border-slate-700 text-xs font-mono text-white placeholder:text-slate-500"
                />
                <Button
                  onClick={handleRunSimulation}
                  disabled={isSimulating}
                  className="bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold shrink-0"
                >
                  {isSimulating ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                </Button>
              </div>
            </div>

            {/* Simulation Result */}
            {simulatorResponse && (
              <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-2 text-xs font-mono">
                <div className="flex items-center justify-between text-[11px] text-slate-400 pb-2 border-b border-slate-800">
                  <span>Source: <strong className="text-purple-400 uppercase">{simulatorResponse.source}</strong></span>
                  <span>Decision: <strong className="text-emerald-400 uppercase">{simulatorResponse.type}</strong></span>
                </div>
                <div className="text-slate-200 whitespace-pre-wrap leading-relaxed">
                  {JSON.stringify(simulatorResponse, null, 2)}
                </div>
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
