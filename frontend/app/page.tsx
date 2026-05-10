import Link from "next/link";
import ScoreGauge from "@/components/ScoreGauge";

const AGENT_URL = "https://github.com/figo99FG/netaudit/releases/latest/download/NetAudit-Agent.exe";

const HOW_IT_WORKS = [
  {
    step: "1",
    icon: "⬇️",
    title: "Download the Agent",
    desc: "One-click download. Double-click to install — no terminal, no setup. It runs quietly in your system tray.",
    tag: "Windows · 67 MB",
  },
  {
    step: "2",
    icon: "🌐",
    title: "Open the Website",
    desc: "The agent automatically opens this website in your browser with everything already connected. No configuration needed.",
    tag: "Auto-connects",
  },
  {
    step: "3",
    icon: "🔍",
    title: "Scan Your Network",
    desc: "Enter your network range (e.g. 192.168.0.0/24) and hit Scan. NetAudit discovers every device and checks it for security issues.",
    tag: "Takes 1–3 minutes",
  },
  {
    step: "4",
    icon: "📋",
    title: "Get Your Report",
    desc: "Every issue is explained in plain English with a severity rating and exact steps to fix it. Export as PDF or JSON.",
    tag: "Instant results",
  },
];

const WHO_FOR = [
  {
    icon: "🏠",
    label: "Home Users",
    color: "#4488ff",
    points: [
      "Check if your WiFi router has weak security",
      "See if WPS or default passwords are enabled",
      "Get plain-English fix instructions",
      "No technical knowledge needed",
    ],
  },
  {
    icon: "🏢",
    label: "IT Admins",
    color: "#ffaa00",
    points: [
      "Audit entire office subnets at once",
      "Scan Cisco switches and routers over SSH",
      "Export PDF reports for compliance",
      "Spot misconfigurations before attackers do",
    ],
  },
  {
    icon: "🔐",
    label: "Pentesters",
    color: "#00ff88",
    points: [
      "Fast config review during engagements",
      "21+ checks based on CIS benchmarks",
      "JSON export for tool integration",
      "Supports IOS, ASA, and generic configs",
    ],
  },
];

const FEATURES = [
  { icon: "⚡", title: "Instant Analysis", desc: "Results in under a second — paste a config and get a full audit immediately." },
  { icon: "🛡️", title: "21+ Security Checks", desc: "Covers passwords, encryption, SSH, SNMP, firewall, VPN, and more." },
  { icon: "🛠️", title: "Actionable Fixes", desc: "Every finding includes the exact steps or commands needed to fix the issue." },
  { icon: "📡", title: "Network Discovery", desc: "Auto-discovers all devices on your subnet using nmap — no manual IP entry." },
  { icon: "📊", title: "Security Score", desc: "A 0–100 score and A–F grade shows exactly how secure your network is." },
  { icon: "📄", title: "PDF & JSON Export", desc: "Professional reports you can share with your team or submit for compliance." },
];

const FAQS = [
  {
    q: "Do I need any technical knowledge to use NetAudit?",
    a: "No. The Quick Checklist tab asks you simple yes/no questions about your router settings and explains every issue in plain English. No commands or configs required.",
  },
  {
    q: "Is my data safe? Does NetAudit store my passwords?",
    a: "Your credentials are never stored. They are used only for the single SSH/login session and discarded immediately. Network scan results are saved locally in your browser.",
  },
  {
    q: "What devices can NetAudit scan?",
    a: "Cisco IOS routers and switches, Cisco ASA firewalls, Sky Hub and other home routers, and any generic network device. If it has an SSH interface or web admin panel, NetAudit can reach it.",
  },
  {
    q: "Why do I need to download the Agent for network scanning?",
    a: "Your home or office devices have private IP addresses (like 192.168.0.x) that are not reachable from the internet. The Agent runs on your computer, which is already on the same network as your devices, so it can reach them directly.",
  },
  {
    q: "I don't have a Cisco router. Can I still use NetAudit?",
    a: "Yes. Use the Quick Checklist tab — it works for any router brand (TP-Link, Netgear, ASUS, Sky, BT, etc.) through a simple question-and-answer format.",
  },
  {
    q: "Is NetAudit free?",
    a: "Yes, completely free. No account required for config upload, file analysis, or the quick checklist. Network scanning requires the free Agent download.",
  },
];

