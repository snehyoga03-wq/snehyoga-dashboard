import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Search, Send, Paperclip, Smile, Phone, Video, MoreVertical, ArrowLeft, Check, CheckCheck, Image, FileText, Clock, MessageCircle, Plus, Filter, Star, Archive, Bot, Zap, ChevronDown, X, Copy, Sparkles } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

// ── Types ──
interface Contact {
  id: string;
  name: string;
  phone: string;
  avatar?: string;
  lastMessage: string;
  lastTime: string;
  unreadCount: number;
  isOnline: boolean;
  labels: string[];
}

interface Message {
  id: string;
  text: string;
  sender: "user" | "admin";
  timestamp: string;
  status: "sent" | "delivered" | "read";
  type: "text" | "image" | "template" | "document";
  templateName?: string;
  mediaUrl?: string;
}

interface Template {
  id: string;
  name: string;
  category: string;
  status: string;
  body: string;
  language: string;
}

// ── Demo Data ──
const DEMO_CONTACTS: Contact[] = [
  { id: "1", name: "Rahul Sharma", phone: "919876543210", lastMessage: "Thank you for the session link!", lastTime: "10:47 AM", unreadCount: 2, isOnline: true, labels: ["Active"] },
  { id: "2", name: "Priya Patel", phone: "919123456780", lastMessage: "When is the next yoga session?", lastTime: "9:30 AM", unreadCount: 0, isOnline: false, labels: ["Premium"] },
  { id: "3", name: "Amit Kumar", phone: "918765432109", lastMessage: "I missed today's class 😔", lastTime: "Yesterday", unreadCount: 1, isOnline: false, labels: ["Expiring"] },
  { id: "4", name: "Sneha Gupta", phone: "917654321098", lastMessage: "Can I change my batch timing?", lastTime: "Yesterday", unreadCount: 0, isOnline: true, labels: ["Active", "Premium"] },
  { id: "5", name: "Vikram Singh", phone: "916543210987", lastMessage: "Payment done ✅", lastTime: "May 9", unreadCount: 0, isOnline: false, labels: [] },
  { id: "6", name: "Anita Desai", phone: "915432109876", lastMessage: "Thank you so much! 🙏", lastTime: "May 8", unreadCount: 0, isOnline: false, labels: ["Active"] },
];

const DEMO_MESSAGES: Record<string, Message[]> = {
  "1": [
    { id: "m1", text: "Hello! Welcome to Snehayoga. Your registration is confirmed 🎉", sender: "admin", timestamp: "10:30 AM", status: "read", type: "text" },
    { id: "m2", text: "WE ARE LIVE\nThank you for registering for the Webinar.\n🔴 we are live!\n🔗 Join now: https://padhoindia.live\nBest regards,\nPadho India", sender: "admin", timestamp: "10:45 AM", status: "read", type: "template", templateName: "session_reminder_v1" },
    { id: "m3", text: "Thank you for the session link!", sender: "user", timestamp: "10:47 AM", status: "read", type: "text" },
    { id: "m4", text: "Ok", sender: "user", timestamp: "10:47 AM", status: "read", type: "text" },
  ],
  "2": [
    { id: "m5", text: "Hi Priya! Your 3-month plan is active.", sender: "admin", timestamp: "9:00 AM", status: "read", type: "text" },
    { id: "m6", text: "When is the next yoga session?", sender: "user", timestamp: "9:30 AM", status: "read", type: "text" },
  ],
  "3": [
    { id: "m7", text: "Good morning! Don't forget today's session at 6 AM 🧘", sender: "admin", timestamp: "5:30 AM", status: "delivered", type: "text" },
    { id: "m8", text: "I missed today's class 😔", sender: "user", timestamp: "8:00 AM", status: "read", type: "text" },
  ],
};

