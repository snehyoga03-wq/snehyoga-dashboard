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

// YouTube video ID extraction for app deep links
const extractYouTubeId = (url: string): string | null => {
    try {
        const u = new URL(url);
        const host = u.hostname.replace('www.', '');
        if (host === 'youtube.com' || host === 'm.youtube.com') {
            if (u.searchParams.has('v')) return u.searchParams.get('v');
            const pathMatch = u.pathname.match(/^\/(live|embed|shorts|v)\/([^/?]+)/);
            if (pathMatch) return pathMatch[2];
        }
        if (host === 'youtu.be') {
            return u.pathname.slice(1).split('/')[0] || null;
        }
    } catch { /* not a valid URL */ }
    return null;
};

// Build redirect URL — for YouTube links, use Intent URL on Android for app opening
const getRedirectUrl = (url: string, userAgent: string): string => {
    const videoId = extractYouTubeId(url);
    if (videoId) {
        const ua = userAgent.toLowerCase();
        if (ua.includes('android')) {
            return `intent://www.youtube.com/watch?v=${videoId}#Intent;scheme=https;package=com.google.android.youtube;S.browser_fallback_url=${encodeURIComponent(url)};end`;
        }
        // iOS: youtube:// scheme doesn't work via HTTP redirect (needs JS).
        // But regular YouTube URLs will trigger Universal Links on iOS if YouTube app is installed.
        // So just return the regular URL for iOS.
    }
    return url;
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
    <a href="${redirectUrl}">Go to Dashboard →</a>
  </div>
</body>
</html>`;

Deno.serve(async (req) => {
    if (req.method === "OPTIONS") {
        return new Response("ok", { headers: corsHeaders });
    }

    const t0 = Date.now();
    const url = new URL(req.url);
    const userAgent = req.headers.get("user-agent") || "";

    // Extract slug from path: /session-redirect/abc123 → abc123
    const pathParts = url.pathname.split("/").filter(Boolean);
    // Path format: /session-redirect/{slug}
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
            // Find user by slug in referral_link
            supabase
                .from("main_data_registration")
                .select("mobile_number, name, days_left, subscription_plan, subscription_paused")
                .ilike("referral_link", `%ref=${slug}%`)
                .limit(1)
                .maybeSingle(),
            // Get session settings
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
        const finalUrl = getRedirectUrl(targetLink, userAgent);
        console.log(`[session-redirect] Redirecting ${user.name} → ${finalUrl} (${Date.now() - t0}ms total)`);

        // For Android intent:// URLs, we can't use a 302 redirect (browsers don't follow intent:// via 302).
        // Instead, serve a minimal HTML page that does the redirect via JS + meta refresh fallback.
        if (finalUrl.startsWith('intent://')) {
            const intentHtml = `<!DOCTYPE html>
<html><head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1.0">
<title>Joining Session...</title>
<meta http-equiv="refresh" content="1;url=${targetLink}">
<style>body{font-family:-apple-system,sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;background:#faf9f6;}.card{text-align:center;padding:2rem;}h2{color:#f97316;}.spin{width:40px;height:40px;border:3px solid #f3f3f3;border-top:3px solid #f97316;border-radius:50%;animation:spin 0.8s linear infinite;margin:1rem auto;}@keyframes spin{to{transform:rotate(360deg)}}</style>
</head><body>
<div class="card"><div class="spin"></div><h2>Opening YouTube...</h2><p style="color:#888">Redirecting you now</p></div>
<script>window.location.href="${finalUrl}";</script>
</body></html>`;
            return new Response(intentHtml, {
                status: 200,
                headers: { ...corsHeaders, "Content-Type": "text/html; charset=utf-8" },
            });
        }

        // Standard HTTP 302 redirect (fastest possible — zero HTML/JS needed)
        return new Response(null, {
            status: 302,
            headers: {
                ...corsHeaders,
                "Location": finalUrl,
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
