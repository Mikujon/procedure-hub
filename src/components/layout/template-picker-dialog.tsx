"use client";

import { FileText, Loader2 } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Card } from "@/components/ui/card";

interface TemplateNode {
  id: string;
  name: string;
  description: string | null;
  icon: string | null;
  category: string;
}

/**
 * Notion-style template gallery — a grid of preview cards in a modal,
 * not a small dropdown list. Purely presentational: page-tree.tsx still
 * owns fetching /api/templates and calling POST /api/pages/from-template
 * (both already work — this only replaces how the choice is presented).
 */
export function TemplatePickerDialog({
  open,
  onOpenChange,
  templates,
  loading,
  onSelect,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  templates: TemplateNode[];
  loading: boolean;
  onSelect: (templateId: string) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Scegli un modello</DialogTitle>
          <DialogDescription>Parti da una struttura pronta invece che da una pagina vuota.</DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-12 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" />
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {templates.map((t) => (
              <button key={t.id} onClick={() => onSelect(t.id)} className="text-left">
                <Card className="h-full p-4 transition-colors hover:border-primary hover:bg-primary/[0.03]">
                  <span className="mb-2 flex h-9 w-9 items-center justify-center rounded-md bg-muted text-lg leading-none">
                    {t.icon ?? <FileText className="h-4 w-4 text-muted-foreground" />}
                  </span>
                  <p className="text-sm font-medium">{t.name}</p>
                  {t.description && <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">{t.description}</p>}
                </Card>
              </button>
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
