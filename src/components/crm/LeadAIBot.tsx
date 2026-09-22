import React, { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Sparkles, Bot, X, Send, Filter, RefreshCw, ChevronDown, Check, User, BarChart2, Calendar, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { askLeadAiBot, Lead, LeadAiAction } from "@/services/leadAiService";

interface LeadAIBotProps {
  leads: Lead[];
  onApplyAction: (action: LeadAiAction) => void;
}

interface ChatMessage {
  id: string;
  sender: "user" | "bot";
  text: string;
  timestamp: string;
  action?: LeadAiAction;
  source?: "gemini" | "local";
}

const PRESET_CHIPS = [
  { label: "📊 Overall Stats", query: "Give me overall lead statistics" },
  { label: "🏆 Deal Conversion", query: "Show me deal done conversion stats" },
  { label: "🔍 Unassigned Leads", query: "Show me unassigned leads" },
  { label: "📅 Today's Follow-ups", query: "What are today's follow up leads?" },
  { label: "👤 Ragini's Leads", query: "Show me leads assigned to Ragini" },
  { label: "👤 Shreya's Leads", query: "Show me leads assigned to Shreya" },
  { label: "📞 Call Connectivity", query: "Give me call connection statistics" }
];

export const LeadAIBot: React.FC<LeadAIBotProps> = ({ leads, onApplyAction }) => {
  const { toast } = useToast();
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [hasUnread, setHasUnread] = useState(false);

  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: "welcome-1",
      sender: "bot",
      text: "👋 **Hello! I'm your Lead Management AI Assistant.**\n\nI am connected directly to your **live Supabase database** and powered by **Gemini 3.6 Flash**.\n\nAsk me any question about lead counts, deal conversions, team performance, or ask me to **filter the table** dynamically!",
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
    }
  ]);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    if (isOpen) {
      scrollToBottom();
      setHasUnread(false);
    }
  }, [messages, isOpen]);

  const handleSendQuery = async (inputQuery?: string) => {
    const textToSend = inputQuery || query;
    if (!textToSend.trim() || isLoading) return;

    const userMsg: ChatMessage = {
      id: Date.now().toString(),
      sender: "user",
      text: textToSend.trim(),
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
    };

    setMessages(prev => [...prev, userMsg]);
    if (!inputQuery) setQuery("");
    setIsLoading(true);

    try {
      const res = await askLeadAiBot(textToSend, leads);
      const botMsg: ChatMessage = {
        id: (Date.now() + 1).toString(),
        sender: "bot",
        text: res.reply,
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        action: res.action,
        source: res.source
      };

      setMessages(prev => [...prev, botMsg]);

      // Automatically apply filter action if present!
      if (res.action && Object.keys(res.action).length > 0) {
        onApplyAction(res.action);
        toast({
          title: "🤖 Table Filter Applied",
          description: "Applied filter based on AI Bot response.",
          duration: 3000
        });
      }
    } catch (err) {
      console.error(err);
      setMessages(prev => [
        ...prev,
        {
          id: (Date.now() + 1).toString(),
          sender: "bot",
          text: "⚠️ Sorry, I encountered an issue analyzing the leads data. Please try again.",
          timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
        }
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleClearChat = () => {
    setMessages([
      {
        id: "welcome-1",
        sender: "bot",
        text: "👋 Chat reset. Ask me anything about your leads dataset!",
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
      }
    ]);
  };

  return (
    <>
      {/* Floating Corner Bot Launcher Button */}
      <div className="fixed bottom-6 right-6 z-50 flex items-center justify-center">
        <AnimatePresence>
          {!isOpen && (
            <motion.button
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.8, opacity: 0 }}
              whileHover={{ scale: 1.08 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => setIsOpen(true)}
              className="relative flex items-center gap-2.5 bg-gradient-to-r from-[#2e5a44] to-[#1e3f2f] text-white px-4 py-3 rounded-full shadow-2xl border border-[#488565] cursor-pointer group"
            >
              {/* Outer Pulse effect */}
              <span className="absolute -inset-1 rounded-full bg-[#2e5a44]/40 animate-ping pointer-events-none"></span>
              
              <div className="relative flex items-center justify-center w-8 h-8 rounded-full bg-white/10 text-emerald-300">
                <Sparkles className="w-5 h-5 animate-pulse text-amber-300" />
              </div>

              <div className="flex flex-col items-start pr-1 text-left">
                <span className="text-xs font-semibold leading-none tracking-wide text-emerald-200">Snehyoga AI</span>
                <span className="text-[11px] font-bold text-white tracking-wider">LEAD BOT</span>
              </div>

              {hasUnread && (
                <span className="absolute -top-1 -right-1 w-3.5 h-3.5 bg-amber-400 border-2 border-white rounded-full"></span>
              )}
            </motion.button>
          )}
        </AnimatePresence>
      </div>

      {/* Chat Drawer Dialog */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            transition={{ duration: 0.2 }}
            className="fixed bottom-6 right-6 z-50 w-[92vw] sm:w-[420px] h-[580px] max-h-[85vh] bg-white rounded-2xl shadow-2xl border border-gray-200 flex flex-col overflow-hidden font-sans"
          >
            {/* Drawer Header */}
            <div className="bg-gradient-to-r from-[#2e5a44] via-[#244837] to-[#1e3f2f] text-white px-4 py-3.5 flex items-center justify-between shadow-md">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-full bg-white/10 border border-white/20 flex items-center justify-center text-amber-300 shadow-inner">
                  <Sparkles className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-1.5">
                    <h3 className="font-bold text-sm leading-tight text-white">Lead AI Assistant</h3>
                    <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[9px] font-medium bg-emerald-500/30 text-emerald-200 border border-emerald-400/30">
                      Gemini AI Online • Live DB
                    </span>
                  </div>
                  <p className="text-[10px] text-gray-200 flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                    Direct Supabase DB Connected
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={handleClearChat}
                  title="Clear chat"
                  className="h-8 w-8 text-gray-300 hover:text-white hover:bg-white/10"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setIsOpen(false)}
                  className="h-8 w-8 text-gray-300 hover:text-white hover:bg-white/10"
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>
            </div>

            {/* Quick Action Preset Chips */}
            <div className="bg-gray-50 border-b border-gray-100 px-3 py-2 flex items-center gap-1.5 overflow-x-auto no-scrollbar scroll-smooth">
              {PRESET_CHIPS.map((chip, idx) => (
                <button
                  key={idx}
                  onClick={() => handleSendQuery(chip.query)}
                  disabled={isLoading}
                  className="shrink-0 text-[11px] font-medium px-2.5 py-1 rounded-full bg-white border border-gray-200 text-gray-700 hover:bg-[#2e5a44] hover:text-white hover:border-[#2e5a44] transition-all shadow-2xs disabled:opacity-50"
                >
                  {chip.label}
                </button>
              ))}
            </div>

            {/* Message Thread Area */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3.5 bg-slate-50/50">
              {messages.map((msg) => (
                <div
                  key={msg.id}
                  className={`flex flex-col ${msg.sender === "user" ? "items-end" : "items-start"}`}
                >
                  <div
                    className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 text-xs leading-relaxed shadow-xs ${
                      msg.sender === "user"
                        ? "bg-[#2e5a44] text-white rounded-br-none"
                        : "bg-white text-gray-800 border border-gray-200/80 rounded-bl-none"
                    }`}
                  >
                    <div className="whitespace-pre-wrap font-normal">
                      {msg.text.split("\n").map((line, lIdx) => {
                        // Very simple markdown formatting helpers
                        const formattedLine = line
                          .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
                          .replace(/\*(.*?)\*/g, "<em>$1</em>");
                        return (
                          <p
                            key={lIdx}
                            className="min-h-[1em] mb-1 last:mb-0"
                            dangerouslySetInnerHTML={{ __html: formattedLine }}
                          />
                        );
                      })}
                    </div>

                    {/* Action Button inside Bot Message */}
                    {msg.sender === "bot" && msg.action && Object.keys(msg.action).length > 0 && (
                      <div className="mt-2.5 pt-2 border-t border-gray-100">
                        <Button
                          size="sm"
                          onClick={() => {
                            onApplyAction(msg.action!);
                            toast({
                              title: "Filter Applied",
                              description: "Table filters updated successfully.",
                              duration: 2500
                            });
                          }}
                          className="w-full bg-emerald-50 text-emerald-800 hover:bg-emerald-100 border border-emerald-200 text-[11px] font-bold h-7 py-0 shadow-2xs flex items-center justify-center gap-1.5"
                        >
                          <Filter className="w-3 h-3 text-emerald-600" /> Apply Filter to Table
                        </Button>
                      </div>
                    )}
                  </div>

                  <span className="text-[9px] text-gray-400 mt-1 px-1">
                    {msg.timestamp} {msg.source === "gemini" ? "• ⚡ Gemini Live" : "• 🚀 Instant Local"}
                  </span>
                </div>
              ))}

              {/* Typing indicator */}
              {isLoading && (
                <div className="flex items-start gap-2">
                  <div className="bg-white border border-gray-200 rounded-2xl rounded-bl-none px-4 py-3 text-xs text-gray-500 shadow-xs flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-amber-500 animate-spin" />
                    <span>AI is thinking...</span>
                  </div>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>

            {/* Input Box Footer */}
            <div className="p-3 bg-white border-t border-gray-100 flex items-center gap-2">
              <Input
                placeholder="Ask stats or type 'show deal done leads'..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    handleSendQuery();
                  }
                }}
                disabled={isLoading}
                className="flex-1 h-9 text-xs border-gray-200 focus:border-[#2e5a44] focus:ring-[#2e5a44]"
              />
              <Button
                onClick={() => handleSendQuery()}
                disabled={!query.trim() || isLoading}
                size="icon"
                className="h-9 w-9 bg-[#2e5a44] hover:bg-[#203f2f] text-white shrink-0 rounded-lg shadow-sm disabled:opacity-50"
              >
                <Send className="w-4 h-4" />
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};
