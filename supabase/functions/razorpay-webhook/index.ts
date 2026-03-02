// Supabase Edge Function: razorpay-webhook
// Receives Razorpay "payment.captured" webhook events and creates/updates users in the CRM.
//
// Deploy:  supabase functions deploy razorpay-webhook
// Set secret:  supabase secrets set RAZORPAY_WEBHOOK_SECRET=your-secret-here
//
// Then configure in Razorpay Dashboard → Settings → Webhooks:
//   URL: https://bzqwaxqzggejpejyxhde.supabase.co/functions/v1/razorpay-webhook
//   Event: payment.captured
//   Secret: (same secret you set above)

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// ---------------------------------------------------------------------------
// Plan mapping: amount in paise → { days, plan name }
// ---------------------------------------------------------------------------
const PLAN_MAP: Record<number, { days: number; plan: string }> = {
    240000: { days: 365, plan: "12 Months" }, // ₹2,400
    180000: { days: 190, plan: "6 Months" },  // ₹1,800
    39900: { days: 30, plan: "1 Month" },   // ₹399
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Verify Razorpay webhook signature using Web Crypto (HMAC-SHA256). */
async function verifySignature(
    rawBody: string,
    signature: string,
    secret: string
): Promise<boolean> {
    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
        "raw",
        encoder.encode(secret),
        { name: "HMAC", hash: "SHA-256" },
        false,
        ["sign"]
    );
    const signatureBuffer = await crypto.subtle.sign(
        "HMAC",
        key,
        encoder.encode(rawBody)
    );
    const computedHex = Array.from(new Uint8Array(signatureBuffer))
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("");
    return computedHex === signature;
}

/** Normalize phone number: ensure it starts with +91 for Indian numbers. */
function normalizePhone(phone: string): string {
    if (!phone) return phone;
    const digits = phone.replace(/\D/g, "");
    if (digits.length === 10) return `+91${digits}`;
    if (digits.length === 12 && digits.startsWith("91")) return `+${digits}`;
    if (digits.length === 13 && phone.startsWith("+")) return phone;
    return phone; // return as-is if format is unknown
}

