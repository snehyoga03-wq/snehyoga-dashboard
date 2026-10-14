import urllib.request
import json
import re
from collections import defaultdict

SUPABASE_URL = "https://bzqwaxqzggejpejyxhde.supabase.co"
SUPABASE_KEY = "sb_publishable_aWZ6_LgTmBCAj7RHgmoDwg_YB4H1Ts4"

def make_request(url, headers):
    req = urllib.request.Request(url, headers=headers, method="GET")
    with urllib.request.urlopen(req, timeout=30) as resp:
        return json.loads(resp.read().decode("utf-8"))

all_leads = []
offset = 0
limit = 1000

while True:
    fetch_url = f"{SUPABASE_URL}/rest/v1/leads?select=id,client_name,contact,lead_status,lead_type,lead_existing_plan,assigned_to,remark,calling_date,created_at&limit={limit}&offset={offset}"
    headers = {"apikey": SUPABASE_KEY, "Authorization": f"Bearer {SUPABASE_KEY}"}
    data = make_request(fetch_url, headers)
    if not data:
        break
    all_leads.extend(data)
    if len(data) < limit:
        break
    offset += limit

def normalize_phone(phone_raw):
    if not phone_raw:
        return ""
    digits = re.sub(r"\D", "", str(phone_raw))
    if len(digits) == 12 and digits.startswith("91"):
        digits = digits[2:]
    elif len(digits) == 11 and digits.startswith("0"):
        digits = digits[1:]
    return digits

by_phone = defaultdict(list)
blank_leads = []

for l in all_leads:
    phone = normalize_phone(l.get("contact"))
    if not phone:
        blank_leads.append(l)
    else:
        by_phone[phone].append(l)

dup_phones = {p: leads for p, leads in by_phone.items() if len(leads) > 1}

# Category 1: Massive spam duplicates (>50 copies)
massive_dups = {p: leads for p, leads in dup_phones.items() if len(leads) > 50}
# Category 2: Minor duplicates (2-10 copies)
minor_dups = {p: leads for p, leads in dup_phones.items() if len(leads) <= 10}

print("=== MASSIVE DUPLICATES (Loop/Cron repeated insertions) ===")
print(f"Total numbers affected: {len(massive_dups)}")
total_massive_rows = sum(len(leads) for leads in massive_dups.values())
print(f"Total rows created by massive duplicates: {total_massive_rows}")
print(f"Excess rows from massive duplicates: {total_massive_rows - len(massive_dups)}")

print("\n=== MINOR DUPLICATES (2 to 7 copies) ===")
print(f"Total numbers with 2-7 copies: {len(minor_dups)}")
total_minor_rows = sum(len(leads) for leads in minor_dups.values())
print(f"Total rows in minor duplicates: {total_minor_rows}")
print(f"Excess rows from minor duplicates: {total_minor_rows - len(minor_dups)}")

# Check how many minor duplicates have different calling_dates vs exact same
exact_same_minor = 0
recalled_minor = 0
for p, leads in minor_dups.items():
    dates = set(l.get("calling_date") or l.get("created_at", "")[:10] for l in leads)
    if len(dates) == 1:
        exact_same_minor += 1
    else:
        recalled_minor += 1

print(f"Minor duplicates with identical dates: {exact_same_minor}")
print(f"Minor duplicates with different dates/re-inquiries: {recalled_minor}")

# Overall summary
print("\n=== SUMMARY METRICS ===")
print(f"1. Total Lead Rows in DB: {len(all_leads)}")
print(f"2. Unique Leads (Unique Numbers + Blanks): {len(by_phone) + len(blank_leads)}")
print(f"3. Unique Phone Numbers affected by Duplication: {len(dup_phones)}")
print(f"4. Total Records belonging to duplicated numbers: {sum(len(leads) for leads in dup_phones.values())}")
print(f"5. Total Excess / Redundant Duplicate Rows: {sum(len(leads)-1 for leads in dup_phones.values())}")
print(f"   - Of which Massive Bug Duplicates (>150x): {total_massive_rows - len(massive_dups)} rows")
print(f"   - Of which Minor Duplicates (2-7x): {total_minor_rows - len(minor_dups)} rows")
