import { useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { getCookie, setCookie } from "@/lib/cookies";

/**
 * Extracts YouTube video ID from various YouTube URL formats.
 * Supports: youtube.com/watch?v=, youtu.be/, youtube.com/live/, youtube.com/embed/, etc.
 */
const extractYouTubeId = (url: string): string | null => {
    try {
        const u = new URL(url);
        const host = u.hostname.replace('www.', '');
        if (host === 'youtube.com' || host === 'm.youtube.com') {
            // /watch?v=VIDEO_ID
            if (u.searchParams.has('v')) return u.searchParams.get('v');
            // /live/VIDEO_ID or /embed/VIDEO_ID or /shorts/VIDEO_ID
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
 * Opens a URL, preferring the native app for YouTube links.
 * - Android: Uses Intent URL which opens the YouTube app directly (with browser fallback)
 * - iOS: Uses youtube:// deep link scheme
 * - Desktop/fallback: Regular redirect
 */
const openWithAppPreference = (url: string) => {
    const videoId = extractYouTubeId(url);

    if (videoId) {
        const ua = navigator.userAgent.toLowerCase();
        const isAndroid = ua.includes('android');
        const isIOS = /iphone|ipad|ipod/.test(ua);

        if (isAndroid) {
            // Android Intent URL — opens YouTube app if installed, falls back to browser
            window.location.href = `intent://www.youtube.com/watch?v=${videoId}#Intent;scheme=https;package=com.google.android.youtube;S.browser_fallback_url=${encodeURIComponent(url)};end`;
            return;
        }

        if (isIOS) {
            // iOS: try youtube:// deep link, fallback to web after 500ms
            const fallbackTimer = setTimeout(() => {
                window.location.href = url;
            }, 500);
            window.location.href = `youtube://watch?v=${videoId}`;
            // If the app opened, the page will be hidden — clear the fallback
            const handleVisibility = () => {
                if (document.hidden) {
                    clearTimeout(fallbackTimer);
                    document.removeEventListener('visibilitychange', handleVisibility);
                }
            };
            document.addEventListener('visibilitychange', handleVisibility);
            return;
        }
    }

    // Non-YouTube or desktop — just redirect normally
    window.location.href = url;
};

const SessionRedirect = () => {
    const { slug } = useParams();
    const navigate = useNavigate();
    const { toast } = useToast();

    useEffect(() => {
        const handleRedirect = async () => {
            const t0 = performance.now();
            let userPhone = getCookie("userPhone");
            let userName = getCookie("userName");
            let userDataToUse = null;

            try {
                // 1. Build all queries to run in PARALLEL
                const settingsPromise = supabase
                    .from("session_settings")
                    .select("session_link, premium_session_link")
                    .single();

                let userPromise = null;

                if (slug && slug !== 'live') {
                    // Find user by slug — use .eq on a pattern match
                    userPromise = supabase
                        .from("main_data_registration")
                        .select("mobile_number, name, days_left, subscription_plan, subscription_paused")
                        .ilike("referral_link", `%ref=${slug}%`)
                        .limit(1)
                        .maybeSingle();
                } else if (userPhone) {
                    // Fallback: find user by cookie phone
                    userPromise = supabase
                        .from("main_data_registration")
                        .select("mobile_number, name, days_left, subscription_plan, subscription_paused")
                        .eq("mobile_number", userPhone)
                        .single();
                }

                // 2. Run BOTH queries at the same time
                if (!userPromise) {
                    // No cookie and no slug — need login
                    toast({
                        title: "Login Required",
                        description: "Please login to access the session",
                        variant: "destructive",
                    });
                    navigate(`/?returnUrl=/${slug || 'live'}`);
                    return;
                }

                const [userResult, settingsResult] = await Promise.all([userPromise, settingsPromise]);
                console.log(`[SessionRedirect] DB queries took ${Math.round(performance.now() - t0)}ms`);

                // 3. Process user data
                const { data: userData, error: userError } = userResult;
                
                if (slug && slug !== 'live' && userData) {
                    // Found by slug — auto-login
                    userPhone = userData.mobile_number;
                    userName = userData.name;
                    userDataToUse = userData;
                    setCookie("userPhone", userPhone);
                    setCookie("userName", userName);
                } else if (slug && slug !== 'live' && !userData) {
                    // Slug didn't match — try cookie fallback
                    if (!userPhone || !userName) {
                        toast({
                            title: "Login Required",
                            description: "Please login to access the session",
                            variant: "destructive",
                        });
                        navigate(`/?returnUrl=/${slug || 'live'}`);
                        return;
                    }
                    // Need a separate query for cookie user
                    const { data: cookieUser, error: cookieError } = await supabase
                        .from("main_data_registration")
                        .select("days_left, subscription_plan, subscription_paused")
                        .eq("mobile_number", userPhone)
                        .single();
                    
                    if (cookieError || !cookieUser) {
                        console.error("User fetch error:", cookieError);
                        toast({
                            title: "Error",
                            description: "Could not verify subscription status",
                            variant: "destructive",
                        });
                        navigate("/dashboard");
                        return;
                    }
                    userDataToUse = cookieUser;
                } else if (userData) {
                    userDataToUse = userData;
                } else {
                    console.error("User fetch error:", userError);
                    toast({
                        title: "Error",
                        description: "Could not verify subscription status",
                        variant: "destructive",
                    });
                    navigate("/dashboard");
                    return;
                }

                // 4. Check Subscription Status
                if (userDataToUse.subscription_paused) {
                    toast({
                        title: "Subscription Paused",
                        description: "Your subscription is currently paused.",
                        variant: "destructive",
                    });
                    navigate("/dashboard");
                    return;
                }

                if ((userDataToUse.days_left || 0) <= 0) {
                    toast({
                        title: "Plan Expired",
                        description: "Please renew your plan to join sessions.",
                        variant: "destructive",
                    });
                    navigate("/dashboard");
                    return;
                }

                // 5. Determine session link
                const { data: settingsData, error: settingsError } = settingsResult;

                if (settingsError || !settingsData) {
                    console.error("Settings fetch error:", settingsError);
                    toast({
                        title: "Error",
                        description: "Could not find session link",
                        variant: "destructive",
                    });
                    navigate("/dashboard");
                    return;
                }

                let targetLink = settingsData.session_link;
                try {
                    if (targetLink && targetLink.startsWith('{')) {
                        const parsed = JSON.parse(targetLink);
                        const days = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
                        const todayStr = days[new Date().getDay()];
                        const activeWeek = parsed.active_week || 1;
                        const key = `w${activeWeek}_${todayStr}`;
                        targetLink = parsed[key];
                    } else {
                        // Legacy fallback
                        if (userDataToUse.subscription_plan === 'personalized' || userDataToUse.subscription_plan === 'premium') {
                            if (settingsData.premium_session_link) {
                                targetLink = settingsData.premium_session_link;
                            }
                        }
                    }
                } catch (e) {
                    console.error("Failed to parse session link:", e);
                }

                if (!targetLink) {
                    toast({
                        title: "No Session Found",
                        description: "There is no active session link right now.",
                        variant: "destructive",
                    });
                    navigate("/dashboard");
                    return;
                }

                // 6. Fire attendance as fire-and-forget (DO NOT await — redirect immediately)
                if (userPhone) {
                    supabase.from('attendance').insert({ mobile_number: userPhone }).then(null, (err: unknown) => {
                        console.error("Failed to mark attendance:", err);
                    });
                }

                console.log(`[SessionRedirect] Total redirect time: ${Math.round(performance.now() - t0)}ms`);
                openWithAppPreference(targetLink);

            } catch (error) {
                console.error("Redirect error:", error);
                toast({
                    title: "Error",
                    description: "Something went wrong. Please try again.",
                    variant: "destructive",
                });
                navigate("/dashboard");
            }
        };

        handleRedirect();
    }, [slug, navigate, toast]);

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
