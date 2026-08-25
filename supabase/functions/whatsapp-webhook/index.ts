import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const VERIFY_TOKEN = Deno.env.get("VERIFY_TOKEN") || "snehyoga_webhook_token_2026";
const WA_API_VERSION = "v20.0";
const DEFAULT_META_TOKEN = "EAAX2HQ7QpvUBSZAK3krfGE7pLN8pW3WoUZCSJZCJsZB4oallIQNagAXwCqENBRZBO3kOGbABFyeI0IqrkZAsuA5lft4kVWrtuoy9MylP9RDz2BV5uEFLjNFBNuU9CJqzFMEMYLZBTn8ZCswZCE8CubZCg0KliOITU9t43FlGZA6HBSyS819nxhAdvTZBOl8IhT5tbV2LHQZDZD";
const DEFAULT_PHONE_ID = "1230157110176906"; // Primary Real Phone ID
const ALT_PHONE_ID = "808910018982018";

const DEFAULT_SUPABASE_URL = "https://bzqwaxqzggejpejyxhde.supabase.co";
const DEFAULT_SUPABASE_KEY = "sb_publishable_aWZ6_LgTmBCAj7RHgmoDwg_YB4H1Ts4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Helper: Format recipient phone number with Indian country code 91
function formatWaPhone(phone: string): string {
  let clean = (phone || "").replace(/\D/g, "");
  if (clean.length === 10) {
    clean = "91" + clean;
  }
  return clean;
}

