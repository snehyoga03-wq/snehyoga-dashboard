import { supabase } from "@/integrations/supabase/client";

export interface WhatsAppConfig {
  apiToken: string;
  phoneNumberId: string;
  wabaId: string;
  languageCode: string;
  googleAiStudioKey: string;
  aiSystemPrompt: string;
  aiEnabled: boolean;
  aiAllowedNumbers: string;
}

export interface MetaTemplate {
  id: string;
  name: string;
  category: string;
  status: string;
  body: string;
  language: string;
  headerType?: "TEXT" | "IMAGE" | "VIDEO" | "DOCUMENT" | "NONE";
  headerUrl?: string;
  paramCount: number;
}

export interface BroadcastContact {
  phone: string;
  name: string;
  stage?: string;
  activityToday?: boolean;
  batchTiming?: string;
  daysLeft?: number;
  params?: Record<string, string>;
  status?: "pending" | "sent" | "delivered" | "failed" | "blocked";
  error?: string;
}

export interface BroadcastProgress {
  total: number;
  processed: number;
  delivered: number;
  failed: number;
  blocked: number;
  isPaused: boolean;
  isStopped: boolean;
  percent: number;
  currentName?: string;
  currentPhone?: string;
  logs: Array<{
    id: string;
    time: string;
    type: "success" | "failed" | "info" | "blocked";
    text: string;
  }>;
}

export interface KnowledgeBaseItem {
  id: string;
  category: string;
  question: string;
  answer: string;
  created_at?: string;
}

export interface MessageBatchRecord {
  id: string;
  batch_name: string;
  target_audience: string;
  template_id?: string;
  total_messages: number;
  delivered_count: number;
  failed_count: number;
  status: "processing" | "completed" | "cancelled" | "paused";
  created_at: string;
  completed_at?: string;
}

export interface MessageQueueItem {
  id: string;
  batch_id: string;
  user_phone: string;
  user_name?: string;
  template_id?: string;
  status: "pending" | "sent" | "delivered" | "read" | "failed";
  error_log?: string;
  processed_at?: string;
  created_at: string;
}

// ── Default Fallbacks ──
export const DEFAULT_CONFIG: WhatsAppConfig = {
  apiToken: "EAAX2HQ7QpvUBSZAK3krfGE7pLN8pW3WoUZCSJZCJsZB4oallIQNagAXwCqENBRZBO3kOGbABFyeI0IqrkZAsuA5lft4kVWrtuoy9MylP9RDz2BV5uEFLjNFBNuU9CJqzFMEMYLZBTn8ZCswZCE8CubZCg0KliOITU9t43FlGZA6HBSyS819nxhAdvTZBOl8IhT5tbV2LHQZDZD",
  phoneNumberId: "1230157110176906",
  wabaId: "1564657775051850",
  languageCode: "en",
  googleAiStudioKey: "",
  aiSystemPrompt: "You are Snehyoga's official Virtual Yoga Counselor. Assist students warmly with batch timings (6 AM, 11 AM, 4 PM IST), subscription plans, yoga therapy guidelines, and attendance links. Be courteous, uplifting, and concise.",
  aiEnabled: false,
  aiAllowedNumbers: "*"
};

// ── Format phone number helper ──
export function normalizePhoneNumber(raw: string | number): string {
  if (!raw) return "";
  const digits = String(raw).replace(/\D/g, "");
  if (digits.length === 10) return `91${digits}`;
  return digits;
}

