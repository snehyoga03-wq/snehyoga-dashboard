// Supabase Edge Function: process-message-queue
// =============================================
// SUBSCRIBER in the Pub/Sub model.
//
// This function:
// 1. Picks up pending messages from message_queue (batch of N)
// 2. Sends each message to Pabbly webhook
// 3. Marks each as delivered or failed
// 4. Implements exponential backoff for retries
// 5. Moves permanently failed messages to dead_letter
//
// Trigger: pg_cron every 30 seconds, or manually via HTTP POST.
// Deploy:  supabase functions deploy process-message-queue
// =============================================

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const BATCH_SIZE = 10;           // Process N messages per invocation
const RATE_LIMIT_DELAY_MS = 200; // Delay between individual sends (ms)

const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function sleep(ms: number) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

Deno.serve(async (req) => {
    if (req.method === "OPTIONS") {
        return new Response("ok", { headers: corsHeaders });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    try {
        // 1. Get the Pabbly webhook URL
        const { data: settings, error: settingsError } = await supabase
            .from("session_settings")
            .select("pabbly_reminder_url")
            .maybeSingle();

        if (settingsError) throw new Error(`Settings error: ${settingsError.message}`);

        const pabblyUrl = settings?.pabbly_reminder_url;
        if (!pabblyUrl) {
            return new Response(
                JSON.stringify({ success: false, error: "Pabbly webhook URL not configured" }),
                { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
        }

        // 2. Fetch pending messages that are ready for processing
        //    (pending OR failed with retry available, and next_retry_at <= now)
        const { data: messages, error: fetchError } = await supabase
            .from("message_queue")
            .select("*")
            .or("status.eq.pending,status.eq.failed")
            .lte("next_retry_at", new Date().toISOString())
            .lt("retry_count", 3)  // Haven't exceeded max retries
            .order("created_at", { ascending: true })
            .limit(BATCH_SIZE);

        if (fetchError) throw new Error(`Queue fetch error: ${fetchError.message}`);

        if (!messages || messages.length === 0) {
            return new Response(
                JSON.stringify({ success: true, processed: 0, message: "Queue empty" }),
                { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
        }

        console.log(`📋 Processing ${messages.length} messages from queue...`);

        // 3. Mark all as "processing" (claim them)
        const messageIds = messages.map((m: any) => m.id);
        await supabase
            .from("message_queue")
            .update({ status: "processing", updated_at: new Date().toISOString() })
            .in("id", messageIds);

        // 4. Process each message individually with rate limiting
        let deliveredCount = 0;
        let failedCount = 0;
        const batchUpdates: Record<string, { delivered: number; failed: number }> = {};

        for (const msg of messages) {
            try {
                // Build individual Pabbly payload
                const payload = {
                    template_name: msg.template_name,
                    template_id: msg.template_id,
                    category: msg.template_category,
                    batch_time: msg.batch_label,
                    users: [{
                        phone: msg.phone,
                        params: msg.template_params || [],
                    }],
                };

                const res = await fetch(pabblyUrl, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(payload),
                });

                if (res.ok) {
                    // ✅ Delivered
                    await supabase
                        .from("message_queue")
                        .update({
                            status: "delivered",
                            delivered_at: new Date().toISOString(),
                            processed_at: new Date().toISOString(),
                            updated_at: new Date().toISOString(),
                        })
                        .eq("id", msg.id);

                    deliveredCount++;
                    if (!batchUpdates[msg.batch_id]) batchUpdates[msg.batch_id] = { delivered: 0, failed: 0 };
                    batchUpdates[msg.batch_id].delivered++;

                    // Log success
                    await supabase.from("reminder_logs").insert({
                        batch_time: msg.batch_label || "QUEUE",
                        phone: msg.phone,
                        status: "success",
                    });

                    console.log(`✅ Delivered to ${msg.phone}`);
                } else {
                    throw new Error(`HTTP ${res.status}: ${await res.text().catch(() => "")}`);
                }
            } catch (err) {
                const errorMsg = err instanceof Error ? err.message : String(err);
                const newRetryCount = (msg.retry_count || 0) + 1;
                const isDeadLetter = newRetryCount >= (msg.max_retries || 3);

                // Exponential backoff: 30s, 120s, 480s
                const backoffSeconds = Math.pow(4, newRetryCount) * 30;
                const nextRetry = new Date(Date.now() + backoffSeconds * 1000).toISOString();

                await supabase
                    .from("message_queue")
                    .update({
                        status: isDeadLetter ? "dead_letter" : "failed",
                        retry_count: newRetryCount,
                        last_error: errorMsg.substring(0, 500),
                        next_retry_at: isDeadLetter ? null : nextRetry,
                        processed_at: new Date().toISOString(),
                        updated_at: new Date().toISOString(),
                    })
                    .eq("id", msg.id);

                failedCount++;
                if (!batchUpdates[msg.batch_id]) batchUpdates[msg.batch_id] = { delivered: 0, failed: 0 };
                batchUpdates[msg.batch_id].failed++;

                // Log failure
                await supabase.from("reminder_logs").insert({
                    batch_time: msg.batch_label || "QUEUE",
                    phone: msg.phone,
                    status: "failed",
                    error_message: errorMsg.substring(0, 200),
                });

                console.error(`❌ Failed for ${msg.phone}: ${errorMsg}`);
            }

            // Rate limit: small delay between sends
            await sleep(RATE_LIMIT_DELAY_MS);
        }

        // 5. Update batch summary records
        for (const [batchId, counts] of Object.entries(batchUpdates)) {
            // Fetch current batch state
            const { data: batch } = await supabase
                .from("message_batches")
                .select("*")
                .eq("id", batchId)
                .maybeSingle();

            if (batch) {
                const newDelivered = (batch.delivered_count || 0) + counts.delivered;
                const newFailed = (batch.failed_count || 0) + counts.failed;
                const totalProcessed = newDelivered + newFailed;
                const isComplete = totalProcessed >= batch.total_messages;

                await supabase
                    .from("message_batches")
                    .update({
                        delivered_count: newDelivered,
                        failed_count: newFailed,
                        status: isComplete
                            ? (newFailed > 0 ? "partial_failure" : "completed")
                            : "processing",
                        completed_at: isComplete ? new Date().toISOString() : null,
                    })
                    .eq("id", batchId);
            }
        }

        console.log(`📊 Batch complete: ${deliveredCount} delivered, ${failedCount} failed`);

        return new Response(
            JSON.stringify({
                success: true,
                processed: messages.length,
                delivered: deliveredCount,
                failed: failedCount,
            }),
            { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
    } catch (err) {
        console.error("❌ process-message-queue error:", err);
        return new Response(
            JSON.stringify({
                success: false,
                error: err instanceof Error ? err.message : String(err),
            }),
            { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
    }
});
