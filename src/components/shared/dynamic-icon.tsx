"use client";

import {
  Users,
  Settings2,
  Server,
  Scale,
  Landmark,
  CalendarClock,
  FileText,
  ShieldCheck,
  FolderKanban,
  Layers,
  type LucideIcon,
} from "lucide-react";

// Registry of icons referenced by name in the data.
const REGISTRY: Record<string, LucideIcon> = {
  Users,
  Settings2,
  Server,
  Scale,
  Landmark,
  CalendarClock,
  FileText,
  ShieldCheck,
  FolderKanban,
  Layers,
};

export function DynamicIcon({
  name,
  className,
  style,
}: {
  name: string;
  className?: string;
  style?: React.CSSProperties;
}) {
  const Icon = REGISTRY[name] ?? FileText;
  return <Icon className={className} style={style} aria-hidden />;
}
