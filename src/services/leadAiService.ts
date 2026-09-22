import { supabase } from "@/integrations/supabase/client";

export interface Lead {
  id: string;
  admission_date: string | null;
  calling_date: string | null;
  sr_no: string | null;
  client_name: string;
  contact: string;
  lead_type: string | null;
  lead_existing_plan: string | null;
  lead_status: string;
  remark: string | null;
  call_connected: string | null;
  assigned_to: string | null;
  follow_up_date: string | null;
  created_at: string | null;
}

export interface LeadAiAction {
  statusFilter?: string;
  typeFilter?: string;
  assignedToFilter?: string;
  autoDateFilter?: string;
  searchQuery?: string;
}

export interface LeadAiResponse {
  reply: string;
  action?: LeadAiAction;
  source: "gemini" | "local";
  isDirectDbQuery?: boolean;
}

export interface LiveDbStats {
  totalLeads: number;
  dealDoneCount: number;
  conversionRate: string;
  callConnectionRate: string;
  statusCounts: Record<string, number>;
  assignedCounts: Record<string, number>;
  connectedCount: number;
  notConnectedCount: number;
  todayFollowUps: number;
  todayStr: string;
}

// In-memory cache for live database statistics (30-second TTL to keep queries instant)
let cachedDbStats: LiveDbStats | null = null;
let lastCacheTime = 0;
const CACHE_TTL_MS = 30000;

/**
 * Executes direct, safe READ-ONLY count queries against the full Supabase database.
 * No access tokens, secret keys, or URLs are ever exposed to the client interface.
 */
export async function fetchLiveDatabaseStats(forceFresh = false): Promise<LiveDbStats> {
  const now = Date.now();
  if (!forceFresh && cachedDbStats && now - lastCacheTime < CACHE_TTL_MS) {
    return cachedDbStats;
  }

  const todayStr = new Date().toISOString().split("T")[0];

  try {
    const [
      totalRes,
      dealDoneRes,
      followUpRes,
      masterClassRes,
      deadRes,
      unassignedRes,
      raginiRes,
      shreyaRes,
      janhaviRes,
      connectedRes,
      notConnectedRes,
      todayFollowUpRes
    ] = await Promise.all([
      supabase.from("leads").select("*", { count: "exact", head: true }),
      supabase.from("leads").select("*", { count: "exact", head: true }).eq("lead_status", "Deal Done"),
      supabase.from("leads").select("*", { count: "exact", head: true }).eq("lead_status", "Follow Up"),
      supabase.from("leads").select("*", { count: "exact", head: true }).eq("lead_status", "Master Class Follow"),
      supabase.from("leads").select("*", { count: "exact", head: true }).eq("lead_status", "Dead"),
      supabase.from("leads").select("*", { count: "exact", head: true }).is("assigned_to", null),
      supabase.from("leads").select("*", { count: "exact", head: true }).ilike("assigned_to", "%Ragini%"),
      supabase.from("leads").select("*", { count: "exact", head: true }).ilike("assigned_to", "%Shreya%"),
      supabase.from("leads").select("*", { count: "exact", head: true }).ilike("assigned_to", "%Janhavi%"),
      supabase.from("leads").select("*", { count: "exact", head: true }).eq("call_connected", "connected"),
      supabase.from("leads").select("*", { count: "exact", head: true }).eq("call_connected", "not_connected"),
      supabase.from("leads").select("*", { count: "exact", head: true }).eq("follow_up_date", todayStr)
    ]);

    const total = totalRes.count || 0;
    const dealDone = dealDoneRes.count || 0;
    const conversionRate = total > 0 ? ((dealDone / total) * 100).toFixed(1) : "0";
    const connected = connectedRes.count || 0;
    const notConnected = notConnectedRes.count || 0;
    const callRate = (connected + notConnected) > 0 ? ((connected / (connected + notConnected)) * 100).toFixed(1) : "0";

    cachedDbStats = {
      totalLeads: total,
      dealDoneCount: dealDone,
      conversionRate: `${conversionRate}%`,
      callConnectionRate: `${callRate}%`,
      statusCounts: {
        "Deal Done": dealDone,
        "Follow Up": followUpRes.count || 0,
        "Master Class Follow": masterClassRes.count || 0,
        "Dead": deadRes.count || 0
      },
      assignedCounts: {
        "Unassigned": unassignedRes.count || 0,
        "Ragini K": raginiRes.count || 0,
        "Shreya K": shreyaRes.count || 0,
        "Janhavi V": janhaviRes.count || 0
      },
      connectedCount: connected,
      notConnectedCount: notConnected,
      todayFollowUps: todayFollowUpRes.count || 0,
      todayStr
    };

    lastCacheTime = now;
    return cachedDbStats;
  } catch (err) {
    console.error("Direct Supabase stats query failed, falling back to local dataset:", err);
    return {
      totalLeads: 0,
      dealDoneCount: 0,
      conversionRate: "0%",
      callConnectionRate: "0%",
      statusCounts: {},
      assignedCounts: {},
      connectedCount: 0,
      notConnectedCount: 0,
      todayFollowUps: 0,
      todayStr
    };
  }
}

