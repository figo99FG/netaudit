#!/usr/bin/env python3
"""
NetAudit Home Router Scanner (Playwright edition)
===================================================
Uses a headless browser to log into your router admin panel,
scrape security settings, and send them to NetAudit for analysis.

Works with: Sky, BT, Virgin, TP-Link, Netgear, ASUS, D-Link

Requirements:
    pip install playwright requests
    playwright install chromium

Usage:
    python netaudit-home-scan.py
    python netaudit-home-scan.py --ip 192.168.1.1 --user admin --password mypass
"""

import argparse
import ipaddress
import json
import re
import socket
import sys
import subprocess
import webbrowser
import urllib.parse
import getpass

API_URL    = "https://netaudit-production.up.railway.app"
RESULTS_URL = "https://frontend-cyan-gamma-73.vercel.app/results"


def check_deps():
    missing = []
    for pkg in ["playwright", "requests"]:
        try:
            __import__(pkg)
        except ImportError:
            missing.append(pkg)
    if missing:
        print(f"[!] Missing packages: {', '.join(missing)}")
        print(f"    Run: pip install {' '.join(missing)}")
        print(f"    Then: playwright install chromium")
        sys.exit(1)
    # Check chromium is installed
    try:
        from playwright.sync_api import sync_playwright
        with sync_playwright() as p:
            p.chromium.launch(headless=True).close()
    except Exception:
        print("[!] Playwright chromium not installed.")
        print("    Run: playwright install chromium")
        sys.exit(1)


def get_gateway() -> str:
    try:
        result = subprocess.run(["ipconfig"], capture_output=True, text=True, timeout=5)
        for line in result.stdout.splitlines():
            if "Default Gateway" in line:
                ip = line.split(":")[-1].strip()
                if ip:
                    try:
                        ipaddress.ip_address(ip)
                        return ip
                    except ValueError:
                        continue
    except Exception:
        pass
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.connect(("8.8.8.8", 80))
        local_ip = s.getsockname()[0]
        s.close()
        parts = local_ip.rsplit(".", 1)
        return f"{parts[0]}.1"
    except Exception:
        return "192.168.0.1"


def scrape_router(ip: str, username: str, password: str) -> dict:
    from playwright.sync_api import sync_playwright, TimeoutError as PWTimeout

    settings = {}

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        ctx = browser.new_context(ignore_https_errors=True)
        page = ctx.new_page()
        page.set_default_timeout(10000)

        base = f"http://{ip}"

        # ── LOGIN ────────────────────────────────────────────────────────
        print("    Opening admin panel...", end=" ", flush=True)
        try:
            page.goto(base, wait_until="domcontentloaded")
        except Exception:
            print("FAILED — router not reachable")
            browser.close()
            return settings

        html = page.content().lower()
        brand = _detect_brand(html)
        print(f"OK ({brand.upper()})")
        settings["brand"] = brand

        print("    Logging in...", end=" ", flush=True)
        logged_in = _try_login(page, base, username, password, brand)
        print("OK" if logged_in else "uncertain — continuing anyway")

        # ── SCRAPE EACH SECTION ──────────────────────────────────────────
        sections = _get_sections(brand, base)
        for name, url in sections:
            print(f"    Scraping {name}...", end=" ", flush=True)
            try:
                page.goto(url, wait_until="domcontentloaded")
                page.wait_for_timeout(1500)
                content = page.content()
                extracted = _extract_from_page(content, name)
                settings.update(extracted)
                print(f"{len(extracted)} settings")
            except PWTimeout:
                print("timeout")
            except Exception as e:
                print(f"skipped ({e})")

        browser.close()

    return settings


def _detect_brand(html: str) -> str:
    if "sky" in html:          return "sky"
    if "tp-link" in html:      return "tplink"
    if "netgear" in html:      return "netgear"
    if "asus" in html:         return "asus"
    if "d-link" in html:       return "dlink"
    if "bt hub" in html:       return "bt"
    if "virginmedia" in html:  return "virgin"
    if "ee " in html:          return "ee"
    return "generic"