const SAMPLE_FINDINGS = [
  { sev: "CRITICAL", title: "Cleartext enable password", color: "#ff4444" },
  { sev: "CRITICAL", title: "Telnet enabled on VTY lines", color: "#ff4444" },
  { sev: "HIGH", title: "SSH version 2 not enforced", color: "#ff7700" },
  { sev: "HIGH", title: "HTTP management server enabled", color: "#ff7700" },
  { sev: "MEDIUM", title: "No login/MOTD banner", color: "#ffaa00" },
  { sev: "LOW", title: "CDP globally enabled", color: "#4488ff" },
];

export default function LandingPage() {
  return (
    <main style={{ background: "var(--bg)", minHeight: "100vh" }}>

      {/* Nav */}
      <nav className="border-b px-6 py-4 flex items-center justify-between sticky top-0 z-10"
        style={{ borderColor: "#2a2a2a", background: "rgba(13,13,13,0.95)", backdropFilter: "blur(8px)" }}>
        <span className="font-bold text-lg tracking-widest" style={{ color: "var(--green)" }}>
          NET<span style={{ color: "#e2e8f0" }}>AUDIT</span>
        </span>
        <div className="flex items-center gap-3">
          <a href="#how-it-works" className="text-xs hidden md:block px-3 py-1.5 rounded transition-all"
            style={{ color: "#718096" }}>How it works</a>
          <a href="#faq" className="text-xs hidden md:block px-3 py-1.5 rounded transition-all"
            style={{ color: "#718096" }}>FAQ</a>
          <a href={AGENT_URL} download
            className="text-xs px-4 py-2 rounded font-bold tracking-widest transition-all hidden sm:block"
            style={{ background: "#1a1a1a", color: "var(--green)", border: "1px solid #00ff8833" }}>
            ↓ Download Agent
          </a>
          <Link href="/scan"
            className="text-xs px-4 py-2 rounded font-bold tracking-widest transition-all"
            style={{ background: "var(--green)", color: "#000" }}>
            SCAN NOW →
          </Link>
        </div>
      </nav>

      {/* Hero */}
      <section className="max-w-6xl mx-auto px-6 pt-20 pb-16 grid md:grid-cols-2 gap-12 items-center">
        <div>
          <div className="inline-block text-xs px-3 py-1 rounded-full mb-6 font-bold tracking-widest"
            style={{ background: "#00ff8811", color: "var(--green)", border: "1px solid #00ff8833" }}>
            FREE · NO ACCOUNT NEEDED
          </div>
          <h1 className="text-4xl font-bold leading-tight mb-4">
            Is your network<br />
            <span style={{ color: "var(--green)" }}>actually secure?</span>
          </h1>
          <p className="text-base mb-4 leading-relaxed" style={{ color: "#a0aec0" }}>
            NetAudit scans your routers, switches, and firewalls for security weaknesses
            — and tells you exactly how to fix them. Plain English. No jargon.
          </p>
          <p className="text-sm mb-8" style={{ color: "#718096" }}>
            Works for home routers, Cisco enterprise gear, and everything in between.
          </p>
          <div className="flex flex-wrap gap-3">
            <Link href="/scan"
              className="px-8 py-3 rounded font-bold tracking-widest text-sm transition-all"
              style={{ background: "var(--green)", color: "#000" }}>
              START SCANNING →
            </Link>
            <a href={AGENT_URL} download
              className="px-8 py-3 rounded font-bold text-sm transition-all"
              style={{ background: "transparent", color: "var(--green)", border: "1px solid #00ff8855" }}>
              ↓ Download Agent
            </a>
          </div>
          <p className="text-xs mt-3" style={{ color: "#4a5568" }}>
            Windows · 67 MB · No installation wizard · Auto-updates
          </p>
        </div>

        {/* Demo widget */}
        <div className="rounded-xl p-6" style={{ background: "#141414", border: "1px solid #2a2a2a" }}>
          <div className="flex items-center gap-2 mb-4">
            <div className="w-3 h-3 rounded-full" style={{ background: "#ff4444" }} />
            <div className="w-3 h-3 rounded-full" style={{ background: "#ffaa00" }} />
            <div className="w-3 h-3 rounded-full" style={{ background: "#00ff88" }} />
            <span className="ml-2 text-xs" style={{ color: "#4a5568" }}>Router1 — Security Audit</span>
          </div>
          <div className="flex justify-center mb-6">
            <ScoreGauge score={28} grade="F" size={160} />
          </div>
          <div className="space-y-2">
            {SAMPLE_FINDINGS.map((f, i) => (
              <div key={i} className="flex items-center gap-3 text-xs py-2 px-3 rounded"
                style={{ background: "#0d0d0d", border: "1px solid #1a1a1a" }}>
                <span className="font-bold shrink-0 w-16 text-right" style={{ color: f.color }}>{f.sev}</span>
                <span style={{ color: "#a0aec0" }}>{f.title}</span>
              </div>
            ))}
          </div>
          <p className="text-xs text-center mt-4" style={{ color: "#4a5568" }}>Sample report — your results will vary</p>
        </div>
      </section>

      {/* Who is it for */}
      <section className="max-w-6xl mx-auto px-6 py-16">
        <h2 className="text-2xl font-bold mb-2 text-center">Built for everyone</h2>
        <p className="text-sm text-center mb-10" style={{ color: "#718096" }}>
          Whether you just want to check your home WiFi or audit a corporate network, NetAudit has you covered.
        </p>
        <div className="grid sm:grid-cols-3 gap-6">
          {WHO_FOR.map(w => (
            <div key={w.label} className="p-6 rounded-xl" style={{ background: "#0d0d0d", border: `1px solid ${w.color}22` }}>
              <div className="text-3xl mb-3">{w.icon}</div>
              <h3 className="font-bold text-base mb-4" style={{ color: w.color }}>{w.label}</h3>
              <ul className="space-y-2">
                {w.points.map((p, i) => (
                  <li key={i} className="flex items-start gap-2 text-xs" style={{ color: "#a0aec0" }}>
                    <span style={{ color: w.color }} className="mt-0.5 shrink-0">✓</span>
                    {p}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section id="how-it-works" className="max-w-6xl mx-auto px-6 py-16">
        <h2 className="text-2xl font-bold mb-2 text-center">How it works</h2>
        <p className="text-sm text-center mb-12" style={{ color: "#718096" }}>
          Up and running in under 5 minutes. No command line required.
        </p>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {HOW_IT_WORKS.map((s, i) => (
            <div key={i} className="relative p-6 rounded-xl" style={{ background: "#0d0d0d", border: "1px solid #2a2a2a" }}>
              <div className="text-3xl mb-3">{s.icon}</div>
              <div className="text-xs font-bold mb-2 tracking-widest" style={{ color: "#00ff88" }}>STEP {s.step}</div>
              <h3 className="font-bold text-sm mb-2">{s.title}</h3>
              <p className="text-xs leading-relaxed mb-3" style={{ color: "#718096" }}>{s.desc}</p>
              <span className="text-xs px-2 py-1 rounded" style={{ background: "#1a1a1a", color: "#555" }}>{s.tag}</span>
            </div>
          ))}
        </div>
      </section>

      {/* Download CTA */}
      <section className="max-w-4xl mx-auto px-6 py-10">
        <div className="rounded-xl p-8 flex flex-col sm:flex-row items-center justify-between gap-6"
          style={{ background: "#0a1a0a", border: "1px solid #00ff8833" }}>
          <div>
            <h3 className="font-bold text-lg mb-1">Ready to scan your network?</h3>
            <p className="text-sm" style={{ color: "#718096" }}>
              Download the Agent, double-click it, and you&apos;re scanning in under a minute.
            </p>
            <p className="text-xs mt-2" style={{ color: "#4a5568" }}>
              Windows · 67 MB · Free · Auto-updates silently
            </p>
          </div>
          <div className="flex flex-col gap-3 shrink-0 text-center">
            <a href={AGENT_URL} download
              className="px-8 py-3 rounded font-bold text-sm tracking-widest"
              style={{ background: "var(--green)", color: "#000" }}>
              ↓ Download Agent
            </a>
            <Link href="/scan"
              className="text-xs"
              style={{ color: "#718096" }}>
              Or scan without downloading →
            </Link>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="max-w-6xl mx-auto px-6 py-16">
        <h2 className="text-2xl font-bold mb-2 text-center">What we check</h2>
        <p className="text-sm text-center mb-10" style={{ color: "#718096" }}>
          Based on Cisco hardening guides, CIS benchmarks, and real-world pentesting experience.
        </p>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {FEATURES.map(f => (
            <div key={f.title} className="p-5 rounded-lg" style={{ background: "#141414", border: "1px solid #2a2a2a" }}>
              <div className="text-2xl mb-3">{f.icon}</div>
              <h3 className="font-bold text-sm mb-2">{f.title}</h3>
              <p className="text-xs leading-relaxed" style={{ color: "#718096" }}>{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* FAQ */}
      <section id="faq" className="max-w-3xl mx-auto px-6 py-16">
        <h2 className="text-2xl font-bold mb-2 text-center">Frequently asked questions</h2>
        <p className="text-sm text-center mb-10" style={{ color: "#718096" }}>Everything you need to know.</p>
        <div className="space-y-4">
          {FAQS.map((faq, i) => (
            <div key={i} className="p-5 rounded-lg" style={{ background: "#0d0d0d", border: "1px solid #2a2a2a" }}>
              <h3 className="font-bold text-sm mb-2" style={{ color: "#e2e8f0" }}>{faq.q}</h3>
              <p className="text-xs leading-relaxed" style={{ color: "#718096" }}>{faq.a}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Final CTA */}
      <section className="max-w-2xl mx-auto px-6 py-16 text-center">
        <div className="rounded-xl p-10" style={{ background: "#00ff8808", border: "1px solid #00ff8822" }}>
          <h2 className="text-2xl font-bold mb-3">Start your free audit now</h2>
          <p className="text-sm mb-6" style={{ color: "#718096" }}>
            No account. No credit card. No setup. Just results.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link href="/scan"
              className="inline-block px-10 py-4 rounded font-bold tracking-widest text-sm"
              style={{ background: "var(--green)", color: "#000" }}>
              ANALYZE A CONFIG →
            </Link>
            <a href={AGENT_URL} download
              className="inline-block px-10 py-4 rounded font-bold text-sm"
              style={{ background: "transparent", color: "var(--green)", border: "1px solid #00ff8855" }}>
              ↓ Download Agent
            </a>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t px-6 py-8" style={{ borderColor: "#2a2a2a" }}>
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <span className="font-bold tracking-widest" style={{ color: "var(--green)" }}>
            NET<span style={{ color: "#e2e8f0" }}>AUDIT</span>
          </span>
          <div className="flex gap-6 text-xs" style={{ color: "#4a5568" }}>
            <a href="#how-it-works" style={{ color: "#4a5568" }}>How it works</a>
            <a href="#faq" style={{ color: "#4a5568" }}>FAQ</a>
            <Link href="/scan" style={{ color: "#4a5568" }}>Scan</Link>
            <a href={AGENT_URL} download style={{ color: "#4a5568" }}>Download</a>
          </div>
          <p className="text-xs text-center" style={{ color: "#4a5568" }}>
            For authorised security testing only.
          </p>
        </div>
      </footer>
    </main>
  );
}
