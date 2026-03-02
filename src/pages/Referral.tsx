import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Copy, Share2, Gift, Calendar, Users, Bell, CheckCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { getCookie } from "@/lib/cookies";

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

export const Referral = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [referralLink, setReferralLink] = useState("");
  const [referralCode, setReferralCode] = useState("");
  const [referralStats, setReferralStats] = useState({
    totalReferrals: 0,
    daysEarned: 0,
    activeFriends: 0,
  });
  const [referredFriends, setReferredFriends] = useState<Array<{
    name: string;
    phone: string;
    joinedAt: Date;
    isActive: boolean;
    daysLeft: number;
  }>>([]);

  useEffect(() => {
    const loadReferralData = async () => {
      const userPhone = getCookie('userPhone');
      if (!userPhone) {
        navigate('/');
        return;
      }

      // Fetch referral link from database
      try {
        const { data, error } = await supabase
          .from('main_data_registration')
          .select('referral_link, name')
          .eq('mobile_number', userPhone)
          .single();

        if (data && data.referral_link) {
          setReferralLink(normalizeReferralLink(data.referral_link));
          // Extract referral code from link (everything after ref=)
          const code = data.referral_link.split('ref=')[1] || '';
          setReferralCode(code);
        }

        // Fetch referral stats
        const { data: referrals } = await supabase
          .from('referrals')
          .select('*')
          .eq('referrer_mobile', userPhone);

        if (referrals) {
          const totalReferrals = referrals.length;
          const daysEarned = totalReferrals * 7; // 1 referral = 7 days

          // Check active friends (those who still have days_left > 0)
          const referredMobiles = referrals.map(r => r.referred_mobile);

          if (referredMobiles.length > 0) {
            const { data: friendsData } = await supabase
              .from('main_data_registration')
              .select('name, mobile_number, created_at, days_left')
              .in('mobile_number', referredMobiles);

            const activeCount = friendsData?.filter(f => (f.days_left || 0) > 0).length || 0;

            const friendsList = friendsData?.map(friend => ({
              name: friend.name,
              phone: friend.mobile_number,
              joinedAt: new Date(friend.created_at || Date.now()),
              isActive: (friend.days_left || 0) > 0,
              daysLeft: friend.days_left || 0,
            })) || [];

            setReferredFriends(friendsList);

            setReferralStats({
              totalReferrals,
              daysEarned,
              activeFriends: activeCount,
            });
          } else {
            setReferralStats({
              totalReferrals,
              daysEarned,
              activeFriends: 0,
            });
          }
        }
      } catch (error) {
        console.error('Error loading referral data:', error);
      }
    };

    loadReferralData();
  }, [navigate]);

  const copyToClipboard = async (text: string, message: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast({ title: "Copied! 📋", description: message });
    } catch (error) {
      toast({ title: "Error", description: "Failed to copy", variant: "destructive" });
    }
  };

  const shareReferral = async () => {
    const shareText = `🧘 Snehyoga सह मोफत योगा क्लासेस! माझ्या लिंकवरून जॉईन करा आणि 7 दिवस मोफत मिळवा: ${referralLink}`;

    if (navigator.share) {
      try {
        await navigator.share({
          title: 'Join Snehyoga',
          text: shareText,
        });
      } catch (e) {
        copyToClipboard(shareText, "Share message copied!");
      }
    } else {
      copyToClipboard(shareText, "Share message copied!");
    }
  };

  const getDaysAgo = (date: Date) => {
    const now = new Date();
    const diff = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));
    if (diff === 0) return "Today";
    if (diff === 1) return "Yesterday";
    return `${diff} days ago`;
  };

  const remindFriend = (phone: string) => {
    const message = encodeURIComponent(
      `अरे! तुम्ही अजून Snehyoga योगा क्लास जॉईन केली नाही? आज जॉईन करा आणि तुमची योगा यात्रा सुरू करा! 🧘‍♂️`
    );
    window.open(`https://wa.me/${phone}?text=${message}`, '_blank');
  };

  return (
    <div className="min-h-screen bg-background p-4">
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <Button variant="ghost" size="icon" onClick={() => navigate('/dashboard')}>
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <h1 className="text-xl font-bold">Refer & Earn 🎁</h1>
      </div>

      <div className="max-w-md mx-auto space-y-6">
        {/* Stats Cards */}
        <div className="grid grid-cols-3 gap-3">
          <Card className="p-4 text-center">
            <Users className="w-6 h-6 mx-auto mb-2 text-primary" />
            <p className="text-2xl font-bold">{referralStats.totalReferrals}</p>
            <p className="text-xs text-muted-foreground">Friends Invited</p>
          </Card>
          <Card className="p-4 text-center">
            <Calendar className="w-6 h-6 mx-auto mb-2 text-green-500" />
            <p className="text-2xl font-bold">{referralStats.daysEarned}</p>
            <p className="text-xs text-muted-foreground">Days Earned</p>
          </Card>
          <Card className="p-4 text-center">
            <CheckCircle className="w-6 h-6 mx-auto mb-2 text-blue-500" />
            <p className="text-2xl font-bold">{referralStats.activeFriends}</p>
            <p className="text-xs text-muted-foreground">Active Friends</p>
          </Card>
        </div>

        {/* Referral Link Card */}
        <Card className="p-4 space-y-4">
          <h2 className="font-semibold">Your Referral Link</h2>
          <div className="flex gap-2">
            <div className="flex-1 p-3 bg-muted rounded-lg text-sm break-all">
              {referralLink || "Loading..."}
            </div>
            <Button
              variant="outline"
              size="icon"
              onClick={() => copyToClipboard(referralLink, "Link copied!")}
            >
              <Copy className="w-4 h-4" />
            </Button>
          </div>

          <h2 className="font-semibold">Referral Code</h2>
          <div className="flex gap-2">
            <div className="flex-1 p-3 bg-muted rounded-lg text-center font-mono text-lg">
              {referralCode || "Loading..."}
            </div>
            <Button
              variant="outline"
              size="icon"
              onClick={() => copyToClipboard(referralCode, "Code copied!")}
            >
              <Copy className="w-4 h-4" />
            </Button>
          </div>

          <Button className="w-full gradient-bg" onClick={shareReferral}>
            <Share2 className="w-4 h-4 mr-2" /> Share with Friends
          </Button>
        </Card>

        {/* Friends List */}
        {referredFriends.length > 0 && (
          <Card className="p-4">
            <h2 className="font-semibold mb-4">My Invited Friends</h2>
            <div className="space-y-3">
              {referredFriends.map((friend, idx) => (
                <div key={idx} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                  <div>
                    <p className="font-medium">{friend.name}</p>
                    <p className="text-xs text-muted-foreground">
                      Joined {getDaysAgo(friend.joinedAt)}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {friend.isActive ? (
                      <span className="text-xs px-2 py-1 bg-green-100 text-green-700 rounded-full">
                        Active ({friend.daysLeft}d)
                      </span>
                    ) : (
                      <>
                        <span className="text-xs px-2 py-1 bg-red-100 text-red-700 rounded-full">
                          Inactive
                        </span>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => remindFriend(friend.phone)}
                        >
                          <Bell className="w-4 h-4" />
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </Card>
        )}

        {/* How it works */}
        <Card className="p-4">
          <h2 className="font-semibold mb-4">How it Works</h2>
          <div className="space-y-3">
            <div className="flex gap-3">
              <div className="w-8 h-8 bg-primary/10 rounded-full flex items-center justify-center text-primary font-bold">
                1
              </div>
              <div>
                <p className="font-medium">Share your link</p>
                <p className="text-sm text-muted-foreground">
                  Send your referral link to friends & family
                </p>
              </div>
            </div>
            <div className="flex gap-3">
              <div className="w-8 h-8 bg-primary/10 rounded-full flex items-center justify-center text-primary font-bold">
                2
              </div>
              <div>
                <p className="font-medium">They join for free</p>
                <p className="text-sm text-muted-foreground">
                  When they sign up, they get 7 free days
                </p>
              </div>
            </div>
            <div className="flex gap-3">
              <div className="w-8 h-8 bg-primary/10 rounded-full flex items-center justify-center text-primary font-bold">
                3
              </div>
              <div>
                <p className="font-medium">You earn +7 days</p>
                <p className="text-sm text-muted-foreground">
                  For each friend who joins, you get 7 extra days
                </p>
              </div>
            </div>
          </div>
        </Card>

      </div>
    </div>
  );
};

export default Referral;
