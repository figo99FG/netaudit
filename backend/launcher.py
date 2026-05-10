"""
NetAudit Agent — launcher.py
Bundles the FastAPI backend into a desktop app.
- Checks for nmap; if missing, runs bundled silent installer
- Checks GitHub for a newer version and auto-updates
- Starts uvicorn on localhost:8000 in a background thread
- Opens the user's browser to the NetAudit website
- Shows a system tray icon with Open / Stop options
"""
import sys
import os
import subprocess
import threading
import webbrowser
import time
import shutil
import ctypes

VERSION = "1.0.9"
GITHUB_REPO = "figo99FG/netaudit"
GITHUB_API = f"https://api.github.com/repos/{GITHUB_REPO}/releases/latest"


# ── Auto-update ────────────────────────────────────────────────────────────────

def _parse_version(v: str) -> tuple:
    try:
        return tuple(int(x) for x in v.lstrip("v").split("."))
    except Exception:
        return (0,)


def check_for_update():
    """Returns (tag, download_url) if a newer release exists, else None."""
    try:
        import urllib.request, json
        req = urllib.request.Request(
            GITHUB_API, headers={"User-Agent": "NetAudit-Agent"}
        )
        with urllib.request.urlopen(req, timeout=5) as r:
            data = json.loads(r.read())
        tag = data.get("tag_name", "")
        if _parse_version(tag) > _parse_version(VERSION):
            for asset in data.get("assets", []):
                if asset["name"].lower().endswith(".exe"):
                    return tag, asset["browser_download_url"]
    except Exception as e:
        print(f"[update] check failed: {e}")
    return None


def apply_update(download_url: str, new_tag: str):
    """Download new exe, write a bat to swap it in, then exit."""
    import urllib.request

    exe_path = sys.executable if getattr(sys, "frozen", False) else None
    if not exe_path:
        print("[update] dev mode — skipping self-replace")
        return

    exe_dir = os.path.dirname(exe_path)
    new_exe = os.path.join(exe_dir, "NetAudit-Agent-update.exe")

    print(f"[update] downloading {new_tag} …")
    try:
        urllib.request.urlretrieve(download_url, new_exe)
    except Exception as e:
        print(f"[update] download failed: {e}")
        return

    bat = os.path.join(exe_dir, "netaudit_update.bat")
    with open(bat, "w") as f:
        f.write(
            f'@echo off\n'
            f'timeout /t 2 /nobreak >nul\n'
            f'move /y "{new_exe}" "{exe_path}"\n'
            f'start "" "{exe_path}"\n'
            f'del "%~f0"\n'
        )

    subprocess.Popen(
        ["cmd", "/c", bat],
        creationflags=subprocess.CREATE_NO_WINDOW,
        close_fds=True,
    )
    print(f"[update] update queued — restarting into {new_tag}")
    os._exit(0)

# ── Helpers ────────────────────────────────────────────────────────────────────

def bundled(filename: str) -> str:
    """Return absolute path to a file bundled via PyInstaller (_MEIPASS) or local."""
    if getattr(sys, "frozen", False):
        base = sys._MEIPASS  # type: ignore[attr-defined]
    else:
        base = os.path.join(os.path.dirname(__file__), "agent_bundle")
    return os.path.join(base, filename)


def is_admin() -> bool:
    try:
        return ctypes.windll.shell32.IsUserAnAdmin()
    except Exception:
        return False


def ensure_nmap():
    """Install nmap (+ Npcap) silently if not already present."""
    if shutil.which("nmap"):
        return  # already installed

    installer = bundled("nmap-setup.exe")
    if not os.path.exists(installer):
        print("[agent] nmap-setup.exe not found in bundle — skipping install")
        return

    print("[agent] nmap not found — running silent installer …")
    try:
        # NSIS silent install: /S
        # Npcap bundled inside nmap installer also accepts /npcap_loopback_support
        subprocess.run(
            [installer, "/S", "/npcap_loopback_support"],
            check=True,
            timeout=120,
        )
        print("[agent] nmap installed successfully")
    except subprocess.CalledProcessError as e:
        print(f"[agent] nmap installer failed: {e}")
    except subprocess.TimeoutExpired:
        print("[agent] nmap installer timed out")


LOG_FILE = os.path.join(os.path.expanduser("~"), "NetAudit-Agent.log")


def _log(msg: str):
    """Write to log file so errors are visible even with console=False."""
    try:
        with open(LOG_FILE, "a", encoding="utf-8") as f:
            import datetime
            f.write(f"[{datetime.datetime.now().isoformat()}] {msg}\n")
    except Exception:
        pass


