#!/usr/bin/env bash
# NetAudit Agent — macOS / Linux launcher
# Run once to set up, then just double-click or run again to start.
set -e

VENV_DIR="$HOME/.netaudit/venv"
BACKEND_DIR="$(cd "$(dirname "$0")/backend" && pwd)"
PORT=8000
SITE_URL="https://netaudit-blue.vercel.app/scan"

# ── Check Python ───────────────────────────────────────────────────────────────
if ! command -v python3 &>/dev/null; then
  echo "Python 3 not found. Install it from https://python.org and re-run this script."
  exit 1
fi

PY_VER=$(python3 -c "import sys; print(sys.version_info.minor)")
if [ "$PY_VER" -lt 10 ]; then
  echo "Python 3.10+ required (found 3.$PY_VER). Please upgrade."
  exit 1
fi

# ── Virtual env ────────────────────────────────────────────────────────────────
if [ ! -d "$VENV_DIR" ]; then
  echo "[agent] Creating virtual environment at $VENV_DIR …"
  python3 -m venv "$VENV_DIR"
fi

source "$VENV_DIR/bin/activate"

# ── Install / update deps ──────────────────────────────────────────────────────
echo "[agent] Checking dependencies …"
pip install -q --upgrade pip
pip install -q -r "$BACKEND_DIR/requirements.txt"

# ── Kill anything on port 8000 ─────────────────────────────────────────────────
if lsof -ti tcp:$PORT &>/dev/null; then
  echo "[agent] Port $PORT in use — killing existing process …"
  kill -9 $(lsof -ti tcp:$PORT) 2>/dev/null || true
  sleep 1
fi

# ── Start backend ──────────────────────────────────────────────────────────────
echo "[agent] Starting backend on 127.0.0.1:$PORT …"
cd "$BACKEND_DIR"
python3 -m uvicorn main:app --host 127.0.0.1 --port $PORT --log-level warning &
UVICORN_PID=$!

# ── Wait for ready ─────────────────────────────────────────────────────────────
echo "[agent] Waiting for backend …"
for i in $(seq 1 20); do
  if curl -sf "http://127.0.0.1:$PORT/api/health" &>/dev/null; then
    echo "[agent] Ready!"
    break
  fi
  sleep 0.5
done

# ── Open browser ───────────────────────────────────────────────────────────────
if command -v open &>/dev/null; then
  open "$SITE_URL"           # macOS
elif command -v xdg-open &>/dev/null; then
  xdg-open "$SITE_URL"       # Linux
fi

echo "[agent] Running. Press Ctrl+C to stop."
wait $UVICORN_PID
