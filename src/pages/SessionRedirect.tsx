import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { getCookie } from "@/lib/cookies";

const SessionRedirect = () => {
    const navigate = useNavigate();
    const { toast } = useToast();

    useEffect(() => {
        const handleRedirect = async () => {
            // 1. Check Auth (Cookie)
            const userPhone = getCookie("userPhone");
            const userName = getCookie("userName");

            if (!userPhone || !userName) {
                toast({
                    title: "Login Required",
                    description: "Please login to access the session",
                    variant: "destructive",
                });
                navigate("/?returnUrl=/live");
                return;
            }

            try {
                // 2. Fetch User Data (Days Left)
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

                // 3. Check Subscription Status
                if (userData.subscription_paused) {
                    toast({
                        title: "Subscription Paused",
                        description: "Your subscription is currently paused.",
                        variant: "destructive",
                    });
                    navigate("/dashboard");
                    return;
                }

                if ((userData.days_left || 0) <= 0) {
                    toast({
                        title: "Plan Expired",
                        description: "Please renew your plan to join sessions.",
                        variant: "destructive",
                    });
                    navigate("/dashboard"); // Or pricing page if available
                    return;
                }

                // 4. Fetch Session Link
                const { data: settingsData, error: settingsError } = await supabase
                    .from("session_settings")
                    .select("session_link, premium_session_link")
                    .single();

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

                // Determine link based on plan (optional logic, can just use main link)
                // For now, defaulting to standard session link, but can switch if needed
                // const targetLink = userData.subscription_plan === 'premium' ? settingsData.premium_session_link : settingsData.session_link;
                // Looking at CRM.tsx logic, mainly session_link is used? Or maybe both.
                // Let's use session_link as default, assuming 'premium' might be special.
                // Actually, let's just use the main session_link for now unless requirements specify otherwise.
                // Let's check if the user is 'premium' just in case.

                let targetLink = settingsData.session_link;
                if (userData.subscription_plan === 'personalized' || userData.subscription_plan === 'premium') {
                    if (settingsData.premium_session_link) {
                        targetLink = settingsData.premium_session_link;
                    }
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

                // 5. Mark Attendance & Redirect
                try {
                    // We don't await this to avoid blocking the redirect if it's slow, 
                    // but since we are redirecting via window.location.href, we should probably await it briefly 
                    // or fire and forget. Fire and forget might be cancelled by browser navigation.
                    // Safer to await with a timeout or just await it. It's a quick insert.
                    await supabase.from('attendance').insert({
                        mobile_number: userPhone,
                        // date: new Date().toISOString().split('T')[0] // Optional if we want explicit date column
                    });
                } catch (attendanceError) {
                    console.error("Failed to mark attendance:", attendanceError);
                    // Don't block redirect
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
    }, [navigate]);

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