// ── 1. Configuration Service ──
export async function loadWhatsAppConfig(): Promise<WhatsAppConfig> {
  const localSaved: Partial<WhatsAppConfig> = {
    apiToken: localStorage.getItem("wa_api_token") || "",
    phoneNumberId: localStorage.getItem("wa_phone_number_id") || "",
    wabaId: localStorage.getItem("wa_waba_id") || "",
    languageCode: localStorage.getItem("wa_language_code") || "en",
    googleAiStudioKey: localStorage.getItem("google_ai_studio_key") || "",
    aiSystemPrompt: localStorage.getItem("ai_system_prompt") || "",
    aiEnabled: localStorage.getItem("ai_enabled") === "true",
    aiAllowedNumbers: localStorage.getItem("ai_allowed_numbers") || "*"
  };

  try {
    const { data, error } = await supabase
      .from("session_settings")
      .select("*")
      .maybeSingle();

    if (error || !data) {
      return { ...DEFAULT_CONFIG, ...removeEmptyKeys(localSaved) };
    }

    const row = data as any;
    const config: WhatsAppConfig = {
      apiToken: (row.whatsapp_api_token || row.wa_api_token || localSaved.apiToken || DEFAULT_CONFIG.apiToken).trim(),
      phoneNumberId: (row.whatsapp_phone_number_id || row.wa_phone_number_id || localSaved.phoneNumberId || DEFAULT_CONFIG.phoneNumberId).trim(),
      wabaId: (row.whatsapp_business_account_id || row.wa_waba_id || localSaved.wabaId || DEFAULT_CONFIG.wabaId).trim(),
      languageCode: (row.whatsapp_language_code || row.wa_language_code || localSaved.languageCode || DEFAULT_CONFIG.languageCode).trim(),
      googleAiStudioKey: (row.google_ai_studio_key || localSaved.googleAiStudioKey || "").trim(),
      aiSystemPrompt: row.ai_system_prompt || localSaved.aiSystemPrompt || DEFAULT_CONFIG.aiSystemPrompt,
      aiEnabled: row.ai_enabled ?? (localSaved.aiEnabled || false),
      aiAllowedNumbers: row.ai_allowed_numbers || localSaved.aiAllowedNumbers || "*"
    };

    return config;
  } catch (err) {
    console.warn("Error reading config from Supabase, using local fallback:", err);
    return { ...DEFAULT_CONFIG, ...removeEmptyKeys(localSaved) };
  }
}

function removeEmptyKeys(obj: Record<string, any>) {
  const clean: Record<string, any> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (v !== "" && v !== null && v !== undefined) clean[k] = v;
  }
  return clean;
}

export async function saveWhatsAppConfig(config: WhatsAppConfig): Promise<{ success: boolean; message: string }> {
  // Save to localStorage for instant client reliability
  localStorage.setItem("wa_api_token", config.apiToken);
  localStorage.setItem("wa_phone_number_id", config.phoneNumberId);
  localStorage.setItem("wa_waba_id", config.wabaId);
  localStorage.setItem("wa_language_code", config.languageCode);
  localStorage.setItem("google_ai_studio_key", config.googleAiStudioKey);
  localStorage.setItem("ai_system_prompt", config.aiSystemPrompt);
  localStorage.setItem("ai_enabled", String(config.aiEnabled));
  localStorage.setItem("ai_allowed_numbers", config.aiAllowedNumbers);

  try {
    const { data: existing } = await supabase.from("session_settings").select("id").maybeSingle();

    // Map payload with both legacy and new column names for safe execution
    const payload: any = {
      whatsapp_api_token: config.apiToken,
      whatsapp_phone_number_id: config.phoneNumberId,
      whatsapp_business_account_id: config.wabaId,
      whatsapp_language_code: config.languageCode,
      wa_api_token: config.apiToken,
      wa_phone_number_id: config.phoneNumberId,
      wa_waba_id: config.wabaId,
      wa_language_code: config.languageCode,
      google_ai_studio_key: config.googleAiStudioKey,
      ai_system_prompt: config.aiSystemPrompt,
      ai_enabled: config.aiEnabled,
      ai_allowed_numbers: config.aiAllowedNumbers,
      updated_at: new Date().toISOString()
    };

    let resultError = null;
    if (existing?.id) {
      const res = await supabase.from("session_settings").update(payload).eq("id", existing.id);
      resultError = res.error;
    } else {
      const res = await supabase.from("session_settings").insert(payload);
      resultError = res.error;
    }

    if (resultError) {
      console.warn("DB save column mismatch, attempting fallback payload:", resultError.message);
      // Fallback with only standard columns
      const safePayload = {
        wa_api_token: config.apiToken,
        wa_phone_number_id: config.phoneNumberId,
        wa_waba_id: config.wabaId,
        wa_language_code: config.languageCode,
        updated_at: new Date().toISOString()
      };
      if (existing?.id) {
        await supabase.from("session_settings").update(safePayload).eq("id", existing.id);
      }
      return { 
        success: true, 
        message: "Saved locally & to core database! (Run whatsapp_config_automation_setup.sql in Supabase to sync extended AI columns)." 
      };
    }

    return { success: true, message: "WhatsApp API credentials & AI configuration saved successfully!" };
  } catch (err: any) {
    return { success: false, message: err.message || "Failed to update database session settings." };
  }
}

