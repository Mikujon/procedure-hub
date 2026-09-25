"use client";

import * as React from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Sparkles,
  Send,
  Loader2,
  Quote,
  X,
  MessageSquare,
  ShieldCheck,
} from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";

interface Citation {
  index: number;
  label: string;
  snippet: string;
}
interface Msg {
  role: "user" | "assistant";
  content: string;
  citations?: Citation[];
}

const SUGGESTIONS = [
  "What is the purpose of this procedure?",
  "What are the key steps?",
  "Who is responsible and when?",
  "What are the compliance requirements?",
];

export function AskPanel({
  open,
  onOpenChange,
  procedureId,
  procedureCode,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  procedureId: string | null;
  procedureCode: string;
}) {
  const [messages, setMessages] = React.useState<Msg[]>([]);
  const [input, setInput] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const scrollRef = React.useRef<HTMLDivElement>(null);

  // reset when switching procedures
  React.useEffect(() => {
    setMessages([]);
    setInput("");
  }, [procedureId]);

  React.useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, loading]);

  const ask = async (question: string) => {
    if (!question.trim() || loading || !procedureId) return;
    const userMsg: Msg = { role: "user", content: question.trim() };
    const history = messages.map((m) => ({ role: m.role, content: m.content }));
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setLoading(true);
    try {
      const res = await fetch("/api/ai/ask", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ procedureId, question: question.trim(), history }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed");
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: data.answer, citations: data.citations ?? [] },
      ]);
    } catch (e: any) {
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: `I couldn't reach the assistant right now. ${e.message ?? ""}`,
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-md p-0 flex flex-col">
        <SheetHeader className="border-b border-border px-4 py-3">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Sparkles className="h-4 w-4" />
            </div>
            <div className="min-w-0">
              <SheetTitle className="text-sm font-medium">Ask AI</SheetTitle>
              <p className="text-[11px] text-muted-foreground truncate">
                Grounded on <span className="font-mono">{procedureCode}</span>
              </p>
            </div>
          </div>
        </SheetHeader>

        {/* messages */}
        <ScrollArea className="flex-1" ref={scrollRef as any}>
          <div className="space-y-4 p-4" ref={scrollRef}>
            {messages.length === 0 && (
              <div className="flex flex-col items-center gap-3 py-8 text-center">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
                  <Sparkles className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-sm font-medium">Ask anything about this procedure</p>
                  <p className="mt-1 text-xs text-muted-foreground max-w-xs">
                    Answers are grounded in this procedure&apos;s content, with inline
                    citations. The assistant won&apos;t invent information.
                  </p>
                </div>
                <div className="mt-2 flex w-full flex-col gap-1.5">
                  {SUGGESTIONS.map((s) => (
                    <button
                      key={s}
                      onClick={() => ask(s)}
                      className="rounded-lg border border-border bg-card px-3 py-2 text-left text-sm text-foreground/80 transition-colors hover:border-primary/40 hover:bg-muted/40"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <AnimatePresence initial={false}>
              {messages.map((m, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={cn(
                    "flex",
                    m.role === "user" ? "justify-end" : "justify-start"
                  )}
                >
                  <div
                    className={cn(
                      "max-w-[85%] rounded-2xl px-3.5 py-2 text-sm",
                      m.role === "user"
                        ? "bg-primary text-primary-foreground rounded-br-md"
                        : "bg-muted text-foreground rounded-bl-md"
                    )}
                  >
                    {m.role === "assistant" && (
                      <div className="mb-1 flex items-center gap-1.5 text-[11px] font-medium text-primary">
                        <Sparkles className="h-3 w-3" />
                        Assistant
                      </div>
                    )}
                    <p className="whitespace-pre-wrap leading-relaxed">{m.content}</p>
                    {m.citations && m.citations.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {m.citations.map((c) => (
                          <span
                            key={c.index}
                            title={c.snippet}
                            className="inline-flex items-center gap-1 rounded-md bg-background/60 px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground"
                          >
                            <Quote className="h-2.5 w-2.5" />
                            [{c.index}] {c.label}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>

            {loading && (
              <div className="flex justify-start">
                <div className="flex items-center gap-2 rounded-2xl rounded-bl-md bg-muted px-3.5 py-2.5 text-sm text-muted-foreground">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  <span className="flex gap-0.5">
                    <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-current [animation-delay:-0.3s]" />
                    <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-current [animation-delay:-0.15s]" />
                    <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-current" />
                  </span>
                </div>
              </div>
            )}
          </div>
        </ScrollArea>

        {/* input */}
        <div className="border-t border-border p-3">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              ask(input);
            }}
            className="flex items-end gap-2"
          >
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  ask(input);
                }
              }}
              rows={1}
              placeholder="Ask about this procedure…"
              className="max-h-32 flex-1 resize-none rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring/40"
            />
            <button
              type="submit"
              disabled={loading || !input.trim()}
              className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-primary-foreground transition-all hover:brightness-105 disabled:opacity-50"
            >
              <Send className="h-4 w-4" />
            </button>
          </form>
          <p className="mt-2 flex items-center gap-1 text-[10px] text-muted-foreground">
            <ShieldCheck className="h-3 w-3" />
            Grounded on this procedure&apos;s content. Verify critical actions before acting.
          </p>
        </div>
      </SheetContent>
    </Sheet>
  );
}