const DEMO_TEMPLATES: Template[] = [
  { id: "t1", name: "session_reminder_v1", category: "UTILITY", status: "APPROVED", body: "Hi {{1}}, your yoga session starts in 30 minutes! Join here: {{2}}", language: "en" },
  { id: "t2", name: "welcome_message", category: "MARKETING", status: "APPROVED", body: "Welcome to Snehayoga, {{1}}! 🧘 Your journey to wellness begins now.", language: "en" },
  { id: "t3", name: "payment_reminder", category: "UTILITY", status: "APPROVED", body: "Hi {{1}}, your subscription expires in {{2}} days. Renew now to continue your sessions.", language: "en" },
  { id: "t4", name: "batch_change_confirm", category: "UTILITY", status: "APPROVED", body: "Hi {{1}}, your batch timing has been updated to {{2}}. See you there! 🎯", language: "en" },
  { id: "t5", name: "memoryv5002", category: "MARKETING", status: "APPROVED", body: "🧠 10X Memory Power Webinar\nJoin us for an amazing session!\n🔗 Register now", language: "en" },
];

// ── Helper Components ──
const Avatar = ({ name, isOnline }: { name: string; isOnline?: boolean }) => {
  const colors = ["#25D366", "#128C7E", "#075E54", "#34B7F1", "#00A884", "#667781"];
  const idx = name.charCodeAt(0) % colors.length;
  return (
    <div className="relative shrink-0">
      <div className="w-12 h-12 rounded-full flex items-center justify-center text-white font-semibold text-lg" style={{ background: colors[idx] }}>
        {name.charAt(0).toUpperCase()}
      </div>
      {isOnline && <div className="absolute bottom-0 right-0 w-3.5 h-3.5 bg-green-500 border-2 border-white rounded-full" />}
    </div>
  );
};

const StatusIcon = ({ status }: { status: string }) => {
  if (status === "read") return <CheckCheck size={16} className="text-blue-500" />;
  if (status === "delivered") return <CheckCheck size={16} className="text-gray-400" />;
  return <Check size={16} className="text-gray-400" />;
};

