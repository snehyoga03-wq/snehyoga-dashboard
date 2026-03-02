import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Upload, Save, Calendar, User, Target, Scale, MessageCircle, Send, X, Paperclip, Image as ImageIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { getCookie } from "@/lib/cookies";

interface DailyEntry {
  day_number: number;
  entry_date: string;
  morning_meal: string;
  evening_meal: string;
  outside_food: boolean;
  snacking_between_meals: boolean;
  yoga_class_attended: boolean;
  weight_before_sleep: string;
  weight_after_yoga: string;
}

interface ChatMessage {
  id: string;
  user_phone: string;
  user_name: string;
  message: string;
  sender_type: 'user' | 'admin';
  created_at: string;
  is_read: boolean;
  attachment_url?: string;
  attachment_type?: string;
}

const FollowUp = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [isUploading, setIsUploading] = useState(false);

  // User info
  const [userPhone, setUserPhone] = useState("");
  const [userName, setUserName] = useState("");

  // Form fields
  const [admissionDate, setAdmissionDate] = useState("");
  const [startingWeight, setStartingWeight] = useState("");
  const [weightLossGoal, setWeightLossGoal] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [imagePreview, setImagePreview] = useState("");

  // Daily entries (7 days)
  const [dailyEntries, setDailyEntries] = useState<DailyEntry[]>(
    Array.from({ length: 7 }, (_, i) => ({
      day_number: i + 1,
      entry_date: "",
      morning_meal: "",
      evening_meal: "",
      outside_food: false,
      snacking_between_meals: false,
      yoga_class_attended: false,
      weight_before_sleep: "",
      weight_after_yoga: "",
    }))
  );

  // Chat state
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [isSendingMessage, setIsSendingMessage] = useState(false);
  const [isAdminTyping, setIsAdminTyping] = useState(false);
  const [isUploadingAttachment, setIsUploadingAttachment] = useState(false);
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const chatFileInputRef = useRef<HTMLInputElement>(null);
  const typingChannelRef = useRef<any>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    const phone = getCookie("userPhone");
    const name = getCookie("userName");
    if (phone) setUserPhone(phone);
    if (name) setUserName(name);
  }, []);

  // Fetch chat messages
  const fetchChatMessages = async () => {
    if (!userPhone) return;
    try {
      const { data, error } = await supabase
        .from('chat_messages')
        .select('*')
        .eq('user_phone', userPhone)
        .order('created_at', { ascending: true });
      
      if (error) throw error;
      setChatMessages((data || []) as ChatMessage[]);
    } catch (error) {
      console.error('Error fetching chat:', error);
    }
  };

  useEffect(() => {
    if (userPhone && isChatOpen) {
      fetchChatMessages();
      // Set up real-time subscription for messages
      const channel = supabase
        .channel('chat-updates')
        .on('postgres_changes', {
          event: 'INSERT',
          schema: 'public',
          table: 'chat_messages',
          filter: `user_phone=eq.${userPhone}`
        }, (payload) => {
          setChatMessages(prev => [...prev, payload.new as ChatMessage]);
        })
        .on('postgres_changes', {
          event: 'UPDATE',
          schema: 'public',
          table: 'chat_messages',
          filter: `user_phone=eq.${userPhone}`
        }, (payload) => {
          setChatMessages(prev => prev.map(msg => 
            msg.id === (payload.new as ChatMessage).id ? payload.new as ChatMessage : msg
          ));
        })
        .subscribe();

      // Set up typing indicator channel
      const typingChannel = supabase
        .channel(`typing-${userPhone}`)
        .on('presence', { event: 'sync' }, () => {
          const state = typingChannel.presenceState();
          const adminTyping = Object.values(state).some((presences: any) => 
            presences.some((p: any) => p.role === 'admin' && p.typing)
          );
          setIsAdminTyping(adminTyping);
        })
        .subscribe();

      typingChannelRef.current = typingChannel;

      return () => {
        supabase.removeChannel(channel);
        supabase.removeChannel(typingChannel);
      };
    }
  }, [userPhone, isChatOpen]);

  // Scroll to bottom when new messages arrive
  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
  }, [chatMessages]);

  // Handle typing indicator
  const handleTyping = () => {
    if (typingChannelRef.current && userPhone) {
      typingChannelRef.current.track({ role: 'user', typing: true, user_phone: userPhone });
      
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
      
      typingTimeoutRef.current = setTimeout(() => {
        typingChannelRef.current?.track({ role: 'user', typing: false, user_phone: userPhone });
      }, 2000);
    }
  };

  const sendMessage = async (attachmentUrl?: string, attachmentType?: string) => {
    if ((!newMessage.trim() && !attachmentUrl) || !userPhone) return;
    
    // Stop typing indicator
    if (typingChannelRef.current) {
      typingChannelRef.current.track({ role: 'user', typing: false, user_phone: userPhone });
    }
    
    setIsSendingMessage(true);
    try {
      const { error } = await supabase
        .from('chat_messages')
        .insert({
          user_phone: userPhone,
          user_name: userName,
          message: attachmentUrl ? (newMessage.trim() || 'Sent an attachment') : newMessage.trim(),
          sender_type: 'user',
          attachment_url: attachmentUrl || null,
          attachment_type: attachmentType || null
        });

      if (error) throw error;
      setNewMessage("");
    } catch (error) {
      console.error('Error sending message:', error);
      toast({ title: "संदेश पाठवणे अयशस्वी", variant: "destructive" });
    } finally {
      setIsSendingMessage(false);
    }
  };

  const handleChatAttachment = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !userPhone) return;

    setIsUploadingAttachment(true);
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${userPhone}_${Date.now()}.${fileExt}`;
      const filePath = `${userPhone}/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('chat-attachments')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('chat-attachments')
        .getPublicUrl(filePath);

      const attachmentType = file.type.startsWith('image/') ? 'image' : 'file';
      await sendMessage(publicUrl, attachmentType);
      
      toast({ title: "फाइल पाठवली!" });
    } catch (error) {
      console.error('Upload error:', error);
      toast({ title: "अपलोड अयशस्वी", variant: "destructive" });
    } finally {
      setIsUploadingAttachment(false);
      if (chatFileInputRef.current) {
        chatFileInputRef.current.value = '';
      }
    }
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Show preview
    const reader = new FileReader();
    reader.onloadend = () => {
      setImagePreview(reader.result as string);
    };
    reader.readAsDataURL(file);

    setIsUploading(true);
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${userPhone}_${Date.now()}.${fileExt}`;
      const filePath = `progress/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('followup-images')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('followup-images')
        .getPublicUrl(filePath);

      setImageUrl(publicUrl);
      toast({ title: "फोटो अपलोड झाला!", description: "Image uploaded successfully" });
    } catch (error) {
      console.error('Upload error:', error);
      toast({ title: "अपलोड अयशस्वी", description: "Failed to upload image", variant: "destructive" });
    } finally {
      setIsUploading(false);
    }
  };

  const updateDailyEntry = (index: number, field: keyof DailyEntry, value: any) => {
    setDailyEntries(prev => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      return updated;
    });
  };

  const handleSubmit = async () => {
    if (!userPhone) {
      toast({ title: "कृपया लॉगिन करा", variant: "destructive" });
      return;
    }

    setIsLoading(true);
    try {
      // Create report
      const { data: report, error: reportError } = await supabase
        .from('followup_reports')
        .insert({
          user_phone: userPhone,
          user_name: userName,
          admission_date: admissionDate || null,
          starting_weight: startingWeight ? parseFloat(startingWeight) : null,
          weight_loss_goal: weightLossGoal ? parseFloat(weightLossGoal) : null,
          image_url: imageUrl || null,
        })
        .select()
        .single();

      if (reportError) throw reportError;

      // Insert daily entries
      const entriesToInsert = dailyEntries
        .filter(entry => entry.entry_date || entry.morning_meal || entry.evening_meal)
        .map(entry => ({
          report_id: report.id,
          day_number: entry.day_number,
          entry_date: entry.entry_date || null,
          morning_meal: entry.morning_meal || null,
          evening_meal: entry.evening_meal || null,
          outside_food: entry.outside_food,
          snacking_between_meals: entry.snacking_between_meals,
          yoga_class_attended: entry.yoga_class_attended,
          weight_before_sleep: entry.weight_before_sleep ? parseFloat(entry.weight_before_sleep) : null,
          weight_after_yoga: entry.weight_after_yoga ? parseFloat(entry.weight_after_yoga) : null,
        }));

      if (entriesToInsert.length > 0) {
        const { error: entriesError } = await supabase
          .from('followup_daily_entries')
          .insert(entriesToInsert);

        if (entriesError) throw entriesError;
      }

      toast({ title: "अहवाल जतन झाला!", description: "Report saved successfully" });
      navigate('/dashboard');
    } catch (error) {
      console.error('Submit error:', error);
      toast({ title: "अहवाल जतन करण्यात अयशस्वी", variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background pb-24">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-background border-b p-4 flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate('/dashboard')}>
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <h1 className="text-lg font-bold">Diet Routine Report</h1>
      </div>

      <div className="max-w-2xl mx-auto p-4 space-y-6">
        {/* Profile Section */}
        <div className="bg-card rounded-xl p-4 space-y-4">
          <h2 className="font-semibold flex items-center gap-2">
            <User className="w-5 h-5 text-primary" />
            Profile Information
          </h2>
          
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Name</Label>
              <Input value={userName} disabled className="bg-muted" />
            </div>
            <div>
              <Label>Phone</Label>
              <Input value={userPhone} disabled className="bg-muted" />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div>
              <Label className="flex items-center gap-1">
                <Calendar className="w-4 h-4" /> Admission Date
              </Label>
              <Input 
                type="date" 
                value={admissionDate}
                onChange={(e) => setAdmissionDate(e.target.value)}
              />
            </div>
            <div>
              <Label className="flex items-center gap-1">
                <Scale className="w-4 h-4" /> Starting Weight (kg)
              </Label>
              <Input 
                type="number" 
                placeholder="65"
                value={startingWeight}
                onChange={(e) => setStartingWeight(e.target.value)}
              />
            </div>
            <div>
              <Label className="flex items-center gap-1">
                <Target className="w-4 h-4" /> Goal Weight (kg)
              </Label>
              <Input 
                type="number" 
                placeholder="55"
                value={weightLossGoal}
                onChange={(e) => setWeightLossGoal(e.target.value)}
              />
            </div>
          </div>

          {/* Image Upload */}
          <div>
            <Label className="flex items-center gap-1">
              <Upload className="w-4 h-4" /> Progress Photo (Optional)
            </Label>
            <div className="mt-2 flex items-center gap-4">
              {imagePreview && (
                <img src={imagePreview} alt="Preview" className="w-20 h-20 object-cover rounded-lg" />
              )}
              <label className="cursor-pointer">
                <div className="border-2 border-dashed rounded-lg p-4 text-center hover:border-primary transition-colors">
                  <Upload className="w-8 h-8 mx-auto text-muted-foreground" />
                  <p className="text-sm text-muted-foreground mt-2">
                    {isUploading ? "Uploading..." : "Click to upload"}
                  </p>
                </div>
                <input 
                  type="file" 
                  className="hidden" 
                  accept="image/*"
                  onChange={handleImageUpload}
                  disabled={isUploading}
                />
              </label>
            </div>
          </div>
        </div>

        {/* 7 Day Tracking Table */}
        <div className="bg-card rounded-xl p-4 space-y-4">
          <h2 className="font-semibold">7 Day Diet Tracking</h2>
          
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-left p-2">Day</th>
                  <th className="text-left p-2">Date</th>
                  <th className="text-left p-2">Morning</th>
                  <th className="text-left p-2">Evening</th>
                  <th className="text-center p-2">Outside Food</th>
                  <th className="text-center p-2">Snacking</th>
                  <th className="text-center p-2">Yoga</th>
                  <th className="text-left p-2">Weight (Sleep)</th>
                  <th className="text-left p-2">Weight (Yoga)</th>
                </tr>
              </thead>
              <tbody>
                {dailyEntries.map((entry, idx) => (
                  <tr key={idx} className="border-b">
                    <td className="p-2 font-medium">Day {entry.day_number}</td>
                    <td className="p-2">
                      <Input 
                        type="date" 
                        className="w-32"
                        value={entry.entry_date}
                        onChange={(e) => updateDailyEntry(idx, 'entry_date', e.target.value)}
                      />
                    </td>
                    <td className="p-2">
                      <Input 
                        placeholder="Morning meal"
                        className="w-32"
                        value={entry.morning_meal}
                        onChange={(e) => updateDailyEntry(idx, 'morning_meal', e.target.value)}
                      />
                    </td>
                    <td className="p-2">
                      <Input 
                        placeholder="Evening meal"
                        className="w-32"
                        value={entry.evening_meal}
                        onChange={(e) => updateDailyEntry(idx, 'evening_meal', e.target.value)}
                      />
                    </td>
                    <td className="p-2 text-center">
                      <Switch 
                        checked={entry.outside_food}
                        onCheckedChange={(v) => updateDailyEntry(idx, 'outside_food', v)}
                      />
                    </td>
                    <td className="p-2 text-center">
                      <Switch 
                        checked={entry.snacking_between_meals}
                        onCheckedChange={(v) => updateDailyEntry(idx, 'snacking_between_meals', v)}
                      />
                    </td>
                    <td className="p-2 text-center">
                      <Switch 
                        checked={entry.yoga_class_attended}
                        onCheckedChange={(v) => updateDailyEntry(idx, 'yoga_class_attended', v)}
                      />
                    </td>
                    <td className="p-2">
                      <Input 
                        type="number"
                        placeholder="kg"
                        className="w-20"
                        value={entry.weight_before_sleep}
                        onChange={(e) => updateDailyEntry(idx, 'weight_before_sleep', e.target.value)}
                      />
                    </td>
                    <td className="p-2">
                      <Input 
                        type="number"
                        placeholder="kg"
                        className="w-20"
                        value={entry.weight_after_yoga}
                        onChange={(e) => updateDailyEntry(idx, 'weight_after_yoga', e.target.value)}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Submit Button */}
        <Button 
          className="w-full gradient-bg" 
          size="lg"
          onClick={handleSubmit}
          disabled={isLoading}
        >
          <Save className="w-5 h-5 mr-2" />
          {isLoading ? "Saving..." : "Save Report"}
        </Button>
      </div>

      {/* Floating Chat Button */}
      <Button
        className="fixed bottom-6 right-6 rounded-full w-14 h-14 shadow-lg"
        onClick={() => setIsChatOpen(true)}
      >
        <MessageCircle className="w-6 h-6" />
      </Button>

      {/* Chat Dialog */}
      {isChatOpen && (
        <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center p-4">
          <div className="absolute inset-0 bg-black/50" onClick={() => setIsChatOpen(false)} />
          <div className="relative bg-background rounded-t-2xl sm:rounded-2xl w-full max-w-md h-[70vh] flex flex-col">
            {/* Chat Header */}
            <div className="flex items-center justify-between p-4 border-b">
              <h3 className="font-semibold">Chat with Admin</h3>
              <Button variant="ghost" size="icon" onClick={() => setIsChatOpen(false)}>
                <X className="w-5 h-5" />
              </Button>
            </div>

            {/* Messages */}
            <div 
              ref={chatContainerRef}
              className="flex-1 overflow-y-auto p-4 space-y-3"
            >
              {chatMessages.length === 0 && (
                <div className="text-center text-muted-foreground py-8">
                  <MessageCircle className="w-12 h-12 mx-auto mb-2 opacity-50" />
                  <p>No messages yet. Start a conversation!</p>
                </div>
              )}
              {chatMessages.map((msg) => (
                <div 
                  key={msg.id}
                  className={`flex ${msg.sender_type === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  <div className={`max-w-[80%] p-3 rounded-lg ${
                    msg.sender_type === 'user' 
                      ? 'bg-primary text-primary-foreground' 
                      : 'bg-muted'
                  }`}>
                    {msg.attachment_url && (
                      msg.attachment_type === 'image' ? (
                        <img 
                          src={msg.attachment_url} 
                          alt="Attachment" 
                          className="max-h-40 rounded mb-2 cursor-pointer"
                          onClick={() => window.open(msg.attachment_url, '_blank')}
                        />
                      ) : (
                        <a 
                          href={msg.attachment_url} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="flex items-center gap-2 text-sm underline mb-2"
                        >
                          📎 View File
                        </a>
                      )
                    )}
                    <p className="text-sm">{msg.message}</p>
                    <p className="text-xs opacity-70 mt-1">
                      {new Date(msg.created_at).toLocaleTimeString()}
                    </p>
                  </div>
                </div>
              ))}
              {isAdminTyping && (
                <div className="flex justify-start">
                  <div className="bg-muted px-4 py-2 rounded-lg">
                    <span className="text-sm text-muted-foreground">Admin is typing...</span>
                  </div>
                </div>
              )}
            </div>

            {/* Input */}
            <div className="p-4 border-t flex gap-2">
              <input 
                type="file"
                ref={chatFileInputRef}
                onChange={handleChatAttachment}
                className="hidden"
                accept="image/*,.pdf,.doc,.docx"
              />
              <Button 
                variant="outline" 
                size="icon"
                onClick={() => chatFileInputRef.current?.click()}
                disabled={isUploadingAttachment}
              >
                {isUploadingAttachment ? (
                  <span className="animate-spin">⏳</span>
                ) : (
                  <Paperclip className="w-4 h-4" />
                )}
              </Button>
              <Input
                placeholder="Type a message..."
                value={newMessage}
                onChange={(e) => {
                  setNewMessage(e.target.value);
                  handleTyping();
                }}
                onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && sendMessage()}
              />
              <Button 
                onClick={() => sendMessage()}
                disabled={isSendingMessage || !newMessage.trim()}
              >
                <Send className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default FollowUp;
