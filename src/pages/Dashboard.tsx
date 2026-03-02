// Dashboard.jsx — Minimalist View
import { Menu, User, Calendar, Copy, Share2, Gift, PlayCircle, PauseCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
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
        if (referral_link) setReferralLink(normalizeReferralLink(referral_link));

        // Fetch referral stats
        const { data: referrals } = await supabase
          .from('referrals')
          .select('id')
          .eq('referrer_mobile', phone);

        if (referrals) {
          setReferralStats({
            totalReferrals: referrals.length,
            daysEarned: referrals.length * 7
          });
        }

        // Fetch Session Link based on Plan
        const { data: sessionData, error: sessionError } = await supabase
          .from('session_settings')
          .select('session_link, premium_session_link')
          .single();

        if (!sessionError && sessionData) {
          setSessionLink(sessionData.session_link);
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

  return (
    <div className="min-h-screen relative bg-[#faf9f6]">
      {/* Top Accent Line */}
      <div className="h-1.5 bg-gradient-to-r from-orange-400 via-pink-500 to-purple-600 w-full absolute top-0 left-0 z-10"></div>

      {/* Subtle Background Elements */}
      <div className="absolute top-0 right-0 w-64 h-64 bg-orange-200/20 rounded-full blur-3xl -z-0 pointer-events-none"></div>
      <div className="absolute top-40 left-0 w-72 h-72 bg-purple-200/20 rounded-full blur-3xl -z-0 pointer-events-none"></div>

      {/* Left slide-out sheet for profile menu */}
      <Sheet open={isMenuOpen} onOpenChange={setIsMenuOpen}>
        <SheetContent side="left" className="w-[300px] sm:w-[360px]">
          <SheetHeader>
            <SheetTitle className="flex items-center gap-3">
              <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center">
                <User className="w-6 h-6 text-primary" />
              </div>
              <div className="text-left">
                <p className="font-semibold">{userName}</p>
                <p className="text-sm text-muted-foreground">{userPhone}</p>
              </div>
            </SheetTitle>
          </SheetHeader>

          <div className="mt-8 space-y-6">
            {/* Logout */}
            <Button
              variant="destructive"
              className="w-full"
              onClick={handleLogout}
            >
              Logout
            </Button>
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

        {/* Upcoming Session */}
        <div className="relative overflow-hidden rounded-2xl border border-white/60 bg-white/80 backdrop-blur-xl shadow-lg shadow-gray-200/50">
          <div className="p-5 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-blue-50 flex items-center justify-center">
                  <PlayCircle className="w-4 h-4 text-blue-500" />
                </div>
                <h3 className="font-bold text-gray-800 text-lg">Upcoming Session</h3>
              </div>
              {batchTiming && <span className="text-xs font-bold px-3 py-1 bg-gradient-to-r from-blue-100 to-indigo-100 text-blue-700 rounded-full shadow-inner">{batchTiming} Batch</span>}
            </div>

            <div className="rounded-xl border border-gray-100 bg-white p-5 flex flex-col md:flex-row md:items-center justify-between shadow-sm gap-4 transition-all hover:shadow-md">
              <div className="space-y-1.5 flex-1">
                <p className="font-bold text-gray-900 text-lg">
                  {sessionLink ? "Live Session is Active" : "No Session Scheduled"}
                </p>
                <div className="flex items-center gap-2 text-sm text-blue-600 font-semibold bg-blue-50/50 w-fit px-2.5 py-1 rounded-md">
                  <Calendar className="w-3.5 h-3.5" />
                  <span>{batchTiming ? `Next session at ${batchTiming}` : "Check your batch timing"}</span>
                </div>

                {subscriptionPaused ? (
                  <div className="mt-3 space-y-2">
                    <div className="flex items-center gap-2 text-sm text-red-600 font-medium bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                      <PauseCircle className="w-4 h-4 flex-shrink-0" />
                      <span>Your subscription is paused</span>
                    </div>
                    <Button
                      size="sm"
                      disabled={isResuming}
                      className="w-full bg-gradient-to-r from-green-600 to-emerald-500 hover:from-green-700 hover:to-emerald-600 text-white shadow-sm"
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
                      <PlayCircle className="w-4 h-4 mr-1" />
                      {isResuming ? "Resuming..." : "Resume Subscription"}
                    </Button>
                  </div>
                ) : sessionLink ? (
                  <Button
                    size="lg"
                    className="mt-4 w-full md:w-auto bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white shadow-lg shadow-blue-500/30 rounded-full font-bold tracking-wide transition-all hover:scale-[1.02]"
                    onClick={async () => {
                      try {
                        const { error } = await supabase.from('attendance').insert({
                          mobile_number: userPhone,
                        });
                        if (error) {
                          console.error("Attendance insert error:", error);
                        } else {
                          toast({ title: "Attendance Marked ✅", description: "You're all set! Joining session..." });
                        }
                      } catch (err) {
                        console.error("Failed to mark attendance:", err);
                      }
                      window.open(sessionLink, '_blank');
                    }}
                  >
                    Join Now
                  </Button>
                ) : null}
              </div>
              <div className="hidden md:flex w-16 h-16 bg-gradient-to-br from-blue-50 to-indigo-50 rounded-2xl items-center justify-center border border-blue-100/50 shadow-inner">
                <span className="text-3xl">🧘‍♀️</span>
              </div>
            </div>
          </div>
        </div>

        {/* Refer & Win */}
        <div className="relative overflow-hidden rounded-2xl border border-white/60 bg-white/80 backdrop-blur-xl shadow-lg shadow-gray-200/50">
          <div className="p-5 space-y-5">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-green-50 flex items-center justify-center">
                <Gift className="w-4 h-4 text-green-500" />
              </div>
              <h3 className="font-bold text-gray-800 text-lg">Refer & Win</h3>
            </div>

            <div className="bg-gradient-to-br from-green-50/50 to-emerald-50/50 rounded-2xl p-5 border border-green-100/50 space-y-5 shadow-inner">
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-white p-4 rounded-xl text-center shadow-sm border border-gray-100/50 transition-transform hover:-translate-y-1">
                  <p className="text-3xl font-black bg-clip-text text-transparent bg-gradient-to-br from-green-600 to-emerald-500">{referralStats.totalReferrals}</p>
                  <p className="text-[10px] text-gray-500 font-bold uppercase tracking-wider mt-1">Total Referrals</p>
                </div>
                <div className="bg-white p-4 rounded-xl text-center shadow-sm border border-gray-100/50 transition-transform hover:-translate-y-1">
                  <p className="text-3xl font-black bg-clip-text text-transparent bg-gradient-to-br from-blue-600 to-indigo-500">{referralStats.daysEarned}</p>
                  <p className="text-[10px] text-gray-500 font-bold uppercase tracking-wider mt-1">Days Earned</p>
                </div>
              </div>

              <div className="space-y-2">
                <p className="text-xs text-gray-600 font-bold uppercase tracking-wider">Your Referral Link</p>
                <div className="bg-white border rounded-xl p-3.5 text-xs text-gray-600 truncate font-mono shadow-sm flex items-center justify-between group cursor-copy" onClick={() => {
                  navigator.clipboard.writeText(referralLink);
                  toast({ title: "Copied! 📋", description: "Link copied to clipboard!" });
                }}>
                  <span className="truncate pr-2">{referralLink || "Loading..."}</span>
                  <Copy className="w-4 h-4 text-gray-400 group-hover:text-blue-500 transition-colors flex-shrink-0" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3.5">
                <Button
                  variant="outline"
                  className="h-11 w-full bg-white hover:bg-gray-50 border-gray-200 text-gray-700 font-semibold rounded-xl"
                  onClick={() => {
                    navigator.clipboard.writeText(referralLink);
                    toast({ title: "Copied! 📋", description: "Link copied to clipboard!" });
                  }}
                >
                  <Copy className="w-4 h-4 mr-2" /> Copy Link
                </Button>
                <Button
                  className="h-11 w-full bg-[#25D366] hover:bg-[#128C7E] text-white shadow-lg shadow-green-500/20 font-semibold rounded-xl"
                  onClick={() => {
                    const shareText = `🧘 Snehyoga सह मोफत योगा क्लासेस! माझ्या लिंकवरून जॉईन करा आणि 7 दिवस मोफत मिळवा: ${referralLink}`;
                    window.open(`https://wa.me/?text=${encodeURIComponent(shareText)}`, '_blank');
                  }}
                >
                  <Share2 className="w-4 h-4 mr-2" /> Share
                </Button>
              </div>

              <div className="text-center pt-2">
                <Button variant="link" className="text-green-700 font-semibold hover:text-green-800 h-auto p-0" onClick={() => navigate('/referral')}>
                  View All Referrals →
                </Button>
              </div>

            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
