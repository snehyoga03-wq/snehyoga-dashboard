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
  const dbStats = await fetchLiveDatabaseStats();
  
  // Use live DB stats if available, otherwise fallback to active leads array length
  const totalCount = dbStats.totalLeads > 0 ? dbStats.totalLeads : leads.length;
  let action: LeadAiAction | undefined;

  // 1. Unassigned check
  if (q.includes("unassigned") || q.includes("not assigned") || q.includes("free lead")) {
    action = { assignedToFilter: "unassigned" };
    const unassignedCount = dbStats.assignedCounts["Unassigned"] ?? leads.filter(l => !l.assigned_to).length;
    return {
      reply: `🔍 **Live Database Query: Unassigned Leads**\n\n- **Total Unassigned in Supabase**: **${unassignedCount}** out of **${totalCount} total leads** across the entire database.\n\nClick the button below to filter the unassigned leads directly in your table.`,
      action,
      source: "local",
      isDirectDbQuery: true
    };
  }

  // 2. Today follow ups
  if (q.includes("today") && (q.includes("follow") || q.includes("calling"))) {
    action = { autoDateFilter: dbStats.todayStr, statusFilter: "all" };
    return {
      reply: `📅 **Live Database Query: Today's Follow-ups**\n\n- **Scheduled for Follow-up Today (${dbStats.todayStr})**: **${dbStats.todayFollowUps} leads**.\n\nTable filter is ready to view today's scheduled follow-ups.`,
      action,
      source: "local",
      isDirectDbQuery: true
    };
  }

  // 3. Deal Done / Conversion
  if (q.includes("deal done") || q.includes("conversion") || q.includes("converted") || q.includes("closed")) {
    action = { statusFilter: "Deal Done" };
    return {
      reply: `🏆 **Live Database Query: Deal Conversions**\n\n- **Total Deals Converted**: **${dbStats.dealDoneCount}**\n- **Database Total Leads**: **${totalCount}**\n- **Overall Conversion Rate**: **${dbStats.conversionRate}**\n\nTable filter updated to display all **Deal Done** leads.`,
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
        reply: `🧘 **Live Database Query: ${prog.name}**\n\n- **Total Leads for ${prog.name}**: **${liveProgCount}** records found in Supabase.\n\nYou can click below to filter the table for **${prog.name}**.`,
        action,
        source: "local",
        isDirectDbQuery: true
      };
    }
  }

  // 5. Call connection stats
  if (q.includes("call") || q.includes("connected") || q.includes("reachable") || q.includes("not connected")) {
    return {
      reply: `📞 **Live Database Query: Call Connectivity**\n\n- **Connected Calls in Supabase**: **${dbStats.connectedCount}** ✅\n- **Not Connected Calls in Supabase**: **${dbStats.notConnectedCount}** ❌\n- **Database Connection Rate**: **${dbStats.callConnectionRate}**`,
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
        reply: `👤 **Live Database Query: ${agent.name}**\n\n- **Total Leads Assigned**: **${agentCount}**\n- **Share of Database**: **${totalCount > 0 ? ((agentCount / totalCount) * 100).toFixed(1) : 0}%**\n\nTable filter ready to display leads assigned to **${agent.name}**.`,
        action,
        source: "local",
        isDirectDbQuery: true
      };
    }
  }

  // 7. General overall summary from Supabase database
  const statusSummaryText = Object.entries(dbStats.statusCounts)
    .map(([status, count]) => `  - **${status}**: ${count}`)
    .join("\n");

  const agentSummaryText = Object.entries(dbStats.assignedCounts)
    .map(([agent, count]) => `  - **${agent}**: ${count}`)
    .join("\n");

  return {
    reply: `📊 **Live Supabase Database Overview**\n\n- **Total Database Records**: **${totalCount} leads**\n- **Closed Deals**: **${dbStats.dealDoneCount}** (${dbStats.conversionRate})\n- **Follow-ups Due Today**: **${dbStats.todayFollowUps}**\n- **Call Connection Rate**: **${dbStats.callConnectionRate}**\n\n**Status Breakdown (Entire Database):**\n${statusSummaryText}\n\n**Agent Distribution (Entire Database):**\n${agentSummaryText}`,
    source: "local",
    isDirectDbQuery: true
  };
}

/** Ask AI Bot with direct Supabase database analytics & Gemini 3.6 Flash reasoning */
export async function askLeadAiBot(userQuery: string, leads: Lead[]): Promise<LeadAiResponse> {
  const apiKey = import.meta.env.VITE_GEMINI_API_KEY || (window as any).VITE_GEMINI_API_KEY;

  // Fetch live database metrics directly from Supabase
  const dbStats = await fetchLiveDatabaseStats();

  // Fallback to local resolver if no API key is provided
  if (!apiKey || apiKey === "your_api_key_here") {
    return queryLeadsLocally(userQuery, leads);
  }

  const systemInstruction = `You are Snehyoga Lead Assistant, an AI CRM bot embedded in the Lead Management dashboard.
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

SECURITY INSTRUCTION:
Do NOT output database connection strings, API keys, URLs, or access tokens in any response.

Always respond with a JSON object in this format (no extra markdown code fences, pure JSON):
{
  "reply": "Your clear, markdown formatted response highlighting exact database numbers and metrics",
  "action": {
    "statusFilter": "optional status filter value",
    "typeFilter": "optional lead type filter value",
    "assignedToFilter": "optional assigned to filter value",
    "autoDateFilter": "optional YYYY-MM-DD string",
    "searchQuery": "optional search query term"
  }
}
If no table filter action is needed, omit the "action" key.`;

  // Try primary model gemini-3.6-flash, fallback to gemini-flash-latest
  const modelsToTry = ["gemini-3.6-flash", "gemini-flash-latest"];

  for (const model of modelsToTry) {
    try {
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
        {
          method: "POST",
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
              temperature: 0.2,
              responseMimeType: "application/json"
            }
          })
        }
      );

      if (!response.ok) {
        console.warn(`Gemini API request failed for model ${model}, trying next...`);
        continue;
      }

      const data = await response.json();
      const rawText = data?.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!rawText) continue;

      const parsed = JSON.parse(rawText.trim());
      return {
        reply: parsed.reply || "Here is the live database summary.",
        action: parsed.action,
        source: "gemini",
        isDirectDbQuery: true
      };
    } catch (err) {
      console.error(`Error connecting to Gemini API model ${model}:`, err);
    }
  }

  // Fallback to local database resolver if API fails
  return queryLeadsLocally(userQuery, leads);
}
