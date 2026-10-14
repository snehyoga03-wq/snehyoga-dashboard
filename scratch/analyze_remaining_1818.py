import urllib.request
import json
import re
from collections import Counter, defaultdict

headers = {
    'apikey': 'sb_publishable_aWZ6_LgTmBCAj7RHgmoDwg_YB4H1Ts4',
    'Authorization': 'Bearer sb_publishable_aWZ6_LgTmBCAj7RHgmoDwg_YB4H1Ts4'
}

all_leads = []
offset = 0
while True:
    req = urllib.request.Request(
        f'https://bzqwaxqzggejpejyxhde.supabase.co/rest/v1/leads?select=id,contact,client_name,lead_status,assigned_to,created_at,calling_date,remark&order=id.asc&limit=1000&offset={offset}',
        headers=headers
    )
    with urllib.request.urlopen(req) as r:
        d = json.loads(r.read().decode())
    if not d:
        break
    all_leads.extend(d)
    if len(d) < 1000:
        break
    offset += 1000

print(f"Total leads fetched: {len(all_leads)}")

def clean_phone(p):
    digits = re.sub(r'\D', '', str(p or ''))
    return digits[-10:] if len(digits) >= 10 else digits

phone_map = defaultdict(list)
blank_phone_leads = []

for l in all_leads:
    phone = clean_phone(l.get('contact'))
    if not phone:
        blank_phone_leads.append(l)
    else:
        phone_map[phone].append(l)

total_unique_phones = len(phone_map)
single_phones = {p: rows for p, rows in phone_map.items() if len(rows) == 1}
dup_phones = {p: rows for p, rows in phone_map.items() if len(rows) > 1}

total_rows_in_dups = sum(len(rows) for rows in dup_phones.values())
excess_rows = sum(len(rows) - 1 for rows in dup_phones.values())

print("\n=== REMAINING 1,818 LEADS DUPLICATE ANALYSIS ===")
print(f"Total Rows in Database: {len(all_leads)}")
print(f"Total Blank/Missing Phone Rows: {len(blank_phone_leads)}")
print(f"Total Unique Phone Numbers: {total_unique_phones}")
print(f"Phone Numbers Appearing ONLY ONCE (No Duplicate): {len(single_phones)}")
print(f"Phone Numbers Appearing MULTIPLE TIMES (Duplicates): {len(dup_phones)}")
print(f"Total Rows Belonging to Duplicate Phone Numbers: {total_rows_in_dups}")
print(f"Total Excess / Redundant Duplicate Rows: {excess_rows}")
print(f"Net Unique Leads in DB: {total_unique_phones + len(blank_phone_leads)}")

# Breakdown by occurrence count
counts = Counter([len(rows) for rows in dup_phones.values()])
print("\n=== DUPLICATE FREQUENCY BREAKDOWN ===")
for c, freq in sorted(counts.items(), reverse=True):
    print(f"  {freq} phone number(s) appear {c} times -> {freq * c} total rows (excess: {freq * (c - 1)})")

# Detailed inspection of the duplicate contacts
print("\n=== DETAILED LIST OF ALL DUPLICATES (Sorted by highest count) ===")
sorted_dups = sorted(dup_phones.items(), key=lambda x: len(x[1]), reverse=True)

# Status distribution within duplicates
dup_status_counter = Counter()
for p, rows in sorted_dups:
    for r in rows:
        dup_status_counter[r.get('lead_status') or 'Select Option'] += 1

print("\nStatuses represented across all duplicate rows:")
for st, cnt in dup_status_counter.most_common():
    print(f"  - {st}: {cnt} rows")

print("\nTop 25 Duplicated Contacts:")
for p, rows in sorted_dups[:25]:
    names = list(set((r.get('client_name') or 'No Name').strip() for r in rows))
    statuses = list(set((r.get('lead_status') or 'Select Option').strip() for r in rows))
    assigned = list(set((r.get('assigned_to') or 'Unassigned').strip() for r in rows))
    calling_dates = list(set(str(r.get('calling_date') or r.get('created_at', '')[:10]) for r in rows))
    print(f"  Phone: {p} | Count: {len(rows)} | Name: {', '.join(names[:2])} | Statuses: {statuses} | Assigned: {assigned} | Dates: {calling_dates[:2]}")
