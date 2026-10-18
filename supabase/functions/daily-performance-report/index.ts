// Supabase Edge Function: daily-performance-report
// ===================================================
// Calculates daily performance metrics for Sneh Yoga telecalling team
// and sends both Team Report and Telecaller Reports to WhatsApp number (Default: 919145414083)
// Triggered daily at 7:00 PM IST via pg_cron.
//
// Deploy: supabase functions deploy daily-performance-report --no-verify-jwt

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const WA_API_VERSION = "v20.0";
const DEFAULT_PHONES = ["919145414083", "919371575365", "919623762115"];
const ASSIGNED_USERS = ["Ragini K", "Shreya K", "Tejasswini K"];

const NOT_CONNECTED_PATTERNS = [
  "call not received", "call not picked", "not received", "not picked",
  "not reachable", "unreachable", "switched off", "switch off",
  "out of coverage", "busy", "no response", "no answer", "no ans", "not ans",
  "didn't pick", "did not pick", "didn't answer", "did not answer",
  "not responding", "phone off", "number not working", "invalid number",
  "wrong number", "disconnected", "network issue", "network error",
  "rnr", "np", "cnr", "snr", "not available", "unavailable",
  "ring no reply", "call not connected", "couldn't connect", "could not connect",
  "can't reach", "cannot reach"
];

function autoDetectCallConnected(remark: string | null | undefined): string | null {
  if (!remark || remark.trim() === "" || remark === "No remark") return null;
  const lower = remark.trim().toLowerCase();
  const isNotConnected = NOT_CONNECTED_PATTERNS.some((p) => lower.includes(p));
  return isNotConnected ? "not_connected" : "connected";
}

