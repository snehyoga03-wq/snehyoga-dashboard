import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  Search, Send, Paperclip, Smile, Phone, Video, MoreVertical, ArrowLeft, 
  Check, CheckCheck, MessageCircle, Plus, Filter, Zap, X, Sparkles, RefreshCw, Loader2 
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/components/ui/use-toast";

// ── Types ──
interface Contact {
  id: string;          // user_phone
  name: string;
  phone: string;
  lastMessage: string;
  lastTime: string;
  unreadCount: number;
  isOnline: boolean;
  labels: string[];
}

interface Message {
  id: string;
  text: string;
  sender: "user" | "admin" | "bot";
  timestamp: string;
  rawDate: Date;
  status: "sent" | "delivered" | "read";
  type: "text" | "template";
  templateName?: string;
}

interface Template {
  id: string;
  name: string;
  category: string;
  status: string;
  body: string;
  language: string;
}

// ── Helper Components ──
const normalizePhone = (phoneStr: string) => {
  let p = (phoneStr || "").replace(/\D/g, "");
  if (p.length === 12 && p.startsWith("91")) p = p.substring(2);
  return p;
};
const Avatar = ({ name, isOnline }: { name: string; isOnline?: boolean }) => {
  const colors = ["#25D366", "#128C7E", "#075E54", "#34B7F1", "#00A884", "#667781"];
  const idx = (name || "U").charCodeAt(0) % colors.length;
  return (
    <div className="relative shrink-0">
      <div className="w-12 h-12 rounded-full flex items-center justify-center text-white font-semibold text-lg" style={{ background: colors[idx] }}>
        {(name || "U").charAt(0).toUpperCase()}
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
  const { toast } = useToast();
  const [selectedContact, setSelectedContact] = useState<Contact | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [messageInput, setMessageInput] = useState("");
  const [allMessages, setAllMessages] = useState<any[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [showTemplates, setShowTemplates] = useState(false);
  const [activeFilter, setActiveFilter] = useState<string>("all");
  const [isLoading, setIsLoading] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // 1. Fetch live chat messages & group into contact conversations
  const fetchLiveChatData = async () => {
    try {
      const { data: dbMsgs, error } = await supabase
        .from("chat_messages")
        .select("*")
        .order("created_at", { ascending: true });

      if (error) {
        console.warn("chat_messages fetch notice:", error);
        setIsLoading(false);
        return;
      }

      const rawMsgs = dbMsgs || [];
      setAllMessages(rawMsgs);

      // Group by user_phone
      const groupedContacts: Record<string, { phone: string; name: string; lastMsg: string; lastTime: string; unread: number; rawTime: number } > = {};

      for (const m of rawMsgs) {
        const rawP = m.user_phone || "unknown";
        const p = normalizePhone(rawP) || rawP;
        const name = m.user_name && m.user_name !== "User" ? m.user_name : (rawP || p);
        const msgTime = new Date(m.created_at);
        const timeStr = msgTime.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" });

        if (!groupedContacts[p]) {
          groupedContacts[p] = {
            phone: p,
            name: name,
            lastMsg: m.message || "",
            lastTime: timeStr,
            unread: m.sender_type === "user" && !m.is_read ? 1 : 0,
            rawTime: msgTime.getTime()
          };
        } else {
          groupedContacts[p].lastMsg = m.message || "";
          groupedContacts[p].lastTime = timeStr;
          groupedContacts[p].rawTime = msgTime.getTime();
          if (m.user_name && m.user_name !== "User") groupedContacts[p].name = m.user_name;
          if (m.sender_type === "user" && !m.is_read) groupedContacts[p].unread += 1;
        }
      }

      // Convert to array sorted by latest activity
      const contactList: Contact[] = Object.values(groupedContacts)
        .sort((a, b) => b.rawTime - a.rawTime)
        .map(c => ({
          id: c.phone,
          name: c.name,
          phone: c.phone,
          lastMessage: c.lastMsg,
          lastTime: c.lastTime,
          unreadCount: c.unread,
          isOnline: true,
          labels: ["Live Webhook"]
        }));

      setContacts(contactList);

      // Keep selected contact synced if open
      if (selectedContact) {
        const updatedSel = contactList.find(c => c.id === selectedContact.id);
        if (updatedSel) setSelectedContact(updatedSel);
      }
    } catch (e) {
      console.error("Error loading chat data:", e);
    } finally {
      setIsLoading(false);
    }
  };

  // 2. Initial load + Supabase Realtime Subscription for incoming webhooks
  useEffect(() => {
    fetchLiveChatData();
    fetchLiveTemplates();

    // Subscribe to new incoming messages inserted by webhook or system
    const channel = supabase
      .channel("realtime-whatsapp-chats")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "chat_messages" }, (payload) => {
        console.log("⚡ Realtime new chat message received:", payload.new);
        fetchLiveChatData();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  // 3. Fetch Meta WABA Approved Templates
  const fetchLiveTemplates = async () => {
    try {
      const { data: settings } = await supabase
        .from("session_settings")
        .select("wa_api_token, wa_waba_id")
        .maybeSingle();

      const waToken = (settings?.wa_api_token || localStorage.getItem("wa_api_token") || "").trim();
      const wabaId = (settings?.wa_waba_id || localStorage.getItem("wa_waba_id") || "1564657775051850").trim();

      if (waToken && wabaId) {
        const url = `https://graph.facebook.com/v20.0/${wabaId}/message_templates?fields=name,status,category,language,components&limit=50&access_token=${waToken}`;
        const res = await fetch(url);
        const json = await res.json();

        if (res.ok && json.data) {
          const tpls: Template[] = json.data.map((t: any) => {
            const bodyComp = t.components?.find((c: any) => c.type === "BODY");
            return {
              id: t.id || t.name,
              name: t.name,
              category: t.category || "UTILITY",
              status: t.status || "APPROVED",
              body: bodyComp?.text || "",
              language: t.language || "en"
            };
          });
          setTemplates(tpls);
        }
      }
    } catch (e) {
      console.warn("Templates load notice:", e);
    }
  };

  // 4. Auto Scroll to Bottom on Message Update
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [selectedContact, allMessages]);

  // Filtered contacts based on search query and filter chips
  const filteredContacts = contacts.filter(c => {
    const matchesSearch = c.name.toLowerCase().includes(searchQuery.toLowerCase()) || c.phone.includes(searchQuery);
    if (activeFilter === "unread") return matchesSearch && c.unreadCount > 0;
    if (activeFilter === "active") return matchesSearch && c.labels.includes("Live Webhook");
    return matchesSearch;
  });

  // Current contact's messages from allMessages
  const currentChatMessages: Message[] = selectedContact 
    ? allMessages
        .filter(m => normalizePhone(m.user_phone) === normalizePhone(selectedContact.phone))
        .map(m => ({
          id: m.id,
          text: m.message || "",
          sender: m.sender_type === "user" ? "user" : m.sender_type === "bot" ? "bot" : "admin",
          timestamp: new Date(m.created_at).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" }),
          rawDate: new Date(m.created_at),
          status: "read",
          type: m.message?.includes("Template") ? "template" : "text"
        }))
    : [];

  // Mark conversation as read when clicked
  const handleSelectContact = async (contact: Contact) => {
    setSelectedContact(contact);
    setContacts(prev => prev.map(c => c.id === contact.id ? { ...c, unreadCount: 0 } : c));
    try {
      await supabase
        .from("chat_messages")
        .update({ is_read: true })
        .eq("user_phone", contact.phone)
        .eq("sender_type", "user");
    } catch (_) {}
  };

  // 5. Send LIVE WhatsApp Text Message via Meta API
  const handleSendMessage = async () => {
    if (!messageInput.trim() || !selectedContact || isSending) return;

    const text = messageInput.trim();
    setMessageInput("");
    setIsSending(true);

    try {
      // Load WhatsApp API credentials from session_settings or localStorage
      const { data: settings } = await supabase
        .from("session_settings")
        .select("wa_api_token, wa_phone_number_id")
        .maybeSingle();

      const waToken = (
        settings?.wa_api_token || 
        localStorage.getItem("wa_api_token") || 
        "EAAX2HQ7QpvUBSZAK3krfGE7pLN8pW3WoUZCSJZCJsZB4oallIQNagAXwCqENBRZBO3kOGbABFyeI0IqrkZAsuA5lft4kVWrtuoy9MylP9RDz2BV5uEFLjNFBNuU9CJqzFMEMYLZBTn8ZCswZCE8CubZCg0KliOITU9t43FlGZA6HBSyS819nxhAdvTZBOl8IhT5tbV2LHQZDZD"
      ).trim();

      const phoneNumberId = (settings?.wa_phone_number_id || "808910018982018").trim();

      // Format recipient phone number (remove + sign, prepend 91 for 10-digit indian numbers)
      let cleanPhone = selectedContact.phone.replace(/\D/g, "");
      if (cleanPhone.length === 10) cleanPhone = "91" + cleanPhone;

      // Call Meta WhatsApp Cloud API directly
      const url = `https://graph.facebook.com/v20.0/${phoneNumberId}/messages`;
      const res = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${waToken}`
        },
        body: JSON.stringify({
          messaging_product: "whatsapp",
          to: cleanPhone,
          type: "text",
          text: { body: text }
        })
      });

      const json = await res.json();

      if (!res.ok || json.error) {
        throw new Error(json.error?.message || `Failed to send WhatsApp message`);
      }

      // Store outgoing message in chat_messages table
      await supabase.from("chat_messages").insert({
        user_phone: selectedContact.phone,
        user_name: selectedContact.name,
        message: text,
        sender_type: "admin",
        is_read: true,
        created_at: new Date().toISOString()
      });

      toast({ title: "Sent Live ✅", description: `Message delivered to ${selectedContact.name}` });
      fetchLiveChatData();
    } catch (err: any) {
      console.error("Live send error:", err);
      toast({ title: "Send Error", description: err.message, variant: "destructive" });
    } finally {
      setIsSending(false);
      inputRef.current?.focus();
    }
  };

  // 6. Send LIVE WhatsApp Template Message
  const handleSendTemplate = async (template: Template) => {
    if (!selectedContact || isSending) return;
    setIsSending(true);

    try {
      const { data: settings } = await supabase
        .from("session_settings")
        .select("wa_api_token, wa_phone_number_id")
        .maybeSingle();

      const waToken = (settings?.wa_api_token || localStorage.getItem("wa_api_token") || "").trim();
      const phoneNumberId = (settings?.wa_phone_number_id || "808910018982018").trim();

      let cleanPhone = selectedContact.phone.replace(/\D/g, "");
      if (cleanPhone.length === 10) cleanPhone = "91" + cleanPhone;

      const url = `https://graph.facebook.com/v20.0/${phoneNumberId}/messages`;
      const res = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${waToken}`
        },
        body: JSON.stringify({
          messaging_product: "whatsapp",
          to: cleanPhone,
          type: "template",
          template: {
            name: template.name,
            language: { code: template.language || "en" }
          }
        })
      });

      const json = await res.json();
      if (!res.ok || json.error) throw new Error(json.error?.message || "Failed to send template");

      const tplPreview = `[Template: ${template.name}]\n${template.body}`;
      await supabase.from("chat_messages").insert({
        user_phone: selectedContact.phone,
        user_name: selectedContact.name,
        message: tplPreview,
        sender_type: "admin",
        is_read: true,
        created_at: new Date().toISOString()
      });

      toast({ title: "Template Sent Live! ⚡", description: `Delivered template "${template.name}"` });
      setShowTemplates(false);
      fetchLiveChatData();
    } catch (err: any) {
      toast({ title: "Template Error", description: err.message, variant: "destructive" });
    } finally {
      setIsSending(false);
    }
  };

  // ── Render ──
  return (
    <div className="h-[calc(100vh-7rem)] flex rounded-2xl overflow-hidden border border-gray-200 shadow-lg bg-white">
      {/* ═══ LEFT PANEL: Contact List ═══ */}
      <div className={`${selectedContact ? 'hidden md:flex' : 'flex'} flex-col w-full md:w-[380px] border-r border-gray-200 bg-white`}>
        {/* Header */}
        <div className="px-4 py-3 bg-[#f0f2f5] border-b border-gray-200">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-bold text-[#111b21]">Chats</h2>
              <span className="bg-[#25d366] text-white text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider flex items-center gap-1">
                <span className="w-1.5 h-1.5 bg-white rounded-full animate-ping" /> LIVE
              </span>
            </div>
            <div className="flex items-center gap-1">
              <button 
                onClick={fetchLiveChatData} 
                className="p-2 hover:bg-gray-200 rounded-full transition-colors"
                title="Refresh Live Chats"
              >
                <RefreshCw size={18} className={`text-[#54656f] ${isLoading ? "animate-spin" : ""}`} />
              </button>
              <button className="p-2 hover:bg-gray-200 rounded-full transition-colors"><MoreVertical size={18} className="text-[#54656f]" /></button>
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
              { key: "active", label: "Live Webhooks" },
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
          {isLoading ? (
            <div className="flex items-center justify-center h-48 text-gray-400 gap-2">
              <Loader2 size={20} className="animate-spin text-[#00a884]" />
              <span className="text-xs">Loading live Webhook chats...</span>
            </div>
          ) : filteredContacts.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-gray-400 px-8 py-12">
              <MessageCircle size={48} strokeWidth={1} />
              <p className="mt-3 text-sm text-center font-medium">No live Webhook chats yet</p>
              <p className="text-xs text-gray-400 text-center mt-1">When users send a message or tap a WhatsApp button, their conversation will appear here live!</p>
            </div>
          ) : (
            filteredContacts.map(contact => (
              <motion.div
                key={contact.id}
                whileHover={{ backgroundColor: "#f0f2f5" }}
                onClick={() => handleSelectContact(contact)}
                className={`flex items-center gap-3 px-4 py-3 cursor-pointer border-b border-gray-100 transition-colors ${
                  selectedContact?.id === contact.id ? "bg-[#f0f2f5]" : ""
                }`}
              >
                <Avatar name={contact.name} isOnline={contact.isOnline} />
                <div className="flex-1 min-w-0">
                  <div className="flex justify-between items-baseline">
                    <h3 className="font-semibold text-[#111b21] text-[15px] truncate">{contact.name}</h3>
                    <span className={`text-xs shrink-0 ml-2 ${contact.unreadCount > 0 ? "text-[#00a884] font-bold" : "text-[#667781]"}`}>{contact.lastTime}</span>
                  </div>
                  <div className="flex items-center gap-1 mt-0.5">
                    <p className="text-sm text-[#667781] truncate flex-1">{contact.lastMessage}</p>
                    {contact.unreadCount > 0 && (
                      <span className="shrink-0 bg-[#25d366] text-white text-xs font-bold min-w-[20px] h-5 flex items-center justify-center rounded-full px-1.5">{contact.unreadCount}</span>
                    )}
                  </div>
                  <div className="flex gap-1 mt-1">
                    <span className="text-[10px] px-1.5 py-0.5 rounded font-medium bg-green-100 text-green-700 flex items-center gap-1">
                      ⚡ Live Webhook
                    </span>
                  </div>
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
              <p className="text-xs text-[#667781] flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-green-500 inline-block" /> +{selectedContact.phone}
              </p>
            </div>
            <div className="flex items-center gap-1">
              <button onClick={fetchLiveChatData} className="p-2 hover:bg-gray-200 rounded-full transition-colors" title="Sync Latest Messages">
                <RefreshCw size={18} className="text-[#54656f]" />
              </button>
            </div>
          </div>

          {/* Messages Area */}
          <div className="flex-1 overflow-y-auto px-4 md:px-12 py-4 space-y-2" style={{ backgroundImage: "url(\"data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23d4cfc6' fill-opacity='0.15'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E\")" }}>
            {currentChatMessages.map((msg) => (
              <motion.div
                key={msg.id}
                initial={{ opacity: 0, y: 8, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                className={`flex ${msg.sender === "admin" || msg.sender === "bot" ? "justify-end" : "justify-start"}`}
              >
                <div className={`relative max-w-[75%] md:max-w-[65%] px-3 py-2 rounded-lg shadow-sm ${
                  msg.sender === "admin"
                    ? "bg-[#d9fdd3] rounded-tr-none border border-emerald-200"
                    : msg.sender === "bot"
                    ? "bg-emerald-50 rounded-tr-none border border-emerald-300 text-emerald-950"
                    : "bg-white rounded-tl-none border border-gray-100"
                }`}>
                  {msg.sender === "bot" && (
                    <div className="flex items-center gap-1 mb-1 pb-1 border-b border-emerald-200/60 text-[10px] font-bold text-emerald-700 uppercase">
                      <Sparkles size={11} className="text-emerald-600" /> Bot Auto-Reply
                    </div>
                  )}
                  {msg.type === "template" && (
                    <div className="flex items-center gap-1.5 mb-1 pb-1 border-b border-gray-200/60">
                      <Zap size={12} className="text-amber-500" />
                      <span className="text-[10px] font-medium text-amber-600 uppercase tracking-wider">Template Sent</span>
                    </div>
                  )}
                  <p className="text-[14.2px] text-[#111b21] whitespace-pre-wrap leading-[19px]">{msg.text}</p>
                  <div className="flex items-center gap-1 justify-end mt-1">
                    <span className="text-[10px] text-[#667781]">{msg.timestamp}</span>
                    {(msg.sender === "admin" || msg.sender === "bot") && <StatusIcon status={msg.status} />}
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
                      <Sparkles size={14} className="text-amber-500" /> Live Meta Templates
                    </h4>
                    <button onClick={() => setShowTemplates(false)} className="p-1 hover:bg-gray-100 rounded-full"><X size={16} /></button>
                  </div>
                  {templates.length === 0 ? (
                    <p className="text-xs text-gray-400 py-4 text-center">No Meta WABA templates fetched yet. Save credentials in CRM settings.</p>
                  ) : (
                    <div className="grid gap-2">
                      {templates.map(t => (
                        <button
                          key={t.id || t.name}
                          onClick={() => handleSendTemplate(t)}
                          disabled={isSending}
                          className="text-left p-3 rounded-lg border border-gray-100 hover:border-[#25d366] hover:bg-green-50/40 transition-all group"
                        >
                          <div className="flex items-center justify-between mb-1">
                            <span className="font-medium text-sm text-[#111b21]">{t.name}</span>
                            <span className="text-[10px] px-1.5 py-0.5 rounded-full font-medium bg-green-100 text-green-700">{t.status}</span>
                          </div>
                          <p className="text-xs text-[#667781] line-clamp-2">{t.body}</p>
                          <div className="flex items-center gap-2 mt-1.5">
                            <span className="text-[10px] bg-gray-100 px-1.5 py-0.5 rounded text-gray-500">{t.category}</span>
                            <span className="text-[10px] text-gray-400">Lang: {t.language}</span>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Input Bar */}
          <div className="flex items-center gap-2 px-3 py-2 bg-[#f0f2f5] border-t border-gray-200 shrink-0">
            <button 
              onClick={() => setShowTemplates(!showTemplates)} 
              className={`p-2 rounded-full transition-colors ${showTemplates ? "bg-[#00a884] text-white" : "hover:bg-gray-200 text-[#54656f]"}`}
              title="Send Template Message"
            >
              <Zap size={22} />
            </button>
            <div className="flex-1 relative">
              <input
                ref={inputRef}
                type="text"
                placeholder={`Type a live WhatsApp reply to ${selectedContact.name}...`}
                value={messageInput}
                onChange={e => setMessageInput(e.target.value)}
                onKeyDown={e => e.key === "Enter" && handleSendMessage()}
                className="w-full px-4 py-2.5 bg-white rounded-lg text-sm border-0 outline-none focus:ring-1 focus:ring-[#00a884] placeholder:text-[#667781]"
              />
            </div>
            <button
              onClick={handleSendMessage}
              disabled={!messageInput.trim() || isSending}
              className={`p-2.5 rounded-full transition-all ${
                messageInput.trim() && !isSending 
                  ? "bg-[#00a884] text-white hover:bg-[#008f72] shadow-md" 
                  : "bg-gray-200 text-gray-400"
              }`}
            >
              {isSending ? <Loader2 size={20} className="animate-spin" /> : <Send size={20} />}
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
            <h2 className="text-3xl font-light text-[#41525d] mb-3">Sneha Yoga Live Webhook Chats</h2>
            <p className="text-sm text-[#667781] leading-relaxed">
              Real-time synchronization with Meta WhatsApp Cloud API. 
              Select a conversation to reply live to customers.
            </p>
            <div className="mt-8 flex items-center justify-center gap-2 text-xs text-[#8696a0]">
              <span className="inline-flex items-center gap-1 px-3 py-1.5 bg-white rounded-full shadow-sm">
                <Zap size={12} className="text-[#00a884]" /> Realtime Sync Active
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