// Send a WhatsApp message back to user via Meta Cloud API with fallback Phone ID
async function sendWAMessage(phoneNumberId: string, waToken: string, toPhone: string, bodyText: string, buttons?: any[]) {
  const formattedPhone = formatWaPhone(toPhone);
  
  let payload: any = {
    messaging_product: "whatsapp",
    to: formattedPhone,
  };

  if (buttons && buttons.length > 0) {
    payload.type = "interactive";
    payload.interactive = {
      type: "button",
      body: { text: bodyText },
      action: {
        buttons: buttons.slice(0, 3).map((b, idx) => ({
          type: "reply",
          reply: {
            id: String(b.id || `btn_${idx}`),
            title: String(b.text || b.title || `Option ${idx+1}`).substring(0, 20)
          }
        }))
      }
    };
  } else {
    payload.type = "text";
    payload.text = { body: bodyText };
  }

  const trySend = async (pid: string) => {
    const url = `https://graph.facebook.com/${WA_API_VERSION}/${pid}/messages`;
    console.log(`📡 Sending Meta API POST to PhoneID ${pid} -> ${formattedPhone}...`);
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${waToken}`
      },
      body: JSON.stringify(payload)
    });
    const json = await res.json();
    console.log(`📤 Meta API response for ${pid} (${res.status}):`, JSON.stringify(json));
    return { ok: res.ok, status: res.status, json };
  };

  // Attempt 1: Try with passed phoneNumberId
  let result = await trySend(phoneNumberId);

  // Attempt 2: If failed, retry with DEFAULT_PHONE_ID if different
  if (!result.ok && phoneNumberId !== DEFAULT_PHONE_ID) {
    console.log(`⚠️ Primary PhoneID ${phoneNumberId} failed. Retrying with ${DEFAULT_PHONE_ID}...`);
    result = await trySend(DEFAULT_PHONE_ID);
  }

  // Attempt 3: If still failed, try ALT_PHONE_ID
  if (!result.ok && phoneNumberId !== ALT_PHONE_ID) {
    console.log(`⚠️ Retrying with fallback PhoneID ${ALT_PHONE_ID}...`);
    result = await trySend(ALT_PHONE_ID);
  }

  return result.json;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  // Handle GET Webhook Verification from Meta Developer Console
  if (req.method === "GET") {
    const url = new URL(req.url);
    const mode = url.searchParams.get("hub.mode");
    const token = url.searchParams.get("hub.verify_token");
    const challenge = url.searchParams.get("hub.challenge");

    if (mode === "subscribe" && token === VERIFY_TOKEN) {
      console.log("✅ Webhook verified successfully!");
      return new Response(challenge, { status: 200 });
    } else {
      console.error("❌ Webhook verification failed. Token mismatch.");
      return new Response("Forbidden", { status: 403 });
    }
  }

  // Handle POST requests for incoming WhatsApp messages/button clicks
  if (req.method === "POST") {
    try {
      const body = await req.json().catch(() => ({}));
      console.log("📩 Received Webhook Event:", JSON.stringify(body, null, 2));

      const entry = body.entry?.[0];
      const change = entry?.changes?.[0]?.value;
      const message = change?.messages?.[0];
      const contact = change?.contacts?.[0];

      if (message) {
        const rawFromPhone = message.from; // e.g. "919145414083"
        const fromPhone = formatWaPhone(rawFromPhone);
        const userName = contact?.profile?.name || "User";

        let userMsgText = "";
        let buttonPayload = "";

        // Extract message content based on WhatsApp type
        if (message.type === "text") {
          userMsgText = message.text?.body || "";
        } else if (message.type === "button") {
          userMsgText = message.button?.text || "";
          buttonPayload = message.button?.payload || message.button?.text || "";
        } else if (message.type === "interactive") {
          const interactive = message.interactive;
          if (interactive.type === "button_reply") {
            userMsgText = interactive.button_reply?.title || "";
            buttonPayload = interactive.button_reply?.id || interactive.button_reply?.title || "";
          } else if (interactive.type === "list_reply") {
            userMsgText = interactive.list_reply?.title || "";
            buttonPayload = interactive.list_reply?.id || interactive.list_reply?.title || "";
          }
        }

        console.log(`💬 Message from ${userName} (${fromPhone}): "${userMsgText}" (payload: "${buttonPayload}")`);

        // Initialize Supabase Client
        const supabaseUrl = Deno.env.get("SUPABASE_URL") || DEFAULT_SUPABASE_URL;
        const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || Deno.env.get("SUPABASE_ANON_KEY") || DEFAULT_SUPABASE_KEY;
        const supabase = createClient(supabaseUrl, supabaseServiceKey);

        // 1. Store incoming message in chat_messages table for CRM Live Chat
        try {
          await supabase.from("chat_messages").insert({
            user_phone: fromPhone,
            user_name: userName,
            message: userMsgText || buttonPayload || "[Button Click]",
            sender_type: "user",
            is_read: false,
            created_at: new Date().toISOString()
          });
        } catch (dbErr) {
          console.warn("Could not insert to chat_messages:", dbErr);
        }

        // 2. Fetch WhatsApp API config from session_settings or use fallback
        let waToken = DEFAULT_META_TOKEN;
        let phoneNumberId = DEFAULT_PHONE_ID;

        try {
          const { data: settings } = await supabase
            .from("session_settings")
            .select("wa_api_token, wa_phone_number_id")
            .maybeSingle();

          if (settings?.wa_api_token) waToken = settings.wa_api_token.trim();
          if (settings?.wa_phone_number_id) phoneNumberId = settings.wa_phone_number_id.trim();
        } catch (_) {}

        // 3. Determine Response Message using Flow Graph Edge Traversal Engine
        let replyText = `Namaste ${userName}! Welcome to Sneha Yoga 🙏 How can we help you today?`;
        let replyButtons: any[] = [
          { id: "btn_class", text: "Yoga Class Schedule" },
          { id: "btn_pricing", text: "Subscription Plans" }
        ];

        // 4. Graph Edge Traversal for Flow Builder
        try {
          const { data: flows } = await supabase
            .from("whatsapp_flows")
            .select("*")
            .eq("status", true);

          if (flows && flows.length > 0) {
            const cleanInput = (userMsgText || buttonPayload).toLowerCase().trim();

            for (const flow of flows) {
              const nodes = flow.nodes || [];
              const edges = flow.edges || [];

              let sourceNode = null;
              let matchedButtonIndex = -1;

              for (const n of nodes) {
                if (n.type === "triggerNode") {
                  const keywords: string[] = n.data?.keywords || [];
                  if (keywords.length === 0 || keywords.some(k => cleanInput.includes(k.toLowerCase().trim()))) {
                    sourceNode = n;
                    break;
                  }
                } else if (n.type === "messageNode") {
                  const buttons = n.data?.buttons || [];
                  const btnIdx = buttons.findIndex((b: any) => 
                    cleanInput.includes((b.text || "").toLowerCase().trim()) ||
                    cleanInput.includes((b.id || "").toLowerCase().trim())
                  );

                  if (btnIdx !== -1) {
                    sourceNode = n;
                    matchedButtonIndex = btnIdx;
                    break;
                  }

                  const aiKeyword = n.data?.aiKeyword || "";
                  if (aiKeyword && cleanInput.includes(aiKeyword.toLowerCase().trim())) {
                    sourceNode = n;
                    break;
                  }
                }
              }

              if (sourceNode) {
                let targetNode = null;

                if (matchedButtonIndex !== -1) {
                  const targetEdge = edges.find((e: any) => 
                    e.source === sourceNode.id && (
                      e.sourceHandle === `tpl-btn-${matchedButtonIndex}` ||
                      e.sourceHandle === `btn-${matchedButtonIndex}` ||
                      e.sourceHandle === `btn_${matchedButtonIndex}` ||
                      e.sourceHandle === String(matchedButtonIndex)
                    )
                  );

                  if (targetEdge) {
                    targetNode = nodes.find((n: any) => n.id === targetEdge.target);
                  }
                }

                if (!targetNode) {
                  const fallbackEdge = edges.find((e: any) => e.source === sourceNode.id);
                  if (fallbackEdge) {
                    targetNode = nodes.find((n: any) => n.id === fallbackEdge.target);
                  }
                }

                if (!targetNode) targetNode = sourceNode;

                if (targetNode && targetNode.type === "messageNode") {
                  replyText = targetNode.data?.text || replyText;
                  replyButtons = targetNode.data?.buttons || [];

                  replyText = replyText
                    .replace(/{{user_name}}/g, userName)
                    .replace(/{{session_link}}/g, "https://yoga.snehyoga.com");
                  break;
                }
              }
            }
          }
        } catch (flowErr) {
          console.warn("Could not traverse flow graph:", flowErr);
        }

        // 5. Send Auto-Reply back to WhatsApp User
        console.log(`🚀 Sending flow auto-reply to ${fromPhone}...`);
        await sendWAMessage(phoneNumberId, waToken, fromPhone, replyText, replyButtons);

        // 6. Log outgoing bot message in chat_messages table
        try {
          await supabase.from("chat_messages").insert({
            user_phone: fromPhone,
            user_name: "Bot",
            message: replyText,
            sender_type: "bot",
            is_read: true,
            created_at: new Date().toISOString()
          });
        } catch (_) {}
      }

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    } catch (error) {
      console.error("Webhook processing caught error:", error);
      return new Response(JSON.stringify({ success: true, warning: "Processed with fallback" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }
  }

  return new Response("Method not allowed", { status: 405 });
});
