// Supabase Edge Function: retention-notifications
// =================================================
// Checks all retention notification triggers and sends WhatsApp template
// messages DIRECTLY via Meta WhatsApp Business API.
//
// Runs every 1 hour via pg_cron.
// All notifications are idempotent — checks retention_notification_log before sending.
//
// Deploy: supabase functions deploy retention-notifications

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const WA_API_VERSION = "v20.0";

// Extract slug from referral_link
const getSlug = (referralLink: string | null): string => {
    if (!referralLink) return "default";
    const match = referralLink.match(/ref=([^&]+)/);
    return match?.[1] ?? "default";
};

// Resolve template parameters
const resolveParams = (user: Record<string, any>, paramsStr: string): string[] => {
    if (!paramsStr?.trim()) return [];
    return paramsStr.split(",").map((key) => {
        const k = key.trim();
        if (k === "name") return user.name || "User";
        if (k === "mobile_number") return user.mobile_number || "";
        if (k === "days_left") return String(user.days_left || 0);
        if (k === "batch_timing") return user.batch_timing || "-";
        if (k === "slug") return getSlug(user.referral_link);
        if (k === "personal_link") return `https://yoga.snehyoga.com/join/${getSlug(user.referral_link)}`;
        if (k === "total_sessions") return String(user.total_sessions || 0);
        return k;
    });
};

// Direct WhatsApp template message delivery via Meta API
async function sendWhatsAppTemplateDirect(
    phoneNumberId: string,
    token: string,
    toPhone: string,
    templateName: string,
    languageCode: string,
    params: string[],
    category?: string,
): Promise<{ success: boolean; messageId?: string; error?: string }> {
    const url = `https://graph.facebook.com/${WA_API_VERSION}/${phoneNumberId}/messages`;
    const components: Record<string, unknown>[] = [];

    if (params.length > 0) {
        components.push({
            type: "body",
            parameters: params.map((p) => ({ type: "text", text: String(p) })),
        });
    }

    if (category === "AUTHENTICATION" && params.length > 0) {
        components.push({
            type: "button",
            sub_type: "url",
            index: "0",
            parameters: [{ type: "text", text: String(params[0]) }],
        });
    }

    const bodyWithParams: Record<string, unknown> = {
        messaging_product: "whatsapp",
        to: toPhone,
        type: "template",
        template: {
            name: templateName,
            language: { code: languageCode },
            ...(components.length > 0 ? { components } : {}),
        },
    };

    let res = await fetch(url, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${token}`,
        },
        body: JSON.stringify(bodyWithParams),
    });

    let json = await res.json();

    if (!res.ok && json.error && (json.error.code === 132000 || String(json.error.message).includes("parameters"))) {
        const bodyNoParams: Record<string, unknown> = {
            messaging_product: "whatsapp",
            to: toPhone,
            type: "template",
            template: {
                name: templateName,
                language: { code: languageCode },
            },
        };
        res = await fetch(url, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${token}`,
            },
            body: JSON.stringify(bodyNoParams),
        });
        json = await res.json();
    }

    if (!res.ok || json.error) {
        const errMsg = json.error?.message || json.error?.error_data?.details || `HTTP ${res.status}`;
        return { success: false, error: errMsg };
    }

    return { success: true, messageId: json.messages?.[0]?.id };
}

interface FlowConfig {
    trigger_code: string;
    enabled: boolean;
    template_name: string;
    template_id: string;
    template_category: string;
    template_params: string;
    cooldown_hours: number;
}

