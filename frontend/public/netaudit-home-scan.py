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

import os
API_URL     = os.getenv("NETAUDIT_API", "https://netaudit-production-76e6.up.railway.app")
RESULTS_URL = os.getenv("NETAUDIT_RESULTS", "https://frontend-cyan-gamma-73.vercel.app/results")


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


def scrape_sky_hub_requests(ip: str, password: str) -> dict:
    """
    Scrape Sky Hub using Playwright with a visible browser so the user can confirm login.
    Settings pages need the browser session cookie.
    """
    from playwright.sync_api import sync_playwright
    import re as _re

    settings = {}
    base = f"http://{ip}"

    SKY_PAGES = [
        ("home",        "sky_index.html"),
        ("wifi",        "sky_wireless_settings.html"),
        ("security",    "sky_logs.html"),
        ("maintenance", "sky_router_status.html"),
        ("advanced",    "sky_wan_setup.html"),
    ]

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=False, args=["--window-size=1100,750"])
        ctx = browser.new_context(ignore_https_errors=True)
        page = ctx.new_page()

        print(f"OK (SKY)")

        # Navigate to root
        page.goto(base, wait_until="domcontentloaded")
        page.wait_for_timeout(2000)

        # Auto-fill password if a field is visible
        print("    Logging in...", end=" ", flush=True)
        filled = False
        for sel in ["input[type='password']", "input[name='password']"]:
            try:
                el = page.locator(sel).first
                if el.is_visible(timeout=2000):
                    el.fill(password)
                    filled = True
                    break
            except Exception:
                pass
        if filled:
            for sel in ["button[type='submit']", "input[type='submit']",
                        "button:has-text('Login')", "button:has-text('OK')"]:
                try:
                    el = page.locator(sel).first
                    if el.is_visible(timeout=2000):
                        el.click()
                        break
                except Exception:
                    pass
            page.wait_for_timeout(3000)

        print("\n" + "=" * 55)
        print("  >>> BROWSER IS OPEN. If you see the Sky Hub home")
        print("      dashboard, press Enter. If it's still on the")
        print("      login screen, log in manually then press Enter.")
        print("=" * 55)
        input("  Press Enter when on Sky Hub home page: ")
        page.wait_for_timeout(1500)

        # Scrape all Sky pages
        for name, sky_page in SKY_PAGES:
            url = f"{base}/{sky_page}"
            print(f"    Visiting {name}...", end=" ", flush=True)
            try:
                page.goto(url, wait_until="domcontentloaded", timeout=8000)
                page.wait_for_timeout(800)
                html = page.content()
                if "404" in html[:300] or "File not found" in html[:300]:
                    print("404")
                    continue
                extracted = _extract_sky_hub_settings(html)
                new_keys = [k for k in extracted if k not in settings]
                settings.update(extracted)
                print(f"{len(new_keys)} new settings")
            except Exception as e:
                print(f"err")

        browser.close()

    settings["brand"] = "sky"
    return settings


def scrape_router(ip: str, username: str, password: str) -> dict:
    from playwright.sync_api import sync_playwright, TimeoutError as PWTimeout

    settings = {}
    api_responses = []

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        ctx = browser.new_context(ignore_https_errors=True)
        page = ctx.new_page()
        page.set_default_timeout(12000)

        base = f"http://{ip}"

        def on_response(response):
            try:
                ct = response.headers.get("content-type", "")
                if "json" in ct or "javascript" in ct:
                    try:
                        data = response.json()
                        api_responses.append({"url": response.url, "data": data})
                    except Exception:
                        pass
            except Exception:
                pass

        page.on("response", on_response)

        print("    Opening admin panel...", end=" ", flush=True)
        try:
            page.goto(base, wait_until="domcontentloaded")
            page.wait_for_timeout(2000)
        except Exception:
            print("FAILED — router not reachable")
            browser.close()
            return settings

        html = page.content().lower()
        brand = _detect_brand(html)
        print(f"OK ({brand.upper()})")
        settings["brand"] = brand

        # Sky Hub: use requests-based scraper (no JS needed)
        if brand == "sky":
            browser.close()
            return scrape_sky_hub_requests(ip, password)

        print("    Logging in...", end=" ", flush=True)
        _try_login(page, base, username, password, brand)
        page.wait_for_timeout(4000)
        print("OK")

        sections = _get_sections(brand, base)
        for name, url in sections:
            print(f"    Visiting {name}...", end=" ", flush=True)
            try:
                page.goto(url, wait_until="domcontentloaded")
                page.wait_for_timeout(2500)
                content = page.content()
                extracted = _extract_from_page(content, name)
                settings.update(extracted)
                print(f"{len(extracted)} settings")
            except Exception:
                print(f"skipped")

        if api_responses:
            print(f"    Parsing {len(api_responses)} API response(s)...")
            for resp in api_responses:
                extracted = _extract_from_json(resp["data"], resp["url"])
                settings.update(extracted)

        browser.close()

    return settings


