"use client";

import { cn } from "@/lib/utils";
import { initials } from "@/lib/domain";

export function UserAvatar({
  name,
  color,
  size = "md",
  className,
}: {
  name: string;
  color: string;
  size?: "xs" | "sm" | "md" | "lg";
  className?: string;
}) {
  const sizes = {
    xs: "h-5 w-5 text-[10px]",
    sm: "h-6 w-6 text-[11px]",
    md: "h-8 w-8 text-xs",
    lg: "h-10 w-10 text-sm",
  };
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-full font-semibold text-white ring-1 ring-inset ring-white/20 select-none",
        sizes[size],
        className
      )}
      style={{ backgroundColor: color }}
      title={name}
    >
      {initials(name)}
    </span>
  );
}
