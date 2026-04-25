// Supabase Edge Function: compute-retention-states
// ==================================================
// Core state engine for the Retention OS.
// Runs every 6 hours via pg_cron, or on-demand via HTTP POST.
//
// 1. Updates rolling session counts (14d, 30d) from attendance table
// 2. Computes lifecycle_state for every user using priority cascade
// 3. Computes is_loyal_member flag
// 4. Logs state transitions to retention_state_log
//
// Deploy: supabase functions deploy compute-retention-states

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Derive plan type from subscription_plan string
function getPlanType(plan: string | null): "monthly" | "yearly" {
    if (!plan) return "monthly";
    const lower = plan.toLowerCase();
    if (lower.includes("12 month") || lower.includes("yearly") || lower.includes("1 year")) return "yearly";
    return "monthly";
}

// Compute lifecycle state using priority cascade (PRD Section 4.1, minus EXPLORER)
function computeState(user: Record<string, any>): string {
    const daysLeft = user.days_left || 0;
    const isPaused = user.subscription_paused || false;
    const planActive = daysLeft > 0 && !isPaused;
    const planType = getPlanType(user.subscription_plan);
    const isActivated = user.is_activated || false;
    const sessionsLast14d = user.sessions_last_14d || 0;
    const sessionsLast30d = user.sessions_last_30d || 0;
    const lastSessionAt = user.last_session_at ? new Date(user.last_session_at) : null;
    const createdAt = user.created_at ? new Date(user.created_at) : new Date();
    const now = new Date();

    const daysSinceLastSession = lastSessionAt
        ? Math.floor((now.getTime() - lastSessionAt.getTime()) / (1000 * 60 * 60 * 24))
        : 999;
    const daysSinceJoin = Math.floor((now.getTime() - createdAt.getTime()) / (1000 * 60 * 60 * 24));

    // P1: EXPIRED
    if (!planActive) return "EXPIRED";

    // P2: EXPIRING_SOON
    if (planActive && daysLeft <= 7) return "EXPIRING_SOON";

    // P3: YEARLY
    if (planType === "yearly" && planActive) return "YEARLY";

    // P4: AT_RISK
    if (isActivated && daysSinceLastSession >= 14 && planActive) return "AT_RISK";

    // P5: INCONSISTENT
    if (isActivated && sessionsLast14d === 1 && planActive) return "INCONSISTENT";

    // P6: ACTIVE_CORE
    if (isActivated && sessionsLast30d >= 3 && planActive) return "ACTIVE_CORE";

    // P7: EARLY_RHYTHM
    if (isActivated && sessionsLast14d >= 2 && sessionsLast30d < 3) return "EARLY_RHYTHM";

    // P8: ACTIVATED
    if (isActivated && daysSinceLastSession < 14) return "ACTIVATED";

    // P9: ONBOARDING
    if (!isActivated && daysSinceJoin <= 7) return "ONBOARDING";

    // P10: JUST_JOINED
    if (!isActivated && daysSinceJoin <= 2) return "JUST_JOINED";

    // Fallback
    if (!isActivated) return "ONBOARDING";
    return user.lifecycle_state || "ACTIVATED";
}

// Compute is_loyal_member flag (PRD Section 4.2)
function computeLoyal(user: Record<string, any>): boolean {
    const totalMonths = user.total_months_active || 0;
    const sessionsLast30d = user.sessions_last_30d || 0;
    const renewalCount = user.renewal_count || 0;
    const lastSessionAt = user.last_session_at ? new Date(user.last_session_at) : null;
    const now = new Date();

    if (totalMonths < 12) return false;
    if (sessionsLast30d < 8) return false;
    if (renewalCount < 1) return false;

    // Check no gap > 21 days (simplified: if last session within 21 days)
    if (!lastSessionAt) return false;
    const daysSinceLast = Math.floor((now.getTime() - lastSessionAt.getTime()) / (1000 * 60 * 60 * 24));
    if (daysSinceLast > 21) return false;

    return true;
}

