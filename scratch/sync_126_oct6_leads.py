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
    raise RuntimeError(f"Failed to execute request to {url}")

# Helper to format admission date to YYYY-MM-DD
def parse_date_to_ymd(d_str):
    if not d_str:
        return None
    d_str = d_str.strip()
    try:
        # E.g. Jun 25 2026
        dt = datetime.strptime(d_str, "%b %d %Y")
        return dt.strftime("%Y-%m-%d")
    except Exception:
        try:
            dt = datetime.strptime(d_str, "%Y-%m-%d")
            return dt.strftime("%Y-%m-%d")
        except Exception:
            return d_str

# Read the updated CSV file (126 rows)
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
        amount = parts[3].strip() if len(parts) > 3 else ""
        adm_date = parts[4].strip() if len(parts) > 4 else ""
        end_date = parts[5].strip() if len(parts) > 5 else ""
        plan = parts[6].strip() if len(parts) > 6 else ""
        status = parts[7].strip() if len(parts) > 7 else ""
        assigned_to = parts[8].strip() if len(parts) > 8 else "Tejasswi K"
        
        parsed_rows.append({
            "line_no": idx,
            "client_name": name,
            "contact": contact,
            "email": email,
            "admission_date": parse_date_to_ymd(adm_date),
            "lead_existing_plan": plan or "1 Month",
            "assigned_to": assigned_to or "Tejasswi K",
            "lead_status": "Select Option"
        })

print(f"Total rows parsed from CSV: {len(parsed_rows)}")

# Prepare Supabase insert payload with created_at set to 6th October 2026
oct6_iso = "2026-10-06T12:00:00+00:00"

payload = []
for row in parsed_rows:
    payload.append({
        "client_name": row["client_name"],
        "contact": row["contact"],
        "admission_date": row["admission_date"],
        "lead_existing_plan": row["lead_existing_plan"],
        "assigned_to": row["assigned_to"],
        "lead_status": row["lead_status"],
        "created_at": oct6_iso
    })

print(f"Posting {len(payload)} leads to Supabase CRM with created_at date = 2026-10-06...")

post_url = f"{SUPABASE_URL}/rest/v1/leads"
post_headers = {
    "apikey": SUPABASE_KEY,
    "Authorization": f"Bearer {SUPABASE_KEY}",
    "Content-Type": "application/json",
    "Prefer": "return=representation"
}

response_data = make_request(post_url, post_headers, data=payload, method="POST")
print(f"\nSUCCESS! Inserted {len(response_data)} leads into Supabase CRM for 6th October 2026 (2026-10-06).")
