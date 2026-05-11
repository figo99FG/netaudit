import Link from "next/link";
import ScoreGauge from "@/components/ScoreGauge";

const AGENT_URL = "https://github.com/figo99FG/netaudit/releases/latest/download/NetAudit-Agent.exe";

/* ── Inline SVG icons (no emoji) ───────────────────────────────────────── */
const IcoDownload = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
    <polyline points="7 10 12 15 17 10"/>
    <line x1="12" y1="15" x2="12" y2="3"/>
  </svg>
);
const IcoGlobe = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10"/>
    <line x1="2" y1="12" x2="22" y2="12"/>
    <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>
  </svg>
);
const IcoScan = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="11" cy="11" r="8"/>
    <line x1="21" y1="21" x2="16.65" y2="16.65"/>
  </svg>
);
const IcoReport = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
    <polyline points="14 2 14 8 20 8"/>
    <line x1="16" y1="13" x2="8" y2="13"/>
    <line x1="16" y1="17" x2="8" y2="17"/>
  </svg>
);
const IcoHome = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
    <polyline points="9 22 9 12 15 12 15 22"/>
  </svg>
);
const IcoServer = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <rect x="2" y="2" width="20" height="8" rx="2" ry="2"/>
    <rect x="2" y="14" width="20" height="8" rx="2" ry="2"/>
    <line x1="6" y1="6" x2="6.01" y2="6"/>
    <line x1="6" y1="18" x2="6.01" y2="18"/>
  </svg>
);
const IcoShield = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
    <polyline points="9 12 11 14 15 10"/>
  </svg>
);
const IcoZap = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>
  </svg>
);
const IcoShieldCheck = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
    <polyline points="9 12 11 14 15 10"/>
  </svg>
);
const IcoWrench = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/>
  </svg>
);
const IcoRadio = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="2"/>
    <path d="M4.93 4.93a10 10 0 0 0 0 14.14M19.07 4.93a10 10 0 0 1 0 14.14M7.76 7.76a6 6 0 0 0 0 8.49M16.24 7.76a6 6 0 0 1 0 8.49"/>
  </svg>
);
const IcoBarChart = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <line x1="18" y1="20" x2="18" y2="10"/>
    <line x1="12" y1="20" x2="12" y2="4"/>
    <line x1="6" y1="20" x2="6" y2="14"/>
  </svg>
);
const IcoFileDown = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
    <polyline points="14 2 14 8 20 8"/>
    <line x1="12" y1="18" x2="12" y2="12"/>
    <line x1="9" y1="15" x2="15" y2="15"/>
  </svg>
);

/* ── Data ───────────────────────────────────────────────────────────────── */
const HOW_IT_WORKS = [
  { step: "01", Icon: IcoDownload, title: "Download the Agent",   tag: "Windows · 67 MB",     desc: "One-click download. Double-click to install — no terminal, no setup. Runs quietly in your system tray." },
  { step: "02", Icon: IcoGlobe,    title: "Open the Website",     tag: "Auto-connects",        desc: "The agent automatically opens this site with everything connected. No configuration needed." },
  { step: "03", Icon: IcoScan,     title: "Scan Your Network",    tag: "Takes 1–3 min",        desc: "Enter your network range (e.g. 192.168.0.0/24) and hit Scan. NetAudit discovers every device and audits it." },
  { step: "04", Icon: IcoReport,   title: "Get Your Report",      tag: "Instant results",      desc: "Every issue is explained in plain English with a severity rating and exact commands to fix it. Export as PDF or JSON." },
];

const WHO_FOR = [
  { Icon: IcoHome,   label: "Home Users",  color: "#4488ff", points: ["Check if your WiFi router has weak security", "See if WPS or default passwords are enabled", "Get plain-English fix instructions", "No technical knowledge needed"] },
  { Icon: IcoServer, label: "IT Admins",   color: "#ffaa00", points: ["Audit entire office subnets at once", "Scan Cisco switches and routers over SSH", "Export PDF reports for compliance", "Spot misconfigurations before attackers do"] },
  { Icon: IcoShield, label: "Pentesters",  color: "#00ff88", points: ["Fast config review during engagements", "21+ checks based on CIS benchmarks", "JSON export for tool integration", "Supports IOS, ASA, and generic configs"] },
];