/**
 * Directly queries Supabase for specific program or custom filter counts
 */
export async function executeDirectSupabaseCount(filters: {
  lead_status?: string;
  lead_type?: string;
  assigned_to?: string;
}): Promise<number> {
  let q = supabase.from("leads").select("*", { count: "exact", head: true });

  if (filters.lead_status && filters.lead_status !== "all") {
    q = q.eq("lead_status", filters.lead_status);
  }
  if (filters.lead_type && filters.lead_type !== "all") {
    q = q.eq("lead_type", filters.lead_type);
  }
  if (filters.assigned_to && filters.assigned_to !== "all") {
    if (filters.assigned_to.toLowerCase() === "unassigned") {
      q = q.is("assigned_to", null);
    } else {
      q = q.ilike("assigned_to", `%${filters.assigned_to.split(" ")[0]}%`);
    }
  }

  const { count, error } = await q;
  if (error) {
    console.error("Direct count query error:", error);
    return 0;
  }
  return count || 0;
}

/** Local Intelligent Query Resolver using live database aggregates */
export async function queryLeadsLocally(userQuery: string, leads: Lead[]): Promise<LeadAiResponse> {
  const q = userQuery.toLowerCase().trim();

  // 0. Instant Greetings & Casual Chat Handler (No delay, no full database dump!)
  const isGreeting = /^(hi|hello|hey|hola|namaste|good\s*(morning|afternoon|evening)|wassup|what'?s\s*up|who\s*are\s*you|how\s*are\s*you)\b/i.test(q) 
    || q === "hi" || q === "hello" || q === "hey";

  if (isGreeting) {
    return {
      reply: `👋 **Hello! How can I help you today?**\n\nI can answer questions about your leads or filter the table for you:\n- 🏆 *"How many deals were closed?"*\n- 🔍 *"Show me unassigned leads"*\n- 📅 *"What follow-ups are due today?"*\n- 👤 *"Show leads assigned to Shreya / Ragini / Janhavi"*\n- 🧘 *"How many Faceyoga leads do we have?"*\n\nJust ask me anything or click one of the quick chips above!`,
      source: "local"
    };
  }

  // 0.1 Help & Capabilities
  if (q.includes("help") || q.includes("what can you do") || q.includes("features")) {
    return {
      reply: `🤖 **Here is what I can do:**\n\n1. **Lead Counts & Stats**: Ask for live database counts on any program, status, or agent.\n2. **Automated Table Filtering**: Tell me to *"show deal done leads"* and I will filter the table immediately.\n3. **Call Connectivity**: Ask *"What is our call connection rate?"* to see live stats.\n4. **Follow-up Reminders**: Ask *"What are today's follow-ups?"* to track pending leads.`,
      source: "local"
    };
  }

  const dbStats = await fetchLiveDatabaseStats();
  const totalCount = dbStats.totalLeads > 0 ? dbStats.totalLeads : leads.length;
  let action: LeadAiAction | undefined;

  // 1. Unassigned check
  if (q.includes("unassigned") || q.includes("not assigned") || q.includes("free lead")) {
    action = { assignedToFilter: "unassigned" };
    const unassignedCount = dbStats.assignedCounts["Unassigned"] ?? leads.filter(l => !l.assigned_to).length;
    return {
      reply: `🔍 **Unassigned Leads**\n\nThere are **${unassignedCount} unassigned leads** out of **${totalCount} total leads** across the entire database.\n\nClick below to filter unassigned leads in your table.`,
      action,
      source: "local",
      isDirectDbQuery: true
    };
  }

  // 2. Today follow ups
  if (q.includes("today") && (q.includes("follow") || q.includes("calling"))) {
    action = { autoDateFilter: dbStats.todayStr, statusFilter: "all" };
    return {
      reply: `📅 **Today's Follow-ups**\n\nYou have **${dbStats.todayFollowUps} leads scheduled for follow-up today** (${dbStats.todayStr}).\n\nClick below to view today's follow-up leads in the table.`,
      action,
      source: "local",
      isDirectDbQuery: true
    };
  }

  // 3. Deal Done / Conversion
  if (q.includes("deal done") || q.includes("conversion") || q.includes("converted") || q.includes("closed")) {
    action = { statusFilter: "Deal Done" };
    return {
      reply: `🏆 **Deal Conversions**\n\n- **Total Deals Converted**: **${dbStats.dealDoneCount}**\n- **Database Total Leads**: **${totalCount}**\n- **Overall Conversion Rate**: **${dbStats.conversionRate}**\n\nClick below to filter all **Deal Done** leads.`,
      action,
      source: "local",
      isDirectDbQuery: true
    };
  }

  // 4. Specific Program check (e.g. Faceyoga, Snehyoga 365, etc.)
  const knownPrograms = [
    { key: "faceyoga", name: "FACEYOGA" },
    { key: "365", name: "SNEHYOGA 365" },
    { key: "msp", name: "MSP - 9 Days" },
    { key: "amp", name: "AMP - 30 Days" },
    { key: "ymc", name: "YMC" },
    { key: "nidra", name: "NIDRA MASTERY" },
    { key: "calm", name: "CALM YOUR MIND" },
    { key: "offline", name: "OFFLINE" }
  ];

  for (const prog of knownPrograms) {
    if (q.includes(prog.key)) {
      const liveProgCount = await executeDirectSupabaseCount({ lead_type: prog.name });
      action = { typeFilter: prog.name };
      return {
        reply: `🧘 **${prog.name} Program**\n\nFound **${liveProgCount} leads** registered for **${prog.name}** in the database.\n\nClick below to view them in the table.`,
        action,
        source: "local",
        isDirectDbQuery: true
      };
    }
  }

  // 5. Call connection stats
  if (q.includes("call") || q.includes("connected") || q.includes("reachable") || q.includes("not connected")) {
    return {
      reply: `📞 **Call Connectivity Stats**\n\n- **Connected Calls**: **${dbStats.connectedCount}** ✅\n- **Not Connected Calls**: **${dbStats.notConnectedCount}** ❌\n- **Connection Rate**: **${dbStats.callConnectionRate}**`,
      source: "local",
      isDirectDbQuery: true
    };
  }

  // 6. Check agent names (Ragini, Shreya, Janhavi)
  const agents = [
    { key: "ragini", name: "Ragini K" },
    { key: "shreya", name: "Shreya K" },
    { key: "janhavi", name: "Janhavi V" }
  ];

  for (const agent of agents) {
    if (q.includes(agent.key)) {
      const agentCount = dbStats.assignedCounts[agent.name] ?? 0;
      action = { assignedToFilter: agent.name };
      return {
        reply: `👤 **${agent.name}'s Leads**\n\n- **Assigned Leads**: **${agentCount}**\n- **Share of Total Leads**: **${totalCount > 0 ? ((agentCount / totalCount) * 100).toFixed(1) : 0}%**\n\nClick below to view leads assigned to **${agent.name}**.`,
        action,
        source: "local",
        isDirectDbQuery: true
      };
    }
  }

  // 7. General overall summary (Only when user explicitly asks for overview, summary, stats, or unknown question)
  const statusSummaryText = Object.entries(dbStats.statusCounts)
    .map(([status, count]) => `  - **${status}**: ${count}`)
    .join("\n");

  const agentSummaryText = Object.entries(dbStats.assignedCounts)
    .map(([agent, count]) => `  - **${agent}**: ${count}`)
    .join("\n");

  return {
    reply: `📊 **Lead Management Overview**\n\n- **Total Database Leads**: **${totalCount}**\n- **Closed Deals**: **${dbStats.dealDoneCount}** (${dbStats.conversionRate})\n- **Follow-ups Due Today**: **${dbStats.todayFollowUps}**\n- **Call Connection Rate**: **${dbStats.callConnectionRate}**\n\n**Status Breakdown:**\n${statusSummaryText}\n\n**Team Distribution:**\n${agentSummaryText}`,
    source: "local",
    isDirectDbQuery: true
  };
}

/** Ask AI Bot with direct Supabase database analytics & Gemini 3.6 Flash reasoning */
export async function askLeadAiBot(userQuery: string, leads: Lead[]): Promise<LeadAiResponse> {
  const q = userQuery.toLowerCase().trim();

  // Instant greeting check: avoid any network delay for simple hellos!
  if (/^(hi|hello|hey|hola|namaste|good\s*(morning|afternoon|evening))\b/i.test(q) || q === "hi" || q === "hello" || q === "hey") {
    return queryLeadsLocally(userQuery, leads);
  }

  const apiKey = import.meta.env.VITE_GEMINI_API_KEY || (window as any).VITE_GEMINI_API_KEY;

  // Fallback to local resolver if no API key is provided
  if (!apiKey || apiKey === "your_api_key_here") {
    return queryLeadsLocally(userQuery, leads);
  }

  // Fetch live database metrics directly from Supabase
  const dbStats = await fetchLiveDatabaseStats();

  const systemInstruction = `You are Snehyoga Lead Assistant, a friendly and smart AI CRM bot embedded in the Lead Management dashboard.
Your job is to answer user questions using LIVE SUPABASE DATABASE STATISTICS across the full CRM database.

Full Database Statistics (Queried Directly From Supabase):
- Total CRM Leads in Database: ${dbStats.totalLeads}
- Total Closed Deals (Deal Done): ${dbStats.dealDoneCount} (Conversion Rate: ${dbStats.conversionRate})
- Overall Call Connection Rate: ${dbStats.callConnectionRate} (Connected: ${dbStats.connectedCount}, Not Connected: ${dbStats.notConnectedCount})
- Follow-ups Scheduled Today (${dbStats.todayStr}): ${dbStats.todayFollowUps}
- Status Breakdown across Full Database: ${JSON.stringify(dbStats.statusCounts)}
- Agent Assignment across Full Database: ${JSON.stringify(dbStats.assignedCounts)}

Available UI Filter Options:
- Statuses: "all", "Deal Done", "Follow Up", "Master Class Follow", "Dead", "Select Option"
- Lead Types: "all", "SNEHYOGA 365", "FACEYOGA", "MSP - 9 Days", "AMP - 30 Days", "YMC", "NIDRA MASTERY", "CALM YOUR MIND", "1:1 CONSULTATION", "OFFLINE"
- Assigned Users: "all", "unassigned", "Ragini K", "Shreya K", "Janhavi V"

IMPORTANT INSTRUCTIONS:
1. GREETINGS: If user says "hi" or casual greeting, greet them warmly and suggest 2-3 specific questions they can ask. NEVER dump the full database overview on a greeting.
2. DIRECT CONCISE ANSWERS: When the user asks a specific question (e.g. "how many deals done?"), answer that question directly and concisely.
3. OVERVIEW: Only output the full statistics report if the user explicitly asks for "overview", "summary", or "stats".
4. SECURITY: Do NOT output database connection strings, API keys, URLs, or access tokens in any response.

Always respond with a JSON object in this format (no extra markdown code fences, pure JSON):
{
  "reply": "Your clear, friendly response formatted with markdown",
  "action": {
    "statusFilter": "optional status filter value",
    "typeFilter": "optional lead type filter value",
    "assignedToFilter": "optional assigned to filter value",
    "autoDateFilter": "optional YYYY-MM-DD string",
    "searchQuery": "optional search query term"
  }
}
If no table filter action is needed, omit the "action" key.`;

  // Try primary model gemini-3.6-flash, fallback to gemini-flash-latest with 4-second timeout
  const modelsToTry = ["gemini-3.6-flash", "gemini-flash-latest"];

  for (const model of modelsToTry) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 4000);

      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
        {
          method: "POST",
          signal: controller.signal,
          headers: {
            "Content-Type": "application/json",
            "x-goog-api-key": apiKey
          },
          body: JSON.stringify({
            contents: [
              {
                role: "user",
                parts: [{ text: `${systemInstruction}\n\nUser Question: "${userQuery}"` }]
              }
            ],
            generationConfig: {
              temperature: 0.3,
              responseMimeType: "application/json"
            }
          })
        }
      );

      clearTimeout(timeoutId);

      if (!response.ok) {
        console.warn(`Gemini API request failed for model ${model}, trying next...`);
        continue;
      }

      const data = await response.json();
      const rawText = data?.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!rawText) continue;

      const parsed = JSON.parse(rawText.trim());
      return {
        reply: parsed.reply || "Here is what I found for you.",
        action: parsed.action,
        source: "gemini",
        isDirectDbQuery: true
      };
    } catch (err) {
      console.warn(`Gemini API attempt timed out or failed for ${model}, using fast local resolver.`);
    }
  }

  // Fallback to local database resolver if API times out or fails
  return queryLeadsLocally(userQuery, leads);
}