def _kill_port(port: int):
    """Kill whatever is holding the given port (Windows only)."""
    try:
        result = subprocess.run(
            ["netstat", "-ano"],
            capture_output=True, text=True, timeout=5
        )
        for line in result.stdout.splitlines():
            if f":{port}" in line and "LISTENING" in line:
                pid = line.strip().split()[-1]
                subprocess.run(["taskkill", "/F", "/PID", pid],
                               capture_output=True, timeout=5)
                _log(f"Killed process {pid} that was holding port {port}")
    except Exception as e:
        _log(f"_kill_port failed: {e}")


def start_backend():
    """Start FastAPI via uvicorn in this thread (blocks)."""
    try:
        # Add common nmap install paths to PATH
        extra_paths = [
            r"C:\Program Files (x86)\Nmap",
            r"C:\Program Files\Nmap",
        ]
        for p in extra_paths:
            if p not in os.environ.get("PATH", ""):
                os.environ["PATH"] = p + os.pathsep + os.environ.get("PATH", "")

        # For frozen exe, also add _MEIPASS so modules are importable
        if getattr(sys, "frozen", False):
            meipass = getattr(sys, "_MEIPASS", "")
            if meipass and meipass not in sys.path:
                sys.path.insert(0, meipass)

        backend_dir = os.path.dirname(os.path.abspath(__file__))
        if backend_dir not in sys.path:
            sys.path.insert(0, backend_dir)

        _log(f"sys.path = {sys.path[:4]}")
        _log("Starting uvicorn on 127.0.0.1:8000")

        # Free the port if something is holding it
        import socket
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
            if s.connect_ex(("127.0.0.1", 8000)) == 0:
                _log("Port 8000 already in use — killing holder")
                _kill_port(8000)
                time.sleep(1)

        import uvicorn

        # In a frozen PyInstaller exe, string-based "main:app" import can fail
        # because importlib can't locate modules the same way. Import directly.
        import main as _main_module
        _log("main module imported OK, starting uvicorn")
        uvicorn.run(
            _main_module.app,
            host="127.0.0.1",
            port=8000,
            log_level="warning",
        )
    except Exception as exc:
        _log(f"BACKEND CRASH: {exc}")


def wait_for_backend(timeout: int = 15):
    """Poll localhost:8000/api/health until it responds or timeout."""
    import urllib.request
    deadline = time.time() + timeout
    while time.time() < deadline:
        try:
            urllib.request.urlopen("http://127.0.0.1:8000/api/health", timeout=1)
            return True
        except Exception:
            time.sleep(0.5)
    return False


# ── Tray icon ──────────────────────────────────────────────────────────────────

SITE_URL = "https://netaudit-blue.vercel.app/scan"


def build_tray_icon():
    from PIL import Image, ImageDraw
    img = Image.new("RGB", (64, 64), "#0d0d0d")
    d = ImageDraw.Draw(img)
    # Simple "N" shape in green
    d.rectangle([8, 8, 56, 56], outline="#00ff88", width=3)
    d.line([14, 52, 14, 12], fill="#00ff88", width=4)
    d.line([14, 12, 50, 52], fill="#00ff88", width=4)
    d.line([50, 52, 50, 12], fill="#00ff88", width=4)
    return img


def run_tray():
    import pystray
    from pystray import MenuItem, Menu

    icon_img = build_tray_icon()

    def on_open(icon, item):
        webbrowser.open(SITE_URL)

    def on_quit(icon, item):
        icon.stop()
        os._exit(0)

    icon = pystray.Icon(
        "NetAudit Agent",
        icon_img,
        "NetAudit Agent — Running",
        menu=Menu(
            MenuItem("NetAudit Agent  ●  Running", None, enabled=False),
            MenuItem("Open in Browser", on_open),
            Menu.SEPARATOR,
            MenuItem("Stop Agent", on_quit),
        ),
    )
    icon.run()


# ── Main ───────────────────────────────────────────────────────────────────────

def main():
    # Auto-update disabled for now — users download manually from the site
    # update = check_for_update()
    # if update:
    #     apply_update(*update)

    print("[agent] Checking nmap …")
    ensure_nmap()

    print("[agent] Starting backend …")
    t = threading.Thread(target=start_backend, daemon=True)
    t.start()

    print("[agent] Waiting for backend to be ready …")
    ready = wait_for_backend(timeout=20)

    if ready:
        print("[agent] Backend ready — opening browser")
        webbrowser.open(SITE_URL)
    else:
        print("[agent] Backend didn't start in time — opening anyway")
        webbrowser.open(SITE_URL)

    print("[agent] Starting tray icon")
    run_tray()


if __name__ == "__main__":
    main()