def _extract_from_json(data, url: str) -> dict:
    """Recursively extract security-relevant fields from API JSON responses."""
    found = {}
    if not isinstance(data, (dict, list)):
        return found

    def flatten(obj, prefix=""):
        if isinstance(obj, dict):
            for k, v in obj.items():
                key = f"{prefix}{k}".lower().replace("-", "_").replace(" ", "_")
                if isinstance(v, (dict, list)):
                    flatten(v, f"{key}_")
                else:
                    found[key] = str(v).lower()
        elif isinstance(obj, list):
            for i, item in enumerate(obj[:10]):
                flatten(item, f"{prefix}{i}_")

    flatten(data)

    # Map known API field names to nvram-style keys
    mappings = {
        "wps":              "wps_enable",
        "wps_enabled":      "wps_enable",
        "upnp":             "upnp_enable",
        "upnp_enabled":     "upnp_enable",
        "firewall":         "fw_enable",
        "firewall_enabled": "fw_enable",
        "remote_access":    "remote_management",
        "ssid":             "wl_ssid",
        "wifi_name":        "wl_ssid",
        "security_mode":    "wl_akm",
        "encryption":       "wl_crypto",
        "password":         "http_passwd",
    }
    for api_key, nvram_key in mappings.items():
        if api_key in found:
            found[nvram_key] = found[api_key]

    return found


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


def _extract_sky_hub_settings(html: str) -> dict:
    """Extract inline JS vars from Sky Hub page HTML and map to nvram-style keys."""
    raw = {}
    for m in re.finditer(r"var\s+(\w+)\s*=\s*'([^']*)'", html):
        raw[m.group(1)] = m.group(2)
    for m in re.finditer(r'var\s+(\w+)\s*=\s*"([^"]*)"', html):
        raw[m.group(1)] = m.group(2)
    for m in re.finditer(r"var\s+(\w+)\s*=\s*(\d+|true|false)\s*;", html):
        if m.group(1) not in raw:
            raw[m.group(1)] = m.group(2)

    s = {}
    if raw.get("sky_WirelessAllSSIDs"):
        s["wl_ssid"] = raw["sky_WirelessAllSSIDs"]
    if raw.get("sky_wlAuthMode"):
        s["wl_security_mode"] = raw["sky_wlAuthMode"]
    if "sky_wlWep" in raw:
        s["wl_wep"] = "enabled" if raw["sky_wlWep"] else "disabled"
    if raw.get("sky_wlWpa"):
        s["wl_crypto"] = raw["sky_wlWpa"]
    if raw.get("sky_wlHide") is not None:
        s["wl_closed"] = raw["sky_wlHide"]
    if raw.get("sky_wlIsolation") is not None:
        s["wifi_isolation"] = raw["sky_wlIsolation"]
    # WPS
    if raw.get("WscMode") == "enabled" or raw.get("sky_actualUserWPSState") == "1":
        s["wps_enable"] = "1"
    elif raw.get("WscMode") == "disabled":
        s["wps_enable"] = "0"
    # Firmware
    if raw.get("sky_firmware_version"):
        s["firmware_version"] = raw["sky_firmware_version"]
    if raw.get("modelName"):
        s["device_name"] = raw["modelName"]
    # Sky Hub admin panel is HTTP only
    s["http_enable"] = "1"
    # Ping
    if raw.get("pingenbl") == "enable":
        s["wan_ping"] = "enabled"
    # Logging
    if raw.get("LogBlockSites") is not None:
        s["log_block_sites"] = raw["LogBlockSites"]
    if raw.get("LogConnToRouter") is not None:
        s["log_conn_router"] = raw["LogConnToRouter"]
    if raw.get("pwd_change_status") is not None:
        s["pwd_change_status"] = raw["pwd_change_status"]
    return s


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
            ("home",        f"{base}/sky_index.html"),
            ("wifi",        f"{base}/sky_wireless_settings.html"),
            ("security",    f"{base}/sky_logs.html"),
            ("maintenance", f"{base}/sky_router_status.html"),
            ("advanced",    f"{base}/sky_wan_setup.html"),
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


