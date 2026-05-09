const fs = require('fs');
const env = fs.readFileSync('.env', 'utf8');
const url = env.match(/VITE_SUPABASE_URL=\"?(.*)\"?/)[1].replace(/\"/g, '');
const key = env.match(/VITE_SUPABASE_PUBLISHABLE_KEY=\"?(.*)\"?/)[1].replace(/\"/g, '');

fetch(url + '/rest/v1/main_data_registration?mobile_number=like.*9145414083*', {
  headers: {
    'apikey': key,
    'Authorization': 'Bearer ' + key,
  }
})
.then(r => r.json())
.then(data => console.log(data))
.catch(console.error);
