import { NextRequest, NextResponse } from "next/server";

// Key is server-side only — never exposed to the browser
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY ?? "";

const PROMPT = (
  hostname: string,
  deviceType: string,
  score: number,
  grade: string,
  findingsText: string,
) => `You are a network security expert reviewing automated scan results.

DEVICE: ${deviceType} | Hostname: ${hostname || "unknown"} | Score: ${score}/100 (Grade ${grade})

FINDINGS:
${findingsText}

Your tasks:
1. Write a 2-3 sentence executive_summary in plain English. Lead with the single biggest risk and what it means in practice. Be specific — use the hostname and device type.
2. Create an action_plan of up to 5 items ordered by impact. For each: what to do, why it matters, and effort (low/medium/high).
3. For each finding rule_id, write a tailored_remediation — make it practical and copy-paste ready.

Return ONLY valid JSON, no markdown:
{
  "executive_summary": "...",
  "action_plan": [
    {"priority": 1, "title": "...", "why": "...", "effort": "low"}
  ],
  "tailored_remediations": {
    "RULE-ID": "exact steps to fix this"
  }
}`;

export async function POST(req: NextRequest) {
  if (!ANTHROPIC_API_KEY) {
    return NextResponse.json({ error: "AI not configured on server" }, { status: 503 });
  }

  try {
    const { hostname, device_type, score, grade, findings } = await req.json();

    const findingsText = (findings as { severity: string; rule_id: string; title: string; description: string }[])
      .map(f => `[${f.severity.toUpperCase()}] ${f.rule_id} — ${f.title}: ${f.description}`)
      .join("\n") || "No findings.";

    const Anthropic = (await import("@anthropic-ai/sdk")).default;
    const client = new Anthropic({ apiKey: ANTHROPIC_API_KEY });

    const msg = await client.messages.create({
      model: "claude-haiku-4-5",
      max_tokens: 2048,
      messages: [{
        role: "user",
        content: PROMPT(hostname, device_type, score, grade, findingsText),
      }],
    });

    let raw = (msg.content[0] as { text: string }).text.trim();
    raw = raw.replace(/^```json\s*/, "").replace(/\s*```$/, "");
    const data = JSON.parse(raw);

    return NextResponse.json(data);
  } catch (e) {
    console.error("[enrich]", e);
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
