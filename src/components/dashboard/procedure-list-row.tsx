import Link from "next/link";
import { StatusStamp } from "@/components/procedures/status-stamp";
import { formatDate } from "@/lib/utils";

interface ProcedureListRowProps {
  id: string;
  title: string;
  code?: string;
  departmentName?: string;
  status?: string;
  /** Right-aligned secondary line — e.g. "Revisione entro …" replaces the default code/department/date meta. */
  meta?: React.ReactNode;
  date?: Date | null;
  /** Position within its list — staggers the entrance animation so rows rise in sequence instead of all at once. */
  index?: number;
}

/** One row of a dashboard procedure list — shared by "Aggiornate di recente", "Procedure per il tuo ruolo", and any future list that needs the same title/meta/status layout. */
export function ProcedureListRow({ id, title, code, departmentName, status, meta, date, index = 0 }: ProcedureListRowProps) {
  return (
    <Link
      href={`/procedures/${id}`}
      className="flex items-center justify-between gap-4 px-4 py-3 opacity-0 hover:bg-muted animate-rise"
      style={{ animationDelay: `${index * 60}ms` }}
    >
      <div className="min-w-0">
        <p className="truncate text-sm font-medium">{title}</p>
        <p className="truncate text-xs text-muted-foreground">
          {meta ?? (
            <span className="font-mono">
              {code} · {departmentName} · {date ? formatDate(date) : "—"}
            </span>
          )}
        </p>
      </div>
      {status && <StatusStamp status={status} className="shrink-0" />}
    </Link>
  );
}
