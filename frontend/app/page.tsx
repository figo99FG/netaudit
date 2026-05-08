import Link from "next/link";
import ScoreGauge from "@/components/ScoreGauge";

const FEATURES = [
  {
    icon: "⚡",
    title: "Instant Analysis",
    desc: "Paste a running-config and get a full security audit in under a second.",
  },
  {
    icon: "🔍",
    title: "21+ Security Checks",
    desc: "Cisco IOS, ASA, and generic rules covering authentication, encryption, SNMP, SSH, ACLs, and more.",
  },
  {
    icon: "🛠️",
    title: "Actionable Fixes",
    desc: "Every finding includes the exact config commands needed to remediate the issue.",
  },
  {
    icon: "🌐",
    title: "Live SSH Scan",
    desc: "Connect directly to a device over SSH to pull and audit its running config live.",
  },
  {
    icon: "📊",
    title: "Security Score",
    desc: "A 0–100 score and A–F grade tells you exactly how hardened your device is.",
  },
  {
    icon: "📤",
    title: "Export Reports",
    desc: "Download findings as JSON for integration with your existing security tooling.",
  },
];

const SAMPLE_FINDINGS = [
  { sev: "CRITICAL", title: "Cleartext enable password", color: "#ff4444" },
  { sev: "CRITICAL", title: "Telnet enabled on VTY lines", color: "#ff4444" },
  { sev: "CRITICAL", title: "Default SNMP community 'public'", color: "#ff4444" },
  { sev: "HIGH", title: "SSH version 2 not enforced", color: "#ff7700" },
  { sev: "HIGH", title: "HTTP management server enabled", color: "#ff7700" },
  { sev: "MEDIUM", title: "No login/MOTD banner", color: "#ffaa00" },
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
        <div className="flex items-center gap-4">
          <span className="text-xs hidden sm:block" style={{ color: "#4a5568" }}>NETWORK CONFIG SECURITY ANALYZER</span>
          <Link
            href="/scan"
            className="text-xs px-4 py-2 rounded font-bold tracking-widest transition-all"
            style={{ background: "var(--green)", color: "#000" }}
          >
            SCAN NOW
          </Link>
        </div>
      </nav>

      {/* Hero */}
      <section className="max-w-6xl mx-auto px-6 pt-20 pb-16 grid md:grid-cols-2 gap-12 items-center">
        <div>
          <div className="inline-block text-xs px-3 py-1 rounded-full mb-6 font-bold tracking-widest"
            style={{ background: "#00ff8811", color: "var(--green)", border: "1px solid #00ff8833" }}>
            BUILT FOR PENTESTERS & NETWORK ENGINEERS
          </div>
          <h1 className="text-4xl font-bold leading-tight mb-4">
            Audit your network configs<br />
            <span style={{ color: "var(--green)" }}>in seconds.</span>
          </h1>
          <p className="text-base mb-8 leading-relaxed" style={{ color: "#718096" }}>
            Paste a Cisco running-config and instantly see every security misconfiguration,
            rated by severity with exact remediation commands. Get a score out of 100.
          </p>
          <div className="flex flex-wrap gap-4">
            <Link
              href="/scan"
              className="px-8 py-3 rounded font-bold tracking-widest text-sm transition-all"
              style={{ background: "var(--green)", color: "#000" }}
            >
              START SCANNING →
            </Link>
          </div>
        </div>

        {/* Demo widget */}
        <div className="rounded-xl p-6" style={{ background: "#141414", border: "1px solid #2a2a2a" }}>
          <div className="flex items-center gap-2 mb-4">
            <div className="w-3 h-3 rounded-full" style={{ background: "#ff4444" }} />
            <div className="w-3 h-3 rounded-full" style={{ background: "#ffaa00" }} />
            <div className="w-3 h-3 rounded-full" style={{ background: "#00ff88" }} />
            <span className="ml-2 text-xs" style={{ color: "#4a5568" }}>Router1.cfg</span>
          </div>
          <div className="flex justify-center mb-6">
            <ScoreGauge score={28} grade="F" size={160} />
          </div>
          <div className="space-y-2">
            {SAMPLE_FINDINGS.map((f, i) => (
              <div key={i} className="flex items-center gap-3 text-xs py-2 px-3 rounded"
                style={{ background: "#0d0d0d", border: "1px solid #1a1a1a" }}>
                <span className="font-bold shrink-0" style={{ color: f.color }}>{f.sev}</span>
                <span style={{ color: "#a0aec0" }}>{f.title}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="max-w-6xl mx-auto px-6 py-16">
        <h2 className="text-xl font-bold mb-2 text-center tracking-wide">Everything a pentester needs</h2>
        <p className="text-sm text-center mb-10" style={{ color: "#718096" }}>
          Built on real Cisco hardening guides and CIS benchmarks.
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

      {/* CTA */}
      <section className="max-w-2xl mx-auto px-6 py-16 text-center">
        <div className="rounded-xl p-10" style={{ background: "#00ff8808", border: "1px solid #00ff8822" }}>
          <h2 className="text-2xl font-bold mb-3">Ready to audit your network?</h2>
          <p className="text-sm mb-6" style={{ color: "#718096" }}>
            No account required. Paste a config and go.
          </p>
          <Link
            href="/scan"
            className="inline-block px-10 py-4 rounded font-bold tracking-widest text-sm"
            style={{ background: "var(--green)", color: "#000" }}
          >
            ANALYZE A CONFIG →
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t px-6 py-6 text-center" style={{ borderColor: "#2a2a2a" }}>
        <p className="text-xs" style={{ color: "#4a5568" }}>
          NetAudit — for authorised security testing only. Always obtain written permission before scanning devices you do not own.
        </p>
      </footer>
    </main>
  );
}
