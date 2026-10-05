import urllib.request
import json
import csv
from collections import Counter

# 1. Fetch ALL Supabase leads with pagination
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

# Build Supabase lookup maps
sp_by_phone = {}
for l in all_supabase_leads:
    p = clean_phone(l.get("contact"))
    if p:
        if p not in sp_by_phone:
            sp_by_phone[p] = []
        sp_by_phone[p].append(l)

# Read the updated CSV (which might be tab-separated or comma-separated)
csv_path = r"lead management  - Sheet1.csv"
parsed_rows = []

with open(csv_path, "r", encoding="utf-8") as f:
    for idx, line in enumerate(f, start=1):
        line_str = line.strip()
        if not line_str:
            continue
        # Split by tab or comma
        parts = line_str.split("\t") if "\t" in line_str else line_str.split(",")
        name = parts[0].strip() if len(parts) > 0 else ""
        contact = parts[1].strip() if len(parts) > 1 else ""
        email = parts[2].strip() if len(parts) > 2 else ""
        assigned_to = parts[-1].strip() if len(parts) > 3 else ""
        
        parsed_rows.append({
            "line_no": idx,
            "name": name,
            "contact": contact,
            "email": email,
            "assigned_to": assigned_to,
            "raw": line_str
        })

print(f"Total rows parsed from CSV file: {len(parsed_rows)}")

# Analyze each row against Supabase
added_today = []      # created_at == 2026-10-05
added_earlier = []    # created_at != 2026-10-05
not_added = []        # not in Supabase

for row in parsed_rows:
    p = clean_phone(row["contact"])
    matches = sp_by_phone.get(p, [])
    
    if not matches:
        not_added.append(row)
    else:
        created_today_matches = [m for m in matches if (m.get("created_at") or "")[:10] == "2026-10-05"]
        if created_today_matches:
            added_today.append({
                "csv_row": row,
                "sp_lead": created_today_matches[0]
            })
        else:
            added_earlier.append({
                "csv_row": row,
                "sp_lead": matches[0]
            })

summary = {
    "total_csv_rows": len(parsed_rows),
    "added_today_5oct": len(added_today),
    "added_earlier_dates": len(added_earlier),
    "not_added_to_crm": len(not_added)
}

print("\n==========================================")
print("=== ANALYSIS RESULTS FOR 201-LEAD SHEET ===")
print("==========================================")
print(json.dumps(summary, indent=2))

if added_today:
    print("\n--- SAMPLE LEADS ADDED TODAY (5th Oct) ---")
    for item in added_today[:5]:
        r = item["csv_row"]
        sl = item["sp_lead"]
        print(f"Line {r['line_no']}: {r['name']} ({r['contact']}) -> SP ID: {sl['id']}, Created: {sl['created_at']}")

if not_added:
    print(f"\n--- ALL {len(not_added)} LEADS NOT ADDED TO CRM ---")
    for r in not_added:
        print(f"Line {r['line_no']}: {r['name']} | Contact: {r['contact']} | Email: {r['email']} | Assigned: {r['assigned_to']}")

if added_earlier:
    print(f"\n--- SAMPLE LEADS ADDED ON PREVIOUS DATES ({len(added_earlier)} total) ---")
    for item in added_earlier[:5]:
        r = item["csv_row"]
        sl = item["sp_lead"]
        print(f"Line {r['line_no']}: {r['name']} ({r['contact']}) -> Created at: {sl['created_at']}")
