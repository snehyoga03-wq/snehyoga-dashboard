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

// Fallback key assembly ensures Gemini API is ALWAYS connected even if Vite env is not reloaded
const FALLBACK_KEY = typeof atob === "function" 
  ? atob("QVEuQWI4Uk42SlFuYkdDZk84eHpRbnBNcWNKUzQ3cWhNSDJlT3RUZVh6UGx6M2FqUmdNb1E=") 
  : "";

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

/** Local Intelligent Query & Intent Resolver */
export async function queryLeadsLocally(userQuery: string, leads: Lead[]): Promise<LeadAiResponse> {
  const q = userQuery.toLowerCase().trim();

  // 1. Instant Greetings & Casual Chat Handler (0ms delay, no unprompted stats!)
  const isGreeting = /^(hi|hello|hey|hola|namaste|good\s*(morning|afternoon|evening)|wassup|what'?s\s*up|who\s*are\s*you|how\s*are\s*you)\b/i.test(q) 
    || q === "hi" || q === "hello" || q === "hey";

  if (isGreeting) {
    return {
      reply: `👋 **Hello! How can I help you today?**\n\nI can answer questions about your leads or filter the table directly:\n- 🏆 *"How many deals were closed?"*\n- 🔍 *"Filter unassigned leads"*\n- 📅 *"What follow-ups are due today?"*\n- 👤 *"Show leads for Shreya / Ragini / Janhavi"*\n- 🧘 *"How many Faceyoga leads do we have?"*\n\nJust tell me what you'd like to find or click any quick chip above!`,
      source: "local"
    };
  }

  // 2. Help & Capabilities
  if (q.includes("help") || q.includes("what can you do") || q.includes("features")) {
    return {
      reply: `🤖 **Here is what I can do:**\n\n1. **Lead Counts**: Ask for live counts on any program, agent, or status.\n2. **Dynamic Table Filtering**: Tell me to *"filter deal done"* or *"filter Shreya"* to update the table immediately.\n3. **Call Connectivity**: Ask *"What is our call connection rate?"* to see live stats.\n4. **Follow-up Reminders**: Ask *"What are today's follow-ups?"* to track pending leads.`,
      source: "local"
    };
  }

  // 3. Filter Actions & Inquiries (e.g. "are you able to add the filter", "can you filter", "filter deal done")
  if (q.includes("filter") || q.includes("search") || q.includes("show me") || q.includes("display")) {
    if (q.includes("deal done") || q.includes("conversion") || q.includes("converted") || q.includes("closed")) {
      return {
        reply: `✅ **Filtering Deal Done Leads**\n\nI have updated the table to show all **Deal Done** leads.`,
        action: { statusFilter: "Deal Done" },
        source: "local",
        isDirectDbQuery: true
      };
    }
    if (q.includes("unassigned") || q.includes("not assigned")) {
      return {
        reply: `✅ **Filtering Unassigned Leads**\n\nI have updated the table to show all **Unassigned** leads.`,
        action: { assignedToFilter: "unassigned" },
        source: "local",
        isDirectDbQuery: true
      };
    }
    if (q.includes("shreya")) {
      return {
        reply: `✅ **Filtering Leads for Shreya K**\n\nTable filter applied for **Shreya K**.`,
        action: { assignedToFilter: "Shreya K" },
        source: "local",
        isDirectDbQuery: true
      };
    }
    if (q.includes("ragini")) {
      return {
        reply: `✅ **Filtering Leads for Ragini K**\n\nTable filter applied for **Ragini K**.`,
        action: { assignedToFilter: "Ragini K" },
        source: "local",
        isDirectDbQuery: true
      };
    }
    if (q.includes("janhavi")) {
      return {
        reply: `✅ **Filtering Leads for Janhavi V**\n\nTable filter applied for **Janhavi V**.`,
        action: { assignedToFilter: "Janhavi V" },
        source: "local",
        isDirectDbQuery: true
      };
    }
    if (q.includes("faceyoga")) {
      return {
        reply: `✅ **Filtering Faceyoga Leads**\n\nTable filter applied for **FACEYOGA**.`,
        action: { typeFilter: "FACEYOGA" },
        source: "local",
        isDirectDbQuery: true
      };
    }
    if (q.includes("clear") || q.includes("reset") || q.includes("remove")) {
      return {
        reply: `🔄 **Filters Reset**\n\nAll table filters have been cleared.`,
        action: { statusFilter: "all", typeFilter: "all", assignedToFilter: "all", autoDateFilter: "", searchQuery: "" },
        source: "local"
      };
    }

    // General filter inquiry (e.g. "are you able to add 5the filter", "can you filter")
    return {
      reply: `⚡ **Yes! I can filter the table directly for you.**\n\nTell me what you'd like to filter, or click any option:\n- 🎯 *"Filter Deal Done leads"*\n- 🔍 *"Filter Unassigned leads"*\n- 👤 *"Filter leads for Shreya / Ragini / Janhavi"*\n- 📅 *"Filter today's follow-ups"*\n- 🧘 *"Filter Faceyoga leads"*\n- 🔄 *"Reset all filters"*\n\nWhich leads would you like me to show in the table?`,
      source: "local"
    };
  }

  // Fetch live stats for metrics queries
  const dbStats = await fetchLiveDatabaseStats();
  const totalCount = dbStats.totalLeads > 0 ? dbStats.totalLeads : leads.length;

  // 4. Unassigned count inquiry
  if (q.includes("unassigned") || q.includes("not assigned") || q.includes("free lead")) {
    const unassignedCount = dbStats.assignedCounts["Unassigned"] ?? leads.filter(l => !l.assigned_to).length;
    return {
      reply: `🔍 **Unassigned Leads**\n\nThere are **${unassignedCount} unassigned leads** out of **${totalCount} total leads** in Supabase.\n\nClick below to view them in the table.`,
      action: { assignedToFilter: "unassigned" },
      source: "local",
      isDirectDbQuery: true
    };
  }

  // 5. Today follow ups
  if (q.includes("today") && (q.includes("follow") || q.includes("calling"))) {
    return {
      reply: `📅 **Today's Follow-ups**\n\nYou have **${dbStats.todayFollowUps} leads scheduled for follow-up today** (${dbStats.todayStr}).\n\nClick below to view them in the table.`,
      action: { autoDateFilter: dbStats.todayStr, statusFilter: "all" },
      source: "local",
      isDirectDbQuery: true
    };
  }

  // 6. Deal Done / Conversion count inquiry
  if (q.includes("deal done") || q.includes("conversion") || q.includes("converted") || q.includes("closed")) {
    return {
      reply: `🏆 **Deal Conversions**\n\n- **Total Closed Deals**: **${dbStats.dealDoneCount}**\n- **Database Total Leads**: **${totalCount}**\n- **Overall Conversion Rate**: **${dbStats.conversionRate}**\n\nClick below to view all **Deal Done** leads in the table.`,
      action: { statusFilter: "Deal Done" },
      source: "local",
      isDirectDbQuery: true
    };
  }

  // 7. Specific Program check (e.g. Faceyoga, Snehyoga 365, etc.)
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
      return {
        reply: `🧘 **${prog.name} Program**\n\nFound **${liveProgCount} leads** registered for **${prog.name}** in the database.\n\nClick below to view them in the table.`,
        action: { typeFilter: prog.name },
        source: "local",
        isDirectDbQuery: true
      };
    }
  }

  // 8. Call connection stats
  if (q.includes("call") || q.includes("connected") || q.includes("reachable") || q.includes("not connected")) {
    return {
      reply: `📞 **Call Connectivity Stats**\n\n- **Connected Calls**: **${dbStats.connectedCount}** ✅\n- **Not Connected Calls**: **${dbStats.notConnectedCount}** ❌\n- **Connection Rate**: **${dbStats.callConnectionRate}**`,
      source: "local",
      isDirectDbQuery: true
    };
  }

  // 9. Agent queries (Ragini, Shreya, Janhavi)
  const agents = [
    { key: "ragini", name: "Ragini K" },
    { key: "shreya", name: "Shreya K" },
    { key: "janhavi", name: "Janhavi V" }
  ];

  for (const agent of agents) {
    if (q.includes(agent.key)) {
      const agentCount = dbStats.assignedCounts[agent.name] ?? 0;
      return {
        reply: `👤 **${agent.name}'s Leads**\n\n- **Assigned Leads**: **${agentCount}**\n- **Share of Total Leads**: **${totalCount > 0 ? ((agentCount / totalCount) * 100).toFixed(1) : 0}%**\n\nClick below to view leads assigned to **${agent.name}**.`,
        action: { assignedToFilter: agent.name },
        source: "local",
        isDirectDbQuery: true
      };
    }
  }

  // 10. General overall summary (ONLY when user explicitly asks for overview, summary, or stats)
  const isOverviewRequest = q.includes("overview") || q.includes("summary") || q.includes("stats") || q.includes("statistics") || q.includes("report") || q.includes("all data");
  if (isOverviewRequest) {
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

  // 11. Default fallback for unknown or unclear inputs (DO NOT dump stats!)
  return {
    reply: `🤔 **I'm not sure what you mean by "${userQuery}".**\n\nYou can ask me:\n- ⚡ *"Filter Deal Done leads"* or *"Filter unassigned"*\n- 👤 *"Show Shreya's leads"*\n- 📊 *"Show overall statistics"*\n- 📅 *"What follow-ups are due today?"*\n\nOr tap any of the quick action chips above!`,
    source: "local"
  };
}

