/**
 * Procedure Hub — Real-time collaboration service.
 *
 * A standalone Socket.io server on port 3003.
 *
 * Design (best practices):
 *  - Authenticated handshake: every socket must present a valid NextAuth JWT
 *    (cookie `next-auth.session-token`, HS256 signed with NEXTAUTH_SECRET).
 *    Anonymous sockets are rejected — collaboration is for logged-in users.
 *  - Tenant isolation: rooms are namespaced `t:{tenantId}:p:{procedureId}`.
 *    Cross-tenant joins are refused (a user can only see presence in their own
 *    tenant's procedures).
 *  - Presence: join/leave broadcasts the current viewer list to the room.
 *  - Field-level locks: a user "claims" a block while editing it; others see
 *    an indicator. Locks auto-release after 6s of inactivity (heartbeat) so
 *    disconnected/crashed clients don't strand blocks.
 *  - Live patches: small debounced content patches broadcast in real time so
 *    other editors see typing without a save. Persistence stays the source of
 *    truth — the editor saves via the Next.js API; this server only relays.
 *
 * Connection path: `/` (Caddy forwards `/?XTransformPort=3003` to this port).
 * Never expose a different path — the gateway routes by it.
 */

import { createServer } from "http";
import { Server } from "socket.io";
import { jwtDecrypt } from "jose";
import { hkdfSync } from "crypto";

const PORT = 3003;
const NEXTAUTH_SECRET = process.env.NEXTAUTH_SECRET;
if (!NEXTAUTH_SECRET) {
  console.error("[collab] FATAL: NEXTAUTH_SECRET is not set. Aborting.");
  process.exit(1);
}

// NextAuth v4 encrypts the session JWT with JWE (alg=dir, enc=A256GCM).
// The Content Encryption Key is derived via HKDF-SHA256 with an empty salt and
// the info string "NextAuth.js Generated Encryption Key" (32 bytes output).
// This mirrors next-auth/jwt's getDerivedEncryptionKey exactly so the collab
// service can decrypt session tokens issued by the web app.
const secretKey = Buffer.from(
  hkdfSync(
    "sha256",
    NEXTAUTH_SECRET,
    "", // salt (empty in default NextAuth v4 decode)
    "NextAuth.js Generated Encryption Key", // info
    32 // length
  )
);

const COOKIE_NAME = "next-auth.session-token";

// room id helper (deterministic, includes tenant so isolation is enforced)
const roomId = (tenantId: string, procedureId: string) =>
  `t:${tenantId}:p:${procedureId}`;

interface PresenceUser {
  id: string;
  name: string;
  avatarColor: string;
  socketId: string;
  // optional cursor in the document (blockIndex the user is hovering/editing)
  blockIndex?: number | null;
}

interface RoomState {
  tenantId: string;
  procedureId: string;
  users: Map<string, PresenceUser>; // keyed by socketId
  locks: Map<number, { userId: string; name: string; color: string; expiresAt: number }>;
}

const rooms = new Map<string, RoomState>();
const socketToRoom = new Map<string, string>(); // socketId -> roomId

// Lock TTL: if no heartbeat for 6s, the lock is considered released
const LOCK_TTL_MS = 6000;
// Heartbeat sweep interval
const SWEEP_INTERVAL_MS = 2000;

const httpServer = createServer();
const io = new Server(httpServer, {
  path: "/",
  cors: {
    origin: true, // reflect origin; cookie is what authenticates
    credentials: true,
    methods: ["GET", "POST"],
  },
  pingInterval: 25000,
  pingTimeout: 60000,
});

// ---- auth middleware ------------------------------------------------------
interface DecodedSession {
  id: string;
  tenantId: string;
  name: string;
  email: string;
  avatarColor?: string;
}

io.use(async (socket, next) => {
  try {
    const cookieHeader = socket.handshake.headers.cookie ?? "";
    const token = parseCookie(cookieHeader, COOKIE_NAME);
    if (!token) {
      console.log(`[collab] auth: no session cookie for ${socket.id}`);
      return next(new Error("unauthenticated: no session cookie"));
    }
    const { payload } = await jwtDecrypt(token, secretKey);
    const user = payload as unknown as DecodedSession;
    if (!user.id || !user.tenantId) {
      console.log(`[collab] auth: invalid session payload for ${socket.id}`);
      return next(new Error("unauthenticated: invalid session"));
    }
    // attach to socket for handlers
    (socket.data as any).user = {
      id: user.id,
      tenantId: user.tenantId,
      name: user.name ?? user.email ?? "Unknown",
      avatarColor: (user.avatarColor as string) ?? "#888888",
    };
    next();
  } catch (err: any) {
    console.log(`[collab] auth error for ${socket.id}: ${err?.message ?? err}`);
    next(new Error("unauthenticated: " + (err?.message ?? "jwt error")));
  }
});