const FEATURES = [
  { Icon: IcoZap,        title: "Instant Analysis",    desc: "Results in under a second — paste a config and get a full audit immediately." },
  { Icon: IcoShieldCheck,title: "21+ Security Checks", desc: "Covers passwords, encryption, SSH, SNMP, firewall, VPN, and more." },
  { Icon: IcoWrench,     title: "Actionable Fixes",    desc: "Every finding includes the exact steps or commands needed to fix the issue." },
  { Icon: IcoRadio,      title: "Network Discovery",   desc: "Auto-discovers all devices on your subnet using nmap — no manual IP entry." },
  { Icon: IcoBarChart,   title: "Security Score",      desc: "A 0–100 score and A–F grade shows exactly how secure your network is." },
  { Icon: IcoFileDown,   title: "PDF & JSON Export",   desc: "Professional reports you can share with your team or submit for compliance." },
];

const FAQS = [
  { q: "Do I need any technical knowledge to use NetAudit?",        a: "No. The Quick Checklist tab asks you simple yes/no questions about your router settings and explains every issue in plain English. No commands or configs required." },
  { q: "Is my data safe? Does NetAudit store my passwords?",        a: "Your credentials are never stored. They are used only for the single SSH/login session and discarded immediately. Scan results are saved locally by the agent." },
  { q: "What devices can NetAudit scan?",                           a: "Cisco IOS routers and switches, Cisco ASA firewalls, Sky Hub and other home routers, and any generic network device. If it has an SSH interface or web admin panel, NetAudit can reach it." },
  { q: "Why do I need to download the Agent for network scanning?", a: "Your home or office devices have private IP addresses (like 192.168.0.x) not reachable from the internet. The Agent runs on your computer, which is already on your local network, so it can reach them directly." },
  { q: "I don't have a Cisco router. Can I still use NetAudit?",   a: "Yes. Use the Quick Checklist tab — it works for any router brand (TP-Link, Netgear, ASUS, Sky, BT, etc.) through a simple question-and-answer format." },
  { q: "Is NetAudit free?",                                         a: "Yes, completely free. No account required for config upload, file analysis, or the quick checklist. Network scanning requires the free Agent download." },
];

const SAMPLE_FINDINGS = [
  { sev: "CRITICAL", title: "Cleartext enable password",       color: "#ff4444" },
  { sev: "CRITICAL", title: "Telnet enabled on VTY lines",     color: "#ff4444" },
  { sev: "HIGH",     title: "SSH version 2 not enforced",      color: "#ff7700" },
  { sev: "HIGH",     title: "HTTP management server enabled",  color: "#ff7700" },
  { sev: "MEDIUM",   title: "No login / MOTD banner",          color: "#ffaa00" },
  { sev: "LOW",      title: "CDP globally enabled",            color: "#4488ff" },
];