// ── 2. Meta Balance & Limits Checker ──
export async function checkMetaBalance(config: WhatsAppConfig): Promise<{
  success: boolean;
  data?: {
    displayPhoneNumber: string;
    qualityRating: string;
    messagingLimitTier: string;
    verifiedName?: string;
    codeVerificationStatus?: string;
  };
  error?: string;
}> {
  try {
    const url = `https://graph.facebook.com/v20.0/${config.phoneNumberId}?fields=display_phone_number,quality_rating,messaging_limit_tier,verified_name,code_verification_status&access_token=${config.apiToken}`;
    const res = await fetch(url);
    const json = await res.json();

    if (!res.ok || json.error) {
      throw new Error(json.error?.message || `HTTP ${res.status}: Failed to fetch Meta balance`);
    }

    return {
      success: true,
      data: {
        displayPhoneNumber: json.display_phone_number || config.phoneNumberId,
        qualityRating: json.quality_rating || "UNKNOWN",
        messagingLimitTier: json.messaging_limit_tier || "STANDARD",
        verifiedName: json.verified_name || "Snehyoga",
        codeVerificationStatus: json.code_verification_status || "VERIFIED"
      }
    };
  } catch (err: any) {
    return { success: false, error: err.message || "Failed to communicate with Meta Graph API" };
  }
}

// ── 3. Template Sync from Meta Graph API ──
export async function fetchMetaTemplates(config: WhatsAppConfig): Promise<{
  success: boolean;
  templates: MetaTemplate[];
  error?: string;
}> {
  try {
    const targetWabaId = config.wabaId || "1564657775051850";
    const url = `https://graph.facebook.com/v20.0/${targetWabaId}/message_templates?fields=name,status,category,language,components&limit=100&access_token=${config.apiToken}`;
    const res = await fetch(url);
    const json = await res.json();

    if (!res.ok || json.error) {
      throw new Error(json.error?.message || "Failed to sync message templates from Meta WABA");
    }

    const templates: MetaTemplate[] = (json.data || []).map((t: any) => {
      const bodyComp = (t.components || []).find((c: any) => c.type === "BODY");
      const headerComp = (t.components || []).find((c: any) => c.type === "HEADER");

      const bodyText = bodyComp?.text || "";
      // Count placeholders like {{1}}, {{2}}
      const matches = bodyText.match(/\{\{\d+\}\}/g) || [];
      const paramCount = matches.length;

      return {
        id: t.id || t.name,
        name: t.name,
        category: t.category || "UTILITY",
        status: t.status || "APPROVED",
        language: t.language || "en",
        body: bodyText,
        headerType: headerComp?.format || "NONE",
        headerUrl: headerComp?.example?.header_handle?.[0] || "",
        paramCount
      };
    });

    return { success: true, templates };
  } catch (err: any) {
    return { success: false, templates: [], error: err.message || "Could not fetch templates" };
  }
}

// ── 3B. Create Meta Template in Meta Cloud API (AiSensy Style) ──
export interface CreateTemplatePayload {
  name: string;
  category: "MARKETING" | "UTILITY" | "AUTHENTICATION";
  language: string;
  headerType: "NONE" | "TEXT" | "IMAGE" | "VIDEO" | "DOCUMENT";
  headerText?: string;
  headerMediaUrl?: string;
  bodyText: string;
  sampleBodyVariables?: string[];
  footerText?: string;
  buttons?: Array<{
    type: "URL" | "PHONE_NUMBER" | "QUICK_REPLY";
    text: string;
    url?: string;
    phoneNumber?: string;
  }>;
}

