const waToken = "EAAX2HQ7QpvUBSZAK3krfGE7pLN8pW3WoUZCSJZCJsZB4oallIQNagAXwCqENBRZBO3kOGbABFyeI0IqrkZAsuA5lft4kVWrtuoy9MylP9RDz2BV5uEFLjNFBNuU9CJqzFMEMYLZBTn8ZCswZCE8CubZCg0KliOITU9t43FlGZA6HBSyS819nxhAdvTZBOl8IhT5tbV2LHQZDZD";
const phoneNumberId = "1230157110176906";
const targetPhone = "919145414083";

async function sendMarathiTemplate() {
  console.log("==================================================");
  console.log(`🚀 TESTING APPROVED MARATHI TEMPLATE 'reminder_v2' (language: mr) -> ${targetPhone}`);
  console.log("==================================================");

  const url = `https://graph.facebook.com/v20.0/${phoneNumberId}/messages`;

  const payload = {
    messaging_product: "whatsapp",
    to: targetPhone,
    type: "template",
    template: {
      name: "reminder_v2",
      language: { code: "mr" }
    }
  };

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${waToken}`
      },
      body: JSON.stringify(payload)
    });

    const json = await res.json();
    console.log("Meta API Response Status:", res.status);
    console.log("Meta API Response Payload:", JSON.stringify(json, null, 2));
  } catch (e) {
    console.error("Error sending Marathi template:", e);
  }

  console.log("==================================================");
}

sendMarathiTemplate();
