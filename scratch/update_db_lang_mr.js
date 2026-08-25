const supabaseUrl = "https://bzqwaxqzggejpejyxhde.supabase.co";
const supabaseAnonKey = "sb_publishable_aWZ6_LgTmBCAj7RHgmoDwg_YB4H1Ts4";

async function updateLangCodeMr() {
  console.log("Setting wa_language_code to 'mr' (Marathi) in session_settings...");
  const url = `${supabaseUrl}/rest/v1/session_settings?id=eq.4343ad53-d063-4a7b-a9bb-c37bc2d7cd0e`;
  
  const res = await fetch(url, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      "apikey": supabaseAnonKey,
      "Authorization": `Bearer ${supabaseAnonKey}`,
      "Prefer": "return=representation"
    },
    body: JSON.stringify({
      wa_language_code: "mr"
    })
  });

  const json = await res.json();
  console.log("Status:", res.status);
  console.log("Result:", JSON.stringify(json, null, 2));
}

updateLangCodeMr();
