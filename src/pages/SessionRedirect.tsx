import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { getCookie, setCookie } from "@/lib/cookies";

/**
 * Extracts YouTube video ID from various YouTube URL formats.
 */
const extractYouTubeId = (url: string): string | null => {
    try {
        const u = new URL(url);
        const host = u.hostname.replace('www.', '');
        if (host === 'youtube.com' || host === 'm.youtube.com') {
            if (u.searchParams.has('v')) return u.searchParams.get('v');
            const pathMatch = u.pathname.match(/^\/(live|embed|shorts|v)\/([^/?]+)/);
            if (pathMatch) return pathMatch[2];
        }
        if (host === 'youtu.be') {
            return u.pathname.slice(1).split('/')[0] || null;
        }
    } catch { /* not a valid URL */ }
    return null;
};

/**
 * Opens a URL, preferring the native YouTube app on mobile.
 */
const openWithAppPreference = (url: string) => {
    const videoId = extractYouTubeId(url);
    if (videoId) {
        const ua = navigator.userAgent.toLowerCase();
        const isAndroid = ua.includes('android');
        const isIOS = /iphone|ipad|ipod/.test(ua);
        if (isAndroid) {
            window.location.href = `intent://www.youtube.com/watch?v=${videoId}#Intent;scheme=https;package=com.google.android.youtube;S.browser_fallback_url=${encodeURIComponent(url)};end`;
            return;
        }
        if (isIOS) {
            const fallbackTimer = setTimeout(() => { window.location.href = url; }, 500);
            window.location.href = `youtube://watch?v=${videoId}`;
            const handleVisibility = () => {
                if (document.hidden) { clearTimeout(fallbackTimer); document.removeEventListener('visibilitychange', handleVisibility); }
            };
            document.addEventListener('visibilitychange', handleVisibility);
            return;
        }
    }
    window.location.href = url;
};

/**
 * Smart batch slot picker.
 * Returns the correct slot key based on current time.
 * Each slot goes live 20 minutes before its session time.
 *
 * Slots & active-from times:
 *   5am  → 4:40 AM
 *   6am  → 5:40 AM
 *   8am  → 7:40 AM
 *   5pm  → 4:40 PM
 *   6pm  → 5:40 PM
 *   7pm  → 6:40 PM
 *   Before 4:40 AM → 7pm (yesterday's last session recording)
 */
const getActiveBatchSlot = (): string => {
    const now = new Date();
    const cur = now.getHours() * 60 + now.getMinutes();
    const slots = [
        { slot: '5am',  from: 5 * 60 - 20  },
        { slot: '6am',  from: 6 * 60 - 20  },
        { slot: '8am',  from: 8 * 60 - 20  },
        { slot: '5pm',  from: 17 * 60 - 20 },
        { slot: '6pm',  from: 18 * 60 - 20 },
        { slot: '7pm',  from: 19 * 60 - 20 },
    ];
    for (let i = slots.length - 1; i >= 0; i--) {
        if (cur >= slots[i].from) return slots[i].slot;
    }
    return '7pm'; // Before 4:40 AM — show yesterday's last session
};

const SLOT_LABELS: Record<string, string> = {
    '5am': '5:00 AM', '6am': '6:00 AM', '8am': '8:00 AM',
    '5pm': '5:00 PM', '6pm': '6:00 PM', '7pm': '7:00 PM',
};

const getNextSlotInfo = (): { label: string; minutesUntil: number } | null => {
    const now = new Date();
    const cur = now.getHours() * 60 + now.getMinutes();
    const slots = [
        { slot: '5am',  from: 5 * 60 - 20  },
        { slot: '6am',  from: 6 * 60 - 20  },
        { slot: '8am',  from: 8 * 60 - 20  },
        { slot: '5pm',  from: 17 * 60 - 20 },
        { slot: '6pm',  from: 18 * 60 - 20 },
        { slot: '7pm',  from: 19 * 60 - 20 },
    ];
    for (const s of slots) {
        if (s.from > cur) return { label: SLOT_LABELS[s.slot], minutesUntil: s.from - cur };
    }
    return null;
};

