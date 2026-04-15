// Supabase Edge Function: process-message-queue
// =============================================
// SUBSCRIBER in the Pub/Sub model.
//
// This function:
// 1. Picks up pending messages from message_queue (batch of N)
// 2. Sends each message via WhatsApp Business API directly
// 3. Marks each as delivered or failed
// 4. Implements exponential backoff for retries
// 5. Moves permanently failed messages to dead_letter
//
// Trigger: pg_cron every 30 seconds, or manually via HTTP POST.
// Deploy:  supabase functions deploy process-message-queue
// =============================================

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const BATCH_SIZE = 10;           // Process N messages per invocation
const RATE_LIMIT_DELAY_MS = 500; // Delay between sends (WA API rate limit safety)
const WA_API_VERSION = "v20.0";

const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function sleep(ms: number) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

// Send a single WhatsApp template message
async function sendWhatsAppTemplate(
    phoneNumberId: string,
    token: string,
    toPhone: string,      // e.g. "919145414083" (no + sign)
    templateName: string,
    languageCode: string,
    params: string[],     // ordered list of body param values
    category?: string,    // template category (AUTHENTICATION needs button component)
): Promise<{ success: boolean; messageId?: string; error?: string }> {
    const url = `https://graph.facebook.com/${WA_API_VERSION}/${phoneNumberId}/messages`;

    // Build components array
    const components: Record<string, unknown>[] = [];

    if (params.length > 0) {
        components.push({
            type: "body",
            parameters: params.map((p) => ({ type: "text", text: String(p) })),
        });
    }

    // AUTHENTICATION templates (OTP) require a button component with the OTP code
    if (category === "AUTHENTICATION" && params.length > 0) {
        components.push({
            type: "button",
            sub_type: "url",
            index: "0",
            parameters: [{ type: "text", text: String(params[0]) }],
        });
    }

    const body: Record<string, unknown> = {
        messaging_product: "whatsapp",
        to: toPhone,
        type: "template",
        template: {
            name: templateName,
            language: { code: languageCode },
            components,
        },
    };

    const res = await fetch(url, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${token}`,
        },
        body: JSON.stringify(body),
    });

    const json = await res.json();

    if (!res.ok || json.error) {
        const errMsg = json.error?.message || json.error?.error_data?.details || `HTTP ${res.status}`;
        return { success: false, error: errMsg };
    }

    const messageId = json.messages?.[0]?.id;
    return { success: true, messageId };
}

Deno.serve(async (req) => {
    if (req.method === "OPTIONS") {
        return new Response("ok", { headers: corsHeaders });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    try {
        // 1. Load WhatsApp config from session_settings
        const { data: settings, error: settingsError } = await supabase
            .from("session_settings")
            .select("wa_api_token, wa_phone_number_id, wa_language_code")
            .maybeSingle();

        if (settingsError) throw new Error(`Settings error: ${settingsError.message}`);

        const waToken = settings?.wa_api_token;
        const phoneNumberId = settings?.wa_phone_number_id || "808910018982018";
        const languageCode = settings?.wa_language_code || "en";

        console.log(`🔍 [QueueProcessor] WA Token present: ${!!waToken}, Phone ID: ${phoneNumberId}`);

        if (!waToken) {
            console.error(`❌ [QueueProcessor] Missing WhatsApp API token in session_settings`);
            return new Response(
                JSON.stringify({ success: false, error: "WhatsApp API token not configured in session_settings" }),
                { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
        }

        // 2. Fetch pending messages ready for processing
        const now = new Date().toISOString();
        console.log(`🔍 [QueueProcessor] Fetching messages with status=pending/failed and next_retry_at <= ${now}`);

        const { data: messages, error: fetchError } = await supabase
            .from("message_queue")
            .select("*")
            .or("status.eq.pending,status.eq.failed")
            .lte("next_retry_at", now)
            .lt("retry_count", 3)
            .order("created_at", { ascending: true })
            .limit(BATCH_SIZE);

        if (fetchError) throw new Error(`Queue fetch error: ${fetchError.message}`);

        if (!messages || messages.length === 0) {
            console.log(`ℹ️ [QueueProcessor] No pending messages found in queue.`);
            return new Response(
                JSON.stringify({ success: true, processed: 0, message: "Queue empty" }),
                { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
        }

        console.log(`📋 [QueueProcessor] Processing ${messages.length} messages...`);

        // 3. Claim messages (mark as processing)
        const messageIds = messages.map((m: any) => m.id);
        await supabase
            .from("message_queue")
            .update({ status: "processing", updated_at: new Date().toISOString() })
            .in("id", messageIds);

        // 4. Send each message via WhatsApp API
        let deliveredCount = 0;
        let failedCount = 0;
        const batchUpdates: Record<string, { delivered: number; failed: number }> = {};

        for (const msg of messages) {
            // Normalise phone: strip any non-digits, ensure no leading +
            let phone = (msg.phone || "").replace(/\D/g, "");
            // If it's a 10-digit number, assume it's an Indian number and add the 91 country code
            if (phone.length === 10) {
                phone = "91" + phone;
            }
            
            const params: string[] = Array.isArray(msg.template_params) ? msg.template_params : [];

            const result = await sendWhatsAppTemplate(
                phoneNumberId,
                waToken,
                phone,
                msg.template_name,
                languageCode,
                params,
                msg.template_category,
            );

            if (result.success) {
                await supabase
                    .from("message_queue")
                    .update({
                        status: "delivered",
                        delivered_at: new Date().toISOString(),
                        processed_at: new Date().toISOString(),
                        updated_at: new Date().toISOString(),
                        last_error: null,
                    })
                    .eq("id", msg.id);

                await supabase.from("reminder_logs").insert({
                    batch_time: msg.batch_label || "QUEUE",
                    phone: msg.phone,
                    status: "success",
                });

                deliveredCount++;
                if (!batchUpdates[msg.batch_id]) batchUpdates[msg.batch_id] = { delivered: 0, failed: 0 };
                batchUpdates[msg.batch_id].delivered++;

                console.log(`✅ Sent to ${msg.phone} (wamid: ${result.messageId})`);
            } else {
                const newRetryCount = (msg.retry_count || 0) + 1;
                const isDeadLetter = newRetryCount >= (msg.max_retries || 3);
                const backoffSeconds = Math.pow(4, newRetryCount) * 30;
                const nextRetry = new Date(Date.now() + backoffSeconds * 1000).toISOString();

                await supabase
                    .from("message_queue")
                    .update({
                        status: isDeadLetter ? "dead_letter" : "failed",
                        retry_count: newRetryCount,
                        last_error: (result.error || "Unknown error").substring(0, 500),
                        next_retry_at: isDeadLetter ? null : nextRetry,
                        processed_at: new Date().toISOString(),
                        updated_at: new Date().toISOString(),
                    })
                    .eq("id", msg.id);

                await supabase.from("reminder_logs").insert({
                    batch_time: msg.batch_label || "QUEUE",
                    phone: msg.phone,
                    status: "failed",
                    error_message: (result.error || "").substring(0, 200),
                });

                failedCount++;
                if (!batchUpdates[msg.batch_id]) batchUpdates[msg.batch_id] = { delivered: 0, failed: 0 };
                batchUpdates[msg.batch_id].failed++;

                console.error(`❌ Failed for ${msg.phone}: ${result.error}`);
            }

            await sleep(RATE_LIMIT_DELAY_MS);
        }

        // 5. Update batch summary records
        for (const [batchId, counts] of Object.entries(batchUpdates)) {
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

        console.log(`📊 Done: ${deliveredCount} delivered, ${failedCount} failed`);

        return new Response(
            JSON.stringify({ success: true, processed: messages.length, delivered: deliveredCount, failed: failedCount }),
            { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );

    } catch (err) {
        console.error("❌ process-message-queue error:", err);
        return new Response(
            JSON.stringify({ success: false, error: err instanceof Error ? err.message : String(err) }),
            { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
    }
});
