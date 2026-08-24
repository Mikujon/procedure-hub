"use client";

import { useEffect, useRef, useState } from "react";
import { MessageSquare, Send, Trash2, Loader2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

interface CommentAuthor {
  id: string;
  name: string;
  avatarUrl: string | null;
}

interface CommentData {
  id: string;
  body: string;
  createdAt: string;
  author: CommentAuthor;
  replies: Omit<CommentData, "replies">[];
}

interface MentionableUser {
  id: string;
  name: string;
  avatarUrl: string | null;
}

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "adesso";
  if (m < 60) return `${m} min fa`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} h fa`;
  const d = Math.floor(h / 24);
  return `${d} g fa`;
}

function initials(name: string) {
  return name.slice(0, 2).toUpperCase();
}

/**
 * Thread of top-level comments + one level of flat replies under a
 * procedure — Comment/replies already came from the API fully loaded
 * (lib/permissions already gated who can see this page), this component is
 * purely presentational + the post/delete actions.
 */
export function CommentThread({
  procedureId,
  currentUserId,
  isAdmin,
  comments: initialComments,
}: {
  procedureId: string;
  currentUserId: string;
  isAdmin: boolean;
  comments: CommentData[];
}) {
  const [comments, setComments] = useState(initialComments);
  const count = comments.reduce((n, c) => n + 1 + c.replies.length, 0);

  async function post(body: string, mentionedUserIds: string[], parentId?: string): Promise<boolean> {
    const res = await fetch(`/api/procedures/${procedureId}/comments`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ body, parentId, mentionedUserIds }),
    });
    if (!res.ok) return false;
    const { comment } = await res.json();
    setComments((prev) =>
      parentId
        ? prev.map((c) => (c.id === parentId ? { ...c, replies: [...c.replies, comment] } : c))
        : [{ ...comment, replies: [] }, ...prev]
    );
    return true;
  }

  async function remove(id: string, parentId?: string) {
    const res = await fetch(`/api/comments/${id}`, { method: "DELETE" });
    if (!res.ok) return;
    setComments((prev) =>
      parentId
        ? prev.map((c) => (c.id === parentId ? { ...c, replies: c.replies.filter((r) => r.id !== id) } : c))
        : prev.filter((c) => c.id !== id)
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-sm">
          <MessageSquare className="h-4 w-4" /> Commenti {count > 0 && `(${count})`}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-5 pt-0">
        <CommentForm onSubmit={(body, mentions) => post(body, mentions)} placeholder="Scrivi un commento… ('@' per menzionare qualcuno)" />

        {comments.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nessun commento ancora — sii il primo.</p>
        ) : (
          <ul className="space-y-4">
            {comments.map((c, i) => (
              <li key={c.id} className="opacity-0 animate-rise space-y-3" style={{ animationDelay: `${Math.min(i, 10) * 50}ms` }}>
                <CommentRow
                  comment={c}
                  canDelete={c.author.id === currentUserId || isAdmin}
                  onDelete={() => remove(c.id)}
                  onReply={(body, mentions) => post(body, mentions, c.id)}
                />
                {c.replies.length > 0 && (
                  <ul className="ml-11 space-y-3 border-l border-border pl-4">
                    {c.replies.map((r) => (
                      <li key={r.id}>
                        <CommentRow
                          comment={r}
                          canDelete={r.author.id === currentUserId || isAdmin}
                          onDelete={() => remove(r.id, c.id)}
                        />
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

function CommentRow({
  comment,
  canDelete,
  onDelete,
  onReply,
}: {
  comment: Omit<CommentData, "replies">;
  canDelete: boolean;
  onDelete: () => void;
  onReply?: (body: string, mentionedUserIds: string[]) => Promise<boolean>;
}) {
  const [replying, setReplying] = useState(false);

  return (
    <div className="flex gap-3">
      <Avatar className="h-8 w-8 shrink-0">
        <AvatarFallback className="bg-primary text-primary-foreground">{initials(comment.author.name)}</AvatarFallback>
      </Avatar>
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline gap-2">
          <span className="text-sm font-medium">{comment.author.name}</span>
          <span className="text-xs text-muted-foreground">{timeAgo(comment.createdAt)}</span>
        </div>
        <p className="mt-0.5 whitespace-pre-wrap text-sm text-foreground">{comment.body}</p>
        <div className="mt-1 flex items-center gap-3 text-xs text-muted-foreground">
          {onReply && (
            <button onClick={() => setReplying((r) => !r)} className="hover:text-foreground">
              Rispondi
            </button>
          )}
          {canDelete && (
            <button onClick={onDelete} className="flex items-center gap-1 hover:text-destructive">
              <Trash2 className="h-3 w-3" /> Elimina
            </button>
          )}
        </div>
        {replying && onReply && (
          <div className="mt-2">
            <CommentForm
              placeholder="Scrivi una risposta… ('@' per menzionare qualcuno)"
              autoFocus
              small
              onSubmit={async (body, mentions) => {
                const ok = await onReply(body, mentions);
                if (ok) setReplying(false);
                return ok;
              }}
            />
          </div>
        )}
      </div>
    </div>
  );
}

/** Text before the cursor ends with an in-progress "@partial" mention token, or null if not currently in one. */
function activeMentionQuery(text: string, cursor: number): string | null {
  const before = text.slice(0, cursor);
  const match = before.match(/(?:^|\s)@([^\s@]{0,30})$/);
  return match ? match[1] : null;
}

function CommentForm({
  onSubmit,
  placeholder,
  autoFocus,
  small,
}: {
  onSubmit: (body: string, mentionedUserIds: string[]) => Promise<boolean>;
  placeholder: string;
  autoFocus?: boolean;
  small?: boolean;
}) {
  const [value, setValue] = useState("");
  const [sending, setSending] = useState(false);
  // Tracks every user picked from the @mention dropdown for this draft, so
  // submit doesn't need to re-parse "@Name" back out of free text (fragile —
  // two colleagues can share a first name) — the client already knows
  // exactly who was selected.
  const [mentions, setMentions] = useState<Map<string, string>>(new Map());
  const [mentionQuery, setMentionQuery] = useState<string | null>(null);
  const [mentionResults, setMentionResults] = useState<MentionableUser[]>([]);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    if (mentionQuery === null) {
      setMentionResults([]);
      return;
    }
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      fetch(`/api/users?q=${encodeURIComponent(mentionQuery)}`)
        .then((r) => r.json())
        .then((data) => setMentionResults(data.users ?? []))
        .catch(() => setMentionResults([]));
    }, 150);
    return () => clearTimeout(debounceRef.current);
  }, [mentionQuery]);

  function handleChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
    const next = e.target.value;
    setValue(next);
    setMentionQuery(activeMentionQuery(next, e.target.selectionStart));
  }

  function pickMention(user: MentionableUser) {
    const el = textareaRef.current;
    const cursor = el?.selectionStart ?? value.length;
    const before = value.slice(0, cursor);
    const after = value.slice(cursor);
    const match = before.match(/(?:^|\s)@([^\s@]{0,30})$/);
    if (!match) return;
    const start = before.length - match[0].length + (match[0].startsWith(" ") ? 1 : 0);
    const inserted = `@${user.name} `;
    const newValue = value.slice(0, start) + inserted + after;
    setValue(newValue);
    setMentions((m) => new Map(m).set(user.id, user.name));
    setMentionQuery(null);
    requestAnimationFrame(() => {
      el?.focus();
      const pos = start + inserted.length;
      el?.setSelectionRange(pos, pos);
    });
  }

  async function submit() {
    const body = value.trim();
    if (!body || sending) return;
    setSending(true);
    // Drop any mention whose "@Name" text no longer appears in the draft
    // (the user deleted or edited it after picking it from the dropdown).
    const mentionedUserIds = Array.from(mentions.entries())
      .filter(([, name]) => value.includes(`@${name}`))
      .map(([id]) => id);
    const ok = await onSubmit(body, mentionedUserIds);
    setSending(false);
    if (ok) {
      setValue("");
      setMentions(new Map());
    }
  }

  return (
    <div className="relative">
      <div className={cn("flex items-start gap-2", small && "gap-1.5")}>
        <Textarea
          ref={textareaRef}
          value={value}
          onChange={handleChange}
          onKeyDown={(e) => {
            if (e.key === "Escape" && mentionQuery !== null) {
              setMentionQuery(null);
              return;
            }
            if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
              e.preventDefault();
              submit();
            }
          }}
          onBlur={() => setTimeout(() => setMentionQuery(null), 150)}
          placeholder={placeholder}
          autoFocus={autoFocus}
          rows={small ? 1 : 2}
          className={cn("resize-none text-sm", small && "min-h-0 py-1.5")}
        />
        <Button onClick={submit} disabled={!value.trim() || sending} size="icon" className="shrink-0">
          {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
        </Button>
      </div>

      {mentionQuery !== null && mentionResults.length > 0 && (
        <div className="absolute left-0 top-full z-50 mt-1 w-56 rounded-lg border border-border bg-card p-1 shadow-xl">
          {mentionResults.map((u) => (
            <button
              key={u.id}
              onMouseDown={(e) => e.preventDefault()} // keep textarea focus so onBlur doesn't close the dropdown first
              onClick={() => pickMention(u)}
              className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-sm hover:bg-muted"
            >
              <Avatar className="h-5 w-5 shrink-0">
                <AvatarFallback className="bg-primary text-[10px] text-primary-foreground">{initials(u.name)}</AvatarFallback>
              </Avatar>
              {u.name}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
