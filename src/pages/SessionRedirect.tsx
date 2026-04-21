import { useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { getCookie, setCookie } from "@/lib/cookies";

const SessionRedirect = () => {
    const { slug } = useParams();
    const navigate = useNavigate();
    const { toast } = useToast();

    useEffect(() => {
        const handleRedirect = async () => {
            let userPhone = getCookie("userPhone");
            let userName = getCookie("userName");
            let userDataToUse = null;

            try {
                // 1. Start fetching session settings immediately (runs in parallel to save time)
                const settingsPromise = supabase
                    .from("session_settings")
                    .select("session_link, premium_session_link")
                    .single();

                // 2. Find user data
                // If there's a slug and it's not the generic 'live' path
                if (slug && slug !== 'live') {
                    // Find user by their referral link containing the slug
                    const { data: slugUser, error: slugError } = await supabase
                        .from("main_data_registration")
                        .select("mobile_number, name, days_left, subscription_plan, subscription_paused")
                        .ilike("referral_link", `%ref=${slug}%`)
                        .limit(1)
                        .maybeSingle();

                    if (slugUser) {
                        userPhone = slugUser.mobile_number;
                        userName = slugUser.name;
                        userDataToUse = slugUser;
                        
                        // Automatically log them in for future visits
                        setCookie("userPhone", userPhone);
                        setCookie("userName", userName);
                    }
                }

                // If user wasn't found by slug or no slug was provided, fallback to cookie
                if (!userDataToUse) {
                    if (!userPhone || !userName) {
                        toast({
                            title: "Login Required",
                            description: "Please login to access the session",
                            variant: "destructive",
                        });
                        navigate(`/?returnUrl=/${slug || 'live'}`);
                        return;
                    }

                    // Fetch User Data by phone
                    const { data: userData, error: userError } = await supabase
                        .from("main_data_registration")
                        .select("days_left, subscription_plan, subscription_paused")
                        .eq("mobile_number", userPhone)
                        .single();

                    if (userError || !userData) {
                        console.error("User fetch error:", userError);
                        toast({
                            title: "Error",
                            description: "Could not verify subscription status",
                            variant: "destructive",
                        });
                        navigate("/dashboard");
                        return;
                    }
                    userDataToUse = userData;
                }

                // 3. Check Subscription Status
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
                    navigate("/dashboard"); // Or pricing page if available
                    return;
                }

                // 4. Wait for Session Link (this resolves instantly now because it was fetching in background)
                const { data: settingsData, error: settingsError } = await settingsPromise;

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

                // 5. Mark Attendance & Redirect (Optimized for speed)
                try {
                    if (userPhone) {
                        // Use Promise.race to give the attendance insert 150ms to fire, 
                        // but DO NOT wait longer than that so the redirect feels instant.
                        await Promise.race([
                            supabase.from('attendance').insert({ mobile_number: userPhone }),
                            new Promise(resolve => setTimeout(resolve, 150)) 
                        ]);
                    }
                } catch (attendanceError) {
                    console.error("Failed to mark attendance:", attendanceError);
                }

                window.location.href = targetLink;

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
