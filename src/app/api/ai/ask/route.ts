import { NextResponse } from "next/server";
import ZAI from "z-ai-web-dev-sdk";
import { db } from "@/lib/db";
import { getTenantContext } from "@/lib/session";
import { serializeForContext, AI_SYSTEM_PROMPT } from "@/lib/ai/context";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

interface ChatMsg {
  role: "user" | "assistant";
  content: string;
}

export async function POST(req: Request) {
  const ctx = await getTenantContext();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { tenantId } = ctx;

  const body = await req.json().catch(() => ({}));
  const procedureId: string | undefined = body.procedureId;
  const question: string | undefined = body.question;
  const history: ChatMsg[] = Array.isArray(body.history) ? body.history : [];

  if (!question || !question.trim())
    return NextResponse.json({ error: "Question is required" }, { status: 400 });
  if (!procedureId)
    return NextResponse.json({ error: "procedureId is required" }, { status: 400 });

  const procedure = await db.procedure.findUnique({
    where: { id: procedureId },
    include: { department: true },
  });
  if (!procedure || procedure.tenantId !== tenantId)
    return NextResponse.json({ error: "Not found" }, { status: 404 });

  const blocks = safeParse(procedure.content, []);
  const { context, sources } = serializeForContext(
    procedure.title,
    procedure.code,
    procedure.summary,
    blocks
  );

  // Build the message list: system + context + history + new question
  const messages: { role: "assistant" | "user"; content: string }[] = [
    { role: "assistant", content: AI_SYSTEM_PROMPT },
    { role: "assistant", content: `PROCEDURE CONTEXT (use ONLY this):\n\n${context}` },
    ...history.slice(-6).map((h) => ({ role: h.role, content: h.content })),
    { role: "user", content: question },
  ];

  try {
    const zai = await ZAI.create();
    const completion = await zai.chat.completions.create({
      messages,
      thinking: { type: "disabled" },
    });
    const answer = completion.choices?.[0]?.message?.content?.trim() ?? "";

    // Extract cited [n] indices from the answer
    const cited = Array.from(answer.matchAll(/\[(\d+)\]/g)).map((m) => Number(m[1]));
    const uniqueCited = Array.from(new Set(cited)).filter((n) =>
      sources.some((s) => s.index === n)
    );
    const citations = uniqueCited.map((n) => {
      const s = sources.find((x) => x.index === n)!;
      return { index: s.index, label: s.label, snippet: s.text.slice(0, 140) };
    });

    return NextResponse.json({ answer, citations });
  } catch (e: any) {
    console.error("[ai/ask] LLM error:", e);
    return NextResponse.json(
      { error: "The assistant is unavailable right now.", detail: String(e?.message ?? e) },
      { status: 502 }
    );
  }
}

function safeParse<T>(s: string | null | undefined, fallback: T): T {
  if (!s) return fallback;
  try {
    return JSON.parse(s) as T;
  } catch {
    return fallback;
  }
}
