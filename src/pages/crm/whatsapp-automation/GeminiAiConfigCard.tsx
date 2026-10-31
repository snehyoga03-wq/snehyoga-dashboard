import React, { useState } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { Sparkles, Key, Send, ShieldCheck, RefreshCw, Terminal, Eye, EyeOff, Bot, Save } from "lucide-react";
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
    title: "👩‍💼 Snehyoga Support Executive",
    prompt:
      `You are the official Customer Support Executive at Snehyoga (https://snehyoga.com/), founded by Government-Certified Yoga Teacher and Lifestyle Coach Snehal Salunkhe.

Your role: Warmly, politely, and professionally assist students and leads on WhatsApp as Snehyoga's dedicated Customer Support Executive.

MANDATORY RULES:
1. GREETING & TONE:
   - Greet warmly as Snehyoga Customer Support.
   - Always begin with 'Namaste 🙏' or 'नमस्कार 🙏'.
   - Courteous, helpful, humble, and polite support executive tone.
2. STRICT LANGUAGE & SCRIPT MATCHING:
   - If user asks in Marathi (Devanagari script), reply in polite Marathi.
   - If user asks in Hindi, reply in polite Hindi.
   - If user asks in Hinglish / Latin script (e.g. 'timing kya hai?', 'fees kiti aahe?'), reply in clean Hinglish.
   - If user asks in English, reply in courteous English.
3. SNEHYOGA CORE FACTS:
   - Batch Timings: Mon-Fri across 6 flexible slots: Morning 5:00 AM, 6:00 AM, 7:30 AM & Evening 5:00 PM, 6:00 PM, 9:00 PM IST (55 mins). Sunday holiday. Any batch can be attended flexibly.
   - Plans & Fees: 1 Month: ₹399/-, 6 Months: ₹1,800/-, 1 Year: ₹2,400/- (includes 1-Year Diet Plan free).
   - Demo Session: Free trial available for any batch.
   - Diet: Empty stomach practice. Warm water 20 min before. 2.5-3 hr gap after meal.
   - Student Portal & Link: https://yoga.snehyoga.com
4. WHATSAPP FORMAT: Concise, under 75 words, friendly emojis. End with a helpful closing question (e.g., offering to book their free demo).`
  },
  {
    title: "🧘 Virtual Yoga Counselor",
    prompt:
      `You are the official AI Counselor & WhatsApp Assistant for Snehyoga (https://snehyoga.com/), founded by Government-Certified Yoga Teacher and Lifestyle Coach Snehal Salunkhe.

MANDATORY RULES:
1. LANGUAGE MATCHING: You MUST reply in the EXACT SAME LANGUAGE and script as the user's message (Marathi in Devanagari script, Hindi in Devanagari script, Hinglish in Latin script, English in English, etc.).
2. TONE & PERSONA: Warm, respectful, inspiring, peaceful, and concise. Always begin with 'Namaste 🙏' or 'नमस्कार 🙏'. Keep responses under 80 words so they read perfectly on WhatsApp.
3. ACCURATE INFORMATION (From Snehyoga Knowledge Base):
   - Daily Live Batches: Monday to Friday across 6 slots: Morning (5:00 AM, 6:00 AM, 7:30 AM IST) & Evening (5:00 PM, 6:00 PM, 9:00 PM IST). 55 min sessions. Sunday holiday. Students can attend ANY batch flexibly.
   - Membership Plans: 1 Month: ₹399/-, 6 Months: ₹1,800/-, 1 Year: ₹2,400/- (includes 1-year Diet Plan).
   - Diet Guideline: Practice empty stomach. Warm/lemon water 20 min before class. 2.5-3 hr gap after heavy meal.
   - Joining Class: Via personal WhatsApp link or https://yoga.snehyoga.com/live.
   - Free Trial / Demo: Available! Ask for preferred batch time.
4. ACTION ORIENTATION: Offer demo session or share joining link.`
  },
  {
    title: "💳 Membership & Plans Advisor",
    prompt:
      `You are Snehyoga's Membership Specialist. Explain Snehyoga 365 plans warmly:
1. 1 Month Plan: ₹399/- (Daily live Yogasanas, Pranayama, Face Yoga, Body Detox Kriya, Community Support)
2. 6 Months Plan: ₹1,800/- (Most Popular)
3. 1 Year Plan: ₹2,400/- (Best Value + includes complete 1-Year Home Diet Plan free!)
Offer demo class bookings and share https://yoga.snehyoga.com for registration.`
  },
  {
    title: "🥗 Yoga Nutrition & Pre-Class Guide",
    prompt:
      `You are Snehyoga's Yoga Diet & Wellness Guide. Advise students on:
1. Pre-class: Empty stomach practice. Warm water or lemon water allowed 20 minutes before class.
2. Meal Gap: Keep a gap of 2.5 to 3 hours after a heavy meal.
3. Post-class: Wait 20-30 minutes before taking a light nutritious meal.
4. 1-Year plan includes complete personalized home diet plan for healthy weight loss and gut health.`
  }
];

