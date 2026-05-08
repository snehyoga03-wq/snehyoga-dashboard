// Dashboard.jsx — Minimalist View
import { Menu, User, Calendar, Copy, Share2, Gift, PlayCircle, PauseCircle, Download, FileText, MessageSquare, Shield, LogOut, Users, Link2, ArrowRight, Check, Lock, Clock, Sunrise, Sun, Moon } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { useNavigate } from "react-router-dom";
import { useEffect, useState, useRef } from "react";
import { useToast } from "@/hooks/use-toast";
import { getCookie, deleteCookie } from "@/lib/cookies";
import { supabase } from "@/integrations/supabase/client";
import { AttendanceTracker } from "@/components/AttendanceTracker";

// Normalize referral link to always use the current site's domain
const normalizeReferralLink = (link: string): string => {
  try {
    const url = new URL(link);
    const ref = url.searchParams.get('ref');
    if (ref) {
      return `${window.location.origin}/?ref=${ref}`;
    }
  } catch { }
  return link;
};

const getYoutubeThumbnail = (url: string | null) => {
  if (!url) return null;
  const match = url.match(/(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=))([^&?]+)/);
  if (match && match[1]) {
    return `https://img.youtube.com/vi/${match[1]}/maxresdefault.jpg`;
  }
  return null;
};

