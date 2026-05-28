import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const VERIFY_TOKEN = Deno.env.get("VERIFY_TOKEN") || "snehyoga_webhook_token_2026";

serve(async (req) => {
  // Handle GET requests for Webhook Verification from Meta
  if (req.method === "GET") {
    const url = new URL(req.url);
    const mode = url.searchParams.get("hub.mode");
    const token = url.searchParams.get("hub.verify_token");
    const challenge = url.searchParams.get("hub.challenge");

    if (mode === "subscribe" && token === VERIFY_TOKEN) {
      console.log("Webhook verified successfully!");
      return new Response(challenge, { status: 200 });
    } else {
      console.error("Webhook verification failed. Token mismatch.");
      return new Response("Forbidden", { status: 403 });
    }
  }

  // Handle POST requests for incoming WhatsApp messages/events
  if (req.method === "POST") {
    try {
      const body = await req.json();
      console.log("Received Webhook Event:", JSON.stringify(body, null, 2));

      // Add your logic to process the incoming messages here.
      // E.g., Save to database, trigger flows, etc.
      // ...

      return new Response(JSON.stringify({ success: true }), {
        headers: { "Content-Type": "application/json" },
        status: 200,
      });
    } catch (error) {
      console.error("Error processing webhook:", error);
      return new Response(JSON.stringify({ error: "Invalid request payload" }), {
        headers: { "Content-Type": "application/json" },
        status: 400,
      });
    }
  }

  return new Response("Method not allowed", { status: 405 });
});
