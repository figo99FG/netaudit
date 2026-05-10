"""
Local config storage — %APPDATA%\\NetAudit\\config.json (Windows)
                         ~/.netaudit/config.json          (macOS/Linux)

Stores user settings: API keys, preferences, etc.
Never committed to git.
"""
import json
import os
from typing import Any


def _path() -> str:
    if os.name == "nt":
        base = os.environ.get("APPDATA", os.path.expanduser("~"))
        folder = os.path.join(base, "NetAudit")
    else:
        folder = os.path.join(os.path.expanduser("~"), ".netaudit")
    os.makedirs(folder, exist_ok=True)
    return os.path.join(folder, "config.json")


def load() -> dict:
    try:
        with open(_path(), encoding="utf-8") as f:
            return json.load(f)
    except Exception:
        return {}


def save(updates: dict) -> None:
    data = load()
    data.update(updates)
    with open(_path(), "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2)


def get(key: str, default: Any = None) -> Any:
    return load().get(key, default)