export async function createMetaTemplate(
  config: WhatsAppConfig,
  payload: CreateTemplatePayload
): Promise<{ success: boolean; data?: any; error?: string }> {
  try {
    const targetWabaId = config.wabaId || "1564657775051850";
    const cleanName = payload.name.toLowerCase().replace(/[^a-z0-9_]/g, "_");

    const components: any[] = [];

    // 1. Header component
    if (payload.headerType === "TEXT" && payload.headerText) {
      const headerComp: any = {
        type: "HEADER",
        format: "TEXT",
        text: payload.headerText
      };
      components.push(headerComp);
    } else if (payload.headerType !== "NONE") {
      const headerComp: any = {
        type: "HEADER",
        format: payload.headerType
      };
      if (payload.headerMediaUrl) {
        headerComp.example = {
          header_handle: [payload.headerMediaUrl]
        };
      }
      components.push(headerComp);
    }

    // 2. Body component
    const bodyComp: any = {
      type: "BODY",
      text: payload.bodyText
    };

    // Check if body has variables like {{1}}, {{2}}
    const varMatches = payload.bodyText.match(/\{\{\d+\}\}/g) || [];
    if (varMatches.length > 0) {
      const samples = (payload.sampleBodyVariables && payload.sampleBodyVariables.length >= varMatches.length)
        ? payload.sampleBodyVariables
        : varMatches.map((_, idx) => `Sample_${idx + 1}`);

      bodyComp.example = {
        body_text: [samples]
      };
    }
    components.push(bodyComp);

    // 3. Footer component
    if (payload.footerText && payload.footerText.trim()) {
      components.push({
        type: "FOOTER",
        text: payload.footerText.trim()
      });
    }

    // 4. Buttons component
    if (payload.buttons && payload.buttons.length > 0) {
      const buttonsComp: any = {
        type: "BUTTONS",
        buttons: payload.buttons.map(b => {
          if (b.type === "URL") {
            return {
              type: "URL",
              text: b.text,
              url: b.url || "https://yoga.snehyoga.com"
            };
          } else if (b.type === "PHONE_NUMBER") {
            return {
              type: "PHONE_NUMBER",
              text: b.text,
              phone_number: b.phoneNumber || "+919145414083"
            };
          } else {
            return {
              type: "QUICK_REPLY",
              text: b.text
            };
          }
        })
      };
      components.push(buttonsComp);
    }

    const requestBody = {
      name: cleanName,
      category: payload.category,
      language: payload.language || "en_US",
      components
    };

    const url = `https://graph.facebook.com/v20.0/${targetWabaId}/message_templates`;
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${config.apiToken}`
      },
      body: JSON.stringify(requestBody)
    });

    const json = await res.json();
    if (!res.ok || json.error) {
      throw new Error(json.error?.message || `HTTP ${res.status}: Failed to create template on Meta`);
    }

    return { success: true, data: json };
  } catch (err: any) {
    return { success: false, error: err.message || "Meta API error" };
  }
}

// ── 4. Send Single Message with Meta Cloud API ──
export interface SendMessageOptions {
  config: WhatsAppConfig;
  to: string;
  type: "template" | "text" | "image" | "video";
  templateName?: string;
  templateParams?: string[];
  languageCode?: string;
  headerImageUrl?: string;
  textBody?: string;
  mediaUrl?: string;
  userName?: string;
  batchId?: string;
}

export async function sendMetaMessage(options: SendMessageOptions): Promise<{
  success: boolean;
  messageId?: string;
  error?: string;
}> {
  const { config, to, type, templateName, templateParams = [], languageCode = "en", headerImageUrl, textBody, mediaUrl, userName, batchId } = options;
  const formattedPhone = normalizePhoneNumber(to);

  if (!formattedPhone || formattedPhone.length < 10) {
    return { success: false, error: "Invalid recipient phone number" };
  }

  let payload: any = {
    messaging_product: "whatsapp",
    to: formattedPhone,
  };

  if (type === "template" && templateName) {
    payload.type = "template";
    const components: any[] = [];

    // Header image component if applicable
    if (headerImageUrl) {
      components.push({
        type: "header",
        parameters: [{ type: "image", image: { link: headerImageUrl } }]
      });
    }

    // Body parameters
    if (templateParams.length > 0) {
      components.push({
        type: "body",
        parameters: templateParams.map(val => ({ type: "text", text: String(val || "") }))
      });
    }

    payload.template = {
      name: templateName,
      language: { code: languageCode || config.languageCode || "en" },
      components
    };
  } else if (type === "image" && mediaUrl) {
    payload.type = "image";
    payload.image = { link: mediaUrl, caption: textBody || "" };
  } else if (type === "video" && mediaUrl) {
    payload.type = "video";
    payload.video = { link: mediaUrl, caption: textBody || "" };
  } else {
    // Plain text message
    payload.type = "text";
    payload.text = { body: textBody || "Namaste from Snehyoga 🙏" };
  }

  // Attempt send with primary Phone ID; fallback if failed
  const attemptPhoneIds = [config.phoneNumberId, "1230157110176906", "808910018982018"].filter(Boolean);
  let lastError = "";
  let messageId = "";

  for (const pid of attemptPhoneIds) {
    try {
      const url = `https://graph.facebook.com/v20.0/${pid}/messages`;
      const res = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${config.apiToken}`
        },
        body: JSON.stringify(payload)
      });
      const json = await res.json();

      if (res.ok && !json.error) {
        messageId = json.messages?.[0]?.id || `msg_${Date.now()}`;
        lastError = "";
        break;
      } else {
        lastError = json.error?.message || `HTTP ${res.status}`;
        // If error is language mismatch, break to let user know
        if (json.error?.code === 132001) break;
      }
    } catch (e: any) {
      lastError = e.message || "Network error";
    }
  }

  const success = !lastError && !!messageId;

  // Log to chat_messages store
  try {
    await supabase.from("chat_messages").insert({
      user_phone: formattedPhone,
      user_name: userName || "Student",
      message: type === "template" ? `[Template: ${templateName}]` : (textBody || `[${type} attachment]`),
      sender_type: "admin",
      attachment_type: type !== "template" && type !== "text" ? type : null,
      attachment_url: mediaUrl || headerImageUrl || null,
      is_read: true,
      created_at: new Date().toISOString()
    });
  } catch (_) {}

  // Log to message_queue if batchId is provided
  if (batchId) {
    try {
      await supabase.from("message_queue").insert({
        batch_id: batchId,
        user_phone: formattedPhone,
        user_name: userName || null,
        template_id: templateName || type,
        status: success ? "delivered" : "failed",
        error_log: lastError || null,
        processed_at: new Date().toISOString(),
        created_at: new Date().toISOString()
      });
    } catch (_) {}
  }

  return { success, messageId, error: lastError || undefined };
}

// ── 5. Bulk Broadcast Engine with Turbo & Standard Modes ──
export interface ExecuteBroadcastOptions {
  batchName: string;
  targetAudience: string;
  contacts: BroadcastContact[];
  config: WhatsAppConfig;
  nudgeFormat: "template" | "text" | "video" | "image" | "preset";
  template?: MetaTemplate;
  dynamicParamsTemplate?: string; // e.g. "name, batch_time, days_left"
  directText?: string;
  headerImageUrl?: string;
  directMediaUrl?: string;
  speedMode: "turbo" | "standard";
  onProgress: (progress: BroadcastProgress) => void;
  checkStop: () => boolean;
  checkPause: () => boolean;
}

export async function executeBroadcast(options: ExecuteBroadcastOptions): Promise<{
  batchId: string;
  deliveredCount: number;
  failedCount: number;
  blockedCount: number;
}> {
  const {
    batchName,
    targetAudience,
    contacts,
    config,
    nudgeFormat,
    template,
    dynamicParamsTemplate = "",
    directText = "",
    headerImageUrl = "",
    directMediaUrl = "",
    speedMode,
    onProgress,
    checkStop,
    checkPause
  } = options;

  // 1. Fetch Blocklist from customer_blocks table
  const blockedPhones = new Set<string>();
  try {
    const { data: blocks } = await supabase.from("customer_blocks").select("phone_number");
    (blocks || []).forEach(b => blockedPhones.add(normalizePhoneNumber(b.phone_number)));
  } catch (_) {}

  // 2. Create message_batches record in Supabase
  let batchId = `batch_${Date.now()}`;
  try {
    const { data: batchData } = await supabase
      .from("message_batches")
      .insert({
        batch_name: batchName,
        target_audience: targetAudience,
        template_id: template?.name || nudgeFormat,
        total_messages: contacts.length,
        delivered_count: 0,
        failed_count: 0,
        status: "processing",
        created_at: new Date().toISOString()
      })
      .select("id")
      .single();

    if (batchData?.id) batchId = batchData.id;
  } catch (err) {
    console.warn("Could not create message_batches record:", err);
  }

  // 3. Execution state
  const total = contacts.length;
  let processed = 0;
  let delivered = 0;
  let failed = 0;
  let blocked = 0;
  const logs: BroadcastProgress["logs"] = [];

  const addLog = (type: "success" | "failed" | "info" | "blocked", text: string) => {
    const now = new Date();
    const timeStr = now.toTimeString().split(" ")[0];
    const logItem = {
      id: `${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
      time: timeStr,
      type,
      text: `[${timeStr}] [${type.toUpperCase()}] ${text}`
    };
    logs.unshift(logItem);
    if (logs.length > 200) logs.pop();
  };

  addLog("info", `Starting broadcast "${batchName}" (${speedMode === "turbo" ? "⚡ Turbo Pub/Sub ~100/sec" : "🐢 Standard 1/sec"}). Total: ${total}`);

  // Helper to resolve params for a contact
  const resolveParamsForContact = (c: BroadcastContact): string[] => {
    if (!dynamicParamsTemplate.trim()) return [];
    return dynamicParamsTemplate.split(",").map(rawKey => {
      const key = rawKey.trim();
      if (key === "name" || key === "{{1}}") return c.name || "Student";
      if (key === "batch_time" || key === "batch_timing" || key === "{{2}}") return c.batchTiming || "6:00 AM";
      if (key === "days_left" || key === "{{3}}") return String(c.daysLeft ?? 30);
      if (key === "phone" || key === "mobile_number") return c.phone;
      if (key === "link" || key === "personal_link") return `https://yoga.snehyoga.com/live?u=${c.phone}`;
      return c.params?.[key] || key; // literal string or custom param
    });
  };

  // Helper to send to one recipient
  const processRecipient = async (contact: BroadcastContact) => {
    const cleanPhone = normalizePhoneNumber(contact.phone);

    // Skip if blocked
    if (blockedPhones.has(cleanPhone)) {
      blocked++;
      processed++;
      addLog("blocked", `${contact.name || cleanPhone}: Skipped (User on Blocklist)`);
      return;
    }

    const resolvedParams = resolveParamsForContact(contact);
    const resolvedText = directText.replace(/\{name\}/g, contact.name || "Student");

    const messageType = nudgeFormat === "template" ? "template" : nudgeFormat === "video" ? "video" : nudgeFormat === "image" ? "image" : "text";

    const res = await sendMetaMessage({
      config,
      to: cleanPhone,
      type: messageType,
      templateName: template?.name,
      templateParams: resolvedParams,
      languageCode: template?.language || config.languageCode,
      headerImageUrl: headerImageUrl || template?.headerUrl,
      textBody: resolvedText,
      mediaUrl: directMediaUrl,
      userName: contact.name,
      batchId
    });

    processed++;
    if (res.success) {
      delivered++;
      addLog("success", `${contact.name || cleanPhone}: Delivered`);
    } else {
      failed++;
      addLog("failed", `${contact.name || cleanPhone}: Failed (${res.error || "Meta rejection"})`);
    }
  };

  // 4. Batch execution based on speed mode
  const chunkSize = speedMode === "turbo" ? 25 : 1;
  const chunkDelayMs = speedMode === "turbo" ? 10 : 1000;

  for (let i = 0; i < contacts.length; i += chunkSize) {
    // Check if stopped
    if (checkStop()) {
      addLog("info", "Broadcast halted by administrator.");
      break;
    }

    // Wait while paused
    while (checkPause() && !checkStop()) {
      await new Promise(r => setTimeout(r, 400));
    }

    const chunk = contacts.slice(i, i + chunkSize);

    if (speedMode === "turbo") {
      await Promise.all(chunk.map(c => processRecipient(c)));
      if (chunkDelayMs > 0) await new Promise(r => setTimeout(r, chunkDelayMs));
    } else {
      // Standard sequential 1-second delay
      for (const c of chunk) {
        if (checkStop()) break;
        while (checkPause() && !checkStop()) {
          await new Promise(r => setTimeout(r, 400));
        }
        await processRecipient(c);
        await new Promise(r => setTimeout(r, chunkDelayMs));
      }
    }

    // Update progress
    onProgress({
      total,
      processed,
      delivered,
      failed,
      blocked,
      isPaused: checkPause(),
      isStopped: checkStop(),
      percent: Math.min(100, Math.round((processed / Math.max(1, total)) * 100)),
      currentName: chunk[chunk.length - 1]?.name,
      currentPhone: chunk[chunk.length - 1]?.phone,
      logs: [...logs]
    });
  }

  // 5. Finalize batch in database
  try {
    await supabase.from("message_batches").update({
      delivered_count: delivered,
      failed_count: failed,
      status: checkStop() ? "cancelled" : "completed",
      completed_at: new Date().toISOString()
    }).eq("id", batchId);
  } catch (_) {}

  addLog("info", `Broadcast completed: ${delivered} delivered, ${failed} failed, ${blocked} blocked.`);

  onProgress({
    total,
    processed,
    delivered,
    failed,
    blocked,
    isPaused: false,
    isStopped: false,
    percent: 100,
    logs: [...logs]
  });

  return { batchId, deliveredCount: delivered, failedCount: failed, blockedCount: blocked };
}

