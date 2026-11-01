import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const VERIFY_TOKEN = Deno.env.get("VERIFY_TOKEN") || "snehyoga_webhook_token_2026";
const WA_API_VERSION = "v20.0";
const DEFAULT_META_TOKEN = "EAAPkGZC1jq5YBSk3DxrmHGBbtfrHCWrbFoN1LmMQBi9EbZAnRcbiQtcy72J9abjpQNVURVV7bNdSJGBeG9ZAsZCUhDkFsJc8FYXtTvqhDnaZBFjDVNFuDYOkFZBKFMHZAEhOIrrVaACnKqZCKLhrKnSPmCEZCOAZBER1zS85tKHZCRoyYlcdGBOSQXA4iGjRrpS4AZDZD";
const DEFAULT_PHONE_ID = "1325180137347203";
const ALT_PHONE_ID = "808910018982018";

const DEFAULT_SUPABASE_URL = "https://bzqwaxqzggejpejyxhde.supabase.co";
const DEFAULT_SUPABASE_KEY = "sb_publishable_aWZ6_LgTmBCAj7RHgmoDwg_YB4H1Ts4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Helper: extract slug from referral link e.g. "https://yog.snehyoga.com/?ref=snehfgh05" -> "snehfgh05"
function getSlug(referralLink: string | null): string {
  if (!referralLink) return "default";
  const refMatch = referralLink.match(/ref=([^&]+)/);
  if (refMatch?.[1]) return refMatch[1];
  const joinMatch = referralLink.match(/\/join\/([^/?]+)/);
  if (joinMatch?.[1]) return joinMatch[1];
  const clean = referralLink.replace(/https?:\/\/[^/]+\/?/, "").replace(/\?.*/, "").trim();
  return clean || "default";
}

// Helper: Format recipient phone number with Indian country code 91
function formatWaPhone(phone: string): string {
  let clean = (phone || "").replace(/\D/g, "");
  if (clean.length === 10) {
    clean = "91" + clean;
  }
  return clean;
}