const Dashboard = () => {
  const navigate = useNavigate();
  const { toast } = useToast();

  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [userName, setUserName] = useState("");
  const [userPhone, setUserPhone] = useState("");
  const [daysLeft, setDaysLeft] = useState<number | null>(null);
  const [batchTiming, setBatchTiming] = useState<string | null>(null);
  const [sessionLink, setSessionLink] = useState<string | null>(null);
  const [subscriptionPaused, setSubscriptionPaused] = useState(false);
  const [isResuming, setIsResuming] = useState(false);
  const [referralLink, setReferralLink] = useState("");
  const [referralStats, setReferralStats] = useState({ totalReferrals: 0, daysEarned: 0 });
  const [subscriptionPlan, setSubscriptionPlan] = useState<string | null>(null);
  const [totalAttendedDays, setTotalAttendedDays] = useState<number>(0);
  const [isLive, setIsLive] = useState(false);
  const activeSlotRef = useRef<string | null>(null);

  useEffect(() => {
    const checkLiveStatus = async () => {
      const now = new Date();
      const cur = now.getHours() * 60 + now.getMinutes();

      const slots = [
        { slot: '5am', start: 5 * 60 },
        { slot: '6am', start: 6 * 60 },
        { slot: '8am', start: 8 * 60 },
        { slot: '5pm', start: 17 * 60 },
        { slot: '6pm', start: 18 * 60 },
        { slot: '7pm', start: 19 * 60 },
      ];

      let newActiveSlot = null;
      for (const s of slots) {
        // A session is considered live from 20 mins before its start time until 60 mins after
        if (cur >= s.start - 20 && cur < s.start + 60) {
          newActiveSlot = s.slot;
          break;
        }
      }

      if (newActiveSlot) {
        setIsLive(true);
        // Only fetch if the slot just changed to avoid spamming the DB
        if (activeSlotRef.current !== newActiveSlot) {
          activeSlotRef.current = newActiveSlot;
          const days = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
          const todayStr = days[now.getDay()];

          const { data: settings } = await supabase.from('session_settings').select('session_link').maybeSingle();
          let activeWeek = 1;
          let legacyLink = null;

          if (settings?.session_link?.startsWith('{')) {
            try { activeWeek = JSON.parse(settings.session_link).active_week || 1; } catch (e) { }
          } else if (settings?.session_link) {
            legacyLink = settings.session_link;
          }

          if (legacyLink) {
            setSessionLink(legacyLink);
          } else {
            const { data: batchLinks } = await supabase
              .from('session_batch_links')
              .select('link')
              .eq('day', todayStr)
              .eq('week', activeWeek)
              .eq('batch_slot', newActiveSlot)
              .maybeSingle();

            if (batchLinks?.link) {
              setSessionLink(batchLinks.link);
            } else {
              setSessionLink(null);
            }
          }
        }
      } else {
        setIsLive(false);
        activeSlotRef.current = null;
        setSessionLink(null);
      }
    };

    checkLiveStatus();
    const interval = setInterval(checkLiveStatus, 60000);
    return () => clearInterval(interval);
  }, []);

  // Load user data
  // Load user data & Calculate Days Left
  useEffect(() => {
    const name = getCookie('userName');
    const phone = getCookie('userPhone');

    if (!name || !phone) {
      navigate('/');
      return;
    }

    setUserName(name);
    setUserPhone(phone);

    const syncDaysLeft = async () => {
      try {
        console.log("syncDaysLeft: Looking up phone:", phone);

        // Fetch User Data (NOTE: last_deduction_date does NOT exist in DB, so we exclude it)
        const { data: userData, error: userError } = await supabase
          .from('main_data_registration')
          .select('id, days_left, subscription_paused, batch_timing, subscription_plan, referral_link')
          .eq('mobile_number', phone)
          .single();

        console.log("syncDaysLeft: DB result:", { userData, userError });

        if (userError) throw userError;
        if (!userData) {
          console.warn("syncDaysLeft: No user found for phone:", phone);
          return;
        }

        const { id, days_left, subscription_paused, batch_timing, subscription_plan, referral_link } = userData;

        // Update local state
        setBatchTiming(batch_timing);
        setDaysLeft(days_left ?? 0);
        setSubscriptionPaused(subscription_paused ?? false);
        setSubscriptionPlan(subscription_plan);
        if (referral_link) setReferralLink(normalizeReferralLink(referral_link));

        // Fetch referral stats
        const { data: referrals } = await supabase
          .from('referrals')
          .select('id')
          .eq('referrer_mobile', phone);

        if (referrals) {
          setReferralStats({
            totalReferrals: referrals.length,
            daysEarned: referrals.length * 1
          });
        }

        // Fetch total attended days
        const { count: attendedCount } = await supabase
          .from('attendance')
          .select('*', { count: 'exact', head: true })
          .eq('mobile_number', phone);
        if (attendedCount !== null) {
          setTotalAttendedDays(attendedCount);
        }

      } catch (err) {
        console.error("Error syncing days left:", err);
      }
    };

    syncDaysLeft();
  }, [navigate, toast]);

  const handleLogout = () => {
    deleteCookie('userName');
    deleteCookie('userPhone');
    deleteCookie('attendance');
    deleteCookie('attendanceWeek');
    deleteCookie('whatsappGroupJoined');
    navigate('/');
    toast({ title: "Logged out", description: "See you soon! 🙏" });
  };

  const getNextSessionText = () => {
    const cur = new Date().getHours() * 60 + new Date().getMinutes();
    if (cur < 5 * 60) return "5:00 AM";
    if (cur < 6 * 60) return "6:00 AM";
    if (cur < 8 * 60) return "8:00 AM";
    if (cur < 17 * 60) return "5:00 PM";
    if (cur < 18 * 60) return "6:00 PM";
    if (cur < 19 * 60) return "7:00 PM";
    return "5:00 AM"; // After 7pm, next is 5am tomorrow
  };

  return (
    <div className="min-h-screen relative bg-[#faf9f6]">
      {/* Top Accent Line */}
      <div className="h-1.5 bg-gradient-to-r from-orange-400 via-pink-500 to-purple-600 w-full absolute top-0 left-0 z-10"></div>

      {/* Subtle Background Elements */}
      <div className="absolute top-0 right-0 w-64 h-64 bg-orange-200/20 rounded-full blur-3xl -z-0 pointer-events-none"></div>
      <div className="absolute top-40 left-0 w-72 h-72 bg-purple-200/20 rounded-full blur-3xl -z-0 pointer-events-none"></div>

      {/* Left slide-out sheet for profile menu */}
      <Sheet open={isMenuOpen} onOpenChange={setIsMenuOpen}>
        <SheetContent side="left" className="w-[300px] sm:w-[360px] bg-[#faf9f6]/95 backdrop-blur-xl border-r-0 shadow-2xl overflow-y-auto">
          <SheetHeader className="pb-6">
            <SheetTitle className="flex flex-col items-start gap-1">
              <p className="font-bold text-gray-900 text-lg leading-tight">{userName}</p>
              <p className="text-sm text-gray-500 font-medium">{userPhone}</p>
            </SheetTitle>
          </SheetHeader>

          <div className="mt-2 space-y-6">
            <div className="space-y-3">
              <div className="bg-white rounded-full px-5 py-3 shadow-sm border border-gray-100 flex justify-center font-bold text-sm text-[#006699]">
                Total Attended Days : {totalAttendedDays}
              </div>
              <div className="bg-white rounded-full px-5 py-3 shadow-sm border border-gray-100 flex justify-center font-bold text-sm text-[#006699]">
                Your Subscription : {daysLeft !== null ? daysLeft : 0} Days left
              </div>
            </div>

            {/* QR Code Section */}
            <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-300 text-center space-y-4">
              <h3 className="font-bold text-base text-[#4a2b63]">Personal Invite QR Code</h3>
              <p className="text-xs text-gray-600">Ask your friends to scan and gift<br /><span className="font-bold text-gray-800">14 Days</span> of <span className="font-bold text-gray-800">FREE ONLINE YOGA</span></p>

              <div className="flex justify-center bg-white p-2 rounded-xl">
                <img src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(referralLink || "https://yoga.snehyoga.com")}`} alt="QR Code" className="w-48 h-48" />
              </div>

              <Button
                className="w-full bg-[#006699] hover:bg-[#005580] text-white rounded-full font-bold"
                onClick={() => {
                  window.open(`https://api.qrserver.com/v1/create-qr-code/?size=500x500&data=${encodeURIComponent(referralLink || "https://yoga.snehyoga.com")}`, '_blank');
                }}
              >
                Download QR Poster
              </Button>
            </div>

            {/* Links Section */}
            <div className="space-y-1 pt-2 border-t border-gray-100">
              <button className="flex items-center gap-3 w-full p-3 text-left hover:bg-gray-50 rounded-xl transition-colors text-gray-700 font-medium text-sm">
                <User className="w-5 h-5 text-gray-600" />
                My Account
              </button>
              <button className="flex items-center gap-3 w-full p-3 text-left hover:bg-gray-50 rounded-xl transition-colors text-gray-700 font-medium text-sm">
                <MessageSquare className="w-5 h-5 text-gray-600" />
                FAQs
              </button>
              <button className="flex items-center gap-3 w-full p-3 text-left hover:bg-gray-50 rounded-xl transition-colors text-gray-700 font-medium text-sm">
                <FileText className="w-5 h-5 text-gray-600" />
                Refund Policy
              </button>
              <button className="flex items-center gap-3 w-full p-3 text-left hover:bg-gray-50 rounded-xl transition-colors text-gray-700 font-medium text-sm">
                <FileText className="w-5 h-5 text-gray-600" />
                Terms of Use
              </button>
              <button className="flex items-center gap-3 w-full p-3 text-left hover:bg-gray-50 rounded-xl transition-colors text-gray-700 font-medium text-sm">
                <Shield className="w-5 h-5 text-gray-600" />
                Privacy Policy
              </button>
              <button onClick={handleLogout} className="flex items-center gap-3 w-full p-3 text-left hover:bg-red-50 rounded-xl transition-colors text-gray-700 font-medium text-sm mt-2">
                <LogOut className="w-5 h-5 text-gray-600" />
                Logout
              </button>
            </div>
          </div>
        </SheetContent>
      </Sheet>

      {/* Main Content */}
      <div className="max-w-md mx-auto space-y-7 pt-6 px-5 relative z-10 pb-10">
        {/* Header */}
        <div className="flex items-center justify-between pb-2 pt-2">
          <div className="flex items-center gap-3">
            <button onClick={() => setIsMenuOpen(true)} className="p-1 -ml-1 text-foreground/80 hover:text-foreground">
              <Menu className="w-6 h-6" />
            </button>
            <div className="flex flex-col">
              <span className="text-[13px] text-muted-foreground font-medium leading-none tracking-wide">Namaste,</span>
              <span className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-orange-600 to-amber-700 leading-tight mt-0.5">{userName || "User"}</span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="text-right">
              <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest content-end">Days Left</p>
              <p className="text-2xl font-black text-gray-800 leading-none">{daysLeft !== null ? daysLeft : "-"}</p>
            </div>
            <Button
              size="sm"
              className="h-9 px-4 rounded-full bg-gradient-to-r from-amber-400 to-orange-400 hover:from-amber-500 hover:to-orange-500 text-white font-bold shadow-md shadow-orange-500/20 transition-all hover:scale-105"
              onClick={() => navigate('/pricing')}
            >
              Plus ✨
            </Button>
          </div>
        </div>

        {/* Attendance Tracker */}
        <AttendanceTracker />

        {/* Dynamic Session Card */}
        {subscriptionPaused ? (
          <div className="bg-white rounded-[24px] p-6 shadow-[0_4px_20px_rgba(0,0,0,0.04)] border border-gray-100 mb-8 flex flex-col items-center text-center">
            <div className="w-16 h-16 rounded-full bg-red-50 flex items-center justify-center mb-4">
              <PauseCircle className="w-8 h-8 text-red-500" />
            </div>
            <h3 className="text-xl font-bold text-gray-900 mb-2">Subscription Paused</h3>
            <p className="text-sm text-gray-500 mb-6">Resume your subscription to join live yoga sessions.</p>
            <Button
              size="lg"
              disabled={isResuming}
              className="w-full h-14 bg-gradient-to-r from-green-600 to-emerald-500 hover:from-green-700 hover:to-emerald-600 text-white shadow-lg shadow-green-500/25 rounded-xl font-bold tracking-wide text-base"
              onClick={async () => {
                setIsResuming(true);
                try {
                  const { error } = await supabase
                    .from('main_data_registration')
                    .update({ subscription_paused: false })
                    .eq('mobile_number', userPhone);
                  if (error) throw error;
                  setSubscriptionPaused(false);
                  toast({ title: "Subscription Resumed ✅", description: "Welcome back! You can now join sessions." });
                } catch (err) {
                  console.error("Failed to resume subscription:", err);
                  toast({ title: "Error", description: "Could not resume. Please try again.", variant: "destructive" });
                } finally {
                  setIsResuming(false);
                }
              }}
            >
              <PlayCircle className="w-5 h-5 mr-2" />
              {isResuming ? "Resuming..." : "Resume Subscription"}
            </Button>
          </div>
        ) : isLive ? (
          <div className="bg-white rounded-[24px] p-4 shadow-[0_8px_30px_rgba(0,0,0,0.06)] border border-gray-100 mb-8 space-y-4">

            {/* Header Area */}
            <div className="flex items-center justify-between px-2 pt-1">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-[#1c1c1c] flex items-center justify-center">
                  <span className="text-[#fdbd2c] text-xl">🧘</span>
                </div>
                <div>
                  <h3 className="font-black text-gray-900 text-[17px] leading-tight tracking-tight">Your Yoga Session</h3>
                  <p className="text-gray-500 text-[13px] font-medium">Live Guided Session</p>
                </div>
              </div>
              <div className="flex items-center gap-1.5 bg-red-50 text-red-600 px-3 py-1.5 rounded-full">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500"></span>
                </span>
                <span className="text-[11px] font-black tracking-widest">LIVE</span>
              </div>
            </div>

            {/* Main Image Banner */}
            <div className="relative rounded-[20px] overflow-hidden aspect-[4/3] sm:aspect-[16/9] w-full shadow-md">
              <img
                src={getYoutubeThumbnail(sessionLink) || "https://images.unsplash.com/photo-1544367567-0f2fcb009e0b?q=80&w=1000&auto=format&fit=crop"}
                alt="Yoga Sunset"
                className="absolute inset-0 w-full h-full object-cover"
              />

              {/* Gradient overlay for text readability */}
              <div className="absolute inset-0 bg-gradient-to-r from-black/90 via-black/50 to-transparent"></div>

              {/* Content overlay */}
              <div className="relative z-10 p-5 h-full flex flex-col justify-between">
                <div>
                  <div className="inline-flex items-center gap-1.5 bg-white/10 backdrop-blur-md border border-white/10 px-2.5 py-1 rounded-full mb-4">
                    <div className="w-1.5 h-1.5 rounded-full bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.8)]"></div>
                    <span className="text-white text-[10px] font-medium"><span className="text-red-400 font-bold">Live</span> session is active</span>
                  </div>

                  <h2 className="text-3xl font-black text-white leading-tight mb-0.5 tracking-wide">
                    Find Balance,<br />
                    <span className="text-[#fdbd2c]">Find You</span>
                  </h2>
                  <div className="w-8 h-0.5 bg-[#fdbd2c] my-3 rounded-full"></div>

                  <p className="text-gray-200 text-[11px] font-medium max-w-[180px] leading-relaxed">
                    Relax your mind, strengthen your body, and uplift your soul.
                  </p>
                </div>

                {/* Clock Badge */}
                <div className="inline-flex items-center gap-3 bg-black/40 backdrop-blur-md border border-white/10 rounded-full px-4 py-2 mt-4 self-start">
                  <Clock className="w-5 h-5 text-[#fdbd2c]" />
                  <div className="flex flex-col">
                    <span className="text-gray-300 text-[9px] uppercase tracking-wider font-semibold leading-none mb-1">Next session at</span>
                    <span className="text-[#fdbd2c] font-black text-sm leading-none">{batchTiming?.match(/\d+:\d+\s*[A-Z]+/i)?.[0] || '7:00 PM'}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Bottom Join Button */}
            <button
              className="w-full relative overflow-hidden group bg-gradient-to-r from-[#fdbd2c] to-[#e89a05] hover:to-[#db9104] rounded-[20px] p-4 flex items-center shadow-[0_8px_20px_rgba(253,189,44,0.3)] transition-transform active:scale-[0.98]"
              onClick={async () => {
                try {
                  await supabase.from('attendance').insert({ mobile_number: userPhone });
                  toast({ title: "Attendance Marked ✅", description: "Joining session..." });
                } catch (err) { }
                const refMatch = referralLink?.match(/ref=([^&]+)/);
                const slug = refMatch?.[1];
                window.open(slug ? `https://yoga.snehyoga.com/join/${slug}` : (sessionLink || '#'), '_blank');
              }}
            >
              {/* Subtle pattern on the right */}
              <div className="absolute right-[-10px] bottom-[-20px] opacity-10 pointer-events-none group-hover:scale-110 transition-transform duration-500 text-amber-900">
                <svg width="120" height="120" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M12 2C12 2 15 8 15 12C15 16 12 22 12 22C12 22 9 16 9 12C9 8 12 2 12 2ZM12 4.5C12 4.5 13.5 9 13.5 12C13.5 15 12 19.5 12 19.5C12 19.5 10.5 15 10.5 12C10.5 9 12 4.5 12 4.5Z" fill="currentColor" />
                  <path d="M6 7C6 7 10 11 10 15C10 19 6 22 6 22C6 22 2 19 2 15C2 11 6 7 6 7Z" fill="currentColor" />
                  <path d="M18 7C18 7 14 11 14 15C14 19 18 22 18 22C18 22 22 19 22 15C22 11 18 7 18 7Z" fill="currentColor" />
                </svg>
              </div>

              <div className="flex items-center gap-4 relative z-10 w-full justify-center sm:justify-start sm:px-4">
                <div className="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center shrink-0 border border-white/30">
                  <div className="w-8 h-8 bg-[#2d2d2d] rounded-full flex items-center justify-center pl-0.5 shadow-sm">
                    <div className="w-0 h-0 border-t-[5px] border-t-transparent border-l-[8px] border-l-[#fdbd2c] border-b-[5px] border-b-transparent"></div>
                  </div>
                </div>

                <div className="flex flex-col text-left">
                  <span className="text-gray-900 font-black text-[17px] tracking-tight leading-none mb-1">JOIN SESSION</span>
                  <span className="text-gray-800/80 text-[11px] font-semibold leading-none">Tap to join the live session</span>
                </div>
              </div>
            </button>

          </div>
        ) : (
          <div className="bg-[#18181a] rounded-[24px] shadow-[0_8px_30px_rgba(0,0,0,0.12)] overflow-hidden relative mb-8">
            
            {/* Background Image with Curved Mask */}
            <div className="absolute top-0 right-0 w-[60%] h-full pointer-events-none">
              <div className="absolute inset-0 bg-gradient-to-r from-[#18181a] via-[#18181a]/90 to-transparent z-10 w-full h-full"></div>
              <img 
                src="https://images.unsplash.com/photo-1544367567-0f2fcb009e0b?q=80&w=1000&auto=format&fit=crop" 
                alt="Yoga Background" 
                className="w-full h-full object-cover opacity-60"
                style={{ maskImage: 'radial-gradient(150% 150% at 0% 50%, transparent 35%, black 55%)', WebkitMaskImage: 'radial-gradient(150% 150% at 0% 50%, transparent 35%, black 55%)' }}
              />
            </div>

            {/* Top "LIVE" pill */}
            <div className="absolute top-4 right-4 z-20">
              <div className="flex items-center gap-1.5 bg-black/40 backdrop-blur-md text-white px-3 py-1.5 rounded-full border border-white/10">
                <span className="w-2 h-2 rounded-full bg-red-500"></span>
                <span className="text-[11px] font-bold tracking-widest">LIVE</span>
              </div>
            </div>

            {/* Main Content Area */}
            <div className="relative z-20 p-6 md:p-8">
              
              <div className="flex flex-col md:flex-row gap-6 md:items-center">
                {/* Circle Badge */}
                <div className="w-[100px] h-[100px] rounded-full border border-gray-500 bg-[#161c2d] flex flex-col items-center justify-center shrink-0 shadow-lg relative">
                  <svg className="w-5 h-5 text-[#fdbd2c] mb-1.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="10"></circle>
                    <line x1="4.93" y1="4.93" x2="19.07" y2="19.07"></line>
                  </svg>
                  <span className="text-white text-[11px] font-bold leading-tight text-center">
                    No Yoga<br/>Sessions<br/>
                    <span className="text-[#fdbd2c]">Right Now</span>
                  </span>
                  
                  {/* Golden leaves decoration SVG */}
                  <div className="absolute -bottom-6 -left-6 w-14 h-14 text-[#9a7b4f] pointer-events-none opacity-80 -z-10">
                    <svg viewBox="0 0 24 24" fill="currentColor" transform="rotate(-30)">
                       <path d="M12 21C12 21 7 16 7 10C7 6 10 3 12 3C14 3 17 6 17 10C17 16 12 21 12 21Z" />
                    </svg>
                  </div>
                </div>

                {/* Typography */}
                <div className="pt-2">
                  <h2 className="text-3xl md:text-4xl font-black text-white leading-tight tracking-wide mb-1">
                    Next Session Live<br/>
                    <span className="text-[#fdbd2c]">at {getNextSessionText()}</span>
                  </h2>
                  
                  <div className="flex items-center gap-3 my-4">
                    <div className="h-px bg-gray-600/60 w-16"></div>
                    {/* Lotus Icon */}
                    <div className="text-[#fdbd2c]">
                      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                        <path d="M12 2C12 2 15 8 15 12C15 16 12 22 12 22C12 22 9 16 9 12C9 8 12 2 12 2ZM12 4.5C12 4.5 13.5 9 13.5 12C13.5 15 12 19.5 12 19.5C12 19.5 10.5 15 10.5 12C10.5 9 12 4.5 12 4.5Z"/>
                      </svg>
                    </div>
                    <div className="h-px bg-gray-600/60 w-16"></div>
                  </div>
                  
                  <p className="text-gray-300 text-[15px] font-medium">Open the link during live timings</p>
                </div>
              </div>
            </div>

            {/* Bottom White Container with 3 Timings */}
            <div className="relative z-20 bg-white rounded-[20px] mx-4 mb-4 p-5 flex items-center justify-between">
              
              {/* Time Slot 1 */}
              <div className="flex flex-col items-center flex-1">
                <div className="w-12 h-12 rounded-full bg-amber-50 flex items-center justify-center mb-2">
                  <Sunrise className="w-6 h-6 text-amber-500" strokeWidth={1.5} />
                </div>
                <span className="text-[#fdbd2c] font-black text-sm md:text-base">{new Date().getHours() < 12 ? '5:00 AM' : '5:00 PM'}</span>
                <div className="w-6 h-[3px] bg-[#fdbd2c] rounded-full mt-1.5"></div>
              </div>

              {/* Separator */}
              <div className="relative flex flex-col items-center px-2">
                <div className="h-10 border-l border-gray-200"></div>
                <div className="absolute top-1/2 -translate-y-1/2 w-7 h-7 bg-white border border-gray-200 rounded-full flex items-center justify-center text-gray-400 text-[10px] font-bold">or</div>
              </div>

              {/* Time Slot 2 */}
              <div className="flex flex-col items-center flex-1">
                <div className="w-12 h-12 rounded-full bg-amber-50 flex items-center justify-center mb-2">
                  <Sun className="w-6 h-6 text-amber-500" strokeWidth={1.5} />
                </div>
                <span className="text-[#fdbd2c] font-black text-sm md:text-base">{new Date().getHours() < 12 ? '6:00 AM' : '6:00 PM'}</span>
                <div className="w-6 h-[3px] bg-[#fdbd2c] rounded-full mt-1.5"></div>
              </div>

              {/* Separator */}
              <div className="relative flex flex-col items-center px-2">
                <div className="h-10 border-l border-gray-200"></div>
                <div className="absolute top-1/2 -translate-y-1/2 w-7 h-7 bg-white border border-gray-200 rounded-full flex items-center justify-center text-gray-400 text-[10px] font-bold">or</div>
              </div>

              {/* Time Slot 3 */}
              <div className="flex flex-col items-center flex-1">
                <div className="w-12 h-12 rounded-full bg-amber-50 flex items-center justify-center mb-2">
                  {new Date().getHours() < 12 ? (
                     <Sun className="w-6 h-6 text-amber-500" strokeWidth={1.5} />
                  ) : (
                     <Moon className="w-6 h-6 text-amber-500" strokeWidth={1.5} />
                  )}
                </div>
                <span className="text-[#fdbd2c] font-black text-sm md:text-base">{new Date().getHours() < 12 ? '8:00 AM' : '7:00 PM'}</span>
                <div className="w-6 h-[3px] bg-[#fdbd2c] rounded-full mt-1.5"></div>
              </div>

            </div>
          </div>
        )}

        {/* My Rewards */}
        {(() => {
          const r = referralStats.totalReferrals;
          let currentLevel = 0, nextLevel = 1, nextGoal = 5, prevGoal = 0, rewardText = "7 Yoga Days!";
          if (r >= 25) { currentLevel = 3; nextLevel = 3; nextGoal = 25; prevGoal = 25; rewardText = "Max Level Reached!"; }
          else if (r >= 10) { currentLevel = 2; nextLevel = 3; nextGoal = 25; prevGoal = 10; rewardText = "30 Yoga Days!"; }
          else if (r >= 5) { currentLevel = 1; nextLevel = 2; nextGoal = 10; prevGoal = 5; rewardText = "15 Yoga Days!"; }

          const invitesAway = Math.max(0, nextGoal - r);
          const progressCurrent = r - prevGoal;
          const progressTotal = nextGoal - prevGoal;

          return (
            <div className="space-y-4 mb-6">
              {/* Header */}
              <div className="flex items-center gap-2 px-1 mb-2">
                <div className="w-8 h-8 flex items-center justify-center text-2xl">🎁</div>
                <h3 className="font-bold text-[#001f3f] text-lg">My Rewards</h3>
              </div>

              {/* Rewards Card */}
              <div className="bg-white rounded-[20px] p-6 shadow-[0_2px_15px_rgba(0,0,0,0.04)] border border-gray-100">
                <div className="flex justify-between items-center mb-6">
                  <span className="text-sm text-[#001f3f] font-medium">Total Invites</span>
                  <span className="text-sm text-[#001f3f] font-bold">{r} Invites</span>
                </div>

                {r < 25 ? (
                  <>
                    <div className="mb-1">
                      <span className="text-[15px] text-gray-600">You're <span className="font-bold text-[#001f3f]">{invitesAway} Invites</span> Away from</span>
                    </div>
                    <div className="mb-8">
                      <span className="text-lg font-bold text-[#001f3f]">{rewardText} 🎉</span>
                    </div>
                  </>
                ) : (
                  <div className="mb-8">
                    <span className="text-lg font-bold text-[#001f3f]">You've reached the Max Level! 🏆</span>
                  </div>
                )}

                <div className="flex justify-end mb-2.5">
                  <span className="text-[11px] font-bold text-[#001f3f]">{r} / {nextGoal} Invites</span>
                </div>

                <div className="flex gap-1.5 h-2.5 mb-6">
                  {Array.from({ length: progressTotal === 0 ? 1 : progressTotal }).map((_, i) => (
                    <div key={i} className={`flex-1 rounded-full ${progressTotal === 0 || i < progressCurrent ? 'bg-[#4db6ac]' : 'bg-[#cfd8dc]'}`}></div>
                  ))}
                </div>

                <div className="flex justify-between items-center pt-2">
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-full bg-[#f5a623] flex items-center justify-center shadow-sm">
                      <Check className="w-4 h-4 text-white stroke-[3]" />
                    </div>
                    <span className="text-sm font-bold text-[#001f3f]">Level {currentLevel}</span>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-[#001f3f]">Level {nextLevel}</span>
                    <div className="w-6 h-6 rounded-full bg-gradient-to-b from-gray-100 to-gray-200 flex items-center justify-center shadow-inner border border-gray-300/50">
                      <Lock className="w-3 h-3 text-gray-500" />
                    </div>
                  </div>
                </div>
              </div>

              {/* Referral Link */}
              <div className="bg-[#f4fdf7] rounded-[20px] p-5 border border-green-100">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-8 h-8 rounded-full bg-green-100/50 flex items-center justify-center shrink-0">
                    <Link2 className="w-4 h-4 text-[#16a34a]" />
                  </div>
                  <div>
                    <h4 className="font-bold text-gray-800 text-sm">Your Referral Link</h4>
                    <p className="text-xs text-gray-500">Share your link and start earning!</p>
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row gap-3">
                  <div className="flex-1 flex items-center bg-white border border-gray-200 rounded-xl pl-4 pr-1 h-12 shadow-sm min-w-0">
                    <span className="text-sm text-gray-500 truncate flex-1 font-medium">{referralLink || "Loading..."}</span>
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(referralLink);
                        toast({ title: "Copied! 📋", description: "Link copied to clipboard!" });
                      }}
                      className="p-2 hover:bg-gray-100 rounded-lg transition-colors ml-2 shrink-0"
                    >
                      <Copy className="w-4 h-4 text-gray-400" />
                    </button>
                  </div>
                  <Button
                    className="bg-[#25D366] hover:bg-[#128C7E] text-white shadow-md shadow-green-500/20 font-bold rounded-xl whitespace-nowrap h-12 px-6 shrink-0"
                    onClick={() => {
                      const shareText = `🧘 Snehyoga सह मोफत योगा क्लासेस! माझ्या लिंकवरून जॉईन करा आणि 1 दिवस मोफत मिळवा: ${referralLink}`;
                      window.open(`https://wa.me/?text=${encodeURIComponent(shareText)}`, '_blank');
                    }}
                  >
                    <Share2 className="w-4 h-4 mr-2" /> Share Link
                  </Button>
                </div>
              </div>

              {/* View All */}
              <Button
                variant="outline"
                className="w-full bg-white hover:bg-gray-50 border border-gray-200 text-[#001f3f] font-bold rounded-xl h-12 shadow-sm transition-colors"
                onClick={() => navigate('/referral')}
              >
                View All Referrals <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </div>
          );
        })()}

        {/* Diet Plan Section */}
        <div className="relative overflow-hidden rounded-2xl border border-white/60 bg-white/80 backdrop-blur-xl shadow-lg shadow-gray-200/50 mb-6 group">
          <div className="p-5 space-y-4">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-orange-50 flex items-center justify-center">
                <FileText className="w-4 h-4 text-orange-500" />
              </div>
              <h3 className="font-bold text-gray-800 text-lg">Your Diet Plan</h3>
            </div>

            <div className="rounded-xl border border-orange-100 bg-gradient-to-br from-orange-50 to-amber-50 p-5 shadow-inner">
              <p className="text-gray-700 font-medium mb-4 text-sm text-center">
                Access your personalized diet plans and documents through the SAP portal! 🥗✨
              </p>
              <Button
                className="w-full h-12 bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white shadow-xl shadow-orange-500/30 rounded-full font-bold tracking-wide transition-all transform hover:-translate-y-1 hover:scale-[1.03] duration-300"
                onClick={() => navigate('/sap')}
              >
                <FileText className="w-5 h-5 mr-2" />
                Open SAP Portal
              </Button>
            </div>
          </div>
        </div>

        {/* Plan Details Card */}
        <div className="relative overflow-hidden rounded-2xl border border-white/60 bg-white/80 backdrop-blur-xl shadow-lg shadow-gray-200/50 mb-6">
          <div className="p-5">
            <h3 className="font-bold text-gray-800 mb-5 flex items-center gap-2 text-base">
              <div className="w-8 h-8 rounded-full bg-orange-50 flex items-center justify-center">
                <Calendar className="w-4 h-4 text-orange-500" />
              </div>
              Your Plan Details
            </h3>

            <div className="space-y-4">
              <div className="flex justify-between items-center pb-3 border-b border-gray-50">
                <span className="text-sm text-gray-500 font-medium">Current Plan</span>
                <span className="font-bold text-gray-900 bg-gradient-to-r from-orange-50 to-amber-50 px-3 py-1 rounded-full border border-orange-100/50 text-xs text-orange-700 shadow-sm">{subscriptionPlan || 'No Active Plan'}</span>
              </div>

              <div className="flex justify-between items-center pb-3 border-b border-gray-50">
                <span className="text-sm text-gray-500 font-medium">Days Left</span>
                <span className={`font-bold ${daysLeft !== null && daysLeft < 5 ? 'text-red-500 bg-red-50' : 'text-gray-900 bg-gray-50'} px-3 py-1 rounded-full text-xs`}>
                  {daysLeft !== null ? `${daysLeft} days` : "-"}
                </span>
              </div>

              <div className="flex justify-between items-center pb-3 border-b border-gray-50">
                <span className="text-sm text-gray-500 font-medium">Batch Timing</span>
                <span className="font-bold text-blue-700 bg-blue-50 px-3 py-1 rounded-full text-xs">{batchTiming || 'Not Assigned'}</span>
              </div>

              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-500 font-medium">Status</span>
                <div className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold ${subscriptionPaused ? 'bg-red-50 text-red-700 border border-red-100' : 'bg-green-50 text-green-700 border border-green-100'}`}>
                  <div className={`w-1.5 h-1.5 rounded-full ${subscriptionPaused ? 'bg-red-500' : 'bg-green-500 animate-pulse'}`}></div>
                  {subscriptionPaused ? 'Paused' : 'Active'}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