function isDateInFilter(dateVal: string | null | undefined, filterDate: string): boolean {
  if (!dateVal || !filterDate) return false;
  if (typeof dateVal === "string" && dateVal.startsWith(filterDate)) return true;
  const d = new Date(dateVal);
  if (isNaN(d.getTime())) return false;
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}` === filterDate;
}

function isUserMatch(assignedTo: string | null | undefined, targetUser: string): boolean {
  if (!targetUser || targetUser === "all") return true;
  const normTarget = targetUser.trim().toLowerCase();
  const targetFirstName = normTarget.split(" ")[0];
  const normAssigned = (assignedTo || "").trim().toLowerCase();

  const isTargetTejas = normTarget.includes("tejasswin") || normTarget.includes("tejassw") || normTarget.includes("tejasw") || normTarget.includes("janhavi");
  const isAssignedTejas = normAssigned.includes("tejasswin") || normAssigned.includes("tejassw") || normAssigned.includes("tejasw") || normAssigned.includes("janhavi");

  if (isTargetTejas && isAssignedTejas) return true;
  return normAssigned.includes(normTarget) || normAssigned.includes(targetFirstName);
}

function getLeadCallStatusForDate(lead: any, historyEntries: any[], targetDate: string): "connected" | "not_connected" | "not_called" {
  const leadHistory = historyEntries.filter((h) => h.lead_id === lead.id);

  // 1. History logged on targetDate
  const periodHistory = leadHistory.filter((h) => isDateInFilter(h.created_at, targetDate));
  if (periodHistory.length > 0) {
    for (const h of periodHistory) {
      if (h.call_connected === "connected") return "connected";
      if (h.call_connected === "not_connected") return "not_connected";
      if (h.action_type === "Call Status") {
        if (h.description?.toLowerCase().includes("not connected")) return "not_connected";
        if (h.description?.toLowerCase().includes("connected")) return "connected";
      }
      const text = h.notes || h.remark || h.comment || h.remarks;
      if (text && text.trim() !== "" && text !== "No remark") {
        const detected = autoDetectCallConnected(text);
        if (detected) return detected as "connected" | "not_connected";
      }
    }
  }

  // 2. Calling date set to targetDate
  if (lead.calling_date && isDateInFilter(lead.calling_date, targetDate)) {
    if (lead.call_connected === "connected") return "connected";
    if (lead.call_connected === "not_connected") return "not_connected";
    if (lead.lead_status === "Deal Done") return "connected";
    if (lead.remark && lead.remark.trim() !== "" && lead.remark !== "No remark") {
      const detected = autoDetectCallConnected(lead.remark);
      if (detected) return detected as "connected" | "not_connected";
    }
    return "connected";
  }

  // 3. Created on targetDate
  if (lead.created_at && isDateInFilter(lead.created_at, targetDate)) {
    if (lead.call_connected === "connected") return "connected";
    if (lead.call_connected === "not_connected") return "not_connected";
    if (lead.lead_status === "Deal Done") return "connected";
    if (lead.lead_status && lead.lead_status !== "Select Option") {
      if (lead.remark && lead.remark.trim() !== "" && lead.remark !== "No remark") {
        const detected = autoDetectCallConnected(lead.remark);
        if (detected) return detected as "connected" | "not_connected";
      }
      return "connected";
    }
  }

  return "not_called";
}

function isLeadWorkedOnDate(lead: any, historyEntries: any[], targetDate: string): boolean {
  if (getLeadCallStatusForDate(lead, historyEntries, targetDate) !== "not_called") return true;
  const leadHistory = historyEntries.filter((h) => h.lead_id === lead.id);
  if (leadHistory.some((h) => isDateInFilter(h.created_at, targetDate))) return true;
  if (lead.calling_date && isDateInFilter(lead.calling_date, targetDate)) return true;
  if (lead.created_at && isDateInFilter(lead.created_at, targetDate)) {
    if (lead.lead_status && lead.lead_status !== "Select Option") return true;
    if (lead.call_connected && lead.call_connected !== "none") return true;
  }
  return false;
}

function generateUserOverviewSentence(userStats: {
  name: string;
  callsDone: number;
  connectedCalls: number;
  followupCallsDone: number;
  pendingFollowups: number;
  overdueTasks: number;
  dealsConverted: number;
  overallScore: number;
}): string {
  const { name, callsDone, connectedCalls, followupCallsDone, pendingFollowups, overdueTasks, dealsConverted, overallScore } = userStats;

  if (callsDone === 0) {
    return `❌ Inactive today: No calls, notes, or status changes were logged for ${name} across assigned leads. Immediate check-in required.`;
  }
  if (overallScore >= 75 || connectedCalls >= 50) {
    return `🌟 Outstanding performance today: ${name} achieved a high score of ${overallScore}/100 with ${callsDone} total calls (${connectedCalls} connected), cleared ${followupCallsDone} follow-ups, and converted ${dealsConverted} deal(s). Daily target fully exceeded.`;
  }
  if (overallScore >= 60 || callsDone >= 40) {
    return `👍 Steady & consistent work today: ${name} logged ${callsDone} calls (${connectedCalls} connected) with ${followupCallsDone} follow-ups cleared. Maintaining solid outreach pace and active lead engagement.`;
  }
  if (pendingFollowups > 10 || overdueTasks > 0) {
    return `⚠️ Attention required on follow-up backlog: While ${name} made ${callsDone} calls, there are ${pendingFollowups} pending follow-ups (${overdueTasks} overdue). Priority must be placed on clearing overdue follow-up leads first.`;
  }
  return `📈 Moderate pace today: ${name} completed ${callsDone} calls (${connectedCalls} connected) with ${followupCallsDone} follow-up calls done (Score: ${overallScore}/100). Higher call volume needed to reach the 60-call target.`;
}

function generateTeamOverviewSentence(teamStats: {
  callsDone: number;
  connectedCalls: number;
  dealsConverted: number;
  overdueTasks: number;
  topPerformerName: string;
}): string {
  const { callsDone, connectedCalls, dealsConverted, overdueTasks, topPerformerName } = teamStats;
  if (callsDone === 0) {
    return `⚠️ No call outreach activity logged by the team for today yet. Immediate dialing campaign required.`;
  }
  return `📊 Team achieved ${dealsConverted} deal(s) today across ${callsDone} total calls (${connectedCalls} connected). Lead performer: ${topPerformerName || "N/A"}. ${overdueTasks > 0 ? `Notice: ${overdueTasks} follow-ups are overdue and require urgent attention.` : `Follow-up tasks are in healthy standing.`}`;
}

// Send Template or Text Fallback via Meta WhatsApp API
async function sendWhatsAppMessage(
  phoneNumberId: string,
  token: string,
  toPhone: string,
  templateName: string,
  params: string[],
  fallbackText: string,
  preferredLang: string = "en"
): Promise<{ success: boolean; messageId?: string; type: "template" | "text_fallback"; error?: string }> {
  const url = `https://graph.facebook.com/${WA_API_VERSION}/${phoneNumberId}/messages`;

  // 1. Attempt sending approved Meta Template with candidates: [preferredLang, "en", "en_US"]
  const candidateLangs = [preferredLang, "en", "en_US"].filter(
    (code, idx, arr) => Boolean(code) && arr.indexOf(code) === idx
  );

  for (const langCode of candidateLangs) {
    try {
      const templatePayload = {
        messaging_product: "whatsapp",
        to: toPhone,
        type: "template",
        template: {
          name: templateName,
          language: { code: langCode },
          components: [
            {
              type: "body",
              parameters: params.map((p) => ({
                type: "text",
                text: String(p ?? "").replace(/[\r\n\t]+/g, " | ").replace(/\s{4,}/g, " ").trim(),
              })),
            },
          ],
        },
      };

      const res = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`,
        },
        body: JSON.stringify(templatePayload),
      });

      const json = await res.json();
      if (res.ok && json.messages?.[0]?.id) {
        console.log(`✅ Template '${templateName}' (${langCode}) sent successfully to ${toPhone}: ${json.messages[0].id}`);
        return { success: true, messageId: json.messages[0].id, type: "template" };
      }

      // If translation not found, continue to next candidate language
      if (json.error?.code === 132001) {
        console.log(`ℹ️ Template '${templateName}' not found for language '${langCode}', checking other variants...`);
        continue;
      }

      console.warn(`⚠️ Template '${templateName}' (${langCode}) send failed (${res.status}):`, json.error?.message || json);
    } catch (err: any) {
      console.warn(`⚠️ Template error for '${templateName}' (${langCode}):`, err.message);
    }
  }

  // 2. Direct Text Fallback (Ensures report is 100% delivered to user)
  console.log(`📨 Falling back to direct WhatsApp text message to ${toPhone}...`);
  try {
    const textPayload = {
      messaging_product: "whatsapp",
      to: toPhone,
      type: "text",
      text: { body: fallbackText },
    };

    const textRes = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${token}`,
      },
      body: JSON.stringify(textPayload),
    });

    const textJson = await textRes.json();
    if (textRes.ok && textJson.messages?.[0]?.id) {
      console.log(`✅ Text fallback sent successfully to ${toPhone}: ${textJson.messages[0].id}`);
      return { success: true, messageId: textJson.messages[0].id, type: "text_fallback" };
    }

    return { success: false, error: textJson.error?.message || `HTTP ${textRes.status}`, type: "text_fallback" };
  } catch (err: any) {
    return { success: false, error: err.message, type: "text_fallback" };
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Optional override from POST body
    let bodyData: any = {};
    if (req.method === "POST") {
      try {
        bodyData = await req.json();
      } catch {
        bodyData = {};
      }
    }

    const targetPhones: string[] = bodyData.to
      ? (Array.isArray(bodyData.to)
          ? bodyData.to
          : String(bodyData.to).split(",").map((s) => s.trim()).filter(Boolean))
      : DEFAULT_PHONES;

    // Determine targetDate in IST (Indian Standard Time: UTC + 5:30)
    const now = new Date();
    const istTime = new Date(now.getTime() + 5.5 * 60 * 60 * 1000);
    const targetDate = bodyData.date || istTime.toISOString().split("T")[0];

    console.log(`📊 [DailyReport] Generating daily report for ${targetDate} -> Sending to ${targetPhones.join(", ")}...`);

    // Fetch Meta WhatsApp Credentials
    const { data: settings } = await supabase
      .from("session_settings")
      .select("wa_api_token, wa_phone_number_id, wa_language_code")
      .maybeSingle();

    const waToken =
      settings?.wa_api_token ||
      "EAAX2HQ7QpvUBSZAK3krfGE7pLN8pW3WoUZCSJZCJsZB4oallIQNagAXwCqENBRZBO3kOGbABFyeI0IqrkZAsuA5lft4kVWrtuoy9MylP9RDz2BV5uEFLjNFBNuU9CJqzFMEMYLZBTn8ZCswZCE8CubZCg0KliOITU9t43FlGZA6HBSyS819nxhAdvTZBOl8IhT5tbV2LHQZDZD";
    const phoneNumberId = settings?.wa_phone_number_id || "1230157110176906";
    const preferredLang = settings?.wa_language_code || "en";

    // Fetch all leads
    let allLeads: any[] = [];
    let offset = 0;
    const pageSize = 1000;
    let hasMore = true;

    while (hasMore) {
      const { data: chunk, error: leadsErr } = await supabase
        .from("leads")
        .select("*")
        .order("created_at", { ascending: false })
        .range(offset, offset + pageSize - 1);

      if (leadsErr) throw leadsErr;
      if (!chunk || chunk.length === 0) {
        hasMore = false;
      } else {
        allLeads = allLeads.concat(chunk);
        if (chunk.length < pageSize) hasMore = false;
        else offset += pageSize;
      }
    }

    // Fetch recent lead history (up to 5000 rows)
    const { data: historyData, error: histErr } = await supabase
      .from("lead_history")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(5000);

    if (histErr) throw histErr;
    const history = historyData || [];

    // Filter leads relevant to targetDate
    const matchesTargetDateFilter = (lead: any): boolean => {
      const isMasterClassFollow = lead.lead_status === "Master Class Follow";
      const isCreatedToday = isDateInFilter(lead.created_at, targetDate);
      const isFollowUpToday = isDateInFilter(lead.follow_up_date, targetDate);
      const isUntouchedCarryForward =
        lead.created_at &&
        lead.created_at.slice(0, 10) < targetDate &&
        lead.lead_status === "Select Option" &&
        !lead.follow_up_date;
      return isCreatedToday || isFollowUpToday || isUntouchedCarryForward || isMasterClassFollow;
    };

    const targetLeads = allLeads.filter(matchesTargetDateFilter);

    // Calculate Member Performance
    const membersData = ASSIGNED_USERS.map((user) => {
      const userLeads = targetLeads.filter((l) => isUserMatch(l.assigned_to, user));
      const userHistory = history.filter((h) => isUserMatch(h.created_by, user));

      let connected = 0;
      let notConnected = 0;
      let converted = 0;
      let pendingFollowUps = 0;
      let overdueTasks = 0;
      let tasksCompleted = 0;
      let followUpsCompleted = 0;
      let newAssignedLeads = 0;
      let followUpCallsDone = 0;

      userLeads.forEach((l) => {
        const st = getLeadCallStatusForDate(l, userHistory, targetDate);
        if (st === "connected") connected++;
        else if (st === "not_connected") notConnected++;

        const isWorkedOn = isLeadWorkedOnDate(l, userHistory, targetDate);

        if (isDateInFilter(l.created_at, targetDate)) {
          newAssignedLeads++;
        }

        if (l.lead_status === "Deal Done") {
          converted++;
        } else if (l.lead_status === "Follow Up") {
          if (!isWorkedOn) {
            pendingFollowUps++;
            if (l.follow_up_date && l.follow_up_date < targetDate) {
              overdueTasks++;
            }
          }
        }

        if (isWorkedOn) {
          tasksCompleted++;
          if (l.follow_up_date) {
            followUpsCompleted++;
          }
          if (st !== "not_called" && l.follow_up_date && l.follow_up_date <= targetDate) {
            followUpCallsDone++;
          }
        }
      });

      const callsCompleted = connected + notConnected;
      const leadsHandled = userLeads.length;
      const conversionRate = leadsHandled > 0 ? (converted / leadsHandled) * 100 : 0;

      // Score
      const callScore = Math.min(100, Math.round((connected / 30) * 100));
      const convScore = Math.min(100, Math.round((conversionRate / 10) * 100));
      const totalFollowUps = followUpsCompleted + overdueTasks;
      const clearanceScore = totalFollowUps > 0 ? Math.max(0, Math.round((followUpsCompleted / totalFollowUps) * 100)) : 100;
      const overallScore = Math.min(100, Math.max(0, Math.round(callScore * 0.4 + convScore * 0.35 + clearanceScore * 0.25)));

      let performanceRating = "AVERAGE";
      if (overallScore >= 75) performanceRating = "HIGH";
      else if (overallScore < 45) performanceRating = "NEEDS_IMPROVEMENT";

      const dynamicSentence = generateUserOverviewSentence({
        name: user,
        callsDone: callsCompleted,
        connectedCalls: connected,
        followupCallsDone: followUpCallsDone,
        pendingFollowups: pendingFollowUps,
        overdueTasks,
        dealsConverted: converted,
        overallScore,
      });

      return {
        name: user,
        callsCompleted,
        connectedCalls: connected,
        notConnectedCalls: notConnected,
        leadsHandled,
        followUpsCompleted,
        pendingFollowUps,
        leadsConverted: converted,
        conversionRate,
        tasksCompleted,
        overdueTasks,
        overallScore,
        performanceRating,
        newAssignedLeads,
        followUpCallsDone,
        dynamicSentence,
      };
    });

    // Sort by overallScore descending to assign rank
    membersData.sort((a, b) => b.overallScore - a.overallScore);
    const rankedMembers = membersData.map((m, idx) => ({ ...m, rank: idx + 1 }));

    // Team Totals
    const teamCallsDone = rankedMembers.reduce((acc, m) => acc + m.callsCompleted, 0);
    const teamConnected = rankedMembers.reduce((acc, m) => acc + m.connectedCalls, 0);
    const teamNotConnected = rankedMembers.reduce((acc, m) => acc + m.notConnectedCalls, 0);
    const teamFollowUpCalls = rankedMembers.reduce((acc, m) => acc + m.followUpCallsDone, 0);
    const teamPendingFollowUps = rankedMembers.reduce((acc, m) => acc + m.pendingFollowUps, 0);
    const teamDealsConverted = rankedMembers.reduce((acc, m) => acc + m.leadsConverted, 0);
    const teamTasksCompleted = rankedMembers.reduce((acc, m) => acc + m.tasksCompleted, 0);
    const teamNewAssigned = rankedMembers.reduce((acc, m) => acc + m.newAssignedLeads, 0);
    const teamConversionRate = teamCallsDone > 0 ? (teamDealsConverted / teamCallsDone) * 100 : 0;
    const teamOverdue = rankedMembers.reduce((acc, m) => acc + m.overdueTasks, 0);

    const topPerformer = rankedMembers[0];
    const teamOverviewSentence = generateTeamOverviewSentence({
      callsDone: teamCallsDone,
      connectedCalls: teamConnected,
      dealsConverted: teamDealsConverted,
      overdueTasks: teamOverdue,
      topPerformerName: topPerformer?.name || "",
    });

    const telecallerHighlightsText = rankedMembers
      .map(
        (m) =>
          `• ${m.name} (Rank #${m.rank}): ${m.callsCompleted} calls (${m.connectedCalls} Conn, ${m.leadsConverted} deal) [Score: ${m.overallScore}]`
      )
      .join("  |  ");

    // 1. Prepare Team Performance Daily Report Payload
    const teamTemplateParams = [
      targetDate,
      String(ASSIGNED_USERS.length),
      String(ASSIGNED_USERS.length * 60),
      String(teamNewAssigned),
      String(teamCallsDone),
      String(teamConnected),
      String(teamNotConnected),
      String(teamFollowUpCalls),
      String(teamPendingFollowUps),
      String(teamDealsConverted),
      teamConversionRate.toFixed(1),
      String(teamTasksCompleted),
      telecallerHighlightsText,
      teamOverviewSentence,
    ];

    const teamFallbackText = `📊 *SNEH YOGA CRM — TEAM DAILY PERFORMANCE REPORT*
📅 *Date*: ${targetDate}
👥 *Total Active Telecallers*: ${ASSIGNED_USERS.length}

━━━━━━━━━━━━━━━━━━━━━━━━━━
📈 *DAILY TEAM TOTALS*
• 🎯 *Total Target Calls*: ${ASSIGNED_USERS.length * 60}
• 📥 *Today New Assigned Leads*: ${teamNewAssigned}
• 📞 *Total Calls Done*: ${teamCallsDone}
    ↳ ✅ Connected Calls: ${teamConnected}
    ↳ ❌ Not Connected Calls: ${teamNotConnected}
• 🔄 *Follow-up Calls Done*: ${teamFollowUpCalls}
• ⏳ *Pending Follow-ups*: ${teamPendingFollowUps}
• 💰 *Deals Converted*: ${teamDealsConverted} (${teamConversionRate.toFixed(1)}%)
• 📋 *Tasks Completed*: ${teamTasksCompleted}

━━━━━━━━━━━━━━━━━━━━━━━━━━
🏆 *TELECALLER BREAKDOWN*
${rankedMembers
  .map(
    (m) =>
      `👤 *${m.name}* (Rank #${m.rank} | Score: ${m.overallScore}/100):\n   • Calls Done: ${m.callsCompleted} (${m.connectedCalls} Connected, ${m.notConnectedCalls} Not Connected)\n   • New Leads: ${m.newAssignedLeads} | Follow-up Calls: ${m.followUpCallsDone}\n   • Deals: ${m.leadsConverted}\n   • Overview: ${m.dynamicSentence}`
  )
  .join("\n\n")}