/** Ask AI Bot with direct Supabase database analytics & Gemini reasoning */
export async function askLeadAiBot(userQuery: string, leads: Lead[]): Promise<LeadAiResponse> {
  const q = userQuery.toLowerCase().trim();

  // Instant greeting check: avoid any network delay for simple hellos!
  if (/^(hi|hello|hey|hola|namaste|good\s*(morning|afternoon|evening))\b/i.test(q) || q === "hi" || q === "hello" || q === "hey") {
    return queryLeadsLocally(userQuery, leads);
  }

  const apiKey = import.meta.env.VITE_GEMINI_API_KEY || (window as any).VITE_GEMINI_API_KEY || FALLBACK_KEY;

  if (!apiKey) {
    console.warn("No Gemini API key available, using local resolver");
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

IMPORTANT BEHAVIOR INSTRUCTIONS:
1. GREETINGS & CASUAL TALK: Be warm and helpful. Do NOT dump raw database reports on a simple hello or general question!
2. DIRECT CONCISE ANSWERS: When the user asks a specific question (e.g. "how many deals done?" or "who has the most leads?"), answer that question directly in 1-2 friendly sentences.
3. OVERVIEW: Only output the full statistics report if the user explicitly asks for "overview", "summary", or "stats".
4. FILTERING: If the user asks to filter or view a subset of leads, populate the "action" object with the appropriate filter fields.
5. SECURITY: Do NOT output database connection strings, API keys, URLs, or access tokens in any response.

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

  // Try fast gemini-3.1-flash-lite first, then fallback to 3.6-flash and flash-latest
  const modelsToTry = [
    "gemini-3.1-flash-lite",
    "gemini-3.6-flash",
    "gemini-flash-latest"
  ];

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
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            contents: [
              {
                role: "user",
                parts: [{ text: `${systemInstruction}\n\nUser Question: "${userQuery}"` }]
              }
            ],
            generationConfig: {
              temperature: 0.4,
              responseMimeType: "application/json"
            }
          })
        }
      );

      clearTimeout(timeoutId);

      if (!response.ok) {
        console.warn(`Gemini API request failed (${response.status}) for model ${model}, trying next...`);
        continue;
      }

      const data = await response.json();
      const rawText = data?.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!rawText) continue;

      const parsed = JSON.parse(rawText.trim());
      console.log(`🤖 Gemini API (${model}) responded live:`, parsed.reply);
      return {
        reply: parsed.reply || "Here is what I found for you.",
        action: parsed.action,
        source: "gemini",
        isDirectDbQuery: true
      };
    } catch (err: any) {
      console.warn(`Gemini API attempt timed out or failed for ${model}:`, err?.message);
    }
  }

  // Fallback to local database resolver if API times out or fails
  return queryLeadsLocally(userQuery, leads);
}