Deno.serve(async (req) => {
    if (req.method === "OPTIONS") {
        return new Response("ok", { headers: corsHeaders });
    }

    try {
        const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
        const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
        const supabase = createClient(supabaseUrl, supabaseServiceKey);

        console.log("🔄 [RetentionEngine] Starting state computation...");

        // ─── Step 1: Update rolling session counts ───────────────────────
        // sessions_last_30d
        await supabase.rpc("exec_sql", {
            query: `
                UPDATE main_data_registration mdr SET
                    sessions_last_30d = COALESCE(sub.cnt, 0),
                    sessions_last_14d = 0, total_sessions = COALESCE(sub2.total, mdr.total_sessions),
                    first_session_at = COALESCE(sub2.first_at, mdr.first_session_at),
                    last_session_at = COALESCE(sub2.last_at, mdr.last_session_at),
                    is_activated = COALESCE(sub2.total, 0) > 0
                FROM (
                    SELECT mobile_number, COUNT(*) AS cnt
                    FROM attendance WHERE created_at >= NOW() - INTERVAL '30 days'
                    GROUP BY mobile_number
                ) sub
                LEFT JOIN (
                    SELECT mobile_number, COUNT(*) AS total, MIN(created_at) AS first_at, MAX(created_at) AS last_at
                    FROM attendance GROUP BY mobile_number
                ) sub2 ON sub.mobile_number = sub2.mobile_number
                WHERE mdr.mobile_number = sub.mobile_number
            `
        }).catch(() => {
            // RPC might not exist, do it manually
            console.log("ℹ️ exec_sql RPC not available, using direct queries");
        });

        // Fallback: update via individual queries
        // Update session counts from attendance
        const { data: attendanceCounts } = await supabase
            .from("attendance")
            .select("mobile_number, created_at");

        if (attendanceCounts) {
            const now = new Date();
            const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
            const fourteenDaysAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);

            // Group by mobile_number
            const userStats: Record<string, { total: number; last30: number; last14: number; first: Date; last: Date }> = {};
            for (const row of attendanceCounts) {
                const phone = row.mobile_number;
                const date = new Date(row.created_at);
                if (!userStats[phone]) {
                    userStats[phone] = { total: 0, last30: 0, last14: 0, first: date, last: date };
                }
                userStats[phone].total++;
                if (date >= thirtyDaysAgo) userStats[phone].last30++;
                if (date >= fourteenDaysAgo) userStats[phone].last14++;
                if (date < userStats[phone].first) userStats[phone].first = date;
                if (date > userStats[phone].last) userStats[phone].last = date;
            }

            // Batch update users
            for (const [phone, stats] of Object.entries(userStats)) {
                await supabase
                    .from("main_data_registration")
                    .update({
                        total_sessions: stats.total,
                        sessions_last_30d: stats.last30,
                        sessions_last_14d: stats.last14,
                        first_session_at: stats.first.toISOString(),
                        last_session_at: stats.last.toISOString(),
                        is_activated: stats.total > 0,
                    })
                    .eq("mobile_number", phone);
            }
            console.log(`📊 Updated session counts for ${Object.keys(userStats).length} users`);
        }

        // ─── Step 2: Fetch all users and compute states ──────────────────
        const { data: users, error: usersError } = await supabase
            .from("main_data_registration")
            .select("id, mobile_number, created_at, days_left, subscription_plan, subscription_paused, lifecycle_state, state_override, state_override_expires_at, first_session_at, last_session_at, total_sessions, sessions_last_30d, sessions_last_14d, is_activated, is_loyal_member, renewal_count, total_months_active");

        if (usersError) throw new Error(`Users fetch error: ${usersError.message}`);
        if (!users || users.length === 0) {
            return new Response(
                JSON.stringify({ success: true, processed: 0, message: "No users found" }),
                { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
        }

        let stateChanges = 0;
        const now = new Date();

        for (const user of users) {
            // Check for active manual override
            if (user.state_override && user.state_override_expires_at) {
                const overrideExpiry = new Date(user.state_override_expires_at);
                if (overrideExpiry > now) {
                    continue; // Skip — admin override is active
                }
                // Clear expired override
                await supabase
                    .from("main_data_registration")
                    .update({ state_override: null, state_override_expires_at: null })
                    .eq("id", user.id);
            }

            const newState = computeState(user);
            const newLoyal = computeLoyal(user);
            const oldState = user.lifecycle_state;

            if (newState !== oldState || newLoyal !== user.is_loyal_member) {
                // Update user
                await supabase
                    .from("main_data_registration")
                    .update({
                        lifecycle_state: newState,
                        state_updated_at: now.toISOString(),
                        is_loyal_member: newLoyal,
                    })
                    .eq("id", user.id);

                // Log state transition
                if (newState !== oldState) {
                    await supabase.from("retention_state_log").insert({
                        user_id: user.id,
                        previous_state: oldState,
                        new_state: newState,
                        trigger: "scheduled",
                    });
                    stateChanges++;
                }
            }
        }

        console.log(`✅ [RetentionEngine] Processed ${users.length} users, ${stateChanges} state changes`);

        return new Response(
            JSON.stringify({
                success: true,
                processed: users.length,
                stateChanges,
                timestamp: now.toISOString(),
            }),
            { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );

    } catch (err) {
        console.error("❌ compute-retention-states error:", err);
        return new Response(
            JSON.stringify({ success: false, error: err instanceof Error ? err.message : String(err) }),
            { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
    }
});
