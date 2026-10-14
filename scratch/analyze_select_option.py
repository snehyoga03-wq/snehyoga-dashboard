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

print(f"Total leads in database: {len(all_leads)}")

# Clean phone helper
def clean_phone(p):
    digits = re.sub(r'\D', '', str(p or ''))
    return digits[-10:] if len(digits) >= 10 else digits

select_option_leads = []
defined_status_leads = []

for l in all_leads:
    st = str(l.get('lead_status') or '').strip()
    if st.lower() in ['select option', '', 'none', 'null', 'undefined']:
        select_option_leads.append(l)
    else:
        defined_status_leads.append(l)

total_so_rows = len(select_option_leads)
total_defined_rows = len(defined_status_leads)

print(f"Total rows with status = 'Select Option' (undefined): {total_so_rows}")
print(f"Total rows with a DEFINED status: {total_defined_rows}")

# Group 'Select Option' leads by phone
so_by_phone = defaultdict(list)
so_blank_phones = []

for l in select_option_leads:
    phone = clean_phone(l.get('contact'))
    if not phone:
        so_blank_phones.append(l)
    else:
        so_by_phone[phone].append(l)

so_unique_phone_count = len(so_by_phone)
so_single_phone_count = sum(1 for p, rows in so_by_phone.items() if len(rows) == 1)
so_dup_phones = {p: rows for p, rows in so_by_phone.items() if len(rows) > 1}
so_dup_phone_count = len(so_dup_phones)

total_rows_in_so_dups = sum(len(rows) for rows in so_dup_phones.values())
excess_so_rows = sum(len(rows) - 1 for rows in so_dup_phones.values())

print("\n--- 'Select Option' (Undefined Status) Analysis ---")
print(f"1. Total 'Select Option' rows: {total_so_rows}")
print(f"2. Blank/No Contact leads: {len(so_blank_phones)}")
print(f"3. Unique phone numbers among 'Select Option': {so_unique_phone_count}")
print(f"4. Phone numbers appearing ONLY ONCE under 'Select Option': {so_single_phone_count}")
print(f"5. Phone numbers having DUPLICATES under 'Select Option': {so_dup_phone_count}")
print(f"6. Total rows belonging to duplicated 'Select Option' numbers: {total_rows_in_so_dups}")
print(f"7. Excess / Redundant 'Select Option' rows: {excess_so_rows}")
print(f"8. Net unique 'Select Option' leads: {so_unique_phone_count + len(so_blank_phones)}")

# Frequency breakdown
counts = Counter([len(rows) for rows in so_dup_phones.values()])
print("\n--- Duplicate Frequency Breakdown (Within 'Select Option') ---")
for c, freq in sorted(counts.items(), reverse=True):
    print(f"  {freq} phone number(s) appear {c} times -> {freq * c} total rows (excess: {freq * (c - 1)})")

# Top duplicated Select Option leads
print("\n--- Top Duplicated 'Select Option' Phone Numbers ---")
top_so_dups = sorted(so_dup_phones.items(), key=lambda x: len(x[1]), reverse=True)
for p, rows in top_so_dups[:20]:
    names = list(set((r.get('client_name') or 'No Name').strip() for r in rows))
    assigned = list(set((r.get('assigned_to') or 'Unassigned').strip() for r in rows))
    print(f"  Phone: {p} | Count: {len(rows)} | Name: {', '.join(names[:2])} | Assigned: {', '.join(assigned)}")

# Cross-reference: Does a 'Select Option' lead have ANOTHER record in the DB where status IS defined?
defined_by_phone = defaultdict(list)
for l in defined_status_leads:
    phone = clean_phone(l.get('contact'))
    if phone:
        defined_by_phone[phone].append(l)

cross_matches = {}
for p in so_by_phone:
    if p in defined_by_phone:
        statuses = list(set(l.get('lead_status') for l in defined_by_phone[p]))
        cross_matches[p] = statuses

print(f"\n--- Cross-Reference with Defined Statuses ---")
print(f"Out of the {so_unique_phone_count} unique 'Select Option' phone numbers:")
print(f"  - {len(cross_matches)} numbers ALSO have another record with a DEFINED status in the database!")
print(f"  - {so_unique_phone_count - len(cross_matches)} numbers exist ONLY as 'Select Option' (truly unworked/unassigned).")

status_breakdown = Counter()
for statuses in cross_matches.values():
    for st in statuses:
        status_breakdown[st] += 1

print("\nDefined statuses already existing for these 'Select Option' leads:")
for st, cnt in status_breakdown.most_common():
    print(f"  - {st}: {cnt} leads")
