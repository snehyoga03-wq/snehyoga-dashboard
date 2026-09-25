// Supabase Edge Function: send-daily-reminders
// ==============================================
// Reads per-slot config from `reminder_schedules` table, fetches target users,
// and sends WhatsApp template messages DIRECTLY via Meta WhatsApp Business API.
//
// Flow: pg_cron → this function (DIRECT SEND) → Meta WhatsApp Business API
//
// Deploy: supabase functions deploy send-daily-reminders

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const WA_API_VERSION = "v20.0";

// Helper: extract slug from referral_link e.g. "...?ref=snehankitamane75"
const getSlug = (referralLink: string | null): string => {
    if (!referralLink) return "default";
    const match = referralLink.match(/ref=([^&]+)/);
    return match?.[1] ?? "default";
};

// Helper: resolve template parameter keys to user field values
const resolveParams = (user: Record<string, any>, paramsStr: string): string[] => {
    if (!paramsStr?.trim()) return [];
    return paramsStr.split(",").map((key) => {
        const k = key.trim();
        if (k === "name")          return user.name || "User";
        if (k === "mobile_number") return user.mobile_number || "";
        if (k === "days_left")     return String(user.days_left || 0);
        if (k === "batch_timing")  return user.batch_timing || "-";
        if (k === "slug")          return getSlug(user.referral_link);
        if (k === "personal_link") return `https://yoga.snehyoga.com/join/${getSlug(user.referral_link)}`;
        return k; // literal string
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

    // Fallback if parameter mismatch (#132000)
    if (!res.ok && json.error && (json.error.code === 132000 || String(json.error.message).includes("parameters"))) {
        console.log(`⚠️ Template '${templateName}' does not take parameters. Retrying without parameters...`);
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

Deno.serve(async (req) => {
    if (req.method === "OPTIONS") {
        return new Response("ok", { headers: corsHeaders });
    }

    try {
        const body = await req.json().catch(() => ({}));
        const batchTime: string = body.batch_time || "Unknown";

        const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
        const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
        const supabase = createClient(supabaseUrl, supabaseServiceKey);

        // ─── 1. Load WhatsApp API Credentials ────────────────────────────
        const { data: settings, error: settingsError } = await supabase
            .from("session_settings")
            .select("wa_api_token, wa_phone_number_id, wa_language_code")
            .maybeSingle();

        if (settingsError) throw new Error(`Settings error: ${settingsError.message}`);

        const waToken = settings?.wa_api_token;
        const phoneNumberId = settings?.wa_phone_number_id || "1230157110176906";
        const languageCode = settings?.wa_language_code || "mr";

        if (!waToken) {
            console.error(`❌ Missing WhatsApp API token in session_settings`);
            return new Response(
                JSON.stringify({ success: false, error: "WhatsApp API token not configured in session_settings" }),
                { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
        }

        // ─── 2. Load the per-slot schedule config ────────────────────────
        const { data: schedule, error: scheduleError } = await supabase
            .from("reminder_schedules")
            .select("*")
            .eq("slot", batchTime)
            .single();

        // If explicitly disabled, bail early
        if (!scheduleError && schedule && schedule.enabled === false) {
            console.log(`⏸ Slot ${batchTime} is disabled — skipping.`);
            return new Response(
                JSON.stringify({ success: true, message: `Slot ${batchTime} is disabled`, sent: 0 }),
                { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
        }

        // Resolve settings: prefer DB schedule, fall back to defaults
        const audience: string        = schedule?.audience        || "batch";
        const customUsers: any[]      = schedule?.custom_users    || [];
        const templateNameCfg: string = schedule?.template_name   || "daily_reminder";
        const templateIdCfg: string   = schedule?.template_id     || "";
        const templateCatCfg: string  = schedule?.template_category || "UTILITY";
        const templateParams: string  = schedule?.template_params  || "name,slug";

        // ─── 3. Fetch users based on audience type ───────────────────────
        let targetUsers: any[] = [];

        if (audience === "custom") {
            targetUsers = customUsers;
        } else {
            let query = supabase
                .from("main_data_registration")
                .select("name, mobile_number, days_left, batch_timing, referral_link");

            if (audience === "active") {
                query = query.eq("subscription_paused", false).gt("days_left", 0);
            } else if (audience === "batch") {
                query = query.eq("subscription_paused", false).gt("days_left", 0).eq("batch_timing", batchTime);
            } else if (audience === "inactive") {
                const { data: allUsers } = await supabase
                    .from("main_data_registration")
                    .select("name, mobile_number, days_left, batch_timing, referral_link");
                targetUsers = (allUsers || []).filter(
                    (u: any) => u.subscription_paused || (u.days_left || 0) <= 0
                );
            }

            if (audience !== "inactive") {
                const { data, error: usersError } = await query;
                if (usersError) throw new Error(`Users fetch error: ${usersError.message}`);
                targetUsers = data || [];
            }
        }

        if (targetUsers.length === 0) {
            console.log(`ℹ️ No users found for ${batchTime} (audience: ${audience})`);
            await supabase.from("reminder_logs").insert({
                batch_time: batchTime,
                phone: "N/A",
                status: "success",
                error_message: `No users in audience "${audience}" for slot ${batchTime}`,
            });
            return new Response(
                JSON.stringify({ success: true, message: `No users for ${batchTime}`, sent: 0 }),
                { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
        }

        console.log(`🚀 Sending ${targetUsers.length} reminders directly for ${batchTime} (audience: ${audience})...`);

        // ─── 4. Direct Parallel Sending to Meta WhatsApp API ──────────────
        let deliveredCount = 0;
        let failedCount = 0;
        const CHUNK_SIZE = 25; // Concurrent batch chunk size

        for (let i = 0; i < targetUsers.length; i += CHUNK_SIZE) {
            const chunk = targetUsers.slice(i, i + CHUNK_SIZE);
            await Promise.all(
                chunk.map(async (u: any) => {
                    let phone = String(u.mobile_number || u.phone || "").replace(/\D/g, "");
                    if (phone.length === 10) phone = "91" + phone;

                    if (!phone) return;

                    const params = resolveParams(u, templateParams);
                    const result = await sendWhatsAppTemplateDirect(
                        phoneNumberId,
                        waToken,
                        phone,
                        templateNameCfg,
                        languageCode,
                        params,
                        templateCatCfg
                    );

                    if (result.success) {
                        deliveredCount++;
                        await supabase.from("reminder_logs").insert({
                            batch_time: batchTime,
                            phone: phone,
                            status: "success",
                            error_message: null,
                        });

                        // Also log into chat_messages table so it appears in CRM Chats timeline (like AiSensy)
                        try {
                            await supabase.from("chat_messages").insert({
                                user_phone: phone,
                                user_name: u.name || "User",
                                message: `[Daily Reminder: ${templateNameCfg}]\nBatch: ${batchTime}`,
                                sender_type: "admin",
                                is_read: true,
                                created_at: new Date().toISOString()
                            });
                        } catch (_) {}

                        console.log(`✅ Direct sent to ${phone} (msgId: ${result.messageId})`);
                    } else {
                        failedCount++;
                        await supabase.from("reminder_logs").insert({
                            batch_time: batchTime,
                            phone: phone,
                            status: "failed",
                            error_message: (result.error || "Unknown error").substring(0, 250),
                        });
                        console.error(`❌ Direct send failed for ${phone}: ${result.error}`);
                    }
                })
            );
        }

        console.log(`📊 Done sending ${batchTime} reminders directly: ${deliveredCount} delivered, ${failedCount} failed.`);

        return new Response(
            JSON.stringify({
                success: true,
                message: `Sent ${deliveredCount} reminders directly for ${batchTime}`,
                sent: deliveredCount,
                failed: failedCount,
                audience,
            }),
            { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );

    } catch (err) {
        console.error("❌ send-daily-reminders error:", err);

        try {
            const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
            const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
            const supabase = createClient(supabaseUrl, supabaseServiceKey);
            const body = await req.clone().json().catch(() => ({}));
            await supabase.from("reminder_logs").insert({
                batch_time: body.batch_time || "Unknown",
                phone: "DIRECT",
                status: "failed",
                error_message: err instanceof Error ? err.message : String(err),
            });
        } catch (_) { /* ignore */ }

        return new Response(
            JSON.stringify({ success: false, error: err instanceof Error ? err.message : String(err) }),
            { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
    }
});
