import urllib.request
import json
import time
import re
from collections import defaultdict

SUPABASE_URL = "https://bzqwaxqzggejpejyxhde.supabase.co"
SUPABASE_KEY = "sb_publishable_aWZ6_LgTmBCAj7RHgmoDwg_YB4H1Ts4"

def make_request(url, headers, retries=5):
    for attempt in range(retries):
        try:
            req = urllib.request.Request(url, headers=headers, method="GET")
            with urllib.request.urlopen(req, timeout=30) as resp:
                res_body = resp.read().decode("utf-8")
                return json.loads(res_body) if res_body else []
        except Exception as e:
            print(f"Attempt {attempt+1} failed: {e}. Retrying in 2s...")
            time.sleep(2)
    raise RuntimeError(f"Failed to fetch {url}")

print("Fetching all leads from Supabase...")
all_leads = []
offset = 0
limit = 1000

while True:
    fetch_url = f"{SUPABASE_URL}/rest/v1/leads?select=id,client_name,contact,lead_status,lead_type,lead_existing_plan,assigned_to,remark,calling_date,created_at&limit={limit}&offset={offset}"
    headers = {
        "apikey": SUPABASE_KEY,
        "Authorization": f"Bearer {SUPABASE_KEY}"
    }
    data = make_request(fetch_url, headers)
    if not data:
        break
    all_leads.extend(data)
    print(f"Fetched {len(all_leads)} leads so far...")
    if len(data) < limit:
        break
    offset += limit

total_leads = len(all_leads)
print(f"\n==========================================")
print(f"TOTAL LEADS IN DATABASE: {total_leads}")
print(f"==========================================\n")

def normalize_phone(phone_raw):
    if not phone_raw:
        return ""
    digits = re.sub(r"\D", "", str(phone_raw))
    # If 12 digits and starts with 91, extract 10 digits
    if len(digits) == 12 and digits.startswith("91"):
        digits = digits[2:]
    elif len(digits) == 11 and digits.startswith("0"):
        digits = digits[1:]
    return digits

# Group by normalized phone
by_norm_phone = defaultdict(list)
# Group by raw contact
by_raw_contact = defaultdict(list)
# Group by name + norm_phone
by_name_phone = defaultdict(list)

blank_contacts = []

for lead in all_leads:
    raw_c = str(lead.get("contact") or "").strip()
    norm_c = normalize_phone(raw_c)
    name = (lead.get("client_name") or "").strip().lower()
    
    if not norm_c:
        blank_contacts.append(lead)
    else:
        by_norm_phone[norm_c].append(lead)
    
    by_raw_contact[raw_c].append(lead)
    if norm_c:
        by_name_phone[(name, norm_c)].append(lead)

# Duplicate stats on normalized phone
dup_norm_phones = {p: leads for p, leads in by_norm_phone.items() if len(leads) > 1}
total_leads_with_duplicates = sum(len(leads) for leads in dup_norm_phones.values())
excess_duplicate_leads = sum(len(leads) - 1 for leads in dup_norm_phones.values())

# Duplicate stats on raw contact string
dup_raw_contacts = {c: leads for c, leads in by_raw_contact.items() if len(leads) > 1}
total_raw_duplicate_rows = sum(len(leads) for leads in dup_raw_contacts.values())
excess_raw_duplicate_rows = sum(len(leads) - 1 for leads in dup_raw_contacts.values())

print(f"--- Analysis based on Normalized Phone Number (10 digits) ---")
print(f"Total Unique Valid Phone Numbers: {len(by_norm_phone)}")
print(f"Total Unique Phone Numbers with Duplicates: {len(dup_norm_phones)}")
print(f"Total Lead Records that are Duplicates (belonging to those numbers): {total_leads_with_duplicates}")
print(f"Excess Duplicate Records (records beyond 1st occurrence): {excess_duplicate_leads}")
print(f"Blank/Invalid Contact Leads: {len(blank_contacts)}")

# Distribution of duplicate frequency
freq_dist = defaultdict(int)
for p, leads in dup_norm_phones.items():
    freq_dist[len(leads)] += 1

print("\nDuplicate Frequency Breakdown (by normalized phone):")
for count in sorted(freq_dist.keys()):
    print(f"  Phone numbers appearing {count} times: {freq_dist[count]} numbers ({freq_dist[count] * count} rows)")

print("\n--- Top 15 Most Duplicated Phone Numbers ---")
sorted_dups = sorted(dup_norm_phones.items(), key=lambda x: len(x[1]), reverse=True)
for p, leads in sorted_dups[:15]:
    names = list(set((l.get("client_name") or "No Name").strip() for l in leads))
    statuses = list(set((l.get("lead_status") or "-").strip() for l in leads))
    assigned = list(set((l.get("assigned_to") or "-").strip() for l in leads))
    print(f"Phone: {p} | Count: {len(leads)} | Names: {', '.join(names[:2])} | Statuses: {', '.join(statuses)} | Assigned: {', '.join(assigned)}")

# Breakdown by assignment for duplicates
print("\nDuplicate distribution by staff assignment:")
assigned_dup_counts = defaultdict(int)
for p, leads in dup_norm_phones.items():
    for l in leads:
        assigned_dup_counts[l.get("assigned_to") or "Unassigned"] += 1
for staff, c in sorted(assigned_dup_counts.items(), key=lambda x: x[1], reverse=True):
    print(f"  {staff}: {c} duplicate rows")