━━━━━━━━━━━━━━━━━━━━━━━━━━
📝 *TODAY'S TEAM OVERVIEW*
${teamOverviewSentence}`;

    const deliveryResults: any[] = [];

    // Send reports to all target recipients
    for (const targetPhone of targetPhones) {
      console.log(`📱 Delivering reports to ${targetPhone}...`);

      // 1. Send Team Performance Daily Report
      const teamSendRes = await sendWhatsAppMessage(
        phoneNumberId,
        waToken,
        targetPhone,
        "team_performance_daily_report",
        teamTemplateParams,
        teamFallbackText,
        preferredLang
      );

      deliveryResults.push({ recipient: targetPhone, report: "team_performance_daily_report", ...teamSendRes });

      // 2. Send Individual Telecaller Daily Reports for Each User
      for (const m of rankedMembers) {
        const userTemplateParams = [
          targetDate,
          m.name,
          String(m.rank),
          String(m.overallScore),
          m.performanceRating,
          "60",
          String(m.newAssignedLeads),
          String(m.callsCompleted),
          String(m.connectedCalls),
          String(m.notConnectedCalls),
          String(m.followUpCallsDone),
          String(m.pendingFollowUps),
          String(m.overdueTasks),
          String(m.leadsConverted),
          m.conversionRate.toFixed(1),
          m.dynamicSentence,
        ];

        const userFallbackText = `👤 *SNEH YOGA CRM — TELECALLER DAILY REPORT*
