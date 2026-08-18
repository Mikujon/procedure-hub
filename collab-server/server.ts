import { Hocuspocus } from "@hocuspocus/server";
import * as Y from "yjs";
import jwt from "jsonwebtoken";
import { prisma } from "../src/lib/prisma";
import { canEditProcedure, canViewProcedure } from "../src/lib/permissions";

/**
 * Standalone real-time collaboration process for the block editor. Runs
 * outside the Next.js request cycle (own HTTP+WS listener), so it has its
 * own auth path: clients connect with a short-lived JWT minted by
 * GET /api/procedures/[id]/collab-token, which this server re-verifies and
 * re-checks against lib/permissions itself — never trust the token's claims
 * alone, access can change between token issuance and connection.
 *
 * Document name == Procedure.id. Structure (which blocks exist, their
 * order/nesting/type) is never encoded in the Yjs doc — Postgres Block rows
 * are the source of truth for that. Yjs only carries live per-block rich
 * text via a Y.Map<blockId, Y.XmlFragment> namespace, built lazily client-
 * side (see src/hooks/use-collaborative-editor.ts).
 */

const secret = process.env.COLLAB_JWT_SECRET;
if (!secret) {
  throw new Error("COLLAB_JWT_SECRET is required to start collab-server");
}

interface CollabTokenPayload {
  userId: string;
  tenantId: string;
  procedureId: string;
  canEdit: boolean;
}

const server = new Hocuspocus({
  port: Number(process.env.COLLAB_SERVER_PORT ?? 1234),
  // Coalesces rapid keystroke updates into one Postgres write instead of
  // persisting a version's worth of data on every Yjs sync tick — explicit
  // ProcedureVersion snapshots only ever come from the publish route, never
  // from this debounce.
  debounce: 2000,
  maxDebounce: 10000,

  async onAuthenticate(data) {
    let payload: CollabTokenPayload;
    try {
      payload = jwt.verify(data.token, secret) as CollabTokenPayload;
    } catch {
      throw new Error("Invalid or expired collaboration token");
    }

    if (payload.procedureId !== data.documentName) {
      throw new Error("Token does not match the requested document");
    }

    const dbUser = await prisma.user.findUnique({ where: { id: payload.userId } });
    if (!dbUser || dbUser.tenantId !== payload.tenantId || !dbUser.isActive) {
      throw new Error("User not found or inactive");
    }
    const actingUser = { id: dbUser.id, tenantId: dbUser.tenantId, globalRole: dbUser.globalRole };

    const canView = await canViewProcedure(actingUser, payload.procedureId);
    if (!canView) {
      throw new Error("Not authorized to view this procedure");
    }

    const procedure = await prisma.procedure.findUnique({ where: { id: payload.procedureId } });
    if (!procedure || procedure.tenantId !== payload.tenantId) {
      throw new Error("Procedure not found");
    }

    const canEdit = await canEditProcedure(actingUser, procedure.departmentId);
    data.connection.readOnly = !canEdit;

    return { userId: dbUser.id, tenantId: dbUser.tenantId };
  },

  async onLoadDocument(data) {
    const procedure = await prisma.procedure.findUnique({
      where: { id: data.documentName },
      select: { collaborativeStateB64: true },
    });
    if (procedure?.collaborativeStateB64) {
      Y.applyUpdate(data.document, new Uint8Array(procedure.collaborativeStateB64));
    }
  },

  async onStoreDocument(data) {
    const update = Y.encodeStateAsUpdate(data.document);
    try {
      await prisma.procedure.update({
        where: { id: data.documentName },
        data: { collaborativeStateB64: Buffer.from(update) },
      });
    } catch (err) {
      // Don't let one deleted/missing procedure crash the debounced store
      // cycle for every other open document on this server.
      console.error(`collab-server: failed to store document ${data.documentName}`, err);
    }
  },
});

server.listen();
