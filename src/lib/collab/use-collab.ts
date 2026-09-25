"use client";

import * as React from "react";
import { useSession } from "next-auth/react";
import { getCollabSocket } from "@/lib/collab/client";
import type { PresenceUser, BlockLock, ContentPatch } from "@/lib/collab/client";

/**
 * useCollab — real-time collaboration scoped to a single procedure.
 *
 * Lifecycle:
 *  - Connects (lazily, via the shared socket singleton) when a procedureId is set
 *    and the user is authenticated.
 *  - Joins the procedure room on connect; leaves on unmount / procedure change.
 *  - Tracks presence (who else is viewing/editing), block locks, and live
 *    content patches.
 *
 * Caller responsibilities:
 *  - Call `claimBlock(i)` when the user starts editing a block (on focus).
 *  - Call `heartbeat(i)` periodically while editing (the editor wrapper does this).
 *  - Call `releaseBlock(i)` on blur.
 *  - Call `broadcastPatch(i, block)` on content change (debounced by the caller).
 *  - Render `presence` avatars and `lockFor(i)` indicators.
 */
export function useCollab(procedureId: string | null) {
  const { data: session, status } = useSession();
  const [connected, setConnected] = React.useState(false);
  const [presence, setPresence] = React.useState<PresenceUser[]>([]);
  const [locks, setLocks] = React.useState<BlockLock[]>([]);
  const [lastPatch, setLastPatch] = React.useState<ContentPatch | null>(null);
  const [savedBy, setSavedBy] = React.useState<{ name: string; color: string; at: number } | null>(null);

  const me = React.useMemo(() => {
    if (status !== "authenticated" || !session?.user) return null;
    return {
      id: (session.user as any).id as string,
      tenantId: (session.user as any).tenantId as string,
      name: session.user.name ?? "Anonymous",
      avatarColor: ((session.user as any).avatarColor as string) ?? "#888",
    };
  }, [session, status]);

  React.useEffect(() => {
    if (!procedureId || !me) return;
    const socket = getCollabSocket();

    const onConnect = () => {
      setConnected(true);
      socket.emit("procedure:join", { procedureId, tenantId: me.tenantId });
    };
    const onDisconnect = () => {
      setConnected(false);
      setPresence([]);
      setLocks([]);
    };

    const onPresenceInit = (p: { users: PresenceUser[]; locks: BlockLock[] }) => {
      setPresence(p.users);
      setLocks(p.locks);
    };
    const onUserJoined = (p: { user: PresenceUser }) => {
      setPresence((prev) =>
        prev.some((u) => u.id === p.user.id) ? prev : [...prev, p.user]
      );
    };
    const onUserLeft = (p: { userId: string }) => {
      setPresence((prev) => prev.filter((u) => u.id !== p.userId));
    };
    const onBlockClaimed = (p: { blockIndex: number; user: { id: string; name: string; color: string } }) => {
      setLocks((prev) => {
        const filtered = prev.filter((l) => l.blockIndex !== p.blockIndex);
        return [...filtered, { blockIndex: p.blockIndex, user: p.user }];
      });
    };
    const onBlockReleased = (p: { blockIndex: number }) => {
      setLocks((prev) => prev.filter((l) => l.blockIndex !== p.blockIndex));
    };
    const onContentUpdate = (p: ContentPatch) => {
      // ignore our own echoes (the server uses `socket.to(room)`, but be safe)
      if (p.by.id === me.id) return;
      setLastPatch(p);
    };
    const onProcedureSaved = (p: { by: { id: string; name: string; color: string }; at: number }) => {
      if (p.by.id === me.id) return;
      setSavedBy({ name: p.by.name, color: p.by.color, at: p.at });
    };

    // attach listeners
    socket.on("connect", onConnect);
    socket.on("disconnect", onDisconnect);
    socket.on("presence:init", onPresenceInit);
    socket.on("presence:user_joined", onUserJoined);
    socket.on("presence:user_left", onUserLeft);
    socket.on("block:claimed", onBlockClaimed);
    socket.on("block:released", onBlockReleased);
    socket.on("content:update", onContentUpdate);
    socket.on("procedure:saved", onProcedureSaved);

    // if already connected, join immediately
    if (socket.connected) {
      onConnect();
    }

    return () => {
      socket.emit("procedure:leave", { procedureId });
      socket.off("connect", onConnect);
      socket.off("disconnect", onDisconnect);
      socket.off("presence:init", onPresenceInit);
      socket.off("presence:user_joined", onUserJoined);
      socket.off("presence:user_left", onUserLeft);
      socket.off("block:claimed", onBlockClaimed);
      socket.off("block:released", onBlockReleased);
      socket.off("content:update", onContentUpdate);
      socket.off("procedure:saved", onProcedureSaved);
      setPresence([]);
      setLocks([]);
      setLastPatch(null);
      setSavedBy(null);
    };
  }, [procedureId, me?.id, me?.tenantId]);

  // actions
  const claimBlock = React.useCallback(
    (blockIndex: number) => {
      if (!procedureId) return;
      getCollabSocket().emit("block:claim", { procedureId, blockIndex });
    },
    [procedureId]
  );
  const heartbeat = React.useCallback(
    (blockIndex: number) => {
      if (!procedureId) return;
      getCollabSocket().emit("block:heartbeat", { procedureId, blockIndex });
    },
    [procedureId]
  );
  const releaseBlock = React.useCallback(
    (blockIndex: number) => {
      if (!procedureId) return;
      getCollabSocket().emit("block:release", { procedureId, blockIndex });
    },
    [procedureId]
  );
  const broadcastPatch = React.useCallback(
    (blockIndex: number, block: unknown) => {
      if (!procedureId) return;
      getCollabSocket().emit("content:patch", { procedureId, blockIndex, block });
    },
    [procedureId]
  );
  const broadcastSaved = React.useCallback(() => {
    if (!procedureId) return;
    getCollabSocket().emit("procedure:saved", { procedureId });
  }, [procedureId]);

  const lockFor = React.useCallback(
    (blockIndex: number) => locks.find((l) => l.blockIndex === blockIndex) ?? null,
    [locks]
  );

  const others = React.useMemo(
    () => presence.filter((u) => u.id !== me?.id),
    [presence, me?.id]
  );

  return {
    connected,
    me,
    presence: others, // other users in the room (excludes self)
    allPresence: presence,
    lockFor,
    claimBlock,
    heartbeat,
    releaseBlock,
    broadcastPatch,
    broadcastSaved,
    lastPatch,
    savedBy,
    clearSavedBy: () => setSavedBy(null),
  };
}