export const GeminiAiConfigCard: React.FC<GeminiAiConfigCardProps> = ({ config, knowledgeBase, onChange }) => {
  const { toast } = useToast();
  const [showKey, setShowKey] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Live Simulator state
  const [testMessage, setTestMessage] = useState("योग क्लासच्या वेळा काय आहेत आणि फी किती आहे?");
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
    <Card className="border border-slate-200/80 shadow-sm bg-white rounded-2xl overflow-hidden">
      <CardHeader className="bg-white border-b border-slate-100 p-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <CardTitle className="text-xl font-bold text-slate-900 flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-purple-600 animate-pulse" />
              Google Gemini AI Studio Assistant
            </CardTitle>
            <p className="text-xs sm:text-sm text-slate-500">
              Configure AI auto-responder for WhatsApp incoming messages.
            </p>
          </div>

          {/* Master AI Toggle */}
          <div className="flex items-center gap-3 bg-slate-50 border border-slate-200 px-4 py-2 rounded-xl self-start sm:self-auto">
            <div className="text-right">
              <p className="text-xs font-bold text-slate-800">Master Auto-Reply</p>
              <p className="text-[10px] text-slate-500">{config.aiEnabled ? "ACTIVE (Responding)" : "DISABLED (Muted)"}</p>
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

      <CardContent className="p-6 space-y-5">
        {/* Google AI Studio Key */}
        <div className="space-y-1.5">
          <div className="flex justify-between items-center">
            <label className="text-xs font-semibold text-slate-800 flex items-center gap-1.5">
              Google AI Studio API Key
            </label>
            <a
              href="https://aistudio.google.com/app/apikey"
              target="_blank"
              rel="noopener noreferrer"
              className="text-[11px] text-purple-600 hover:text-purple-700 hover:underline font-semibold"
            >
              Get free Gemini Key ↗
            </a>
          </div>
          <div className="relative">
            <Input
              type={showKey ? "text" : "password"}
              placeholder="••••••••••••••••••••••••••••••••••••••••••••••••"
              value={config.googleAiStudioKey}
              onChange={(e) => onChange({ ...config, googleAiStudioKey: e.target.value })}
              className="pr-10 font-mono text-xs border-slate-200 bg-slate-50/50 focus-visible:ring-purple-500 h-10 rounded-xl"
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
            Powers real-time reasoning with <code>gemini-1.5-flash / gemini-2.5-flash-lite</code> (sub-second latency for WhatsApp chats).
          </p>
        </div>

        {/* AI System Prompt & Personality */}
        <div className="space-y-2">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <label className="text-xs font-semibold text-slate-800">
              AI System Prompt / Personality
            </label>
            <div className="flex flex-wrap items-center gap-1.5">
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
            className="w-full h-40 p-3.5 rounded-xl border border-slate-200 text-xs font-sans text-slate-800 bg-slate-50/50 focus:outline-none focus:ring-2 focus:ring-purple-500 leading-relaxed resize-y"
            placeholder="Define the bot persona, tone, guidelines, and rules..."
          />
        </div>

        {/* Allowed Numbers Whitelist Filter */}
        <div className="space-y-1.5">
          <div className="flex justify-between items-center">
            <label className="text-xs font-semibold text-slate-800">
              Allowed Mobile Numbers (Comma Separated)
            </label>
            <span className="text-[11px] text-slate-400">Use * for all users or comma-separated test numbers</span>
          </div>
          <Input
            value={config.aiAllowedNumbers}
            onChange={(e) => onChange({ ...config, aiAllowedNumbers: e.target.value })}
            placeholder="* or 919145414083, 919876543210"
            className="font-mono text-xs border-slate-200 bg-slate-50/50 h-10 rounded-xl"
          />
          <p className="text-[11px] text-slate-500">
            Set to <code>*</code> to respond to all incoming WhatsApp messages, or enter specific phone numbers with country code (e.g. <code>919145414083</code>) for pilot testing.
          </p>
        </div>

        {/* Save Config Button */}
        <div className="pt-2">
          <Button
            onClick={handleSave}
            disabled={isSaving}
            className="bg-[#e11d48] hover:bg-[#be123c] text-white font-semibold text-sm px-6 py-2.5 rounded-xl shadow-sm transition-all flex items-center gap-2"
          >
            {isSaving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            Save AI Config
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
              <span className="text-[11px] font-mono text-slate-400">Live Simulator</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="sm:col-span-2">
                <Input
                  value={testMessage}
                  onChange={(e) => setTestMessage(e.target.value)}
                  placeholder="Test a student query (e.g. batch timings, fees, diet, or demo)"
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
                <div className="text-slate-200 whitespace-pre-wrap leading-relaxed font-sans text-xs">
                  {simulatorResponse.text || JSON.stringify(simulatorResponse, null, 2)}
                </div>
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