/* ── Nav component (reused) ─────────────────────────────────────────────── */
function Nav() {
  return (
    <nav
      className="nav-glass border-b px-6 py-4 flex items-center justify-between sticky top-0 z-40"
      style={{ borderColor: "var(--border)" }}
    >
      <span
        className="font-bold text-lg tracking-widest select-none"
        style={{ fontFamily: "var(--font-heading)", color: "var(--green)" }}
      >
        NET<span style={{ color: "var(--text)" }}>AUDIT</span>
      </span>
      <div className="flex items-center gap-3">
        <a
          href="#how-it-works"
          className="text-xs hidden md:block px-3 py-1.5 rounded hover:opacity-80"
          style={{ color: "var(--text-muted)" }}
        >
          How it works
        </a>
        <a
          href="#faq"
          className="text-xs hidden md:block px-3 py-1.5 rounded hover:opacity-80"
          style={{ color: "var(--text-muted)" }}
        >
          FAQ
        </a>
        <a
          href={AGENT_URL}
          download
          className="text-xs px-4 py-2 rounded font-semibold hidden sm:block hover:opacity-80"
          style={{
            background: "var(--bg-card)",
            color: "var(--green)",
            border: "1px solid rgba(0,255,136,0.2)",
            fontFamily: "var(--font-heading)",
          }}
        >
          ↓ Download
        </a>
        <Link
          href="/scan"
          className="text-xs px-4 py-2 rounded font-bold tracking-wide hover:opacity-90"
          style={{ background: "var(--green)", color: "#000", fontFamily: "var(--font-heading)" }}
        >
          SCAN NOW →
        </Link>
      </div>
    </nav>
  );
}