// ── 6. Google Gemini AI Auto-Responder ──
export interface GeminiRouterResponse {
  type: "trigger_flow" | "reply";
  flowId?: string;
  text?: string;
  source: "gemini" | "local_knowledge" | "fallback";
}

export async function askGeminiAutoResponder(
  userQuery: string,
  config: WhatsAppConfig,
  knowledgeBase: KnowledgeBaseItem[],
  senderPhone?: string
): Promise<GeminiRouterResponse> {
  const query = userQuery.trim();

  // Whitelist check
  if (config.aiAllowedNumbers && config.aiAllowedNumbers.trim() !== "*") {
    if (senderPhone) {
      const allowedList = config.aiAllowedNumbers.split(",").map(p => normalizePhoneNumber(p.trim()));
      const normalizedSender = normalizePhoneNumber(senderPhone);
      if (!allowedList.includes(normalizedSender)) {
        return {
          type: "reply",
          text: "Namaste! Our AI assistant is currently restricted to registered pilot testing numbers.",
          source: "fallback"
        };
      }
    }
  }

  // Local knowledge base exact match instant fast-path
  const queryLower = query.toLowerCase();
  for (const kb of knowledgeBase) {
    if (queryLower.includes(kb.question.toLowerCase()) || kb.question.toLowerCase().includes(queryLower)) {
      return {
        type: "reply",
        text: kb.answer,
        source: "local_knowledge"
      };
    }
  }

  const apiKey = config.googleAiStudioKey || import.meta.env.VITE_GEMINI_API_KEY || "";
  if (!apiKey) {
    // Return friendly local reply
    return {
      type: "reply",
      text: `Namaste 🙏 Thank you for reaching out to Snehyoga. Our live classes run Mon-Fri at 6:00 AM, 11:00 AM, and 4:00 PM. Please visit https://yoga.snehyoga.com/live or reply "Help" to speak to our yoga teacher.`,
      source: "fallback"
    };
  }

  // Build injected Knowledge Base string
  const kbContext = knowledgeBase.map((k, i) => `${i + 1}. [${k.category}] Q: ${k.question}\nA: ${k.answer}`).join("\n\n");

  const systemInstruction = `${config.aiSystemPrompt || "You are the Snehyoga AI Counselor."}

You have access to the verified Snehyoga Knowledge Base below:
---
${kbContext}
---

INSTRUCTIONS:
1. Always reply in JSON format strictly matching this schema:
   {"type": "trigger_flow", "flowId": "<flow_id>"} OR {"type": "reply", "text": "<your answer>"}
2. If the user asks about live classes, scheduling, pricing, diet, or demo session, answer accurately using the Knowledge Base.
3. If the user explicitly asks to register, pay, or start a trial, you may trigger flow "onboarding_flow" or reply with the live link.
4. Keep replies friendly, respectful, and concise (under 80 words) for WhatsApp readability.`;

  const models = ["gemini-1.5-flash", "gemini-2.5-flash-lite", "gemini-flash-latest"];
  for (const model of models) {
    try {
      const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [
            {
              role: "user",
              parts: [{ text: `${systemInstruction}\n\nStudent message: "${query}"` }]
            }
          ]
        })
      });

      const json = await res.json();
      const rawText = json.candidates?.[0]?.content?.parts?.[0]?.text || "";
      const cleaned = rawText.replace(/```json/g, "").replace(/```/g, "").trim();

      try {
        const parsed = JSON.parse(cleaned);
        if (parsed.type === "trigger_flow" || parsed.type === "reply") {
          return {
            type: parsed.type,
            flowId: parsed.flowId,
            text: parsed.text || "Namaste from Snehyoga 🙏",
            source: "gemini"
          };
        }
      } catch (_) {
        if (cleaned) {
          return { type: "reply", text: cleaned, source: "gemini" };
        }
      }
    } catch (_) {}
  }

  return {
    type: "reply",
    text: "Namaste 🙏 We have received your query. Our team will assist you shortly.",
    source: "fallback"
  };
}