const SessionRedirect = () => {
    const { slug } = useParams();
    const navigate = useNavigate();
    const { toast } = useToast();
    const [noSession, setNoSession] = useState(false);
    const [activeSlotLabel, setActiveSlotLabel] = useState('');
    const [nextSlot, setNextSlot] = useState<{ label: string; minutesUntil: number } | null>(null);

    useEffect(() => {
        const handleRedirect = async () => {
            const t0 = performance.now();
            let userPhone = getCookie("userPhone");
            let userName = getCookie("userName");
            let userDataToUse = null;

            try {
                // 1. Determine today's day key and active batch slot
                const days = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
                const todayStr = days[new Date().getDay()];
                const activeSlot = getActiveBatchSlot();
                setActiveSlotLabel(SLOT_LABELS[activeSlot]);
                setNextSlot(getNextSlotInfo());

                // 2. Run user + batch links + settings queries in parallel
                const batchLinksPromise = supabase
                    .from('session_batch_links')
                    .select('batch_slot, link, week')
                    .eq('day', todayStr);

                const settingsPromise = supabase
                    .from('session_settings')
                    .select('session_link')
                    .maybeSingle();

                let userPromise = null;
                if (slug && slug !== 'live') {
                    userPromise = supabase
                        .from("main_data_registration")
                        .select("mobile_number, name, days_left, subscription_plan, subscription_paused")
                        .ilike("referral_link", `%ref=${slug}%`)
                        .limit(1)
                        .maybeSingle();
                } else if (userPhone) {
                    userPromise = supabase
                        .from("main_data_registration")
                        .select("mobile_number, name, days_left, subscription_plan, subscription_paused")
                        .eq("mobile_number", userPhone)
                        .single();
                }

                if (!userPromise) {
                    toast({ title: "Login Required", description: "Please login to access the session", variant: "destructive" });
                    navigate(`/?returnUrl=/${slug || 'live'}`);
                    return;
                }

                const [userResult, batchResult, settingsResult] = await Promise.all([userPromise, batchLinksPromise, settingsPromise]);
                console.log(`[SessionRedirect] DB queries took ${Math.round(performance.now() - t0)}ms`);

                // 3. Process user data
                const { data: userData, error: userError } = userResult;
                if (slug && slug !== 'live' && userData) {
                    userPhone = userData.mobile_number;
                    userName = userData.name;
                    userDataToUse = userData;
                    setCookie("userPhone", userPhone);
                    setCookie("userName", userName);
                } else if (slug && slug !== 'live' && !userData) {
                    if (!userPhone || !userName) {
                        toast({ title: "Login Required", description: "Please login to access the session", variant: "destructive" });
                        navigate(`/?returnUrl=/${slug || 'live'}`);
                        return;
                    }
                    const { data: cookieUser, error: cookieError } = await supabase
                        .from("main_data_registration")
                        .select("days_left, subscription_plan, subscription_paused")
                        .eq("mobile_number", userPhone)
                        .single();
                    if (cookieError || !cookieUser) {
                        toast({ title: "Error", description: "Could not verify subscription status", variant: "destructive" });
                        navigate("/dashboard");
                        return;
                    }
                    userDataToUse = cookieUser;
                } else if (userData) {
                    userDataToUse = userData;
                } else {
                    console.error("User fetch error:", userError);
                    toast({ title: "Error", description: "Could not verify subscription status", variant: "destructive" });
                    navigate("/dashboard");
                    return;
                }

                // 4. Check subscription status
                if (userDataToUse.subscription_paused) {
                    toast({ title: "Subscription Paused", description: "Your subscription is currently paused.", variant: "destructive" });
                    navigate("/dashboard");
                    return;
                }
                if ((userDataToUse.days_left || 0) <= 0) {
                    toast({ title: "Plan Expired", description: "Please renew your plan to join sessions.", variant: "destructive" });
                    navigate("/dashboard");
                    return;
                }

                // 5. Determine active week from session_settings
                let activeWeek = 1;
                try {
                    const settingsData = settingsResult.data;
                    if (settingsData?.session_link?.startsWith('{')) {
                        const parsed = JSON.parse(settingsData.session_link);
                        activeWeek = parsed.active_week || 1;
                    }
                } catch (e) { /* use default week 1 */ }

                // 6. Pick the correct batch link for today + active week + active slot
                const batchRows = batchResult.data || [];
                const weekRows = batchRows.filter(r => r.week === activeWeek);
                const slotRow = weekRows.find(r => r.batch_slot === activeSlot);
                const targetLink = slotRow?.link?.trim() || '';

                // 7. No link set → show "session not started" screen
                if (!targetLink) {
                    setNoSession(true);
                    return;
                }

                // 8. Fire attendance (non-blocking)
                if (userPhone) {
                    supabase.from('attendance').insert({ mobile_number: userPhone }).then(null, (err: unknown) => {
                        console.error("Failed to mark attendance:", err);
                    });
                }

                console.log(`[SessionRedirect] Total redirect time: ${Math.round(performance.now() - t0)}ms`);
                openWithAppPreference(targetLink);

            } catch (error) {
                console.error("Redirect error:", error);
                toast({ title: "Error", description: "Something went wrong. Please try again.", variant: "destructive" });
                navigate("/dashboard");
            }
        };

        handleRedirect();
    }, [slug, navigate, toast]);

    // "Session Not Started" screen
    if (noSession) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-orange-50 to-amber-50 p-4">
                <div className="text-center space-y-6 max-w-sm w-full">
                    <div className="text-6xl animate-bounce">🧘</div>
                    <div>
                        <h2 className="text-2xl font-bold text-gray-800">Session Not Started Yet</h2>
                        <p className="text-gray-500 mt-2 text-sm">
                            The <span className="font-semibold text-amber-600">{activeSlotLabel}</span> session link hasn't been set yet.
                            Please try again closer to the session time.
                        </p>
                    </div>
                    {nextSlot && (
                        <div className="bg-white rounded-2xl p-5 shadow-sm border border-amber-100">
                            <p className="text-xs text-gray-500 uppercase tracking-wide font-semibold">Next session in</p>
                            <p className="text-3xl font-bold text-amber-600 mt-1">
                                {nextSlot.minutesUntil >= 60
                                    ? `${Math.floor(nextSlot.minutesUntil / 60)}h ${nextSlot.minutesUntil % 60}m`
                                    : `${nextSlot.minutesUntil} min`}
                            </p>
                            <p className="text-sm text-gray-400 mt-1">{nextSlot.label} batch</p>
                        </div>
                    )}
                    <button
                        onClick={() => navigate("/dashboard")}
                        className="w-full py-3 px-6 bg-amber-500 hover:bg-amber-600 active:bg-amber-700 text-white font-semibold rounded-xl transition-colors shadow-md text-base"
                    >
                        ← Back to Dashboard
                    </button>
                </div>
            </div>
        );
    }

    // Loading / redirecting screen
    return (
        <div className="min-h-screen flex items-center justify-center bg-background">
            <div className="text-center space-y-4">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
                <h2 className="text-xl font-semibold text-primary">Checking your subscription...</h2>
                <p className="text-muted-foreground">Please wait while we redirect you.</p>
            </div>
        </div>
    );
};

export default SessionRedirect;