📅 *Date*: ${targetDate}
👤 *Telecaller*: ${m.name}
🏆 *Team Rank*: #${m.rank} | *Score*: ${m.overallScore}/100 (${m.performanceRating})

━━━━━━━━━━━━━━━━━━━━━━━━━━
📊 *TODAY'S CALL ACTIVITY*
• 🎯 *Daily Call Target*: 60 Connected Calls
• 📥 *Today New Assigned Leads*: ${m.newAssignedLeads}
• 📞 *Total Calls Done*: ${m.callsCompleted}
    ↳ ✅ Connected Calls: ${m.connectedCalls}
    ↳ ❌ Not Connected Calls: ${m.notConnectedCalls}
• 🔄 *Follow-up Calls Done*: ${m.followUpCallsDone}
• ⏳ *Pending Follow-ups*: ${m.pendingFollowUps}
• ⚠️ *Overdue Tasks*: ${m.overdueTasks}
• 💰 *Deals Converted*: ${m.leadsConverted} (${m.conversionRate.toFixed(1)}%)

━━━━━━━━━━━━━━━━━━━━━━━━━━
💬 *TODAY'S REPORT OVERVIEW*
${m.dynamicSentence}`;

        const userSendRes = await sendWhatsAppMessage(
          phoneNumberId,
          waToken,
          targetPhone,
          "telecaller_daily_report",
          userTemplateParams,
          userFallbackText,
          preferredLang
        );

        deliveryResults.push({ recipient: targetPhone, report: `telecaller_daily_report (${m.name})`, ...userSendRes });
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        date: targetDate,
        recipients: targetPhones,
        teamMetrics: {
          totalCalls: teamCallsDone,
          connectedCalls: teamConnected,
          notConnectedCalls: teamNotConnected,
          followUpCallsDone: teamFollowUpCalls,
          newAssignedLeads: teamNewAssigned,
          dealsConverted: teamDealsConverted,
          conversionRate: teamConversionRate,
        },
        members: rankedMembers.map((m) => ({
          name: m.name,
          rank: m.rank,
          score: m.overallScore,
          callsDone: m.callsCompleted,
          connected: m.connectedCalls,
          newAssigned: m.newAssignedLeads,
          followUpsDone: m.followUpCallsDone,
          deals: m.leadsConverted,
          overview: m.dynamicSentence,
        })),
        deliveryResults,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    console.error("❌ [DailyReport] Function execution error:", err);
    return new Response(
      JSON.stringify({ success: false, error: err.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
