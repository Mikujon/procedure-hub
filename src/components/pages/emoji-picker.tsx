"use client";

import { useEffect, useRef, useState } from "react";

const EMOJIS = [
  "📄", "📝", "📋", "📌", "📎", "🗂️", "📁", "📚", "📖", "🔖",
  "✅", "☑️", "🎯", "🚀", "💡", "🔥", "⭐", "❤️", "⚙️", "🔧",
  "🔒", "🛡️", "⚖️", "🧭", "🗺️", "📊", "📈", "💰", "🧾", "🏢",
  "👥", "👤", "🤝", "💬", "📣", "🔔", "📅", "⏰", "🌍", "✈️",
  "🧠", "🎓", "🏆", "🎨", "🍿", "☕", "🌱", "🧪", "🔬", "💻",
];

export function EmojiPicker({
  current,
  onSelect,
  onClose,
}: {
  current?: string | null;
  onSelect: (emoji: string | null) => void;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [q, setQ] = useState("");

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [onClose]);

  return (
    <div ref={ref} className="absolute z-50 mt-1 w-64 rounded-lg border border-border bg-card p-2 shadow-xl">
      <div className="mb-2 flex items-center justify-between">
        <button
          onClick={() => onSelect(EMOJIS[Math.floor(Math.random() * EMOJIS.length)])}
          className="rounded-md px-2 py-1 text-xs text-muted-foreground hover:bg-muted"
        >
          Casuale
        </button>
        {current && (
          <button onClick={() => onSelect(null)} className="rounded-md px-2 py-1 text-xs text-muted-foreground hover:bg-muted">
            Rimuovi
          </button>
        )}
      </div>
      <div className="grid grid-cols-8 gap-0.5">
        {EMOJIS.map((e) => (
          <button
            key={e}
            onClick={() => onSelect(e)}
            className="flex h-7 w-7 items-center justify-center rounded-md text-lg hover:bg-muted"
          >
            {e}
          </button>
        ))}
      </div>
    </div>
  );
}
