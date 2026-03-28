// Supabase Edge Function: send-daily-reminders
// ==============================================
// UPDATED: Now publishes to message_queue (Pub/Sub) instead of
// sending directly to Pabbly. This ensures reliable delivery
// under heavy load with automatic retries.
//
// Flow: pg_cron → this function (PUBLISHER) → message_queue
//       → process-message-queue (SUBSCRIBER) → Pabbly webhook
//
// Deploy:  supabase functions deploy send-daily-reminders

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
    if (req.method === "OPTIONS") {
        return new Response("ok", { headers: corsHeaders });
    }

    try {
        const body = await req.json().catch(() => ({}));
        const batchTime = body.batch_time || "Unknown";

        const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
        const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
        const supabase = createClient(supabaseUrl, supabaseServiceKey);

        // 1. Get all active users for this batch time
        const { data: batchUsers, error: usersError } = await supabase
            .from("main_data_registration")
            .select("name, mobile_number, days_left, batch_timing")
            .eq("batch_timing", batchTime)
            .eq("subscription_paused", false)
            .gt("days_left", 0);

        if (usersError) throw new Error(`Users fetch error: ${usersError.message}`);

        if (!batchUsers || batchUsers.length === 0) {
            console.log(`ℹ️ No active users found for ${batchTime} batch`);

            // Log empty batch
            await supabase.from("reminder_logs").insert({
                batch_time: batchTime,
                phone: "N/A",
                status: "success",
                error_message: `No active users in ${batchTime} batch`,
            });

            return new Response(
                JSON.stringify({ success: true, message: `No users for ${batchTime}`, queued: 0 }),
                { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
        }

        // 2. Publish to message queue via RPC
        const queueUsers = batchUsers.map(u => ({
            phone: u.mobile_number,
            name: u.name || "User",
            params: [u.name || "User", String(u.days_left || 0)],
        }));

        const { data: batchId, error: rpcError } = await supabase.rpc("publish_messages", {
            p_batch_label: `${batchTime} auto`,
            p_template_name: "daily_reminder",
            p_template_id: "",
            p_template_category: "UTILITY",
            p_users: queueUsers,
        });

        if (rpcError) throw new Error(`Publish error: ${rpcError.message}`);

        console.log(`📤 Published ${batchUsers.length} messages for ${batchTime} batch (batch_id: ${batchId})`);

        // 3. Trigger queue processing immediately
        try {
            const fnUrl = `${supabaseUrl}/functions/v1/process-message-queue`;
            await fetch(fnUrl, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${supabaseServiceKey}`,
                },
                body: JSON.stringify({}),
            });
        } catch (triggerErr) {
            console.warn("⚠️ Could not trigger queue processing:", triggerErr);
            // Non-critical — cron will pick it up
        }

        // 4. Log success
        await supabase.from("reminder_logs").insert({
            batch_time: batchTime,
            phone: "QUEUE",
            status: "success",
            error_message: `Published ${batchUsers.length} messages to queue`,
        });

        return new Response(
            JSON.stringify({
                success: true,
                message: `Queued ${batchUsers.length} reminders for ${batchTime}`,
                queued: batchUsers.length,
                batch_id: batchId,
            }),
            { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
    } catch (err) {
        console.error("❌ send-daily-reminders error:", err);

        // Log failure
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
        } catch (_) {
            // Ignore logging errors
        }

        return new Response(
            JSON.stringify({ success: false, error: err instanceof Error ? err.message : String(err) }),
            { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
    }
});
