import urllib.request
import json
import time
from datetime import datetime

SUPABASE_URL = "https://bzqwaxqzggejpejyxhde.supabase.co"
SUPABASE_KEY = "sb_publishable_aWZ6_LgTmBCAj7RHgmoDwg_YB4H1Ts4"

def make_request(url, headers, data=None, method="GET", retries=5):
    for attempt in range(retries):
        try:
            req_data = json.dumps(data).encode("utf-8") if data else None
            req = urllib.request.Request(url, data=req_data, headers=headers, method=method)
            with urllib.request.urlopen(req, timeout=15) as resp:
                res_body = resp.read().decode("utf-8")
                return json.loads(res_body) if res_body else {}
        except Exception as e:
            print(f"Attempt {attempt+1} failed ({e}). Retrying in 2 seconds...")
            time.sleep(2)
    raise RuntimeError(f"Failed to execute request to {url} after {retries} retries.")

# 1. Fetch ALL Supabase leads with pagination
all_supabase_leads = []
offset = 0
limit = 1000

while True:
    fetch_url = f"{SUPABASE_URL}/rest/v1/leads?select=*&limit={limit}&offset={offset}"
    headers = {
        "apikey": SUPABASE_KEY,
        "Authorization": f"Bearer {SUPABASE_KEY}"
    }
    data = make_request(fetch_url, headers)
    if not data:
        break
    all_supabase_leads.extend(data)
    if len(data) < limit:
        break
    offset += limit

print(f"Loaded {len(all_supabase_leads)} existing leads from Supabase.")

def clean_phone(p):
    if not p:
        return ""
    digits = "".join(c for c in str(p) if c.isdigit())
    return digits[-10:] if len(digits) >= 10 else digits

sp_by_phone = {}
for l in all_supabase_leads:
    p = clean_phone(l.get("contact"))
    if p:
        if p not in sp_by_phone:
            sp_by_phone[p] = []
        sp_by_phone[p].append(l)

# 2. Read the CSV file (201 rows)
csv_path = r"lead management  - Sheet1.csv"
parsed_rows = []

with open(csv_path, "r", encoding="utf-8") as f:
    for idx, line in enumerate(f, start=1):
        line_str = line.strip()
        if not line_str:
            continue
        parts = line_str.split("\t") if "\t" in line_str else line_str.split(",")
        name = parts[0].strip() if len(parts) > 0 else ""
        contact = parts[1].strip() if len(parts) > 1 else ""
        email = parts[2].strip() if len(parts) > 2 else ""
        assigned_to = parts[-1].strip() if len(parts) > 3 else "Tejasswi K"
        
        parsed_rows.append({
            "line_no": idx,
            "name": name,
            "contact": contact,
            "email": email,
            "assigned_to": assigned_to or "Tejasswi K"
        })

# Target leads to add: Those that don't have a record created today (2026-10-05)
leads_to_insert = []

for row in parsed_rows:
    p = clean_phone(row["contact"])
    matches = sp_by_phone.get(p, [])
    created_today = [m for m in matches if (m.get("created_at") or "")[:10] == "2026-10-05"]
    
    if not created_today:
        leads_to_insert.append(row)

print(f"\nFound {len(leads_to_insert)} leads to insert for 5th Oct 2026.")

if not leads_to_insert:
    print("No leads need insertion!")
    exit(0)

# Build insert payload for Supabase
today_iso = datetime.now().strftime("2026-10-05T12:00:00+00:00")

payload = []
for item in leads_to_insert:
    payload.append({
        "client_name": item["name"],
        "contact": item["contact"],
        "assigned_to": item["assigned_to"],
        "lead_status": "Select Option",
        "created_at": today_iso,
        "admission_date": "2026-10-05"
    })

post_url = f"{SUPABASE_URL}/rest/v1/leads"
post_headers = {
    "apikey": SUPABASE_KEY,
    "Authorization": f"Bearer {SUPABASE_KEY}",
    "Content-Type": "application/json",
    "Prefer": "return=representation"
}

print(f"Posting {len(payload)} leads to Supabase...")
response_data = make_request(post_url, post_headers, data=payload, method="POST")

print(f"\nSUCCESS! Inserted {len(response_data)} leads into Supabase with date 2026-10-05.")
