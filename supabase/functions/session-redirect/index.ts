// Supabase Edge Function: session-redirect
// ==========================================
// Server-side personal link handler — NO React app download needed!
//
// When a user clicks their personal link (e.g., yoga.snehyoga.com/join/abc123),
// this function runs entirely on the server:
//   1. Looks up the user by slug (referral_link)
//   2. Validates subscription (active, not paused, days > 0)
//   3. Gets today's session link from session_settings
//   4. Marks attendance (fire-and-forget)
//   5. Returns an instant HTTP 302 redirect to the session URL
//
// Total time: ~200-400ms (server-side DB queries only, no JS download)
//
// Deploy:  supabase functions deploy session-redirect

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

        // Run BOTH queries in parallel for speed
        const [userResult, settingsResult] = await Promise.all([
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
        if (!settings) {
            return new Response(errorPage("No Session", "Could not find session settings.", dashboardUrl), {
                status: 500,
                headers: { ...corsHeaders, "Content-Type": "text/html; charset=utf-8" },
            });
        }

        let targetLink = settings.session_link;
        try {
            if (targetLink && targetLink.startsWith('{')) {
                const parsed = JSON.parse(targetLink);
                const days = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
                // Use IST timezone (UTC+5:30)
                const now = new Date();
                const istOffset = 5.5 * 60 * 60 * 1000;
                const istDate = new Date(now.getTime() + istOffset);
                const todayStr = days[istDate.getUTCDay()];
                const activeWeek = parsed.active_week || 1;
                const key = `w${activeWeek}_${todayStr}`;
                targetLink = parsed[key];
            } else {
                // Legacy fallback for premium users
                if (user.subscription_plan === 'personalized' || user.subscription_plan === 'premium') {
                    if (settings.premium_session_link) {
                        targetLink = settings.premium_session_link;
                    }
                }
            }
        } catch (e) {
            console.error("Failed to parse session link:", e);
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
        // Simple HTTP 302 redirect — works everywhere including WhatsApp in-app browser.
        // YouTube/Zoom/Meet URLs automatically open their respective apps via
        // Android App Links / iOS Universal Links when the app is installed.
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