def _try_login(page, base: str, username: str, password: str, brand: str) -> bool:
    from playwright.sync_api import TimeoutError as PWTimeout

    # Try filling username/password fields if present
    try:
        # Look for username field
        for sel in ["input[name='username']", "input[name='user']",
                    "input[type='text']", "input[id*='user']", "input[id*='login']"]:
            try:
                el = page.locator(sel).first
                if el.is_visible(timeout=2000):
                    el.fill(username)
                    break
            except Exception:
                continue

        # Look for password field
        for sel in ["input[name='password']", "input[name='pass']",
                    "input[type='password']"]:
            try:
                el = page.locator(sel).first
                if el.is_visible(timeout=2000):
                    el.fill(password)
                    break
            except Exception:
                continue

        # Click login button
        for sel in ["button[type='submit']", "input[type='submit']",
                    "button:has-text('Login')", "button:has-text('Sign in')",
                    "a:has-text('Login')", "#login-btn", ".login-btn"]:
            try:
                el = page.locator(sel).first
                if el.is_visible(timeout=2000):
                    el.click()
                    page.wait_for_timeout(2000)
                    break
            except Exception:
                continue

        return True
    except Exception:
        return False


def _get_sections(brand: str, base: str) -> list[tuple[str, str]]:
    """Return list of (section_name, url) to scrape per brand."""
    common = [
        ("home",     base),
        ("wifi",     f"{base}/wifi"),
        ("security", f"{base}/security"),
        ("advanced", f"{base}/advanced"),
    ]
    brand_sections = {
        "sky": [
            ("home",         f"{base}/sky/home"),
            ("wifi",         f"{base}/sky/wifi"),
            ("security",     f"{base}/sky/security"),
            ("advanced",     f"{base}/sky/advanced"),
            ("upnp",         f"{base}/sky/advanced#upnp"),
        ],
        "tplink": [
            ("wireless",     f"{base}/webpages/index.html#wireless"),
            ("security",     f"{base}/webpages/index.html#security"),
            ("advanced",     f"{base}/webpages/index.html#advance"),
        ],
        "netgear": [
            ("wireless",     f"{base}/WLG_wireless.htm"),
            ("wan",          f"{base}/WAN_setup.htm"),
            ("upnp",         f"{base}/UPnP.htm"),
            ("security",     f"{base}/WAN_NAT_firewall.htm"),
        ],
        "asus": [
            ("wireless",     f"{base}/Advanced_Wireless_Content.asp"),
            ("wan",          f"{base}/Advanced_WAN_Content.asp"),
            ("firewall",     f"{base}/Advanced_Firewall_Content.asp"),
        ],
    }
    return brand_sections.get(brand, common)


def _extract_from_page(html: str, section: str) -> dict:
    """Extract security-relevant settings from page HTML."""
    from bs4 import BeautifulSoup
    soup = BeautifulSoup(html, "html.parser")
    text = soup.get_text(" ", strip=True)
    text_lower = text.lower()
    found = {}

    # WPS
    if "wps" in text_lower:
        if re.search(r"wps[^.]*?:\s*(enabled|on|active)", text_lower):
            found["wps_enable"] = "1"
        elif re.search(r"wps[^.]*?:\s*(disabled|off)", text_lower):
            found["wps_enable"] = "0"

    # UPnP
    if "upnp" in text_lower:
        if re.search(r"upnp[^.]*?:\s*(enabled|on|active)", text_lower):
            found["upnp_enable"] = "1"
        elif re.search(r"upnp[^.]*?:\s*(disabled|off)", text_lower):
            found["upnp_enable"] = "0"

    # Firewall
    if "firewall" in text_lower:
        if re.search(r"firewall[^.]*?:\s*(disabled|off|inactive)", text_lower):
            found["fw_enable"] = "0"
        elif re.search(r"firewall[^.]*?:\s*(enabled|on|active)", text_lower):
            found["fw_enable"] = "1"

    # Remote management
    if "remote" in text_lower and ("management" in text_lower or "access" in text_lower):
        if re.search(r"remote[^.]*?(management|access)[^.]*?:\s*(enabled|on|active)", text_lower):
            found["remote_management"] = "1"
        elif re.search(r"remote[^.]*?(management|access)[^.]*?:\s*(disabled|off)", text_lower):
            found["remote_management"] = "0"

    # WiFi encryption
    for enc in ["wep", "wpa3", "wpa2-aes", "wpa2", "tkip"]:
        if re.search(rf"\b{enc}\b", text_lower):
            if re.search(rf"{enc}[^.]*?(selected|active|current|in use|:\s*yes)", text_lower):
                found["wl_crypto"] = enc.replace("-", "_")
                break

    # SSID
    ssid_match = re.search(r"(?:network name|ssid)[:\s]+([A-Za-z0-9_\-]{4,32})", text, re.IGNORECASE)
    if ssid_match:
        found["wl_ssid"] = ssid_match.group(1)

    # Extract all visible label:value pairs
    for row in soup.find_all(["tr", "li", "div"]):
        row_text = row.get_text(" ", strip=True)
        m = re.match(r"^([A-Za-z \/\(\)]{3,40}):\s*(.{1,60})$", row_text)
        if m:
            key = m.group(1).strip().lower().replace(" ", "_")
            val = m.group(2).strip().lower()
            if len(key) < 40 and len(val) < 60:
                found[key] = val

    return found


