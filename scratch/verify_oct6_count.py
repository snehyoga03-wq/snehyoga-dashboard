import urllib.request
import json

SUPABASE_URL = "https://bzqwaxqzggejpejyxhde.supabase.co"
SUPABASE_KEY = "sb_publishable_aWZ6_LgTmBCAj7RHgmoDwg_YB4H1Ts4"

# Query count of leads created on 2026-10-06 using gte and lte filters
url_oct6 = f"{SUPABASE_URL}/rest/v1/leads?created_at=gte.2026-10-06T00:00:00&created_at=lt.2026-10-07T00:00:00&select=id,client_name,contact,assigned_to,created_at,admission_date"

req = urllib.request.Request(url_oct6, headers={
    "apikey": SUPABASE_KEY,
    "Authorization": f"Bearer {SUPABASE_KEY}",
    "Prefer": "count=exact"
})

with urllib.request.urlopen(req) as resp:
    data = json.loads(resp.read().decode())
    content_range = resp.headers.get("Content-Range")
    print(f"Content-Range header: {content_range}")
    print(f"Direct count of leads created on 6th Oct 2026 (2026-10-06): {len(data)}")
    if data:
        print("\nSample 6th Oct lead:")
        print(data[0])
