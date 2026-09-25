const supabaseUrl = "https://bzqwaxqzggejpejyxhde.supabase.co";
const supabaseAnonKey = "sb_publishable_aWZ6_LgTmBCAj7RHgmoDwg_YB4H1Ts4";

async function inspectFlows() {
  console.log("Fetching whatsapp_flows...");
  const url = `${supabaseUrl}/rest/v1/whatsapp_flows?select=*`;
  const res = await fetch(url, {
    headers: {
      "apikey": supabaseAnonKey,
      "Authorization": `Bearer ${supabaseAnonKey}`
    }
  });

  const flows = await res.json();
  console.log(`Found ${flows.length} flow(s):\n`);

  for (const f of flows) {
    console.log(`--- Flow: "${f.name}" (ID: ${f.id}, Status: ${f.status}) ---`);
    console.log("Nodes count:", (f.nodes || []).length);
    console.log("Edges count:", (f.edges || []).length);
    
    for (const n of (f.nodes || [])) {
      console.log(`  Node ID: ${n.id} | Type: ${n.type} | Data:`, JSON.stringify(n.data));
    }
    for (const e of (f.edges || [])) {
      console.log(`  Edge: ${e.source} (${e.sourceHandle}) -> ${e.target} (${e.targetHandle})`);
    }
    console.log("\n");
  }
}

inspectFlows();