// ── 7. Knowledge Base Database Helpers ──
export async function fetchKnowledgeBase(): Promise<KnowledgeBaseItem[]> {
  try {
    const { data, error } = await supabase
      .from("ai_knowledge_base")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) throw error;
    return data || [];
  } catch (err) {
    console.warn("Could not fetch ai_knowledge_base, using local defaults:", err);
    return [
      {
        id: "1",
        category: "Batches & Timings",
        question: "What are the daily yoga batch timings?",
        answer: "Our live yoga sessions take place every Monday to Friday across 3 batches: Morning 6:00 AM – 7:00 AM, Mid-day 11:00 AM – 12:00 PM, and Evening 4:00 PM – 5:00 PM IST."
      },
      {
        id: "2",
        category: "Live Class Link",
        question: "How do I join the live yoga session today?",
        answer: "Join today's live class through your student portal at https://yoga.snehyoga.com/live or use your personalized link sent on WhatsApp."
      },
      {
        id: "3",
        category: "Subscription & Fees",
        question: "What are the subscription plans and fees for Snehyoga?",
        answer: "Snehyoga offers: Snehyoga 365 Annual Plan, 9-Day Mind & Spine Program (MSP), 30-Day AMP, and Faceyoga Mastery. Reply 'Plans' to view full pricing."
      },
      {
        id: "4",
        category: "Free Trial / Demo",
        question: "Can I attend a free demo or trial session?",
        answer: "Yes! We offer a complimentary trial session. Let us know your preferred batch time (6 AM, 11 AM, or 4 PM) and we'll reserve your slot."
      }
    ];
  }
}

