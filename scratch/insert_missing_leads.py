import urllib.request
import json
import csv
from datetime import datetime

# 1. Fetch ALL Supabase leads to identify the 35 missing and 5 previous date leads
all_supabase_leads = []
offset = 0
limit = 1000

while True:
    url = f"https://bzqwaxqzggejpejyxhde.supabase.co/rest/v1/leads?select=*&limit={limit}&offset={offset}"
    req = urllib.request.Request(url, headers={
        "apikey": "sb_publishable_aWZ6_LgTmBCAj7RHgmoDwg_YB4H1Ts4",
        "Authorization": "Bearer sb_publishable_aWZ6_LgTmBCAj7RHgmoDwg_YB4H1Ts4"
    })
    with urllib.request.urlopen(req) as resp:
        data = json.loads(resp.read().decode())
        if not data:
            break
        all_supabase_leads.extend(data)
        if len(data) < limit:
            break
        offset += limit

print(f"Total Supabase leads fetched: {len(all_supabase_leads)}")

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

# Read the CSV file (201 rows)
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

target_leads_to_add = []

for row in parsed_rows:
    p = clean_phone(row["contact"])
    matches = sp_by_phone.get(p, [])
    
    # Check if not added or added on previous date (created_at != 2026-10-05)
    created_today_matches = [m for m in matches if (m.get("created_at") or "")[:10] == "2026-10-05"]
    
    if not created_today_matches:
        target_leads_to_add.append(row)

print(f"Total target leads to add for 5th Oct 2026: {len(target_leads_to_add)}")

for item in target_leads_to_add:
    print(f"Line {item['line_no']}: {item['name']} | Contact: {item['contact']} | Email: {item['email']} | Assigned: {item['assigned_to']}")
