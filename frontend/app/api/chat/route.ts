import { NextRequest, NextResponse } from "next/server";

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY ?? "";

export async function POST(req: NextRequest) {
  if (!ANTHROPIC_API_KEY) {
    return NextResponse.json({ error: "AI not configured on server" }, { status: 503 });
  }

  try {
    const { message, history, findings_summary, hostname, device_type, score, grade } = await req.json();

    if (!message?.trim()) {
      return NextResponse.json({ error: "message is empty" }, { status: 400 });
    }

    const system = `You are a network security assistant. The user scanned their network device and got these results:

Device: ${device_type || "unknown"} | Hostname: ${hostname || "unknown"} | Score: ${score}/100 (Grade ${grade})

Findings:
${findings_summary || "No findings available."}

Answer their questions about this scan concisely and practically.
If asked how to fix something, give exact config commands.
If asked why the score is low, explain based on the findings above.
Keep responses short and to the point.`;

    const Anthropic = (await import("@anthropic-ai/sdk")).default;
    const client = new Anthropic({ apiKey: ANTHROPIC_API_KEY });

    const messages = [
      ...(history || []).slice(-10),
      { role: "user" as const, content: message },
    ];

    const msg = await client.messages.create({
      model: "claude-haiku-4-5",
      max_tokens: 1024,
      system,
      messages,
    });

    return NextResponse.json({
      reply: (msg.content[0] as { text: string }).text.trim(),
    });
  } catch (e) {
    console.error("[chat]", e);
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
