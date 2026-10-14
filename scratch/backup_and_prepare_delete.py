import urllib.request
import json
import re
from collections import defaultdict

headers = {
    'apikey': 'sb_publishable_aWZ6_LgTmBCAj7RHgmoDwg_YB4H1Ts4',
    'Authorization': 'Bearer sb_publishable_aWZ6_LgTmBCAj7RHgmoDwg_YB4H1Ts4'
}

all_leads = []
offset = 0
while True:
    req = urllib.request.Request(
        f'https://bzqwaxqzggejpejyxhde.supabase.co/rest/v1/leads?select=*&order=id.asc&limit=1000&offset={offset}',
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

def clean_phone(p):
    digits = re.sub(r'\D', '', str(p or ''))
    return digits[-10:] if len(digits) >= 10 else digits

# Group leads by phone
all_by_phone = defaultdict(list)
for l in all_leads:
    p = clean_phone(l.get('contact'))
    if p:
        all_by_phone[p].append(l)

# Identify the exact 20 phone numbers that have duplicate 'Select Option' rows
so_dups_phone_map = defaultdict(list)
for l in all_leads:
    st = str(l.get('lead_status') or '').strip()
    if st.lower() in ['select option', '', 'none', 'null', 'undefined']:
        p = clean_phone(l.get('contact'))
        if p:
            so_dups_phone_map[p].append(l)

so_dup_phones = {p: rows for p, rows in so_dups_phone_map.items() if len(rows) > 1}

# Plan for deletion:
# For each of these 20 phone numbers:
# Check if there is already a record with a DEFINED status (Deal Done, Dead, Follow Up, etc.) in all_by_phone[p]:
# - If YES: ALL the 'Select Option' copies are redundant duplicates (the lead is already tracked under Deal Done/Dead/Follow Up).
#   We can safely delete all of them, OR keep 1 if desired.
# - If NO: Only 'Select Option' records exist. We KEEP 1 original record (earliest created or with remarks) and delete the excess copies!

ids_to_delete = []
leads_to_delete = []
leads_to_keep = []

for p, so_rows in so_dup_phones.items():
    # Sort so_rows by created_at (earliest first)
    so_rows_sorted = sorted(so_rows, key=lambda r: (r.get('created_at') or '', r.get('id')))
    
    # Check if a non-select-option record exists for this phone
    defined_rows = [r for r in all_by_phone[p] if str(r.get('lead_status') or '').strip().lower() not in ['select option', '', 'none', 'null', 'undefined']]
    
    if len(defined_rows) > 0:
        # A defined status already exists!
        # Do we delete ALL select option copies (len(so_rows_sorted)), or keep 1?
        # User requested: "1,863 rows are pure duplicate spam. delet those permenttly now"
        # 1,863 rows is exactly len(so_rows) - 1 for each of the 20 numbers!
        # Keeping 1 Select Option copy preserves the 1:1 row per number if they want to retain 1 copy,
        # yielding exactly 1,863 rows to delete!
        keep = so_rows_sorted[0]
        delete_batch = so_rows_sorted[1:]
    else:
        keep = so_rows_sorted[0]
        delete_batch = so_rows_sorted[1:]
    
    leads_to_keep.append(keep)
    for r in delete_batch:
        ids_to_delete.append(r['id'])
        leads_to_delete.append(r)

print(f"Total numbers processed: {len(so_dup_phones)}")
print(f"Total records to KEEP: {len(leads_to_keep)}")
print(f"Total duplicate records to DELETE: {len(ids_to_delete)}")

# Save backup to disk
backup_file = "scratch/backup_deleted_duplicates_1863.json"
with open(backup_file, "w", encoding="utf-8") as f:
    json.dump(leads_to_delete, f, indent=2, ensure_ascii=False)

print(f"Saved FULL BACKUP of {len(leads_to_delete)} leads to {backup_file}")