Deno.serve(async (req) => {
    if (req.method === "OPTIONS") {
        return new Response("ok", { headers: corsHeaders });
    }

    try {
        const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
        const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
        const supabase = createClient(supabaseUrl, supabaseServiceKey);

        console.log("🔔 [RetentionNotify] Starting notification check...");

        // Load WhatsApp API Credentials
        const { data: settings } = await supabase
            .from("session_settings")
            .select("wa_api_token, wa_phone_number_id, wa_language_code")
            .maybeSingle();

        const waToken = settings?.wa_api_token;
        const phoneNumberId = settings?.wa_phone_number_id || "1230157110176906";
        const languageCode = settings?.wa_language_code || "mr";

        if (!waToken) {
            console.error("❌ Missing WhatsApp API token in session_settings");
            return new Response(
                JSON.stringify({ success: false, error: "WhatsApp API token not configured" }),
                { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
        }

        // Load flow configs
        const { data: flowConfigs } = await supabase
            .from("retention_flow_config")
            .select("*")
            .eq("enabled", true);

        if (!flowConfigs || flowConfigs.length === 0) {
            return new Response(
                JSON.stringify({ success: true, message: "No enabled flows", sent: 0 }),
                { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
        }

        const configMap: Record<string, FlowConfig> = {};
        for (const fc of flowConfigs) configMap[fc.trigger_code] = fc;

        // Load all users
        const { data: users } = await supabase
            .from("main_data_registration")
            .select("id, name, mobile_number, referral_link, created_at, days_left, subscription_plan, subscription_paused, batch_timing, lifecycle_state, is_activated, first_session_at, last_session_at, total_sessions, sessions_last_14d, sessions_last_30d, renewal_count, total_months_active, mty_upgrade_shown_at");

        if (!users || users.length === 0) {
            return new Response(
                JSON.stringify({ success: true, message: "No users", sent: 0 }),
                { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
        }

        // Load recent notification log (last 90 days) for dedup
        const { data: recentLogs } = await supabase
            .from("retention_notification_log")
            .select("mobile_number, trigger_code, created_at")
            .gte("created_at", new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString());

        // Build dedup set: "phone:trigger_code" → latest timestamp
        const sentMap: Record<string, Date> = {};
        for (const log of (recentLogs || [])) {
            const key = `${log.mobile_number}:${log.trigger_code}`;
            const logDate = new Date(log.created_at);
            if (!sentMap[key] || logDate > sentMap[key]) sentMap[key] = logDate;
        }

        // Helper: check if notification was already sent within cooldown
        const alreadySent = (phone: string, triggerCode: string, cooldownHours: number): boolean => {
            const key = `${phone}:${triggerCode}`;
            const lastSent = sentMap[key];
            if (!lastSent) return false;
            const hoursSince = (Date.now() - lastSent.getTime()) / (1000 * 60 * 60);
            return hoursSince < cooldownHours;
        };

        const now = new Date();
        const toSend: { triggerCode: string; user: Record<string, any> }[] = [];

        for (const user of users) {
            const daysLeft = user.days_left || 0;
            const isPaused = user.subscription_paused || false;
            const createdAt = new Date(user.created_at || now);
            const daysSinceJoin = Math.floor((now.getTime() - createdAt.getTime()) / (1000 * 60 * 60 * 24));
            const lastSession = user.last_session_at ? new Date(user.last_session_at) : null;
            const daysSinceLastSession = lastSession
                ? Math.floor((now.getTime() - lastSession.getTime()) / (1000 * 60 * 60 * 24))
                : 999;
            const planType = (user.subscription_plan || "").toLowerCase().includes("12 month") ? "yearly" : "monthly";
            const state = user.lifecycle_state || "JUST_JOINED";

            // ── First 30-day flows ───────────────────────────────
            if (daysSinceJoin <= 1 && configMap["WELCOME_D0"]) {
                if (!alreadySent(user.mobile_number, "WELCOME_D0", 99999)) {
                    toSend.push({ triggerCode: "WELCOME_D0", user });
                }
            }

            if (daysSinceJoin >= 2 && daysSinceJoin <= 3 && !user.is_activated && configMap["ONBOARDING_D2"]) {
                if (!alreadySent(user.mobile_number, "ONBOARDING_D2", 99999)) {
                    toSend.push({ triggerCode: "ONBOARDING_D2", user });
                }
            }

            if (daysSinceJoin >= 5 && daysSinceJoin <= 6 && !user.is_activated && configMap["ONBOARDING_D5"]) {
                if (!alreadySent(user.mobile_number, "ONBOARDING_D5", 99999)) {
                    toSend.push({ triggerCode: "ONBOARDING_D5", user });
                }
            }

            if (user.is_activated && user.first_session_at && configMap["FIRST_WIN_D1"]) {
                const firstAt = new Date(user.first_session_at);
                const hoursSinceFirst = (now.getTime() - firstAt.getTime()) / (1000 * 60 * 60);
                if (hoursSinceFirst <= 24 && !alreadySent(user.mobile_number, "FIRST_WIN_D1", 99999)) {
                    toSend.push({ triggerCode: "FIRST_WIN_D1", user });
                }
            }

            if (user.is_activated && daysSinceJoin <= 14 && (user.sessions_last_14d || 0) >= 2 && configMap["RHYTHM_D10"]) {
                if (!alreadySent(user.mobile_number, "RHYTHM_D10", 99999)) {
                    toSend.push({ triggerCode: "RHYTHM_D10", user });
                }
            }

            if (daysSinceJoin >= 15 && daysSinceJoin <= 16 && (user.sessions_last_14d || 0) >= 2 && configMap["PROGRESS_D15"]) {
                if (!alreadySent(user.mobile_number, "PROGRESS_D15", 99999)) {
                    toSend.push({ triggerCode: "PROGRESS_D15", user });
                }
            }

            if (daysLeft === 3 && !isPaused && configMap["RENEWAL_D27"]) {
                if (!alreadySent(user.mobile_number, "RENEWAL_D27", 99999)) {
                    toSend.push({ triggerCode: "RENEWAL_D27", user });
                }
            }

            if (daysLeft === 1 && !isPaused && configMap["RENEWAL_D30"]) {
                if (!alreadySent(user.mobile_number, "RENEWAL_D30", 99999)) {
                    toSend.push({ triggerCode: "RENEWAL_D30", user });
                }
            }

            // ── Rescue flows ─────────────────────────────────────
            if (state === "INCONSISTENT" && daysSinceLastSession >= 7 && configMap["RESCUE_7D"]) {
                if (!alreadySent(user.mobile_number, "RESCUE_7D", 168)) {
                    toSend.push({ triggerCode: "RESCUE_7D", user });
                }
            }

            if (state === "AT_RISK" && daysSinceLastSession >= 14 && configMap["RESCUE_14D"]) {
                if (!alreadySent(user.mobile_number, "RESCUE_14D", 168)) {
                    toSend.push({ triggerCode: "RESCUE_14D", user });
                }
            }

            if (state === "AT_RISK" && daysSinceLastSession >= 21 && configMap["RESCUE_21D"]) {
                if (!alreadySent(user.mobile_number, "RESCUE_21D", 99999)) {
                    await supabase.from("retention_outreach_queue").insert({
                        user_id: user.id,
                        mobile_number: user.mobile_number,
                        user_name: user.name || "Unknown",
                        reason: `21+ days without session (last: ${daysSinceLastSession}d ago)`,
                        lifecycle_state: state,
                    });
                    toSend.push({ triggerCode: "RESCUE_21D", user });
                }
            }

            // ── Monthly to Yearly upgrade flows ──────────────────
            if (planType === "monthly" && !isPaused && daysLeft > 0) {
                if (daysSinceJoin >= 20 && daysSinceJoin <= 21 && state === "ACTIVE_CORE" && configMap["MTY_INTRO"]) {
                    if (!alreadySent(user.mobile_number, "MTY_INTRO", 99999)) {
                        toSend.push({ triggerCode: "MTY_INTRO", user });
                    }
                }
                if (daysSinceJoin >= 25 && daysSinceJoin <= 26 && state === "ACTIVE_CORE" && configMap["MTY_INVITE"]) {
                    if (!alreadySent(user.mobile_number, "MTY_INVITE", 99999)) {
                        toSend.push({ triggerCode: "MTY_INVITE", user });
                    }
                }
            }

            // ── Expiry flows ─────────────────────────────────────
            if (daysLeft === 7 && !isPaused) {
                if ((state === "ACTIVE_CORE" || state === "YEARLY") && configMap["EXPIRY_7D_ACTIVE"]) {
                    if (!alreadySent(user.mobile_number, "EXPIRY_7D_ACTIVE", 99999)) {
                        toSend.push({ triggerCode: "EXPIRY_7D_ACTIVE", user });
                    }
                }
                if (state === "AT_RISK" && configMap["EXPIRY_7D_ATRISK"]) {
                    if (!alreadySent(user.mobile_number, "EXPIRY_7D_ATRISK", 99999)) {
                        toSend.push({ triggerCode: "EXPIRY_7D_ATRISK", user });
                    }
                }
            }

            if (daysLeft === 1 && !isPaused && configMap["EXPIRY_1D"]) {
                if (!alreadySent(user.mobile_number, "EXPIRY_1D", 99999)) {
                    toSend.push({ triggerCode: "EXPIRY_1D", user });
                }
            }

            // ── Win-back flows ───────────────────────────────────
            if (state === "EXPIRED") {
                const expiredDaysAgo = Math.abs(daysLeft);
                if (expiredDaysAgo >= 7 && expiredDaysAgo <= 8 && configMap["WINBACK_7D"]) {
                    if (!alreadySent(user.mobile_number, "WINBACK_7D", 99999)) {
                        toSend.push({ triggerCode: "WINBACK_7D", user });
                    }
                }
                if (expiredDaysAgo >= 30 && expiredDaysAgo <= 31 && configMap["WINBACK_30D"]) {
                    if (!alreadySent(user.mobile_number, "WINBACK_30D", 99999)) {
                        toSend.push({ triggerCode: "WINBACK_30D", user });
                    }
                }
                if (expiredDaysAgo >= 60 && expiredDaysAgo <= 61 && (user.total_sessions || 0) >= 5 && configMap["WINBACK_60D"]) {
                    if (!alreadySent(user.mobile_number, "WINBACK_60D", 99999)) {
                        toSend.push({ triggerCode: "WINBACK_60D", user });
                    }
                }
            }

            // ── Yearly user flows ────────────────────────────────
            if (planType === "yearly" && !isPaused && daysLeft > 0) {
                if (daysSinceJoin >= 90 && daysSinceJoin <= 91 && configMap["YEARLY_M3"]) {
                    if (!alreadySent(user.mobile_number, "YEARLY_M3", 99999)) {
                        toSend.push({ triggerCode: "YEARLY_M3", user });
                    }
                }
                if (daysSinceJoin >= 180 && daysSinceJoin <= 181 && configMap["YEARLY_M6"]) {
                    if (!alreadySent(user.mobile_number, "YEARLY_M6", 99999)) {
                        toSend.push({ triggerCode: "YEARLY_M6", user });
                    }
                }
                if (daysLeft <= 30 && daysLeft >= 29 && configMap["YEARLY_M11"]) {
                    if (!alreadySent(user.mobile_number, "YEARLY_M11", 99999)) {
                        toSend.push({ triggerCode: "YEARLY_M11", user });
                    }
                }
            }
        }

        // ── Direct Send via WhatsApp Business API ─────────────
        let totalSent = 0;
        let totalFailed = 0;

        // Group by trigger_code
        const grouped: Record<string, Record<string, any>[]> = {};
        for (const item of toSend) {
            if (!grouped[item.triggerCode]) grouped[item.triggerCode] = [];
            grouped[item.triggerCode].push(item.user);
        }

        const CHUNK_SIZE = 20;

        for (const [triggerCode, triggerUsers] of Object.entries(grouped)) {
            const config = configMap[triggerCode];
            if (!config || !config.template_name) {
                console.log(`⏭ Skipping ${triggerCode}: no template configured`);
                continue;
            }

            for (let i = 0; i < triggerUsers.length; i += CHUNK_SIZE) {
                const chunk = triggerUsers.slice(i, i + CHUNK_SIZE);
                await Promise.all(
                    chunk.map(async (u) => {
                        let phone = (u.mobile_number || "").replace(/\D/g, "");
                        if (phone.length === 10) phone = "91" + phone;

                        if (!phone) return;

                        const params = resolveParams(u, config.template_params);
                        const result = await sendWhatsAppTemplateDirect(
                            phoneNumberId,
                            waToken,
                            phone,
                            config.template_name,
                            languageCode,
                            params,
                            config.template_category
                        );

                        if (result.success) {
                            totalSent++;
                            await supabase.from("retention_notification_log").insert({
                                user_id: u.id,
                                mobile_number: u.mobile_number,
                                trigger_code: triggerCode,
                                channel: "whatsapp",
                                status: "sent",
                                message_preview: `Template: ${config.template_name}`,
                            });

                            try {
                                await supabase.from("chat_messages").insert({
                                    user_phone: phone,
                                    user_name: u.name || "User",
                                    message: `[Retention Automation: ${config.template_name}]\nFlow: ${triggerCode}`,
                                    sender_type: "admin",
                                    is_read: true,
                                    created_at: new Date().toISOString()
                                });
                            } catch (_) {}
                        } else {
                            totalFailed++;
                            await supabase.from("retention_notification_log").insert({
                                user_id: u.id,
                                mobile_number: u.mobile_number,
                                trigger_code: triggerCode,
                                channel: "whatsapp",
                                status: "failed",
                                message_preview: `Failed: ${result.error}`,
                            });
                        }
                    })
                );
            }

            console.log(`📤 Direct sent retention notifications for ${triggerCode}`);
        }

        console.log(`✅ [RetentionNotify] Done. Sent ${totalSent} direct notifications (${totalFailed} failed) across ${Object.keys(grouped).length} flows`);

        return new Response(
            JSON.stringify({ success: true, sent: totalSent, failed: totalFailed, flows: Object.keys(grouped).length }),
            { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );

    } catch (err) {
        console.error("❌ retention-notifications error:", err);
        return new Response(
            JSON.stringify({ success: false, error: err instanceof Error ? err.message : String(err) }),
            { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
    }
});