// Send a WhatsApp message back to user via Meta Cloud API
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

  let result = await trySend(phoneNumberId);
  if (!result.ok && phoneNumberId !== DEFAULT_PHONE_ID) {
    result = await trySend(DEFAULT_PHONE_ID);
  }
  if (!result.ok && phoneNumberId !== ALT_PHONE_ID) {
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
        const metaUserName = contact?.profile?.name || "";
        const isButtonClick = message.type === "button" || message.type === "interactive";

        let userMsgText = "";
        let buttonPayload = "";

        // Extract message content based on WhatsApp message type
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

        const cleanInput = (userMsgText || buttonPayload).toLowerCase().trim();
        console.log(`💬 Incoming message from ${metaUserName || 'User'} (${fromPhone}): "${userMsgText}" (payload: "${buttonPayload}", cleanInput: "${cleanInput}")`);

        // Initialize Supabase Client
        const supabaseUrl = Deno.env.get("SUPABASE_URL") || DEFAULT_SUPABASE_URL;
        const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || Deno.env.get("SUPABASE_ANON_KEY") || DEFAULT_SUPABASE_KEY;
        const supabase = createClient(supabaseUrl, supabaseServiceKey);

        // Resolve user name: prefer Meta profile name if present, else fallback to DB main_data_registration name
        let userName = metaUserName;
        if (!userName || userName === "User" || userName.toLowerCase() === "na") {
          try {
            const last10 = fromPhone.slice(-10);
            const { data: dbUser } = await supabase
              .from("main_data_registration")
              .select("name")
              .ilike("mobile_number", `%${last10}%`)
              .maybeSingle();
            if (dbUser?.name) {
              userName = dbUser.name;
            }
          } catch (_) {}
        }
        if (!userName) userName = "User";

        // Format message stored in DB
        const dbMessageContent = isButtonClick
          ? `[Button Clicked: ${userMsgText || buttonPayload || "Option"}]`
          : (userMsgText || buttonPayload || "[Message]");

        // 1. Store incoming user message in chat_messages table for CRM Live Chat timeline
        try {
          await supabase.from("chat_messages").insert({
            user_phone: fromPhone,
            user_name: userName,
            message: dbMessageContent,
            sender_type: "user",
            is_read: false,
            created_at: new Date().toISOString()
          });
        } catch (dbErr) {
          console.warn("Could not insert to chat_messages:", dbErr);
        }

        // 2. Fetch WhatsApp API credentials & default links from session_settings
        let waToken = DEFAULT_META_TOKEN;
        let phoneNumberId = DEFAULT_PHONE_ID;
        let defaultSessionLink = "https://yoga.snehyoga.com";

        try {
          const { data: settings } = await supabase
            .from("session_settings")
            .select("wa_api_token, wa_phone_number_id, whatsapp_api_token, whatsapp_phone_number_id, session_link")
            .maybeSingle();

          if (settings?.whatsapp_api_token || settings?.wa_api_token) {
            waToken = (settings.whatsapp_api_token || settings.wa_api_token).trim();
          }
          if (settings?.whatsapp_phone_number_id || settings?.wa_phone_number_id) {
            phoneNumberId = (settings.whatsapp_phone_number_id || settings.wa_phone_number_id).trim();
          }
          if (settings?.session_link) {
            try {
              const parsedLink = typeof settings.session_link === "string" ? JSON.parse(settings.session_link) : settings.session_link;
              const days = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];
              const todayKey = `w1_${days[new Date().getDay()]}`;
              if (parsedLink?.[todayKey] || parsedLink?.w1_mon) {
                defaultSessionLink = parsedLink[todayKey] || parsedLink.w1_mon;
              }
            } catch (_) {}
          }
        } catch (_) {}

        // Look up target user's personal joining link from main_data_registration
        let userSessionLink = "https://yoga.snehyoga.com/join/default";
        try {
          const last10 = fromPhone.slice(-10);
          const { data: matchedUser } = await supabase
            .from("main_data_registration")
            .select("name, referral_link, mobile_number")
            .ilike("mobile_number", `%${last10}%`)
            .maybeSingle();

          if (matchedUser?.referral_link?.trim()) {
            const slug = getSlug(matchedUser.referral_link.trim());
            userSessionLink = `https://yoga.snehyoga.com/join/${slug}`;
          }
        } catch (_) {}

        // 3. Smart Flow Graph & Keyword Traversal Engine
        try {
          const { data: flows } = await supabase
            .from("whatsapp_flows")
            .select("*")
            .eq("status", true);

          let replySent = false;

          if (flows && flows.length > 0) {
            console.log(`🔍 Checking ${flows.length} active flow(s) for input: "${cleanInput}"`);

            for (const flow of flows) {
              const nodes = flow.nodes || [];
              const edges = flow.edges || [];

              let sourceNode = null;
              let matchedButtonIndex = -1;

              // Step A: Match explicit Trigger Nodes or Message Node Buttons
              for (const n of nodes) {
                if (n.type === "triggerNode") {
                  const keywords: string[] = n.data?.keywords || [];
                  if (keywords.length > 0 && keywords.some(k => {
                    const cleanK = k.toLowerCase().trim();
                    return cleanInput.includes(cleanK) || cleanK.includes(cleanInput);
                  })) {
                    sourceNode = n;
                    console.log(`🎯 Matched TriggerNode (${n.id}) in flow "${flow.name}"`);
                    break;
                  }
                } else if (n.type === "messageNode") {
                  const buttons = n.data?.buttons || [];
                  const btnIdx = buttons.findIndex((b: any, idx: number) => {
                    const bText = (b.text || b.title || "").toLowerCase().trim();
                    const bId = (b.id || "").toLowerCase().trim();
                    if (!bText && !bId) return false;

                    return (
                      (bText && (cleanInput.includes(bText) || bText.includes(cleanInput) || bText.startsWith(cleanInput) || cleanInput.startsWith(bText))) ||
                      (bId && (cleanInput.includes(bId) || bId.includes(cleanInput))) ||
                      buttonPayload === `btn-${idx}` ||
                      buttonPayload === `btn_${idx}` ||
                      buttonPayload === `tpl-btn-${idx}`
                    );
                  });

                  if (btnIdx !== -1) {
                    sourceNode = n;
                    matchedButtonIndex = btnIdx;
                    console.log(`🎯 Matched MessageNode button index ${btnIdx} (${n.id}) in flow "${flow.name}"`);
                    break;
                  }
                }
              }

              // Step B: Keyword fallback match for Morning / Evening session links
              if (!sourceNode) {
                for (const n of nodes) {
                  if (n.type === "messageNode") {
                    const nodeText = (n.data?.text || n.data?.label || "").toLowerCase();
                    if (nodeText && cleanInput.length >= 3) {
                      if (cleanInput.includes("morning") && nodeText.includes("morning")) {
                        sourceNode = n;
                        console.log(`🎯 Matched Morning Yoga MessageNode (${n.id})`);
                        break;
                      }
                      if (cleanInput.includes("evening") && nodeText.includes("evening")) {
                        sourceNode = n;
                        console.log(`🎯 Matched Evening Yoga MessageNode (${n.id})`);
                        break;
                      }
                    }
                  }
                }
              }

              // Step C: Route to target response node
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
                    console.log(`➡️ Connected edge to TargetNode (${targetNode?.id})`);
                  }
                }

                if (!targetNode) {
                  const fallbackEdge = edges.find((e: any) => e.source === sourceNode.id);
                  if (fallbackEdge) {
                    targetNode = nodes.find((n: any) => n.id === fallbackEdge.target);
                  }
                }

                if (!targetNode && sourceNode.type === "messageNode") {
                  targetNode = sourceNode;
                }

                if (targetNode && targetNode.type === "messageNode") {
                  let replyText = targetNode.data?.text || "";
                  let replyButtons: any[] = targetNode.data?.buttons || [];

                  const isInvalidGreeting = !userName || ["user", "na", "n/a", "null"].includes(userName.trim().toLowerCase()) || /^\+?\d+$/.test(userName.trim());
                  const nameGreeting = isInvalidGreeting ? "" : userName.trim();
                  const greetingPrefix = nameGreeting ? `Namaste ${nameGreeting} 🙏` : `Namaste 🙏`;

                  replyText = replyText
                    .replace(/Namaste\s+{{user_name}}\s*🙏?/gi, greetingPrefix)
                    .replace(/{{user_name}}/g, nameGreeting)
                    .replace(/{{session_link}}/g, userSessionLink);

                  console.log(`🚀 Sending Flow Response to ${fromPhone}:\n"${replyText}"`);
                  await sendWAMessage(phoneNumberId, waToken, fromPhone, replyText, replyButtons);

                  // Log outgoing bot reply to chat_messages table for CRM timeline
                  await supabase.from("chat_messages").insert({
                    user_phone: fromPhone,
                    user_name: userName,
                    message: replyText,
                    sender_type: "bot",
                    is_read: true,
                    created_at: new Date().toISOString()
                  });

                  console.log(`✅ Outgoing Flow Response logged in chat_messages for ${fromPhone}`);
                  replySent = true;
                  break;
                }
              }
            }
          }

          // Step D: General Fallback for Session Link requests
          if (!replySent && (cleanInput.includes("morning") || cleanInput.includes("evening") || cleanInput.includes("join") || cleanInput.includes("session") || cleanInput.includes("link"))) {
            const isInvalidGreeting = !userName || ["user", "na", "n/a", "null"].includes(userName.trim().toLowerCase()) || /^\+?\d+$/.test(userName.trim());
            const nameGreeting = isInvalidGreeting ? "" : userName.trim();
            const greetingHeader = nameGreeting ? `Namaste ${nameGreeting} 🙏` : `Namaste 🙏`;

            const fallbackText = `${greetingHeader}\n\nYour Yoga Session link is ready! 🧘✨\n\nPersonal Joining Link: ${userSessionLink}\n\nPlease join 5 minutes early with your yoga mat ready. Let's start with positive energy!\n\nSneha Yoga Studio 🌸`;
            
            console.log(`🚀 Sending Direct Session Link Fallback to ${fromPhone}`);
            await sendWAMessage(phoneNumberId, waToken, fromPhone, fallbackText);

            await supabase.from("chat_messages").insert({
              user_phone: fromPhone,
              user_name: userName,
              message: fallbackText,
              sender_type: "bot",
              is_read: true,
              created_at: new Date().toISOString()
            });

            console.log(`✅ Direct Session Link Fallback logged in chat_messages for ${fromPhone}`);
            replySent = true;
          }

          // Step E: Gemini AI Studio Auto-Responder with RAG Knowledge Base
          if (!replySent && userMsgText.trim().length > 0) {
            try {
              const { data: aiSettings } = await supabase
                .from("session_settings")
                .select("google_ai_studio_key, ai_system_prompt, ai_enabled, ai_allowed_numbers")
                .maybeSingle();

              const isAiEnabled = aiSettings?.ai_enabled ?? true;
              const aiApiKey = (aiSettings?.google_ai_studio_key || Deno.env.get("GEMINI_API_KEY") || "").trim();
              const allowedNumbers = (aiSettings?.ai_allowed_numbers || "*").trim();

              const isAllowed = !allowedNumbers || allowedNumbers === "*" || allowedNumbers.split(",").map(p => formatWaPhone(p.trim())).includes(fromPhone);

              if (isAiEnabled && isAllowed) {
                console.log(`🤖 Evaluating AI Auto-Responder for incoming message from ${fromPhone}: "${userMsgText}"`);

                // 1. Fetch Knowledge Base from ai_knowledge_base
                const { data: kbData } = await supabase
                  .from("ai_knowledge_base")
                  .select("category, question, answer");

                const kbItems: Array<{ category: string; question: string; answer: string }> = kbData || [];

                // 2. Fetch Recent Conversation History for this user from chat_messages
                // Note: The incoming message was already inserted into chat_messages earlier in the function.
                const { data: rawHistory } = await supabase
                  .from("chat_messages")
                  .select("sender_type, message, created_at")
                  .eq("user_phone", fromPhone)
                  .order("created_at", { ascending: false })
                  .limit(12);

                let historyContext = "";
                let hasPriorHistory = false;
                if (rawHistory && rawHistory.length > 0) {
                  // rawHistory[0] is the current incoming message just saved.
                  // All subsequent messages (index 1+) are prior messages in the conversation thread.
                  const priorMessages = rawHistory
                    .slice(1)
                    .filter(m => m.message && !m.message.startsWith("[Daily Reminder:"))
                    .reverse(); // Chronological order: oldest to newest

                  if (priorMessages.length > 0) {
                    hasPriorHistory = true;
                    historyContext = priorMessages.map(m => {
                      const senderLabel = m.sender_type === "user" ? `Student (${userName})` : "Snehyoga Support";
                      const cleanMsg = m.message.replace(/^\[Button Clicked:\s*(.*?)\]$/, 'Clicked button: "$1"');
                      return `${senderLabel}: ${cleanMsg}`;
                    }).join("\n");
                  }
                }

                let aiReply = "";

                // 3. Fast-path local exact match if API key isn't provided
                if (!aiApiKey) {
                  const qLower = cleanInput.toLowerCase();
                  for (const kb of kbItems) {
                    const kbQLower = kb.question.toLowerCase();
                    if (qLower.includes(kbQLower) || kbQLower.includes(qLower) || (qLower.length > 5 && kbQLower.split(" ").filter(w => w.length > 3).some(w => qLower.includes(w)))) {
                      aiReply = kb.answer;
                      break;
                    }
                  }
                  if (!aiReply) {
                    aiReply = `Namaste ${userName !== 'User' ? userName : ''} 🙏\n\nThank you for messaging Snehyoga! Our live classes run Mon-Fri across 6 batches: 5 AM, 6 AM, 7:30 AM, 5 PM, 6 PM, 9 PM IST.\n\nPersonal Joining Link: ${userSessionLink}\n\nHow may we assist you with our yoga & wellness programs?`;
                  }
                } else {
                  // Call Google Gemini API with Conversational Memory & Language Continuity
                  const kbContext = kbItems
                    .map((k, i) => `${i + 1}. [${k.category}]\nQ: ${k.question}\nA: ${k.answer}`)
                    .join("\n\n");

                  const systemInstruction = `You are the official Customer Support Executive at Snehyoga (https://snehyoga.com/), founded by Government-Certified Yoga Teacher and Lifestyle Coach Snehal Salunkhe. Warmly, politely, and professionally assist students on WhatsApp with batch timings (5 AM, 6 AM, 7:30 AM, 5 PM, 6 PM, 9 PM IST, Mon-Fri), plans (1 Month: ₹399/-, 6 Months: ₹1,800/-, 1 Year: ₹2,400/- with Free Diet Plan), free demo sessions, and diet guidance.

Snehyoga Verified Knowledge Base:
---
${kbContext}
---

Student Information:
- Student Name: ${userName}
- Student Phone: ${fromPhone}
- Personal Student Portal Link: ${userSessionLink}

MANDATORY INSTRUCTIONS FOR WHATSAPP CUSTOMER SUPPORT:
1. MULTI-TURN CONVERSATION MEMORY & NATURAL CONTINUATION:
   - Carefully read the RECENT CONVERSATION HISTORY below to understand the dialogue so far.
   ${hasPriorHistory ? `- THIS IS AN ONGOING CONVERSATION THREAD.
   - DO NOT RE-GREET (do NOT repeat "Namaste", "नमस्कार", "Snehyoga mein aapka swagat hai", etc.) because you have already greeted the student previously!
   - Directly answer the student's question or follow-up like a natural, helpful human assistant continuing a conversation.
   - Treat short answers or fragments (e.g. "1 year", "morning", "saturday nasto ka?", "demo", "ok", "fees") as answers or follow-ups to the preceding discussion topic.` : `- THIS IS THE FIRST MESSAGE of a new conversation.
   - Greet warmly once: "Namaste ${userName !== 'User' ? userName : ''} 🙏" or "नमस्कार 🙏".`}

2. STRICT LANGUAGE CONTINUITY & SCRIPT MATCHING:
   - Detect the student's language by looking at their messages across the ENTIRE conversation history and current message:
     * MARATHI (मराठी):
       - If the student communicates in Marathi in Devanagari script (उदा. 'नमस्कार', 'क्लास कधी सुरू होतो?', 'फीस किती आहे?'): Reply in polite Marathi (Devanagari script).
       - If the student communicates in Marathi using Latin/English alphabets (e.g. 'Saturday nasto ka?', 'kas karayach', 'kay timing ahe', 'kiti fees ahe', 'mala join karaycha ahe', 'shiku shakto ka'): Reply in friendly Latin Marathi (e.g. 'Nahi, Saturday ani Sunday class nastat (holiday aste). Classes fakta Monday te Friday astat...').
       - CRITICAL RULE FOR MARATHI: When the student gives short answers (e.g. '1 year', 'ok', 'morning', 'demo', 'fees', 'yes', 'ho'), NEVER SWITCH TO HINDI OR ENGLISH! RETAIN MARATHI.
     * HINDI / HINGLISH:
       - If the student communicates in Hindi or Hinglish (e.g. 'kya timing hai', 'kab shuru hota hai', 'kaise join kare', 'fees kitni hai', 'theek hai'): Reply in Hindi or Hinglish. Retain Hindi on short follow-ups.
     * ENGLISH:
       - If the student communicates in English: Reply in polite, clear English.
   - NEVER SWITCH LANGUAGES mid-conversation unless the student explicitly asks to switch.

3. ACCURACY & POLICIES:
   - Batch Timings: Mon-Fri across 6 batches: Morning 5:00 AM, 6:00 AM, 7:30 AM & Evening 5:00 PM, 6:00 PM, 9:00 PM IST (55 mins each). Saturday & Sunday are holidays. Students can flexibly switch batches any day.
   - Plans & Fees: 1 Month: ₹399/-, 6 Months: ₹1,800/-, 1 Year Best Value: ₹2,400/- (includes 1-Year Free Home Diet Plan).
   - Free Demo Session: Free live demo session available for any batch slot.
   - Portal Link: ${userSessionLink}

4. BREVITY & WHATSAPP FORMAT:
   - Keep answers clear, polite, warm, and concise (strictly under 65 words for WhatsApp readability).
   - Use clean line breaks and relevant emojis (🙏, 🧘, 🌿, ✨).`;

                  const userContentText = `${systemInstruction}

=== RECENT CONVERSATION HISTORY ===
${historyContext || "(No previous messages. Start of conversation.)"}
===================================

CURRENT INCOMING MESSAGE:
Student (${userName}): "${userMsgText}"

Reply directly to the student as Snehyoga Support:`;

                  const models = ["gemini-3.5-flash-lite", "gemini-3.5-flash", "gemini-3.8-flash", "gemini-flash-lite-latest"];
                  for (const model of models) {
                    try {
                      const geminiRes = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${aiApiKey}`, {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                          contents: [
                            {
                              role: "user",
                              parts: [
                                { text: userContentText }
                              ]
                            }
                          ]
                        })
                      });

                      if (geminiRes.ok) {
                        const geminiJson = await geminiRes.json();
                        const candidateText = geminiJson.candidates?.[0]?.content?.parts?.[0]?.text || "";
                        if (candidateText.trim()) {
                          aiReply = candidateText.trim();
                          break;
                        }
                      } else {
                        console.warn(`Gemini model ${model} HTTP status:`, geminiRes.status);
                      }
                    } catch (mErr) {
                      console.warn(`Gemini model ${model} fetch failed:`, mErr);
                    }
                  }
                }

                if (aiReply) {
                  console.log(`🤖 Sending AI Auto-Reply to ${fromPhone}:\n"${aiReply}"`);
                  await sendWAMessage(phoneNumberId, waToken, fromPhone, aiReply);

                  await supabase.from("chat_messages").insert({
                    user_phone: fromPhone,
                    user_name: userName,
                    message: aiReply,
                    sender_type: "bot",
                    is_read: true,
                    created_at: new Date().toISOString()
                  });

                  console.log(`✅ Outgoing AI Auto-Reply logged in chat_messages for ${fromPhone}`);
                  replySent = true;
                }
              }
            } catch (aiErr) {
              console.error("AI auto-responder error in webhook:", aiErr);
            }
          }

        } catch (flowErr) {
          console.warn("Could not process flow graph:", flowErr);
        }
      }

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    } catch (error) {
      console.error("Webhook processing error:", error);
      return new Response(JSON.stringify({ success: true, warning: "Processed with error handling" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }
  }

  return new Response("Method not allowed", { status: 405 });
});

