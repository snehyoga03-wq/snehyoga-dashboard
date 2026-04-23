// Supabase Edge Function: send-daily-reminders
// ==============================================
// UPDATED: Reads per-slot config from `reminder_schedules` table.
// Each time slot can independently configure audience, template, and params.
//
// Flow: pg_cron → this function (PUBLISHER) → message_queue
//       → process-message-queue (SUBSCRIBER) → WhatsApp Business API
//
// Deploy:  supabase functions deploy send-daily-reminders

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

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
        // personal_link uses /join/ path which Netlify proxies to the edge function (instant server-side redirect)
        if (k === "personal_link") return `https://yoga.snehyoga.com/join/${getSlug(user.referral_link)}`;
        return k; // literal string
    });
};

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

        // ─── 1. Load the per-slot schedule config ────────────────────────
        const { data: schedule, error: scheduleError } = await supabase
            .from("reminder_schedules")
            .select("*")
            .eq("slot", batchTime)
            .single();

        // If explicitly disabled, bail early
        if (!scheduleError && schedule && schedule.enabled === false) {
            console.log(`⏸ Slot ${batchTime} is disabled — skipping.`);
            return new Response(
                JSON.stringify({ success: true, message: `Slot ${batchTime} is disabled`, queued: 0 }),
                { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
        }

        // Resolve settings: prefer DB schedule, fall back to defaults
        const audience: string        = schedule?.audience        || "active";
        const customUsers: any[]      = schedule?.custom_users    || [];
        const templateNameCfg: string = schedule?.template_name   || "daily_reminder";
        const templateIdCfg: string   = schedule?.template_id     || "";
        const templateCatCfg: string  = schedule?.template_category || "UTILITY";
        const templateParams: string  = schedule?.template_params  || "name,slug";

        // ─── 2. Fetch users based on audience type ───────────────────────
        let targetUsers: any[] = [];

        if (audience === "custom") {
            // Use the stored custom users list directly
            targetUsers = customUsers;
        } else {
            let query = supabase
                .from("main_data_registration")
                .select("name, mobile_number, days_left, batch_timing, referral_link");

            if (audience === "active") {
                query = query.eq("subscription_paused", false).gt("days_left", 0);
            } else if (audience === "inactive") {
                // We need paused OR days_left <= 0 — fetch all then filter
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
                JSON.stringify({ success: true, message: `No users for ${batchTime}`, queued: 0 }),
                { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
        }

        // ─── 3. Build queue payload ──────────────────────────────────────
        const queueUsers = targetUsers.map((u: any) => {
            let p = String(u.mobile_number || u.phone || "").replace(/\D/g, "");
            if (p.length === 10) p = "91" + p;
            
            return {
                phone: p,
                name: u.name || "User",
                params: resolveParams(u, templateParams),
            };
        });

        const { data: batchId, error: rpcError } = await supabase.rpc("publish_messages", {
            p_batch_label: `${batchTime} auto`,
            p_template_name: templateNameCfg,
            p_template_id: templateIdCfg,
            p_template_category: templateCatCfg,
            p_users: queueUsers,
        });

        if (rpcError) throw new Error(`Publish error: ${rpcError.message}`);

        console.log(`📤 Published ${targetUsers.length} messages for ${batchTime} (audience: ${audience}, batch_id: ${batchId})`);

        // ─── 4. Trigger queue processing immediately ─────────────────────
        try {
            const fnUrl = `${supabaseUrl}/functions/v1/process-message-queue`;
            console.log(`🔄 [Trigger] Calling queue processor at ${fnUrl}...`);
            const triggerRes = await fetch(fnUrl, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${supabaseServiceKey}`,
                },
                body: JSON.stringify({}),
            });
            console.log(`🔄 [Trigger] Queue processor response status: ${triggerRes.status}`);
        } catch (triggerErr) {
            console.error("⚠️ [Trigger] Could not trigger queue processing:", triggerErr);
        }

        // ─── 5. Log success ───────────────────────────────────────────────
        await supabase.from("reminder_logs").insert({
            batch_time: batchTime,
            phone: "QUEUE",
            status: "success",
            error_message: `Published ${targetUsers.length} messages (audience: ${audience})`,
        });

        return new Response(
            JSON.stringify({
                success: true,
                message: `Queued ${targetUsers.length} reminders for ${batchTime}`,
                queued: targetUsers.length,
                batch_id: batchId,
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
                phone: "QUEUE",
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
