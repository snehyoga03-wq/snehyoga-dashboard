import urllib.request
import json
import time

SUPABASE_URL = "https://bzqwaxqzggejpejyxhde.supabase.co"
SUPABASE_KEY = "sb_publishable_aWZ6_LgTmBCAj7RHgmoDwg_YB4H1Ts4"

headers = {
    'apikey': SUPABASE_KEY,
    'Authorization': f'Bearer {SUPABASE_KEY}',
    'Content-Type': 'application/json'
}

# 1. Load backup file with the exact 1863 leads to delete
with open("scratch/backup_deleted_duplicates_1863.json", "r", encoding="utf-8") as f:
    leads_to_delete = json.load(f)

ids_to_delete = [l['id'] for l in leads_to_delete]
total_to_delete = len(ids_to_delete)
print(f"Loaded {total_to_delete} lead IDs to delete from backup.")

# 2. Delete in batches of 50 via REST API: DELETE /rest/v1/leads?id=in.(id1,id2,...)
batch_size = 50
deleted_count = 0

for i in range(0, total_to_delete, batch_size):
    batch = ids_to_delete[i:i + batch_size]
    ids_param = ",".join(batch)
    delete_url = f"{SUPABASE_URL}/rest/v1/leads?id=in.({ids_param})"
    
    success = False
    for attempt in range(5):
        try:
            req = urllib.request.Request(delete_url, headers=headers, method="DELETE")
            with urllib.request.urlopen(req, timeout=20) as resp:
                if resp.status in [200, 204]:
                    deleted_count += len(batch)
                    print(f"Deleted {deleted_count}/{total_to_delete} rows...")
                    success = True
                    break
        except Exception as e:
            print(f"Attempt {attempt+1} failed ({e}). Retrying in 1s...")
            time.sleep(1)
            
    if not success:
        print(f"ERROR: Failed to delete batch starting at index {i}")
        break

print(f"\nFinished deleting {deleted_count} rows.")

# 3. Verify total remaining rows in Supabase
count_req = urllib.request.Request(
    f"{SUPABASE_URL}/rest/v1/leads?select=id",
    headers={**headers, 'Range-Unit': 'items', 'Prefer': 'count=exact'}
)
try:
    with urllib.request.urlopen(count_req) as resp:
        content_range = resp.headers.get('Content-Range')
        print(f"Verification: Content-Range header = {content_range}")
except Exception as e:
    print(f"Verification header read failed ({e}), checking with pagination count...")

offset = 0
total_remaining = 0
while True:
    req = urllib.request.Request(f"{SUPABASE_URL}/rest/v1/leads?select=id&limit=1000&offset={offset}", headers=headers)
    with urllib.request.urlopen(req) as r:
        d = json.loads(r.read().decode())
    if not d:
        break
    total_remaining += len(d)
    if len(d) < 1000:
        break
    offset += 1000

print(f"Total rows currently remaining in Supabase leads table: {total_remaining}")
