import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Minimal error HTML page
const errorPage = (title: string, message: string, redirectUrl: string) => `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title} - Snehyoga</title>
  <style>
    body { font-family: -apple-system, sans-serif; display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0; background: #faf9f6; }
    .card { text-align: center; padding: 2rem; max-width: 320px; }
    h2 { color: #c53030; margin-bottom: 0.5rem; }
    p { color: #666; margin-bottom: 1.5rem; }
    a { display: inline-block; padding: 0.75rem 2rem; background: linear-gradient(135deg, #f97316, #f59e0b); color: white; text-decoration: none; border-radius: 999px; font-weight: 700; }
  </style>
</head>
<body>
  <div class="card">
    <h2>${title}</h2>
    <p>${message}</p>
    <a href="${redirectUrl}">Go to Dashboard &rarr;</a>
  </div>
</body>
</html>`;

Deno.serve(async (req) => {
    if (req.method === "OPTIONS") {
        return new Response("ok", { headers: corsHeaders });
    }

    const t0 = Date.now();
    const url = new URL(req.url);

    // Extract slug from path: /session-redirect/abc123 → abc123
    const pathParts = url.pathname.split("/").filter(Boolean);
    const slug = pathParts.length >= 2 ? pathParts[pathParts.length - 1] : null;

    // Dashboard URL for error redirects
    const dashboardUrl = "https://yoga.snehyoga.com/dashboard";

    if (!slug) {
        return new Response(errorPage("Invalid Link", "No session identifier found.", dashboardUrl), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "text/html; charset=utf-8" },
        });
    }

    try {
        const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
        const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
        const supabase = createClient(supabaseUrl, supabaseServiceKey);

        // Calculate IST day and active batch slot
        const days = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
        const now = new Date();
        const istOffset = 5.5 * 60 * 60 * 1000;
        const istDate = new Date(now.getTime() + istOffset);
        const todayStr = days[istDate.getUTCDay()];
        const curMin = istDate.getUTCHours() * 60 + istDate.getUTCMinutes();

        const slotDefs = [
            { slot: '5am', from: 5 * 60 - 20 },
            { slot: '6am', from: 6 * 60 - 20 },
            { slot: '8am', from: 8 * 60 - 20 },
            { slot: '5pm', from: 17 * 60 - 20 },
            { slot: '6pm', from: 18 * 60 - 20 },
            { slot: '7pm', from: 19 * 60 - 20 },
        ];
        let activeSlot = '7pm';
        for (let i = slotDefs.length - 1; i >= 0; i--) {
            if (curMin >= slotDefs[i].from) {
                activeSlot = slotDefs[i].slot;
                break;
            }
        }

        // Run user, settings, and batch links queries in parallel for ultra-fast redirection
        const [userResult, settingsResult, batchLinksResult] = await Promise.all([
            supabase
                .from("main_data_registration")
                .select("mobile_number, name, days_left, subscription_plan, subscription_paused")
                .ilike("referral_link", `%ref=${slug}%`)
                .limit(1)
                .maybeSingle(),
            supabase
                .from("session_settings")
                .select("session_link, premium_session_link")
                .single(),
            supabase
                .from("session_batch_links")
                .select("week, batch_slot, link")
                .eq("day", todayStr),
        ]);

        console.log(`[session-redirect] DB queries took ${Date.now() - t0}ms`);

        // ─── Validate User ──────────────────────────────────────────────
        const user = userResult.data;
        if (!user) {
            return new Response(errorPage("User Not Found", "This link doesn't match any registered user.", dashboardUrl), {
                status: 404,
                headers: { ...corsHeaders, "Content-Type": "text/html; charset=utf-8" },
            });
        }

        if (user.subscription_paused) {
            return new Response(errorPage("Subscription Paused", "Your subscription is currently paused. Please resume it from the dashboard.", dashboardUrl), {
                status: 403,
                headers: { ...corsHeaders, "Content-Type": "text/html; charset=utf-8" },
            });
        }

        if ((user.days_left || 0) <= 0) {
            return new Response(errorPage("Plan Expired", "Your plan has expired. Please renew to join sessions.", dashboardUrl), {
                status: 403,
                headers: { ...corsHeaders, "Content-Type": "text/html; charset=utf-8" },
            });
        }

        // ─── Determine Session Link ─────────────────────────────────────
        const settings = settingsResult.data;
        let activeWeek = 1;
        try {
            if (settings?.session_link && settings.session_link.startsWith('{')) {
                const parsed = JSON.parse(settings.session_link);
                activeWeek = parsed.active_week || 1;
            }
        } catch (_) {}

        let targetLink = "";

        // 1. First priority: Check session_batch_links for today + active week + active slot
        const batchRows = batchLinksResult.data || [];
        const weekRows = batchRows.filter((r: any) => r.week === activeWeek);
        const slotRow = weekRows.find((r: any) => r.batch_slot === activeSlot);
        if (slotRow?.link?.trim()) {
            targetLink = slotRow.link.trim();
        } else {
            // Fallback: any non-empty slot link for today in the active week
            const anySlot = weekRows.find((r: any) => r.link?.trim());
            if (anySlot?.link?.trim()) {
                targetLink = anySlot.link.trim();
            }
        }

        // 2. Second priority: Fallback to session_settings.session_link
        if (!targetLink && settings?.session_link) {
            try {
                if (settings.session_link.startsWith('{')) {
                    const parsed = JSON.parse(settings.session_link);
                    const key = `w${activeWeek}_${todayStr}`;
                    targetLink = parsed[key];
                } else {
                    targetLink = settings.session_link;
                }
            } catch (e) {
                console.error("Failed to parse session link:", e);
            }
        }

        // 3. Fallback for premium users if configured
        if (!targetLink && (user.subscription_plan === 'personalized' || user.subscription_plan === 'premium')) {
            if (settings?.premium_session_link) {
                targetLink = settings.premium_session_link;
            }
        }

        // Normalize URL (ensure https://)
        if (targetLink) {
            targetLink = targetLink.trim();
            if (!/^https?:\/\//i.test(targetLink)) {
                targetLink = `https://${targetLink}`;
            }
        }

        if (!targetLink) {
            return new Response(errorPage("No Active Session", "There is no active session link right now.", dashboardUrl), {
                status: 404,
                headers: { ...corsHeaders, "Content-Type": "text/html; charset=utf-8" },
            });
        }

        // ─── Mark Attendance (fire-and-forget) ──────────────────────────
        supabase.from('attendance').insert({ mobile_number: user.mobile_number }).then(
            () => console.log(`[session-redirect] Attendance marked for ${user.mobile_number}`),
            (err: unknown) => console.error("[session-redirect] Attendance error:", err)
        );

        // ─── Redirect! ─────────────────────────────────────────────────
        console.log(`[session-redirect] Redirecting ${user.name} -> ${targetLink} (${Date.now() - t0}ms total)`);

        return new Response(null, {
            status: 302,
            headers: {
                ...corsHeaders,
                "Location": targetLink,
                "Cache-Control": "no-cache, no-store, must-revalidate",
            },
        });

    } catch (err) {
        console.error("[session-redirect] Error:", err);
        return new Response(errorPage("Error", "Something went wrong. Please try again.", dashboardUrl), {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "text/html; charset=utf-8" },
        });
    }
});