// ---- presence + room management -----------------------------------------
io.on("connection", (socket) => {
  const user = (socket.data as any).user as {
    id: string;
    tenantId: string;
    name: string;
    avatarColor: string;
  };
  console.log(`[collab] connect ${user.name} (${socket.id})`);

  let currentRoomId: string | null = null;

  socket.on("procedure:join", (payload: { procedureId: string; tenantId: string }) => {
    if (!payload || typeof payload.procedureId !== "string") return;
    // enforce tenant match (the client sends its own tenantId from session;
    // the server already authenticated it, so this is defense-in-depth)
    if (payload.tenantId !== user.tenantId) {
      socket.emit("error", { code: "tenant_mismatch" });
      return;
    }

    const rid = roomId(user.tenantId, payload.procedureId);

    // leave previous room if any
    if (currentRoomId && currentRoomId !== rid) {
      leaveRoom(socket, currentRoomId);
    }

    currentRoomId = rid;
    socketToRoom.set(socket.id, rid);
    socket.join(rid);

    let room = rooms.get(rid);
    if (!room) {
      room = {
        tenantId: user.tenantId,
        procedureId: payload.procedureId,
        users: new Map(),
        locks: new Map(),
      };
      rooms.set(rid, room);
    }
    room.users.set(socket.id, {
      id: user.id,
      name: user.name,
      avatarColor: user.avatarColor,
      socketId: socket.id,
      blockIndex: null,
    });

    // tell the newcomer who's already here
    socket.emit("presence:init", {
      procedureId: payload.procedureId,
      users: Array.from(room.users.values()).map(stripSocketId),
      locks: serializeLocks(room),
    });
    // tell everyone else the newcomer arrived
    socket.to(rid).emit("presence:user_joined", {
      procedureId: payload.procedureId,
      user: stripSocketId(room.users.get(socket.id)!),
    });

    console.log(`[collab] ${user.name} joined room ${rid} (now ${room.users.size})`);
  });

  // field-level lock: a user is editing a block
  socket.on("block:claim", (payload: { procedureId: string; blockIndex: number }) => {
    if (!currentRoomId || !payload || typeof payload.blockIndex !== "number") return;
    const room = rooms.get(currentRoomId);
    if (!room) return;
    const idx = payload.blockIndex;
    const existing = room.locks.get(idx);
    const now = Date.now();
    // allow claim if no lock or it's the same user or the lock expired
    if (
      !existing ||
      existing.userId === user.id ||
      existing.expiresAt < now
    ) {
      room.locks.set(idx, {
        userId: user.id,
        name: user.name,
        color: user.avatarColor,
        expiresAt: now + LOCK_TTL_MS,
      });
      io.to(currentRoomId).emit("block:claimed", {
        procedureId: payload.procedureId,
        blockIndex: idx,
        user: { id: user.id, name: user.name, color: user.avatarColor },
      });
    } else {
      // already locked by someone else — tell the claimer
      socket.emit("block:claim_rejected", {
        procedureId: payload.procedureId,
        blockIndex: idx,
        heldBy: { id: existing.userId, name: existing.name, color: existing.color },
      });
    }
  });

  // heartbeat: refresh the active lock for the block the user is editing
  socket.on("block:heartbeat", (payload: { procedureId: string; blockIndex: number }) => {
    if (!currentRoomId || !payload) return;
    const room = rooms.get(currentRoomId);
    if (!room) return;
    const lock = room.locks.get(payload.blockIndex);
    if (lock && lock.userId === user.id) {
      lock.expiresAt = Date.now() + LOCK_TTL_MS;
    }
  });

  // release the lock (on blur / leave the block)
  socket.on("block:release", (payload: { procedureId: string; blockIndex: number }) => {
    if (!currentRoomId || !payload) return;
    releaseLock(currentRoomId, payload.blockIndex, user.id, payload.procedureId);
  });

  // live content patch: relay to other sockets in the room (no persistence here)
  socket.on("content:patch", (payload: {
    procedureId: string;
    blockIndex: number;
    block: unknown;
  }) => {
    if (!currentRoomId || !payload) return;
    const room = rooms.get(currentRoomId);
    if (!room) return;
    if (room.procedureId !== payload.procedureId) return; // safety
    socket.to(currentRoomId).emit("content:update", {
      procedureId: payload.procedureId,
      blockIndex: payload.blockIndex,
      block: payload.block,
      by: { id: user.id, name: user.name, color: user.avatarColor },
      at: Date.now(),
    });
  });

  // notify others that the procedure was saved (so they can refetch)
  socket.on("procedure:saved", (payload: { procedureId: string }) => {
    if (!currentRoomId || !payload) return;
    socket.to(currentRoomId).emit("procedure:saved", {
      procedureId: payload.procedureId,
      by: { id: user.id, name: user.name, color: user.avatarColor },
      at: Date.now(),
    });
  });

  // cursor position: relay only (ephemeral, no server state).
  // payload.blockIndex === null means "cleared" (user blurred / left the block).
  socket.on("cursor:move", (payload: { procedureId: string; blockIndex: number | null; offset: number }) => {
    if (!currentRoomId || !payload) return;
    const room = rooms.get(currentRoomId);
    if (!room || room.procedureId !== payload.procedureId) return;
    socket.to(currentRoomId).emit("cursor:moved", {
      procedureId: payload.procedureId,
      userId: user.id,
      name: user.name,
      color: user.avatarColor,
      blockIndex: payload.blockIndex,
      offset: payload.offset ?? 0,
      at: Date.now(),
    });
  });

  // ---- cleanup ----------------------------------------------------------
  const onDisconnect = () => {
    if (currentRoomId) {
      leaveRoom(socket, currentRoomId);
    }
    socketToRoom.delete(socket.id);
    console.log(`[collab] disconnect ${user.name} (${socket.id})`);
  };
  socket.on("disconnect", onDisconnect);
  socket.on("error", (e) => console.error(`[collab] socket error ${socket.id}:`, e));
});

