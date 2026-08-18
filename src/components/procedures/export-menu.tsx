"use client";

import { FileDown, FileText, FileSpreadsheet, FileType2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

/** Downloads go through a plain <a href> to the export route — the browser sends the session cookie on same-origin navigation, no fetch/blob dance needed. */
export function ExportMenu({ procedureId }: { procedureId: string }) {
  const base = `/api/procedures/${procedureId}/export`;
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline">
          <FileDown className="h-4 w-4" /> Esporta
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem asChild>
          <a href={`${base}?format=pdf`} className="flex items-center gap-2">
            <FileText className="h-4 w-4 text-muted-foreground" /> PDF
          </a>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <a href={`${base}?format=docx`} className="flex items-center gap-2">
            <FileType2 className="h-4 w-4 text-muted-foreground" /> Word (.docx)
          </a>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <a href={`${base}?format=xlsx`} className="flex items-center gap-2">
            <FileSpreadsheet className="h-4 w-4 text-muted-foreground" /> Excel (.xlsx)
          </a>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