// ---------------------------------------------------------------------------
// Main handler
// ---------------------------------------------------------------------------
Deno.serve(async (req: Request) => {
    const corsHeaders = {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers":
            "authorization, x-client-info, apikey, content-type, x-razorpay-signature",
    };

    // Handle CORS preflight
    if (req.method === "OPTIONS") {
        return new Response("ok", { headers: corsHeaders });
    }

    if (req.method !== "POST") {
        return new Response(JSON.stringify({ error: "Method not allowed" }), {
            status: 405,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
    }

    try {
        const rawBody = await req.text();
        const webhookSecret = Deno.env.get("RAZORPAY_WEBHOOK_SECRET");

        // --------------- Signature Verification ---------------
        if (webhookSecret) {
            const razorpaySignature =
                req.headers.get("x-razorpay-signature") ?? "";
            if (!razorpaySignature) {
                console.warn("Missing x-razorpay-signature header");
                return new Response(JSON.stringify({ error: "Missing signature" }), {
                    status: 401,
                    headers: { ...corsHeaders, "Content-Type": "application/json" },
                });
            }
            const isValid = await verifySignature(
                rawBody,
                razorpaySignature,
                webhookSecret
            );
            if (!isValid) {
                console.error("Invalid webhook signature");
                return new Response(
                    JSON.stringify({ error: "Invalid signature" }),
                    {
                        status: 401,
                        headers: { ...corsHeaders, "Content-Type": "application/json" },
                    }
                );
            }
        } else {
            console.warn("RAZORPAY_WEBHOOK_SECRET not set — skipping signature check");
        }

        // --------------- Parse Payload ---------------
        const body = JSON.parse(rawBody);
        console.log("Razorpay webhook event:", body.event);

        // Only handle payment.captured
        if (body.event !== "payment.captured") {
            return new Response(
                JSON.stringify({ message: `Event '${body.event}' ignored` }),
                {
                    status: 200,
                    headers: { ...corsHeaders, "Content-Type": "application/json" },
                }
            );
        }

        const payment = body?.payload?.payment?.entity;
        if (!payment) {
            throw new Error("No payment entity found in webhook payload");
        }

        const amountPaise: number = payment.amount; // Razorpay sends in paise
        const contactRaw: string = payment.contact ?? "";
        const emailRaw: string = payment.email ?? "";
        const paymentId: string = payment.id;
        const orderId: string = payment.order_id ?? "";

        // Extract name from notes (Razorpay payment links may populate notes)
        const notes = payment.notes ?? {};
        let nameRaw: string = "Razorpay User";

        if (notes.first_name || notes.last_name) {
            nameRaw = [notes.first_name, notes.last_name].filter(Boolean).join(" ").trim();
        } else {
            nameRaw = notes.name ??
                notes.customer_name ??
                payment.description ??
                "Razorpay User";
        }

        const phone = normalizePhone(contactRaw);

        if (!phone) {
            throw new Error("No phone number found in payment payload");
        }

        // --------------- Map Amount → Plan ---------------
        const planInfo = PLAN_MAP[amountPaise];
        if (!planInfo) {
            console.warn(
                `Unknown amount ${amountPaise} paise (₹${amountPaise / 100}). No plan matched.`
            );
            return new Response(
                JSON.stringify({
                    message: `Amount ₹${amountPaise / 100} not matched to any plan`,
                }),
                {
                    status: 200,
                    headers: { ...corsHeaders, "Content-Type": "application/json" },
                }
            );
        }

        const { days, plan } = planInfo;
        console.log(
            `Payment captured: ₹${amountPaise / 100} → Plan: ${plan}, Days: ${days}, Phone: ${phone}`
        );

        // --------------- Upsert into CRM ---------------
        const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
        const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
        const supabase = createClient(supabaseUrl, supabaseServiceKey);

        // Check if user already exists
        const { data: existingUser, error: lookupError } = await supabase
            .from("main_data_registration")
            .select("id, days_left, name")
            .eq("mobile_number", phone)
            .maybeSingle();

        if (lookupError) {
            throw new Error(`Lookup error: ${lookupError.message}`);
        }

        let resultMessage = "";

        if (existingUser) {
            // --- Existing user: top up days ---
            const newDaysLeft = (existingUser.days_left ?? 0) + days;
            const { error: updateError } = await supabase
                .from("main_data_registration")
                .update({
                    days_left: newDaysLeft,
                    subscription_plan: plan,
                    subscription_paused: false,
                    last_payment_id: paymentId,
                    last_order_id: orderId,
                })
                .eq("id", existingUser.id);

            if (updateError) throw new Error(`Update error: ${updateError.message}`);

            resultMessage = `Updated existing user '${existingUser.name}' → days_left: ${newDaysLeft}, plan: ${plan}`;
            console.log("✅", resultMessage);
        } else {
            // --- New user: insert ---
            // Generate a referral link similar to the frontend signup logic
            const cleanName = nameRaw.toLowerCase().replace(/\s+/g, '');
            const randomNumber = Math.floor(Math.random() * 100).toString().padStart(2, '0');
            const newUserReferralCode = `sneh${cleanName}${randomNumber}`;
            const referralLink = `https://testv1356.netlify.app/?ref=${newUserReferralCode}`;

            const { error: insertError } = await supabase
                .from("main_data_registration")
                .insert({
                    name: nameRaw,
                    mobile_number: phone,
                    days_left: days,
                    subscription_plan: plan,
                    subscription_paused: false,
                    referral_link: referralLink,
                    created_at: new Date().toISOString(),
                    last_payment_id: paymentId,
                    last_order_id: orderId,
                });

            if (insertError) throw new Error(`Insert error: ${insertError.message}`);

            resultMessage = `Created new user '${nameRaw}' (${phone}) → days_left: ${days}, plan: ${plan}`;
            console.log("✅", resultMessage);
        }

        return new Response(
            JSON.stringify({ success: true, message: resultMessage }),
            {
                status: 200,
                headers: { ...corsHeaders, "Content-Type": "application/json" },
            }
        );
    } catch (err) {
        console.error("❌ razorpay-webhook error:", err);
        return new Response(
            JSON.stringify({
                success: false,
                error: err instanceof Error ? err.message : String(err),
            }),
            {
                status: 500,
                headers: { ...corsHeaders, "Content-Type": "application/json" },
            }
        );
    }
});
