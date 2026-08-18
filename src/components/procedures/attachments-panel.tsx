"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { FileText, Paperclip, Trash2, Loader2, Upload } from "lucide-react";
import { formatBytes } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

interface AttachmentRow {
  id: string;
  fileName: string;
  fileSizeBytes: number;
}

/**
 * Read-only list + (if canEdit) upload/delete for a procedure's Attachments
 * (roadmap item #1). Upload goes through the presigned-URL flow: POST
 * /api/attachments creates the row and returns a short-lived PUT URL, then
 * the file bytes go straight from the browser to object storage — this
 * component never sends the file through our own server.
 */
export function AttachmentsPanel({
  procedureId,
  initialAttachments,
  canEdit,
}: {
  procedureId: string;
  initialAttachments: AttachmentRow[];
  canEdit: boolean;
}) {
  const router = useRouter();
  const [attachments, setAttachments] = useState(initialAttachments);
  const [uploading, setUploading] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  if (!canEdit && attachments.length === 0) return null;

  async function handleFile(file: File) {
    setUploading(true);
    try {
      const res = await fetch("/api/attachments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ procedureId, fileName: file.name, fileSizeBytes: file.size }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Upload fallito");

      const putRes = await fetch(data.uploadUrl, {
        method: "PUT",
        headers: { "Content-Type": file.type || "application/octet-stream" },
        body: file,
      });
      if (!putRes.ok) throw new Error("Caricamento verso lo storage fallito");

      setAttachments((prev) => [...prev, data.attachment]);
      router.refresh();
    } catch (e: any) {
      toast.error(e.message ?? "Errore durante il caricamento");
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  async function handleDelete(id: string) {
    setDeletingId(id);
    try {
      const res = await fetch(`/api/attachments/${id}`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? "Eliminazione fallita");
      }
      setAttachments((prev) => prev.filter((a) => a.id !== id));
      router.refresh();
    } catch (e: any) {
      toast.error(e.message ?? "Errore durante l'eliminazione");
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="flex items-center gap-2 text-sm">
          <Paperclip className="h-4 w-4" /> Allegati
        </CardTitle>
        {canEdit && (
          <Button variant="link" size="sm" className="h-auto p-0 text-xs" disabled={uploading} onClick={() => inputRef.current?.click()}>
            {uploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
            {uploading ? "Caricamento…" : "Carica"}
          </Button>
        )}
        <input ref={inputRef} type="file" className="hidden" onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])} />
      </CardHeader>

      {attachments.length > 0 && (
        <CardContent className="pt-0">
          <ul className="space-y-1.5">
            {attachments.map((a) => (
              <li key={a.id} className="flex items-center gap-2 text-sm">
                <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
                <a
                  href={`/api/attachments/${a.id}/download`}
                  className="truncate text-foreground hover:text-primary hover:underline"
                >
                  {a.fileName}
                </a>
                <span className="shrink-0 text-xs text-muted-foreground">{formatBytes(a.fileSizeBytes)}</span>
                {canEdit && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="ml-auto h-6 w-6 shrink-0 text-muted-foreground hover:text-destructive"
                    disabled={deletingId === a.id}
                    title="Elimina allegato"
                    onClick={() => handleDelete(a.id)}
                  >
                    {deletingId === a.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                  </Button>
                )}
              </li>
            ))}
          </ul>
        </CardContent>
      )}
    </Card>
  );
}
