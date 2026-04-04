// Supabase Edge Function: sap-otp
// ================================
// Handles WhatsApp OTP send & verify for the SAP portal.
//
// POST body:
//   { action: "send",   phone: "919145414083" }
//   { action: "verify", phone: "919145414083", otp: "741258" }
//
// Deploy: supabase functions deploy sap-otp

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

async function hashOtp(otp: string): Promise<string> {
    const buffer = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(otp));
    return Array.from(new Uint8Array(buffer)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

Deno.serve(async (req) => {
    if (req.method === "OPTIONS") {
        return new Response("ok", { headers: corsHeaders });
    }

    const supabase = createClient(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const respond = (data: object, status = 200) =>
        new Response(JSON.stringify(data), {
            status,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
        });

    try {
        const { action, phone, otp } = await req.json();

        if (!phone) return respond({ success: false, error: "Phone is required" }, 400);

        // ── SEND OTP ──────────────────────────────────────────────
        if (action === "send") {
            // Generate 6-digit OTP
            const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
            const otpHash = await hashOtp(otpCode);

            // Invalidate any existing active OTPs for this phone
            await supabase
                .from("otp_sessions")
                .update({ used: true })
                .eq("phone", phone)
                .eq("used", false);

            // Store new OTP (hashed)
            const { error: insertError } = await supabase.from("otp_sessions").insert({
                phone,
                otp_hash: otpHash,
                expires_at: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
            });

            if (insertError) throw new Error(`DB error: ${insertError.message}`);

            // Load WhatsApp config
            const { data: settings } = await supabase
                .from("session_settings")
                .select("wa_api_token, wa_phone_number_id")
                .maybeSingle();

            const token = settings?.wa_api_token;
            const phoneNumberId = settings?.wa_phone_number_id || "808910018982018";

            if (!token) return respond({ success: false, error: "WhatsApp API not configured" });

            // Send via WhatsApp OTP template
            const waRes = await fetch(`https://graph.facebook.com/v20.0/${phoneNumberId}/messages`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${token}`,
                },
                body: JSON.stringify({
                    messaging_product: "whatsapp",
                    to: phone.replace(/\D/g, ""),
                    type: "template",
                    template: {
                        name: "otp",
                        language: { code: "en" },
                        components: [
                            {
                                type: "body",
                                parameters: [{ type: "text", text: otpCode }],
                            },
                            {
                                type: "button",
                                sub_type: "url",
                                index: "0",
                                parameters: [{ type: "text", text: otpCode }],
                            },
                        ],
                    },
                }),
            });

            const waJson = await waRes.json();
            if (!waRes.ok || waJson.error) {
                throw new Error(waJson.error?.message || `WhatsApp API error: HTTP ${waRes.status}`);
            }

            console.log(`✅ OTP sent to ${phone}`);
            return respond({ success: true });
        }

        // ── VERIFY OTP ────────────────────────────────────────────
        if (action === "verify") {
            if (!otp) return respond({ verified: false, error: "OTP is required" }, 400);

            const otpHash = await hashOtp(String(otp));

            const { data: session } = await supabase
                .from("otp_sessions")
                .select("id")
                .eq("phone", phone)
                .eq("otp_hash", otpHash)
                .eq("used", false)
                .gt("expires_at", new Date().toISOString())
                .order("created_at", { ascending: false })
                .limit(1)
                .maybeSingle();

            if (!session) {
                return respond({ verified: false, error: "Invalid or expired OTP" });
            }

            // Mark as used so it can't be reused
            await supabase.from("otp_sessions").update({ used: true }).eq("id", session.id);

            console.log(`✅ OTP verified for ${phone}`);
            return respond({ verified: true });
        }

        return respond({ error: "Invalid action. Use 'send' or 'verify'." }, 400);

    } catch (err) {
        console.error("sap-otp error:", err);
        return respond({ success: false, error: err instanceof Error ? err.message : String(err) }, 500);
    }
});
