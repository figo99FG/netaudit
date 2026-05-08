#!/usr/bin/env python3
"""
NetAudit Local Agent
====================
Scans your network, pulls running-configs from Cisco devices via SSH,
and sends them to the NetAudit API for analysis.

Requirements:
    pip install netmiko requests python-nmap

Usage:
    python netaudit-agent.py
    python netaudit-agent.py --range 192.168.1.0/24 --user admin --password cisco
"""

import argparse
import ipaddress
import json
import os
import socket
import sys
import webbrowser

API_URL = "https://netaudit-production.up.railway.app"
RESULTS_URL = "https://frontend-cyan-gamma-73.vercel.app/results"

# Ports that indicate a network device
DEVICE_PORTS = [22, 23]

def check_deps():
    missing = []
    for pkg in ["netmiko", "requests", "nmap"]:
        try:
            __import__(pkg)
        except ImportError:
            missing.append(pkg)
    if missing:
        print(f"[!] Missing packages: {', '.join(missing)}")
        print(f"    Run: pip install {' '.join(missing)}")
        sys.exit(1)

def get_local_subnet():
    """Guess the local /24 subnet from the default interface."""
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.connect(("8.8.8.8", 80))
        ip = s.getsockname()[0]
        s.close()
        parts = ip.split(".")
        return f"{parts[0]}.{parts[1]}.{parts[2]}.0/24", ip
    except Exception:
        return "192.168.1.0/24", "unknown"

def discover_devices(subnet: str) -> list[str]:
    """Use nmap to find hosts with SSH or Telnet open."""
    import nmap
    print(f"[*] Scanning {subnet} for network devices (ports 22,23)...")
    nm = nmap.PortScanner()
    nm.scan(hosts=subnet, arguments="-p 22,23 --open -T4 --host-timeout 5s")
    hosts = []
    for host in nm.all_hosts():
        if nm[host].state() == "up":
            for port in DEVICE_PORTS:
                if nm[host].has_tcp(port) and nm[host]["tcp"][port]["state"] == "open":
                    hosts.append(host)
                    break
    print(f"[+] Found {len(hosts)} potential device(s): {', '.join(hosts) or 'none'}")
    return hosts

def pull_config(host: str, username: str, password: str, device_type: str) -> str | None:
    """SSH into a device and pull running-config."""
    from netmiko import ConnectHandler, NetmikoTimeoutException, NetmikoAuthenticationException
    try:
        print(f"    Connecting to {host}...", end=" ", flush=True)
        conn = ConnectHandler(
            device_type=device_type,
            host=host,
            username=username,
            password=password,
            timeout=10,
            session_timeout=15,
        )
        config = conn.send_command("show running-config")
        conn.disconnect()
        print("OK")
        return config
    except NetmikoAuthenticationException:
        print("AUTH FAILED")
    except NetmikoTimeoutException:
        print("TIMEOUT")
    except Exception as e:
        print(f"ERROR: {e}")
    return None

def analyze(config_text: str, device_hint: str = "auto") -> dict | None:
    """POST config to NetAudit API."""
    import requests
    try:
        r = requests.post(
            f"{API_URL}/api/analyze",
            json={"config_text": config_text, "device_hint": device_hint},
            timeout=30,
        )
        r.raise_for_status()
        return r.json()
    except Exception as e:
        print(f"[!] API error: {e}")
        return None

def print_result(host: str, result: dict):
    score = result.get("score", "?")
    grade = result.get("grade", "?")
    hostname = result.get("hostname") or host
    scan_id = result.get("scan_id", "")
    summary = result.get("summary", {})
    url = f"{RESULTS_URL}/{scan_id}?data={__import__('urllib.parse', fromlist=['quote']).quote(json.dumps(result))}"

    crit = summary.get("critical", 0)
    high = summary.get("high", 0)
    med  = summary.get("medium", 0)

    print(f"\n  {'='*55}")
    print(f"  {hostname} ({host})")
    print(f"  Score: {score}/100  Grade: {grade}  |  CRIT:{crit}  HIGH:{high}  MED:{med}")
    print(f"  Report: {url}")
    print(f"  {'='*55}")
    return url

def main():
    check_deps()

    parser = argparse.ArgumentParser(description="NetAudit Local Network Agent")
    parser.add_argument("--range",    help="CIDR range to scan (default: auto-detect)")
    parser.add_argument("--hosts",    help="Comma-separated list of hosts (skips discovery)")
    parser.add_argument("--user",     help="SSH username")
    parser.add_argument("--password", help="SSH password")
    parser.add_argument("--device",   default="cisco_ios", help="Netmiko device type (default: cisco_ios)")
    parser.add_argument("--no-open",  action="store_true", help="Don't auto-open results in browser")
    args = parser.parse_args()

    print("\n  NetAudit Local Agent")
    print("  Authorized security testing only\n")

    # Determine target hosts
    if args.hosts:
        hosts = [h.strip() for h in args.hosts.split(",")]
        print(f"[*] Targeting specified hosts: {', '.join(hosts)}")
    else:
        subnet, my_ip = get_local_subnet()
        if args.range:
            subnet = args.range
        else:
            detected = input(f"[?] Detected subnet {subnet}. Press Enter to use it or type another: ").strip()
            if detected:
                subnet = detected
        hosts = discover_devices(subnet)

    if not hosts:
        print("[!] No devices found. Try specifying --hosts manually.")
        sys.exit(0)

    # Get credentials
    username = args.user or input("\n[?] SSH username: ").strip()
    password = args.password or __import__("getpass").getpass("[?] SSH password: ")

    print(f"\n[*] Pulling configs from {len(hosts)} device(s)...\n")

    result_urls = []
    for host in hosts:
        config = pull_config(host, username, password, args.device)
        if not config:
            continue
        print(f"    Analyzing {host}...", end=" ", flush=True)
        result = analyze(config)
        if not result:
            continue
        print("done")
        url = print_result(host, result)
        result_urls.append(url)

    if not result_urls:
        print("\n[!] No results — check credentials and device reachability.")
        sys.exit(1)

    print(f"\n[+] {len(result_urls)} scan(s) complete.")

    if not args.no_open:
        open_browser = input("\n[?] Open results in browser? [Y/n]: ").strip().lower()
        if open_browser != "n":
            for url in result_urls:
                webbrowser.open(url)

if __name__ == "__main__":
    main()
