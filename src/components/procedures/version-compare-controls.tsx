"use client";

import { useRouter } from "next/navigation";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { formatDate } from "@/lib/utils";

interface VersionOption {
  versionNumber: number;
  createdAt: string;
  authorName: string;
}

export function VersionCompareControls({
  procedureId,
  versions,
  fromVersion,
  toVersion,
}: {
  procedureId: string;
  versions: VersionOption[];
  fromVersion: number;
  toVersion: number;
}) {
  const router = useRouter();

  function navigate(next: { from?: number; to?: number }) {
    const params = new URLSearchParams({
      from: String(next.from ?? fromVersion),
      to: String(next.to ?? toVersion),
    });
    router.push(`/procedures/${procedureId}/versions/compare?${params.toString()}`);
  }

  return (
    <div className="flex flex-wrap items-center gap-3 rounded-lg border border-border bg-muted/30 px-4 py-3">
      <VersionSelect label="Da" versions={versions} value={fromVersion} onChange={(v) => navigate({ from: v })} />
      <span className="text-muted-foreground">→</span>
      <VersionSelect label="A" versions={versions} value={toVersion} onChange={(v) => navigate({ to: v })} />
    </div>
  );
}

function VersionSelect({
  label,
  versions,
  value,
  onChange,
}: {
  label: string;
  versions: VersionOption[];
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      <Select value={String(value)} onValueChange={(v) => onChange(Number(v))}>
        <SelectTrigger className="h-8 w-[240px] text-xs">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {versions.map((v) => (
            <SelectItem key={v.versionNumber} value={String(v.versionNumber)}>
              v{v.versionNumber} — {formatDate(v.createdAt)} · {v.authorName}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