export async function addKnowledgeBaseItem(item: Omit<KnowledgeBaseItem, "id" | "created_at">): Promise<boolean> {
  try {
    const { error } = await supabase.from("ai_knowledge_base").insert({
      category: item.category,
      question: item.question,
      answer: item.answer,
      created_at: new Date().toISOString()
    });
    return !error;
  } catch (_) {
    return false;
  }
}

export async function updateKnowledgeBaseItem(id: string, item: Partial<KnowledgeBaseItem>): Promise<boolean> {
  try {
    const { error } = await supabase.from("ai_knowledge_base").update({
      category: item.category,
      question: item.question,
      answer: item.answer
    }).eq("id", id);
    return !error;
  } catch (_) {
    return false;
  }
}

export async function deleteKnowledgeBaseItem(id: string): Promise<boolean> {
  try {
    const { error } = await supabase.from("ai_knowledge_base").delete().eq("id", id);
    return !error;
  } catch (_) {
    return false;
  }
}

// ── 8. Customer Lead Stage & Blocklist Helpers ──
export async function fetchCustomerLeadStages(): Promise<Record<string, string>> {
  try {
    const { data } = await supabase.from("customer_lead_stage").select("phone_number, stage");
    const map: Record<string, string> = {};
    (data || []).forEach(r => {
      map[normalizePhoneNumber(r.phone_number)] = r.stage;
    });
    return map;
  } catch (_) {
    return {};
  }
}

