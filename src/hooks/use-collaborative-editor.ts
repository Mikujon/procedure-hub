"use client";

import { useCallback, useEffect, useState } from "react";
import * as Y from "yjs";
import { HocuspocusProvider, WebSocketStatus } from "@hocuspocus/provider";

export type CollabStatus = "connecting" | "connected" | "disconnected";

interface UseCollaborativeEditorOptions {
  procedureId: string;
  /** Null while the collab-token fetch is in flight — connection is deferred until it resolves. */
  token: string | null;
}

/**
 * Owns one Y.Doc + HocuspocusProvider per open procedure edit session.
 * Structure (which blocks exist/order/nesting) is never encoded here — only
 * per-block rich text lives in Yjs, one Y.XmlFragment per block, created
 * lazily as blocks are mounted for editing. See collab-server/server.ts for
 * the persistence/auth side of this connection.
 */
export function useCollaborativeEditor({ procedureId, token }: UseCollaborativeEditorOptions) {
  const [doc, setDoc] = useState<Y.Doc | null>(null);
  const [provider, setProvider] = useState<HocuspocusProvider | null>(null);
  const [status, setStatus] = useState<CollabStatus>("connecting");

  useEffect(() => {
    if (!token) return;

    const newDoc = new Y.Doc();
    let everConnected = false;
    const newProvider = new HocuspocusProvider({
      url: process.env.NEXT_PUBLIC_COLLAB_URL ?? "ws://localhost:1234",
      name: procedureId,
      document: newDoc,
      token,
      onStatus: ({ status: s }) => {
        const isConnected = s === WebSocketStatus.Connected;
        setStatus(isConnected ? "connected" : "connecting");
        // doc/provider are only exposed once a connection has actually been
        // proven — exposing them the instant they're merely *constructed*
        // (the previous behavior) made BlockEditor's collabActive true even
        // when collab-server is completely unreachable, which silently
        // discarded every block's real Postgres-backed initialContent in
        // favor of an empty local Y.Doc that never got a chance to sync
        // (InlineRichText ignores initialContent whenever fragment is set).
        // Found verifying the reading-outline/TOC feature against a freshly
        // duplicated procedure: every block rendered blank despite having
        // real stored content, because a token was issued (COLLAB_JWT_SECRET
        // set) but collab-server itself wasn't running.
        if (isConnected && !everConnected) {
          everConnected = true;
          setDoc(newDoc);
          setProvider(newProvider);
        }
      },
      onDisconnect: () => setStatus("disconnected"),
    });

    setStatus("connecting");

    return () => {
      newProvider.destroy();
      newDoc.destroy();
      setDoc(null);
      setProvider(null);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [procedureId, token]);

  /** Y.XmlFragment for one block's rich text, created on first access. Null until the doc exists. */
  const getFragment = useCallback(
    (blockId: string): Y.XmlFragment | null => {
      if (!doc) return null;
      return doc.getXmlFragment(`block:${blockId}`);
    },
    [doc]
  );

  return {
    status,
    doc,
    provider,
    awareness: provider?.awareness ?? null,
    getFragment,
  };
}
