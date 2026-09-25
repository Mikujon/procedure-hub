"use client";

import { io, Socket } from "socket.io-client";

/**
 * Client-side socket.io singleton for real-time collaboration.
 *
 * Connection rules (gateway constraints — DO NOT break these):
 *  - Path is ALWAYS "/" so Caddy's XTransformPort routing works.
 *  - URL is "/?XTransformPort=3003" — never `http://localhost:3003`.
 *  - withCredentials: true so the NextAuth session cookie is sent on the
 *    handshake (the server authenticates the JWT before accepting the socket).
 *
 * The connection is created lazily and reused across the app.
 */

let _socket: Socket | null = null;

export function getCollabSocket(): Socket {
  if (_socket) return _socket;
  _socket = io("/?XTransformPort=3003", {
    // Allow polling fallback — some proxies don't upgrade WS cleanly on the
    // first attempt; socket.io will negotiate WS after the polling handshake.
    transports: ["websocket", "polling"],
    upgrade: true,
    reconnection: true,
    reconnectionAttempts: Infinity,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 8000,
    timeout: 10000,
    withCredentials: true,
    autoConnect: true,
  });
  return _socket;
}

export function disposeCollabSocket() {
  if (_socket) {
    _socket.removeAllListeners();
    _socket.disconnect();
    _socket = null;
  }
}

// ---- event contract (shared with server) ----------------------------------
export interface PresenceUser {
  id: string;
  name: string;
  avatarColor: string;
  blockIndex?: number | null;
}

export interface BlockLock {
  blockIndex: number;
  user: { id: string; name: string; color: string };
}

export interface ContentPatch {
  procedureId: string;
  blockIndex: number;
  block: unknown;
  by: { id: string; name: string; color: string };
  at: number;
}

export interface RemoteCursor {
  userId: string;
  name: string;
  color: string;
  blockIndex: number | null; // null = cursor cleared (user blurred)
  offset: number;
  at: number;
}

export type CollabEvents = {
  // outbound (client → server)
  "procedure:join": (p: { procedureId: string; tenantId: string }) => void;
  "procedure:leave": (p: { procedureId: string }) => void;
  "block:claim": (p: { procedureId: string; blockIndex: number }) => void;
  "block:heartbeat": (p: { procedureId: string; blockIndex: number }) => void;
  "block:release": (p: { procedureId: string; blockIndex: number }) => void;
  "content:patch": (p: { procedureId: string; blockIndex: number; block: unknown }) => void;
  "procedure:saved": (p: { procedureId: string }) => void;
  "cursor:move": (p: { procedureId: string; blockIndex: number | null; offset: number }) => void;

  // inbound (server → client)
  "presence:init": (p: { procedureId: string; users: PresenceUser[]; locks: BlockLock[] }) => void;
  "presence:user_joined": (p: { procedureId: string; user: PresenceUser }) => void;
  "presence:user_left": (p: { procedureId: string; userId: string }) => void;
  "block:claimed": (p: { procedureId: string; blockIndex: number; user: { id: string; name: string; color: string } }) => void;
  "block:claim_rejected": (p: { procedureId: string; blockIndex: number; heldBy: { id: string; name: string; color: string } }) => void;
  "block:released": (p: { procedureId: string; blockIndex: number }) => void;
  "content:update": (p: ContentPatch) => void;
  "procedure:saved": (p: { procedureId: string; by: { id: string; name: string; color: string }; at: number }) => void;
  "cursor:moved": (p: RemoteCursor) => void;
};