// ---- helpers -------------------------------------------------------------
function leaveRoom(socket: any, rid: string) {
  const room = rooms.get(rid);
  if (!room) return;
  const user = (socket.data as any).user;
  const presence = room.users.get(socket.id);
  room.users.delete(socket.id);
  // release any locks held by this socket
  for (const [idx, lock] of room.locks.entries()) {
    if (lock.userId === user.id) {
      room.locks.delete(idx);
      io.to(rid).emit("block:released", {
        procedureId: room.procedureId,
        blockIndex: idx,
      });
    }
  }
  socket.leave(rid);
  // notify remaining users
  io.to(rid).emit("presence:user_left", {
    procedureId: room.procedureId,
    userId: user.id,
  });
  // garbage collect empty rooms
  if (room.users.size === 0) {
    rooms.delete(rid);
  }
}

function releaseLock(rid: string, blockIndex: number, userId: string, procedureId: string) {
  const room = rooms.get(rid);
  if (!room) return;
  const lock = room.locks.get(blockIndex);
  if (lock && lock.userId === userId) {
    room.locks.delete(blockIndex);
    io.to(rid).emit("block:released", {
      procedureId,
      blockIndex,
    });
  }
}

function stripSocketId(u: PresenceUser) {
  return { id: u.id, name: u.name, avatarColor: u.avatarColor, blockIndex: u.blockIndex ?? null };
}

function serializeLocks(room: RoomState) {
  return Array.from(room.locks.entries()).map(([blockIndex, lock]) => ({
    blockIndex,
    user: { id: lock.userId, name: lock.name, color: lock.color },
  }));
}

function parseCookie(header: string, name: string): string | null {
  const parts = header.split(";");
  for (const part of parts) {
    const [k, ...rest] = part.trim().split("=");
    if (k === name) {
      return decodeURIComponent(rest.join("="));
    }
  }
  return null;
}

// ---- heartbeat sweeper: expire stale locks so dead clients don't strand blocks
setInterval(() => {
  const now = Date.now();
  for (const [rid, room] of rooms.entries()) {
    let changed = false;
    for (const [idx, lock] of room.locks.entries()) {
      if (lock.expiresAt < now) {
        room.locks.delete(idx);
        io.to(rid).emit("block:released", {
          procedureId: room.procedureId,
          blockIndex: idx,
        });
        changed = true;
      }
    }
    if (changed) {
      console.log(`[collab] swept expired locks in ${rid}`);
    }
  }
}, SWEEP_INTERVAL_MS);

httpServer.listen(PORT, () => {
  console.log(`[collab] Socket.io collaboration server listening on :${PORT} (path /)`);
});

// graceful shutdown
const shutdown = (sig: string) => {
  console.log(`[collab] ${sig} received, shutting down…`);
  io.close(() => {
    httpServer.close(() => process.exit(0));
  });
};
process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));