// ── Main Component ──
export function WhatsAppChat() {
  const [selectedContact, setSelectedContact] = useState<Contact | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [messageInput, setMessageInput] = useState("");
  const [messages, setMessages] = useState<Record<string, Message[]>>(DEMO_MESSAGES);
  const [contacts, setContacts] = useState<Contact[]>(DEMO_CONTACTS);
  const [showTemplates, setShowTemplates] = useState(false);
  const [activeFilter, setActiveFilter] = useState<string>("all");
  const [showEmojiHint, setShowEmojiHint] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [selectedContact, messages]);

  const filteredContacts = contacts.filter(c => {
    const matchesSearch = c.name.toLowerCase().includes(searchQuery.toLowerCase()) || c.phone.includes(searchQuery);
    if (activeFilter === "unread") return matchesSearch && c.unreadCount > 0;
    if (activeFilter === "active") return matchesSearch && c.labels.includes("Active");
    return matchesSearch;
  });

  const handleSendMessage = () => {
    if (!messageInput.trim() || !selectedContact) return;
    const newMsg: Message = {
      id: `msg-${Date.now()}`,
      text: messageInput,
      sender: "admin",
      timestamp: new Date().toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" }),
      status: "sent",
      type: "text",
    };
    setMessages(prev => ({
      ...prev,
      [selectedContact.id]: [...(prev[selectedContact.id] || []), newMsg],
    }));
    setContacts(prev => prev.map(c => c.id === selectedContact.id ? { ...c, lastMessage: messageInput, lastTime: "Just now" } : c));
    setMessageInput("");
    inputRef.current?.focus();
    // Simulate delivery after 1s
    setTimeout(() => {
      setMessages(prev => ({
        ...prev,
        [selectedContact.id]: (prev[selectedContact.id] || []).map(m => m.id === newMsg.id ? { ...m, status: "delivered" } : m),
      }));
    }, 1000);
  };

  const handleSendTemplate = (template: Template) => {
    if (!selectedContact) return;
    const newMsg: Message = {
      id: `msg-${Date.now()}`,
      text: template.body.replace("{{1}}", selectedContact.name).replace("{{2}}", "https://yoga.snehyoga.com"),
      sender: "admin",
      timestamp: new Date().toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" }),
      status: "sent",
      type: "template",
      templateName: template.name,
    };
    setMessages(prev => ({
      ...prev,
      [selectedContact.id]: [...(prev[selectedContact.id] || []), newMsg],
    }));
    setShowTemplates(false);
  };

  // ── Render ──
  return (
    <div className="h-[calc(100vh-7rem)] flex rounded-2xl overflow-hidden border border-gray-200 shadow-lg bg-white">
      {/* ═══ LEFT PANEL: Contact List ═══ */}
      <div className={`${selectedContact ? 'hidden md:flex' : 'flex'} flex-col w-full md:w-[380px] border-r border-gray-200 bg-white`}>
        {/* Header */}
        <div className="px-4 py-3 bg-[#f0f2f5] border-b border-gray-200">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-xl font-bold text-[#111b21]">Chats</h2>
            <div className="flex items-center gap-1">
              <button className="p-2 hover:bg-gray-200 rounded-full transition-colors"><Plus size={20} className="text-[#54656f]" /></button>
              <button className="p-2 hover:bg-gray-200 rounded-full transition-colors"><Filter size={20} className="text-[#54656f]" /></button>
              <button className="p-2 hover:bg-gray-200 rounded-full transition-colors"><MoreVertical size={20} className="text-[#54656f]" /></button>
            </div>
          </div>
          {/* Search */}
          <div className="relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#54656f]" />
            <input
              type="text"
              placeholder="Search or start new chat"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-white rounded-lg text-sm border-0 outline-none focus:ring-1 focus:ring-[#00a884] placeholder:text-[#667781]"
            />
          </div>
          {/* Filter chips */}
          <div className="flex gap-2 mt-3 overflow-x-auto pb-1">
            {[
              { key: "all", label: "All" },
              { key: "unread", label: "Unread" },
              { key: "active", label: "Active" },
            ].map(f => (
              <button
                key={f.key}
                onClick={() => setActiveFilter(f.key)}
                className={`px-3 py-1 rounded-full text-xs font-medium whitespace-nowrap transition-all ${
                  activeFilter === f.key
                    ? "bg-[#00a884] text-white"
                    : "bg-white text-[#54656f] hover:bg-gray-100"
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>

        {/* Contact List */}
        <div className="flex-1 overflow-y-auto">
          {filteredContacts.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-gray-400 px-8">
              <MessageCircle size={48} strokeWidth={1} />
              <p className="mt-3 text-sm text-center">No conversations found</p>
            </div>
          ) : (
            filteredContacts.map(contact => (
              <motion.div
                key={contact.id}
                whileHover={{ backgroundColor: "#f0f2f5" }}
                onClick={() => {
                  setSelectedContact(contact);
                  setContacts(prev => prev.map(c => c.id === contact.id ? { ...c, unreadCount: 0 } : c));
                }}
                className={`flex items-center gap-3 px-4 py-3 cursor-pointer border-b border-gray-100 transition-colors ${
                  selectedContact?.id === contact.id ? "bg-[#f0f2f5]" : ""
                }`}
              >
                <Avatar name={contact.name} isOnline={contact.isOnline} />
                <div className="flex-1 min-w-0">
                  <div className="flex justify-between items-baseline">
                    <h3 className="font-semibold text-[#111b21] text-[15px] truncate">{contact.name}</h3>
                    <span className={`text-xs shrink-0 ml-2 ${contact.unreadCount > 0 ? "text-[#00a884] font-medium" : "text-[#667781]"}`}>{contact.lastTime}</span>
                  </div>
                  <div className="flex items-center gap-1 mt-0.5">
                    <p className="text-sm text-[#667781] truncate flex-1">{contact.lastMessage}</p>
                    {contact.unreadCount > 0 && (
                      <span className="shrink-0 bg-[#25d366] text-white text-xs font-bold min-w-[20px] h-5 flex items-center justify-center rounded-full px-1.5">{contact.unreadCount}</span>
                    )}
                  </div>
                  {contact.labels.length > 0 && (
                    <div className="flex gap-1 mt-1">
                      {contact.labels.map(l => (
                        <span key={l} className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${
                          l === "Premium" ? "bg-amber-100 text-amber-700" :
                          l === "Expiring" ? "bg-red-100 text-red-600" :
                          "bg-green-100 text-green-700"
                        }`}>{l}</span>
                      ))}
                    </div>
                  )}
                </div>
              </motion.div>
            ))
          )}
        </div>
      </div>

      {/* ═══ RIGHT PANEL: Chat View ═══ */}
      {selectedContact ? (
        <div className="flex-1 flex flex-col bg-[#efeae2]">
          {/* Chat Header */}
          <div className="flex items-center gap-3 px-4 py-2.5 bg-[#f0f2f5] border-b border-gray-200 shrink-0">
            <button onClick={() => setSelectedContact(null)} className="md:hidden p-1 hover:bg-gray-200 rounded-full"><ArrowLeft size={20} /></button>
            <Avatar name={selectedContact.name} isOnline={selectedContact.isOnline} />
            <div className="flex-1 min-w-0">
              <h3 className="font-semibold text-[#111b21] text-base">{selectedContact.name}</h3>
              <p className="text-xs text-[#667781]">{selectedContact.isOnline ? "online" : `+${selectedContact.phone}`}</p>
            </div>
            <div className="flex items-center gap-1">
              <button className="p-2 hover:bg-gray-200 rounded-full transition-colors"><Phone size={20} className="text-[#54656f]" /></button>
              <button className="p-2 hover:bg-gray-200 rounded-full transition-colors"><Video size={20} className="text-[#54656f]" /></button>
              <button className="p-2 hover:bg-gray-200 rounded-full transition-colors"><MoreVertical size={20} className="text-[#54656f]" /></button>
            </div>
          </div>

          {/* Messages Area */}
          <div className="flex-1 overflow-y-auto px-4 md:px-12 py-4 space-y-1" style={{ backgroundImage: "url(\"data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23d4cfc6' fill-opacity='0.15'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E\")" }}>
            {(messages[selectedContact.id] || []).map((msg) => (
              <motion.div
                key={msg.id}
                initial={{ opacity: 0, y: 8, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                className={`flex ${msg.sender === "admin" ? "justify-end" : "justify-start"}`}
              >
                <div className={`relative max-w-[75%] md:max-w-[65%] px-3 py-1.5 rounded-lg shadow-sm ${
                  msg.sender === "admin"
                    ? "bg-[#d9fdd3] rounded-tr-none"
                    : "bg-white rounded-tl-none"
                }`}>
                  {msg.type === "template" && (
                    <div className="flex items-center gap-1.5 mb-1 pb-1 border-b border-gray-200/60">
                      <Zap size={12} className="text-amber-500" />
                      <span className="text-[10px] font-medium text-amber-600 uppercase tracking-wider">Template • {msg.templateName}</span>
                    </div>
                  )}
                  <p className="text-[14.2px] text-[#111b21] whitespace-pre-wrap leading-[19px]">{msg.text}</p>
                  <div className={`flex items-center gap-1 justify-end mt-0.5 ${msg.sender === "admin" ? "" : ""}`}>
                    <span className="text-[11px] text-[#667781]">{msg.timestamp}</span>
                    {msg.sender === "admin" && <StatusIcon status={msg.status} />}
                  </div>
                </div>
              </motion.div>
            ))}
            <div ref={chatEndRef} />
          </div>

          {/* Template Picker */}
          <AnimatePresence>
            {showTemplates && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="bg-white border-t border-gray-200 overflow-hidden"
              >
                <div className="p-3 max-h-[250px] overflow-y-auto">
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="font-semibold text-sm text-gray-800 flex items-center gap-1.5">
                      <Sparkles size={14} className="text-amber-500" /> Templates
                    </h4>
                    <button onClick={() => setShowTemplates(false)} className="p-1 hover:bg-gray-100 rounded-full"><X size={16} /></button>
                  </div>
                  <div className="grid gap-2">
                    {DEMO_TEMPLATES.map(t => (
                      <button
                        key={t.id}
                        onClick={() => handleSendTemplate(t)}
                        className="text-left p-3 rounded-lg border border-gray-100 hover:border-[#25d366] hover:bg-green-50/40 transition-all group"
                      >
                        <div className="flex items-center justify-between mb-1">
                          <span className="font-medium text-sm text-[#111b21]">{t.name}</span>
                          <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${
                            t.status === "APPROVED" ? "bg-green-100 text-green-700" : "bg-amber-100 text-amber-700"
                          }`}>{t.status}</span>
                        </div>
                        <p className="text-xs text-[#667781] line-clamp-2">{t.body}</p>
                        <div className="flex items-center gap-2 mt-1.5">
                          <span className="text-[10px] bg-gray-100 px-1.5 py-0.5 rounded text-gray-500">{t.category}</span>
                          <span className="text-[10px] text-gray-400">{t.language}</span>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Input Bar */}
          <div className="flex items-center gap-2 px-3 py-2 bg-[#f0f2f5] border-t border-gray-200 shrink-0">
            <button onClick={() => setShowTemplates(!showTemplates)} className={`p-2 rounded-full transition-colors ${showTemplates ? "bg-[#00a884] text-white" : "hover:bg-gray-200 text-[#54656f]"}`}>
              <Zap size={22} />
            </button>
            <button className="p-2 hover:bg-gray-200 rounded-full transition-colors text-[#54656f]"><Paperclip size={22} /></button>
            <div className="flex-1 relative">
              <input
                ref={inputRef}
                type="text"
                placeholder='Type "/" for canned messages'
                value={messageInput}
                onChange={e => setMessageInput(e.target.value)}
                onKeyDown={e => e.key === "Enter" && handleSendMessage()}
                className="w-full px-4 py-2.5 bg-white rounded-lg text-sm border-0 outline-none focus:ring-1 focus:ring-[#00a884] placeholder:text-[#667781]"
              />
            </div>
            <button className="p-2 hover:bg-gray-200 rounded-full transition-colors text-[#54656f]"><Smile size={22} /></button>
            <button
              onClick={handleSendMessage}
              disabled={!messageInput.trim()}
              className={`p-2.5 rounded-full transition-all ${messageInput.trim() ? "bg-[#00a884] text-white hover:bg-[#008f72] shadow-md" : "bg-gray-200 text-gray-400"}`}
            >
              <Send size={20} />
            </button>
          </div>
        </div>
      ) : (
        /* Empty State */
        <div className="flex-1 hidden md:flex flex-col items-center justify-center bg-[#f0f2f5]">
          <div className="text-center max-w-md px-8">
            <div className="w-[200px] h-[200px] mx-auto mb-6 relative">
              <div className="absolute inset-0 bg-gradient-to-br from-[#25d366]/20 to-[#128c7e]/20 rounded-full animate-pulse" />
              <div className="absolute inset-6 bg-gradient-to-br from-[#25d366]/30 to-[#128c7e]/30 rounded-full flex items-center justify-center">
                <MessageCircle size={64} className="text-[#25d366]" strokeWidth={1} />
              </div>
            </div>
            <h2 className="text-3xl font-light text-[#41525d] mb-3">Snehayoga WhatsApp</h2>
            <p className="text-sm text-[#667781] leading-relaxed">
              Send and receive messages directly from Meta WhatsApp Business API. 
              Select a conversation to start messaging.
            </p>
            <div className="mt-8 flex items-center justify-center gap-2 text-xs text-[#8696a0]">
              <span className="inline-flex items-center gap-1 px-3 py-1.5 bg-white rounded-full shadow-sm">
                <Zap size={12} className="text-[#00a884]" /> Meta Business API Connected
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
