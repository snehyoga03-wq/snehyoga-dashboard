const supabaseUrl = "https://bzqwaxqzggejpejyxhde.supabase.co";
const supabaseAnonKey = "sb_publishable_aWZ6_LgTmBCAj7RHgmoDwg_YB4H1Ts4";

async function add30DaysToAllUsers() {
  console.log("Fetching all users from main_data_registration...");
  const fetchUrl = `${supabaseUrl}/rest/v1/main_data_registration?select=id,name,days_left,mobile_number`;
  
  const res = await fetch(fetchUrl, {
    headers: {
      "apikey": supabaseAnonKey,
      "Authorization": `Bearer ${supabaseAnonKey}`
    }
  });

  const users = await res.json();
  console.log(`Found ${users.length} total users.`);

  let updatedCount = 0;
  const CHUNK_SIZE = 25;

  for (let i = 0; i < users.length; i += CHUNK_SIZE) {
    const chunk = users.slice(i, i + CHUNK_SIZE);
    await Promise.all(
      chunk.map(async (user) => {
        const currentDays = Number(user.days_left || 0);
        const newDays = (currentDays <= 0 ? 0 : currentDays) + 30; // Add 30 days to subscription

        const patchUrl = `${supabaseUrl}/rest/v1/main_data_registration?id=eq.${user.id}`;
        const patchRes = await fetch(patchUrl, {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            "apikey": supabaseAnonKey,
            "Authorization": `Bearer ${supabaseAnonKey}`
          },
          body: JSON.stringify({
            days_left: newDays
          })
        });

        if (patchRes.ok) {
          updatedCount++;
        } else {
          console.error(`Failed for user ${user.id} (${user.name}):`, await patchRes.text());
        }
      })
    );
    console.log(`Processed ${Math.min(i + CHUNK_SIZE, users.length)} / ${users.length} users...`);
  }

  console.log(`\n✅ Successfully added 30 days to all ${updatedCount} users in main_data_registration!`);
}

add30DaysToAllUsers();