def scrape_router_manual(ip: str, username: str, password: str) -> dict:
    """Visible browser mode — user logs in manually while we intercept API calls."""
    from playwright.sync_api import sync_playwright

    settings = {}
    api_responses = []

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=False, args=["--window-size=1200,800"])
        ctx = browser.new_context(ignore_https_errors=True)
        page = ctx.new_page()

        def on_response(response):
            try:
                ct = response.headers.get("content-type", "")
                if "json" in ct:
                    try:
                        data = response.json()
                        api_responses.append({"url": response.url, "data": data})
                        print(f"    [+] Captured API response: {response.url.split('/')[-1]}")
                    except Exception:
                        pass
            except Exception:
                pass

        page.on("response", on_response)
        page.goto(f"http://{ip}", wait_until="domcontentloaded")

        print(f"    Browser opened at http://{ip}")
        print(f"    → Log in, then click through: WiFi, Security, Advanced, UPnP tabs")
        print(f"    → Press Enter here when you're done browsing...\n")

        try:
            input()
        except KeyboardInterrupt:
            pass

        # Extract from final page DOM too
        try:
            content = page.content()
            dom_settings = _extract_from_page(content, "final")
            settings.update(dom_settings)
        except Exception:
            pass

        browser.close()

    # Parse all captured API responses
    for resp in api_responses:
        extracted = _extract_from_json(resp["data"], resp["url"])
        settings.update(extracted)

    print(f"\n[+] Captured {len(api_responses)} API responses, extracted {len(settings)} settings")
    return settings


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
    for hint in ["home_router", "auto"]:
        try:
            r = requests.post(
                f"{API_URL}/api/analyze",
                json={"config_text": config_text, "device_hint": hint},
                timeout=30,
            )
            if r.ok:
                return r.json()
            if r.status_code == 422 and hint == "home_router":
                continue  # retry with auto
            print(f"[!] API error {r.status_code}: {r.text[:400]}")
            return None
        except Exception as e:
            print(f"[!] API error: {e}")
            return None
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
    parser.add_argument("--show",     action="store_true", help="Show browser window (manual login mode)")
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

    if args.show:
        print(f"\n[*] Opening browser window — log into your router manually, then browse to WiFi/Security/Advanced settings.")
        print(f"    We'll capture all API calls in the background. Press Ctrl+C when done browsing.\n")
        settings = scrape_router_manual(router_ip, username, password)
    else:
        print(f"\n[*] Scanning {router_ip} with headless browser...\n")
        settings = scrape_router(router_ip, username, password)

    if len(settings) < 2:
        print("\n[!] Could not extract settings.")
        print("    Try the manual checklist instead:")
        print("    https://frontend-cyan-gamma-73.vercel.app/scan → QUICK CHECKLIST tab")
        sys.exit(1)

    config_text = settings_to_config(settings, router_ip)
    print(f"\n[*] Extracted {len(settings)} settings — config preview:")
    for line in config_text.splitlines():
        if not line.startswith("#") and line.strip():
            print(f"    {line}")
    print(f"\n[*] Analysing...")

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