def settings_to_config(settings: dict, router_ip: str) -> str:
    """Convert scraped settings dict to nvram-style config string."""
    lines = [
        f"# NetAudit scraped config",
        f"# Router: {router_ip}",
        f"# Brand: {settings.get('brand', 'unknown')}",
        "",
    ]
    skip = {"brand"}
    for k, v in settings.items():
        if k not in skip:
            clean_key = re.sub(r"[^a-z0-9_]", "_", k.lower())
            clean_val = str(v).replace("\n", " ")[:200]
            lines.append(f"{clean_key}={clean_val}")
    return "\n".join(lines)


def analyze(config_text: str) -> dict | None:
    import requests
    try:
        r = requests.post(
            f"{API_URL}/api/analyze",
            json={"config_text": config_text, "device_hint": "home_router"},
            timeout=30,
        )
        r.raise_for_status()
        return r.json()
    except Exception as e:
        print(f"[!] API error: {e}")
        return None


def print_result(result: dict, router_ip: str) -> str:
    score    = result.get("score", "?")
    grade    = result.get("grade", "?")
    scan_id  = result.get("scan_id", "")
    summary  = result.get("summary", {})
    findings = result.get("findings", [])

    url = f"{RESULTS_URL}/{scan_id}?data={urllib.parse.quote(json.dumps(result))}"

    print(f"\n  {'='*60}")
    print(f"  Router: {router_ip}")
    print(f"  Score:  {score}/100   Grade: {grade}")
    print(f"  Issues: CRITICAL={summary.get('critical',0)}  HIGH={summary.get('high',0)}  "
          f"MEDIUM={summary.get('medium',0)}  LOW={summary.get('low',0)}")
    if findings:
        print(f"\n  Findings:")
        for f in findings[:6]:
            print(f"    [{f['severity'].upper():8}] {f['title']}")
        if len(findings) > 6:
            print(f"    ... and {len(findings)-6} more")
    print(f"\n  Full report → {url}")
    print(f"  {'='*60}\n")
    return url


def main():
    check_deps()

    parser = argparse.ArgumentParser(description="NetAudit Home Router Scanner")
    parser.add_argument("--ip",       help="Router IP (default: auto-detect)")
    parser.add_argument("--user",     default="admin", help="Admin username")
    parser.add_argument("--password", help="Admin password")
    parser.add_argument("--no-open",  action="store_true")
    args = parser.parse_args()

    print("\n  NetAudit Home Router Scanner")
    print("  Use only on networks you own or have permission to test\n")

    router_ip = args.ip
    if not router_ip:
        detected = get_gateway()
        resp = input(f"[?] Detected router at {detected}. Press Enter or type another IP: ").strip()
        router_ip = resp if resp else detected

    username = args.user
    password = args.password or getpass.getpass(f"[?] Admin password (user: {username}): ")

    print(f"\n[*] Scanning {router_ip} with headless browser...\n")
    settings = scrape_router(router_ip, username, password)

    if len(settings) < 2:
        print("\n[!] Could not extract settings.")
        print("    Try the manual checklist instead:")
        print("    https://frontend-cyan-gamma-73.vercel.app/scan → QUICK CHECKLIST tab")
        sys.exit(1)

    config_text = settings_to_config(settings, router_ip)
    print(f"\n[*] Extracted {len(settings)} settings — analysing...")

    result = analyze(config_text)
    if not result:
        sys.exit(1)

    url = print_result(result, router_ip)

    if not args.no_open:
        ans = input("[?] Open full report in browser? [Y/n]: ").strip().lower()
        if ans != "n":
            webbrowser.open(url)


if __name__ == "__main__":
    main()