/* ── Page ───────────────────────────────────────────────────────────────── */
export default function LandingPage() {
  return (
    <main style={{ background: "var(--bg)", minHeight: "100vh" }}>
      <Nav />

      {/* ── Hero ── */}
      <section
        className="hero-grid max-w-6xl mx-auto px-6 pt-20 pb-20 grid md:grid-cols-2 gap-14 items-center"
        style={{ borderBottom: "1px solid var(--border)" }}
      >
        <div>
          <div
            className="inline-flex items-center gap-2 text-xs px-3 py-1.5 rounded-full mb-8 font-semibold tracking-widest"
            style={{
              background: "rgba(0,255,136,0.06)",
              color: "var(--green)",
              border: "1px solid rgba(0,255,136,0.18)",
              fontFamily: "var(--font-mono)",
            }}
          >
            <span>◆</span> FREE · NO ACCOUNT NEEDED
          </div>
          <h1
            className="text-5xl font-bold leading-[1.1] mb-5"
            style={{ fontFamily: "var(--font-heading)", color: "var(--text)" }}
          >
            Is your network<br />
            <span style={{ color: "var(--green)" }}>actually secure?</span>
          </h1>
          <p className="text-base mb-3 leading-relaxed" style={{ color: "var(--text-2)", maxWidth: 440 }}>
            NetAudit scans your routers, switches, and firewalls for security weaknesses
            — and tells you exactly how to fix them. Plain English. No jargon.
          </p>
          <p className="text-sm mb-10" style={{ color: "var(--text-muted)" }}>
            Works for home routers, Cisco enterprise gear, and everything in between.
          </p>
          <div className="flex flex-wrap gap-3 mb-4">
            <Link
              href="/scan"
              className="px-8 py-3 rounded font-bold tracking-wide text-sm hover:opacity-90"
              style={{ background: "var(--green)", color: "#000", fontFamily: "var(--font-heading)" }}
            >
              START SCANNING →
            </Link>
            <a
              href={AGENT_URL}
              download
              className="px-8 py-3 rounded font-semibold text-sm hover:opacity-80 flex items-center gap-2"
              style={{
                background: "transparent",
                color: "var(--green)",
                border: "1px solid rgba(0,255,136,0.3)",
                fontFamily: "var(--font-heading)",
              }}
            >
              <IcoDownload /> Download Agent
            </a>
          </div>
          <p className="text-xs" style={{ color: "var(--text-dim)", fontFamily: "var(--font-mono)" }}>
            Windows · 67 MB · No wizard · Auto-updates
          </p>
        </div>

        {/* Demo widget */}
        <div
          className="rounded-xl p-5 glow-green"
          style={{ background: "var(--bg-card)", border: "1px solid var(--border-mid)" }}
        >
          {/* Fake window chrome */}
          <div className="flex items-center gap-1.5 mb-5">
            <div className="w-3 h-3 rounded-full" style={{ background: "#ff4444" }} />
            <div className="w-3 h-3 rounded-full" style={{ background: "#ffaa00" }} />
            <div className="w-3 h-3 rounded-full" style={{ background: "#00cc66" }} />
            <span
              className="ml-3 text-xs"
              style={{ color: "var(--text-muted)", fontFamily: "var(--font-mono)" }}
            >
              Router1 — Security Audit
            </span>
          </div>
          <div className="flex justify-center mb-6">
            <ScoreGauge score={28} grade="F" size={150} />
          </div>
          <div className="space-y-1.5">
            {SAMPLE_FINDINGS.map((f, i) => (
              <div
                key={i}
                className="flex items-center gap-3 text-xs py-2 px-3 rounded-md"
                style={{ background: "var(--bg-surface)", border: "1px solid var(--border)" }}
              >
                <span
                  className="font-bold shrink-0 w-16 text-right tracking-widest"
                  style={{ color: f.color, fontFamily: "var(--font-mono)" }}
                >
                  {f.sev}
                </span>
                <span style={{ color: "var(--text-2)" }}>{f.title}</span>
              </div>
            ))}
          </div>
          <p
            className="text-xs text-center mt-4"
            style={{ color: "var(--text-dim)", fontFamily: "var(--font-mono)" }}
          >
            sample report — your results will vary
          </p>
        </div>
      </section>

      {/* ── Who is it for ── */}
      <section className="max-w-6xl mx-auto px-6 py-20">
        <div className="text-center mb-12">
          <p
            className="text-xs font-bold tracking-widest mb-3"
            style={{ color: "var(--text-muted)", fontFamily: "var(--font-mono)" }}
          >
            BUILT FOR EVERYONE
          </p>
          <h2 className="text-3xl font-bold mb-3" style={{ fontFamily: "var(--font-heading)" }}>
            Whether you manage one router<br />or a hundred
          </h2>
          <p className="text-sm" style={{ color: "var(--text-2)", maxWidth: 480, margin: "0 auto" }}>
            NetAudit scales from a home WiFi check to an enterprise subnet audit.
          </p>
        </div>
        <div className="grid sm:grid-cols-3 gap-5">
          {WHO_FOR.map(w => (
            <div
              key={w.label}
              className="p-6 rounded-xl card-hover"
              style={{
                background: "var(--bg-surface)",
                border: `1px solid ${w.color}18`,
              }}
            >
              <div
                className="w-10 h-10 rounded-lg flex items-center justify-center mb-4"
                style={{ background: `${w.color}12`, color: w.color, border: `1px solid ${w.color}22` }}
              >
                <w.Icon />
              </div>
              <h3
                className="font-bold text-base mb-4"
                style={{ color: w.color, fontFamily: "var(--font-heading)" }}
              >
                {w.label}
              </h3>
              <ul className="space-y-2.5">
                {w.points.map((p, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm" style={{ color: "var(--text-2)" }}>
                    <span style={{ color: w.color, marginTop: 2, flexShrink: 0 }}>›</span>
                    {p}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </section>

      {/* ── How it works ── */}
      <section
        id="how-it-works"
        className="max-w-6xl mx-auto px-6 py-20"
        style={{ borderTop: "1px solid var(--border)" }}
      >
        <div className="text-center mb-14">
          <p
            className="text-xs font-bold tracking-widest mb-3"
            style={{ color: "var(--text-muted)", fontFamily: "var(--font-mono)" }}
          >
            HOW IT WORKS
          </p>
          <h2 className="text-3xl font-bold mb-3" style={{ fontFamily: "var(--font-heading)" }}>
            Up and running in under 5 minutes
          </h2>
          <p className="text-sm" style={{ color: "var(--text-2)" }}>No command line required.</p>
        </div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {HOW_IT_WORKS.map((s, i) => (
            <div
              key={i}
              className="relative p-6 rounded-xl card-hover"
              style={{ background: "var(--bg-surface)", border: "1px solid var(--border)" }}
            >
              <div
                className="w-10 h-10 rounded-lg flex items-center justify-center mb-4"
                style={{
                  background: "rgba(0,255,136,0.06)",
                  color: "var(--green)",
                  border: "1px solid rgba(0,255,136,0.15)",
                }}
              >
                <s.Icon />
              </div>
              <div
                className="text-xs font-bold mb-2 tracking-widest"
                style={{ color: "var(--green)", fontFamily: "var(--font-mono)" }}
              >
                STEP {s.step}
              </div>
              <h3
                className="font-bold text-sm mb-2"
                style={{ fontFamily: "var(--font-heading)", color: "var(--text)" }}
              >
                {s.title}
              </h3>
              <p className="text-xs leading-relaxed mb-3" style={{ color: "var(--text-2)" }}>
                {s.desc}
              </p>
              <span
                className="text-xs px-2 py-0.5 rounded"
                style={{
                  background: "var(--bg-card)",
                  color: "var(--text-muted)",
                  border: "1px solid var(--border)",
                  fontFamily: "var(--font-mono)",
                }}
              >
                {s.tag}
              </span>
            </div>
          ))}
        </div>
      </section>

      {/* ── Download CTA ── */}
      <section className="max-w-4xl mx-auto px-6 py-4 pb-20">
        <div
          className="rounded-xl p-8 flex flex-col sm:flex-row items-center justify-between gap-6 glow-green"
          style={{ background: "rgba(0,255,136,0.04)", border: "1px solid rgba(0,255,136,0.18)" }}
        >
          <div>
            <h3
              className="font-bold text-xl mb-1"
              style={{ fontFamily: "var(--font-heading)" }}
            >
              Ready to scan your network?
            </h3>
            <p className="text-sm" style={{ color: "var(--text-2)" }}>
              Download the Agent, double-click it, and you&apos;re scanning in under a minute.
            </p>
            <p
              className="text-xs mt-2"
              style={{ color: "var(--text-muted)", fontFamily: "var(--font-mono)" }}
            >
              Windows · 67 MB · Free · Auto-updates silently
            </p>
          </div>
          <div className="flex flex-col gap-3 shrink-0 items-center">
            <a
              href={AGENT_URL}
              download
              className="px-8 py-3 rounded font-bold text-sm tracking-wide hover:opacity-90 flex items-center gap-2"
              style={{ background: "var(--green)", color: "#000", fontFamily: "var(--font-heading)" }}
            >
              <IcoDownload /> Download Agent
            </a>
            <Link
              href="/scan"
              className="text-xs hover:opacity-80"
              style={{ color: "var(--text-muted)" }}
            >
              Or scan without downloading →
            </Link>
          </div>
        </div>
      </section>

      {/* ── Features ── */}
      <section
        className="max-w-6xl mx-auto px-6 py-20"
        style={{ borderTop: "1px solid var(--border)" }}
      >
        <div className="text-center mb-12">
          <p
            className="text-xs font-bold tracking-widest mb-3"
            style={{ color: "var(--text-muted)", fontFamily: "var(--font-mono)" }}
          >
            WHAT WE CHECK
          </p>
          <h2 className="text-3xl font-bold mb-3" style={{ fontFamily: "var(--font-heading)" }}>
            21+ security checks out of the box
          </h2>
          <p className="text-sm" style={{ color: "var(--text-2)" }}>
            Based on Cisco hardening guides, CIS benchmarks, and real-world pentesting experience.
          </p>
        </div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {FEATURES.map(f => (
            <div
              key={f.title}
              className="p-5 rounded-xl card-hover"
              style={{ background: "var(--bg-surface)", border: "1px solid var(--border)" }}
            >
              <div
                className="w-9 h-9 rounded-lg flex items-center justify-center mb-3"
                style={{
                  background: "rgba(0,255,136,0.06)",
                  color: "var(--green)",
                  border: "1px solid rgba(0,255,136,0.12)",
                }}
              >
                <f.Icon />
              </div>
              <h3
                className="font-bold text-sm mb-1.5"
                style={{ fontFamily: "var(--font-heading)", color: "var(--text)" }}
              >
                {f.title}
              </h3>
              <p className="text-xs leading-relaxed" style={{ color: "var(--text-2)" }}>
                {f.desc}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* ── FAQ ── */}
      <section
        id="faq"
        className="max-w-3xl mx-auto px-6 py-20"
        style={{ borderTop: "1px solid var(--border)" }}
      >
        <div className="text-center mb-12">
          <p
            className="text-xs font-bold tracking-widest mb-3"
            style={{ color: "var(--text-muted)", fontFamily: "var(--font-mono)" }}
          >
            FAQ
          </p>
          <h2 className="text-3xl font-bold" style={{ fontFamily: "var(--font-heading)" }}>
            Frequently asked questions
          </h2>
        </div>
        <div className="space-y-3">
          {FAQS.map((faq, i) => (
            <div
              key={i}
              className="p-5 rounded-xl"
              style={{ background: "var(--bg-surface)", border: "1px solid var(--border)" }}
            >
              <h3
                className="font-semibold text-sm mb-2"
                style={{ color: "var(--text)", fontFamily: "var(--font-heading)" }}
              >
                {faq.q}
              </h3>
              <p className="text-sm leading-relaxed" style={{ color: "var(--text-2)" }}>
                {faq.a}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Final CTA ── */}
      <section
        className="max-w-2xl mx-auto px-6 py-20 text-center"
        style={{ borderTop: "1px solid var(--border)" }}
      >
        <div
          className="rounded-xl p-12 glow-green"
          style={{ background: "rgba(0,255,136,0.04)", border: "1px solid rgba(0,255,136,0.15)" }}
        >
          <h2
            className="text-3xl font-bold mb-3"
            style={{ fontFamily: "var(--font-heading)" }}
          >
            Start your free audit now
          </h2>
          <p className="text-sm mb-8" style={{ color: "var(--text-2)" }}>
            No account. No credit card. No setup. Just results.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link
              href="/scan"
              className="inline-flex items-center justify-center px-10 py-3.5 rounded font-bold tracking-wide text-sm hover:opacity-90"
              style={{ background: "var(--green)", color: "#000", fontFamily: "var(--font-heading)" }}
            >
              ANALYZE A CONFIG →
            </Link>
            <a
              href={AGENT_URL}
              download
              className="inline-flex items-center justify-center gap-2 px-10 py-3.5 rounded font-semibold text-sm hover:opacity-80"
              style={{
                background: "transparent",
                color: "var(--green)",
                border: "1px solid rgba(0,255,136,0.3)",
                fontFamily: "var(--font-heading)",
              }}
            >
              <IcoDownload /> Download Agent
            </a>
          </div>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer
        className="border-t px-6 py-8"
        style={{ borderColor: "var(--border)" }}
      >
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <span
            className="font-bold tracking-widest"
            style={{ fontFamily: "var(--font-heading)", color: "var(--green)" }}
          >
            NET<span style={{ color: "var(--text)" }}>AUDIT</span>
          </span>
          <div className="flex gap-6 text-xs" style={{ color: "var(--text-muted)" }}>
            <a href="#how-it-works" className="hover:opacity-80" style={{ color: "var(--text-muted)" }}>How it works</a>
            <a href="#faq" className="hover:opacity-80" style={{ color: "var(--text-muted)" }}>FAQ</a>
            <Link href="/scan" className="hover:opacity-80" style={{ color: "var(--text-muted)" }}>Scan</Link>
            <Link href="/history" className="hover:opacity-80" style={{ color: "var(--text-muted)" }}>History</Link>
            <a href={AGENT_URL} download className="hover:opacity-80" style={{ color: "var(--text-muted)" }}>Download</a>
          </div>
          <p className="text-xs" style={{ color: "var(--text-dim)", fontFamily: "var(--font-mono)" }}>
            For authorised security testing only.
          </p>
        </div>
      </footer>
    </main>
  );
}
