const waToken = "EAAX2HQ7QpvUBSZAK3krfGE7pLN8pW3WoUZCSJZCJsZB4oallIQNagAXwCqENBRZBO3kOGbABFyeI0IqrkZAsuA5lft4kVWrtuoy9MylP9RDz2BV5uEFLjNFBNuU9CJqzFMEMYLZBTn8ZCswZCE8CubZCg0KliOITU9t43FlGZA6HBSyS819nxhAdvTZBOl8IhT5tbV2LHQZDZD";
const wabaId = "1564657775051850";

async function fetchApprovedTemplates() {
  console.log("==================================================");
  console.log(`🔍 FETCHING APPROVED META TEMPLATES FOR WABA ${wabaId}...`);
  console.log("==================================================");

  const url = `https://graph.facebook.com/v20.0/${wabaId}/message_templates?limit=100`;

  try {
    const res = await fetch(url, {
      headers: { "Authorization": `Bearer ${waToken}` }
    });

    const json = await res.json();
    console.log("HTTP Status:", res.status);

    if (json.data && json.data.length > 0) {
      console.log(`Found ${json.data.length} templates in Meta WABA:`);
      json.data.forEach((tpl, idx) => {
        console.log(`\n[${idx + 1}] Name: "${tpl.name}"`);
        console.log(`    Language: "${tpl.language}"`);
        console.log(`    Status: "${tpl.status}"`);
        console.log(`    Category: "${tpl.category}"`);
      });
    } else {
      console.log("Response Payload:", JSON.stringify(json, null, 2));
    }
  } catch (e) {
    console.error("Error fetching Meta templates:", e);
  }

  console.log("\n==================================================");
}

fetchApprovedTemplates();
