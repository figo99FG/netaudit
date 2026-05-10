"""
Persistent result storage — Supabase primary, in-memory fallback.

Requires env vars:
  SUPABASE_URL         https://xxxx.supabase.co
  SUPABASE_SERVICE_KEY  service_role key (not anon — needs INSERT/SELECT)

If either var is missing, results only live in _memory (fine for dev,
dies on Railway restart in prod — set the vars to fix that).
"""

import json
import os
from typing import Optional

# In-memory cache — always populated so repeated GET /results/{id} hits
# are fast even when Supabase is configured.
_memory: dict[str, dict] = {}

TABLE = "netaudit_scans"


def _client():
    url = os.getenv("SUPABASE_URL", "").strip()
    key = (os.getenv("SUPABASE_SERVICE_KEY") or os.getenv("SUPABASE_KEY", "")).strip()
    if not url or not key:
        return None
    try:
        from supabase import create_client
        return create_client(url, key)
    except Exception:
        return None


def save(scan_id: str, result_dict: dict) -> None:
    _memory[scan_id] = result_dict
    client = _client()
    if not client:
        return
    try:
        client.table(TABLE).upsert(
            {"scan_id": scan_id, "data": result_dict}
        ).execute()
    except Exception as exc:
        # Non-fatal — in-memory copy is already saved.
        print(f"[db] Supabase write failed (will use memory): {exc}")


def load(scan_id: str) -> Optional[dict]:
    # Fast path — already in memory
    if scan_id in _memory:
        return _memory[scan_id]
    # Cold path — Railway restarted, try Supabase
    client = _client()
    if not client:
        return None
    try:
        res = (
            client.table(TABLE)
            .select("data")
            .eq("scan_id", scan_id)
            .single()
            .execute()
        )
        if res.data:
            data = res.data["data"]
            # supabase-py returns JSONB as a dict already
            if isinstance(data, str):
                data = json.loads(data)
            _memory[scan_id] = data  # warm the cache
            return data
    except Exception as exc:
        print(f"[db] Supabase read failed: {exc}")
    return None
