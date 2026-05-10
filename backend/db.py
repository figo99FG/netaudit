"""
Persistent result storage.

Priority:
  1. SQLite  — %APPDATA%\\NetAudit\\scans.db  (Windows)
                ~/.netaudit/scans.db           (macOS / Linux)
  2. Supabase — if SUPABASE_URL + SUPABASE_SERVICE_KEY env vars are set
  3. In-memory — last resort (results lost on restart)
"""

import json
import os
import sqlite3
from typing import Optional

_memory: dict[str, dict] = {}
TABLE = "netaudit_scans"   # Supabase table name


# ── SQLite ─────────────────────────────────────────────────────────────────────

def _db_path() -> str:
    if os.name == "nt":
        base = os.environ.get("APPDATA", os.path.expanduser("~"))
        folder = os.path.join(base, "NetAudit")
    else:
        folder = os.path.join(os.path.expanduser("~"), ".netaudit")
    os.makedirs(folder, exist_ok=True)
    return os.path.join(folder, "scans.db")


_conn: Optional[sqlite3.Connection] = None


def _sqlite() -> Optional[sqlite3.Connection]:
    global _conn
    if _conn is not None:
        return _conn
    try:
        _conn = sqlite3.connect(_db_path(), check_same_thread=False)
        _conn.execute("""
            CREATE TABLE IF NOT EXISTS scans (
                scan_id    TEXT PRIMARY KEY,
                data       TEXT NOT NULL,
                created_at TEXT NOT NULL DEFAULT (datetime('now'))
            )
        """)
        _conn.commit()
        return _conn
    except Exception as e:
        print(f"[db] SQLite init failed: {e}")
        return None


# ── Supabase ───────────────────────────────────────────────────────────────────

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


# ── Public API ─────────────────────────────────────────────────────────────────

def save(scan_id: str, result_dict: dict) -> None:
    _memory[scan_id] = result_dict

    db = _sqlite()
    if db:
        try:
            db.execute(
                "INSERT OR REPLACE INTO scans (scan_id, data) VALUES (?, ?)",
                (scan_id, json.dumps(result_dict)),
            )
            db.commit()
        except Exception as e:
            print(f"[db] SQLite write failed: {e}")

    client = _client()
    if client:
        try:
            client.table(TABLE).upsert(
                {"scan_id": scan_id, "data": result_dict}
            ).execute()
        except Exception as exc:
            print(f"[db] Supabase write failed (non-fatal): {exc}")


def load(scan_id: str) -> Optional[dict]:
    if scan_id in _memory:
        return _memory[scan_id]

    db = _sqlite()
    if db:
        try:
            row = db.execute(
                "SELECT data FROM scans WHERE scan_id = ?", (scan_id,)
            ).fetchone()
            if row:
                data = json.loads(row[0])
                _memory[scan_id] = data
                return data
        except Exception as e:
            print(f"[db] SQLite read failed: {e}")

    client = _client()
    if client:
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
                if isinstance(data, str):
                    data = json.loads(data)
                _memory[scan_id] = data
                return data
        except Exception as exc:
            print(f"[db] Supabase read failed: {exc}")

    return None


def list_recent(limit: int = 100) -> list[dict]:
    """Return slim summaries of recent scans, newest first."""
    results: list[dict] = []

    db = _sqlite()
    if not db:
        return results

    try:
        rows = db.execute(
            "SELECT scan_id, data, created_at FROM scans ORDER BY created_at DESC LIMIT ?",
            (limit,),
        ).fetchall()
        for scan_id, data_str, created_at in rows:
            try:
                d = json.loads(data_str)
            except Exception:
                continue
            is_network = "network_scan_id" in d
            results.append({
                "scan_id":    scan_id,
                "created_at": created_at,
                "type":       "network" if is_network else "single",
                "hostname":   d.get("hostname"),
                "subnet":     d.get("subnet"),
                "score":      d.get("score") if not is_network else d.get("avg_score"),
                "grade":      d.get("grade"),
                "device_type": d.get("device_type"),
                "hosts_found": d.get("hosts_found"),
            })
    except Exception as e:
        print(f"[db] SQLite list failed: {e}")

    return results
