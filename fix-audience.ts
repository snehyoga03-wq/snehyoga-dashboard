import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  const { data, error } = await supabase.from('reminder_schedules').update({ audience: 'batch' }).eq('audience', 'active');
  console.log("Updated rows", error || data);
  const { data: updated } = await supabase.from('reminder_schedules').select('*');
  console.log("Final state", updated);
  process.exit(0);
}
run();