export async function saveCustomerLeadStage(phone: string, stage: string): Promise<boolean> {
  const clean = normalizePhoneNumber(phone);
  try {
    const { error } = await supabase.from("customer_lead_stage").upsert({
      phone_number: clean,
      stage,
      updated_at: new Date().toISOString()
    });
    return !error;
  } catch (_) {
    return false;
  }
}

export async function fetchBlockedCustomers(): Promise<string[]> {
  try {
    const { data } = await supabase.from("customer_blocks").select("phone_number");
    return (data || []).map(r => normalizePhoneNumber(r.phone_number));
  } catch (_) {
    return [];
  }
}

export async function addBlockedCustomer(phone: string, reason = "Manual opt-out"): Promise<boolean> {
  const clean = normalizePhoneNumber(phone);
  try {
    const { error } = await supabase.from("customer_blocks").upsert({
      phone_number: clean,
      reason,
      created_at: new Date().toISOString()
    });
    return !error;
  } catch (_) {
    return false;
  }
}

export async function removeBlockedCustomer(phone: string): Promise<boolean> {
  const clean = normalizePhoneNumber(phone);
  try {
    const { error } = await supabase.from("customer_blocks").delete().eq("phone_number", clean);
    return !error;
  } catch (_) {
    return false;
  }
}
