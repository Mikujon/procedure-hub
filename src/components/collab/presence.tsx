"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { UserAvatar } from "@/components/shared/user-avatar";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Wifi, WifiOff, Users } from "lucide-react";
import type { PresenceUser } from "@/lib/collab/client";

/** Stacked avatar cluster + connection badge for procedure presence. */
export function PresenceBar({
  others,
  connected,
  className,
}: {
  others: PresenceUser[];
  connected: boolean;
  className?: string;
}) {
  return (
    <div className={cn("flex items-center gap-2", className)}>
      <TooltipProvider delayDuration={200}>
        <Tooltip>
          <TooltipTrigger asChild>
            <span
              className={cn(
                "inline-flex h-2 w-2 items-center justify-center rounded-full",
                connected ? "bg-status-published" : "bg-muted-foreground/40"
              )}
            >
              {connected && (
                <span className="absolute h-2 w-2 animate-ping rounded-full bg-status-published opacity-60" />
              )}
            </span>
          </TooltipTrigger>
          <TooltipContent side="bottom">
            {connected ? "Real-time sync active" : "Connecting…"}
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>

      {others.length === 0 ? (
        <span className="hidden items-center gap-1 text-[11px] text-muted-foreground sm:inline-flex">
          {connected ? <Wifi className="h-3 w-3" /> : <WifiOff className="h-3 w-3" />}
          {connected ? "You're alone here" : "Reconnecting"}
        </span>
      ) : (
        <div className="flex items-center gap-2">
          <div className="flex -space-x-1.5">
            {others.slice(0, 4).map((u) => (
              <TooltipProvider key={u.id} delayDuration={150}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span className="ring-2 ring-card rounded-full">
                      <UserAvatar
                        name={u.name}
                        color={u.avatarColor}
                        size="xs"
                        className="ring-1 ring-background"
                      />
                    </span>
                  </TooltipTrigger>
                  <TooltipContent side="bottom">{u.name} is here</TooltipContent>
                </Tooltip>
              </TooltipProvider>
            ))}
            {others.length > 4 && (
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-muted text-[10px] font-semibold text-muted-foreground ring-1 ring-background">
                +{others.length - 4}
              </span>
            )}
          </div>
          <span className="hidden items-center gap-1 text-[11px] text-muted-foreground sm:inline-flex">
            <Users className="h-3 w-3" />
            {others.length} other{others.length === 1 ? "" : "s"}
          </span>
        </div>
      )}
    </div>
  );
}

/** Inline "edited by X" chip shown on a block that another user is editing. */
export function EditingBadge({
  user,
  className,
}: {
  user: { id: string; name: string; color: string };
  className?: string;
}) {
  return (
    <TooltipProvider delayDuration={150}>
      <Tooltip>
        <TooltipTrigger asChild>
          <span
            className={cn(
              "inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[10px] font-medium",
              className
            )}
            style={{ backgroundColor: `${user.color}1a`, color: user.color }}
          >
            <span
              className="h-1.5 w-1.5 rounded-full"
              style={{ backgroundColor: user.color }}
            />
            {user.name.split(" ")[0]} editing
          </span>
        </TooltipTrigger>
        <TooltipContent side="top">{user.name} is editing this block</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
