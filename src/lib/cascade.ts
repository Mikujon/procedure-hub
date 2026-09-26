import { db } from "@/lib/db";
import type { Document, OrgNode, OrgAssignment, Version, Destination, User } from "@prisma/client";

/**
 * Cascade visibility engine — the core of the Nodo model.
 *
 * Rule (spec 7): a document attached to a node is seen by everyone at or
 * below that node. So to know what USER can see, we walk UP from the user's
 * nodes to all ancestors — the user "descends from" all of them — and
 * collect every document whose destination intersects that ancestor set.
 *
 * Filters (sedi/ruoli/lingue) NARROW the cascade; they never widen it.
 *
 * Result is also split into:
 *  - visible: documents the user can see (cascade + filters match)
 *  - toRead:  mandatory documents where the user has NOT acked the CURRENT version
 *  - read:    mandatory documents the user HAS acked the current version
 */

export interface VisibleDoc {
  document: Document & {
    owner: Pick<User, "id" | "name" | "avatarColor">;
    versions: Version[];
    destinations: Destination[];
  };
  currentVersion: Version | null;
  acknowledged: boolean; // acked the CURRENT version
  acknowledgedAt: Date | null;
}

function safeParseArr(s: string | null | undefined): string[] {
  if (!s) return [];
  try {
    const v = JSON.parse(s);
    return Array.isArray(v) ? v.map(String) : [];
  } catch {
    return [];
  }
}

/**
 * Compute the set of ancestor node ids for a user (inclusive of their own
 * node ids). This is the "inverse perimeter" the Nodo spec mentions — from
 * a person UP to all ancestors. The DB has the tree via OrgNode.parentId.
 */
export async function computeUserNodeIds(userId: string): Promise<Set<string>> {
  // active assignments (member or manager, valid today)
  const now = new Date();
  const assignments = await db.orgAssignment.findMany({
    where: {
      userId,
      validFrom: { lte: now },
      OR: [{ validTo: null }, { validTo: { gte: now } }],
    },
    select: { nodeId: true },
  });
  const startIds = assignments.map((a) => a.nodeId);
  const result = new Set<string>(startIds);

  // walk up
  for (const id of startIds) {
    let cur: string | null = id;
    while (cur) {
      const node = await db.orgNode.findUnique({
        where: { id: cur },
        select: { parentId: true },
      });
      if (!node || !node.parentId) break;
      if (result.has(node.parentId)) break; // already visited
      result.add(node.parentId);
      cur = node.parentId;
    }
  }
  return result;
}

/**
 * Compute the documents visible to a user (cascade + filters).
 */
export async function computeVisibleDocuments(
  userId: string,
  tenantId: string
): Promise<VisibleDoc[]> {
  const user = await db.user.findUnique({
    where: { id: userId },
    select: { location: true, role: true, language: true },
  });
  if (!user) return [];

  const userNodeIds = await computeUserNodeIds(userId);

  // fetch all in_vigore documents of this tenant
  const docs = await db.document.findMany({
    where: {
      tenantId,
      stato: "in_vigore",
      // visibility restricted = only via destination; "all" = everyone
      // (Nodo rule 7.3.7: default closed, so most are restricted)
    },
    include: {
      owner: { select: { id: true, name: true, avatarColor: true } },
      versions: { orderBy: { numero: "desc" } },
      destinations: true,
    },
  });

  const visible: VisibleDoc[] = [];

  for (const doc of docs) {
    // "all" visibility bypasses destination filtering (rare)
    if (doc.visibility === "all") {
      visible.push(await buildVisibleDoc(doc, userId));
      continue;
    }

    // restricted: must match at least one destination
    const matched = doc.destinations.some((d) => {
      const destNodeIds = safeParseArr(d.nodeIds);
      const destSedi = safeParseArr(d.sedi);
      const destRuoli = safeParseArr(d.ruoli);
      const destLingue = safeParseArr(d.lingue);

      // node cascade: at least one dest node must be in user's ancestor set
      if (destNodeIds.length > 0) {
        const hit = destNodeIds.some((n) => userNodeIds.has(n));
        if (!hit) return false;
      }
      // sede filter narrows
      if (destSedi.length > 0 && user.location) {
        if (!destSedi.includes(user.location)) return false;
      }
      // role filter narrows
      if (destRuoli.length > 0) {
        if (!destRuoli.includes(user.role)) return false;
      }
      // language filter narrows
      if (destLingue.length > 0) {
        if (!destLingue.includes(user.language)) return false;
      }
      return true;
    });

    if (matched) {
      visible.push(await buildVisibleDoc(doc, userId));
    }
  }

  // sort: obbligatorio first, then by updatedAt desc
  visible.sort((a, b) => {
    if (a.document.obbligatorio !== b.document.obbligatorio)
      return a.document.obbligatorio ? -1 : 1;
    return b.document.updatedAt.getTime() - a.document.updatedAt.getTime();
  });

  return visible;
}

async function buildVisibleDoc(
  doc: Document & {
    owner: Pick<User, "id" | "name" | "avatarColor">;
    versions: Version[];
    destinations: Destination[];
  },
  userId: string
): Promise<VisibleDoc> {
  // current version = the one marked isCurrent, else the latest
  const currentVersion =
    doc.versions.find((v) => v.isCurrent) ?? doc.versions[0] ?? null;

  let acknowledged = false;
  let acknowledgedAt: Date | null = null;
  if (currentVersion) {
    const ack = await db.acknowledgment.findUnique({
      where: {
        userId_documentId_versionId: {
          userId,
          documentId: doc.id,
          versionId: currentVersion.id,
        },
      },
    });
    if (ack) {
      acknowledged = true;
      acknowledgedAt = ack.at;
    }
  }

  return {
    document: doc,
    currentVersion,
    acknowledged,
    acknowledgedAt,
  };
}

/**
 * Compute the read status of a document for ALL its intended recipients.
 * Used by LG-4 (Legal Head) and TL (Team Leader, scoped to team).
 *
 * Returns: list of { user, acknowledged, at }
 */
export interface ReadStatusRow {
  userId: string;
  userName: string;
  userEmail: string;
  userLocation: string | null;
  userRole: string;
  acknowledged: boolean;
  acknowledgedAt: string | null;
  via: string | null;
}

export async function computeReadStatus(
  documentId: string,
  tenantId: string,
  versionId?: string
): Promise<ReadStatusRow[]> {
  const doc = await db.document.findUnique({
    where: { id: documentId },
    include: {
      versions: { orderBy: { numero: "desc" } },
      destinations: true,
    },
  });
  if (!doc || doc.tenantId !== tenantId) return [];

  const currentVersion =
    (versionId
      ? doc.versions.find((v) => v.id === versionId)
      : doc.versions.find((v) => v.isCurrent)) ?? doc.versions[0] ?? null;

  // compute recipients: all users whose ancestor set intersects any destination
  // nodeIds, filtered by sede/ruolo/lingua.
  const allTenantUsers = await db.user.findMany({
    where: { tenantId },
    select: {
      id: true,
      name: true,
      email: true,
      location: true,
      role: true,
      language: true,
    },
  });

  // precompute each user's node-ancestor set
  const recipients: typeof allTenantUsers = [];
  for (const u of allTenantUsers) {
    const userNodeIds = await computeUserNodeIds(u.id);
    const matched = doc.destinations.some((d) => {
      const destNodeIds = safeParseArr(d.nodeIds);
      const destSedi = safeParseArr(d.sedi);
      const destRuoli = safeParseArr(d.ruoli);
      const destLingue = safeParseArr(d.lingue);
      if (destNodeIds.length > 0) {
        if (!destNodeIds.some((n) => userNodeIds.has(n))) return false;
      }
      if (destSedi.length > 0 && u.location) {
        if (!destSedi.includes(u.location)) return false;
      }
      if (destRuoli.length > 0 && !destRuoli.includes(u.role)) return false;
      if (destLingue.length > 0 && !destLingue.includes(u.language)) return false;
      return true;
    });
    if (matched) recipients.push(u);
  }

  // fetch acks for these users against the current version
  const acks = currentVersion
    ? await db.acknowledgment.findMany({
        where: {
          documentId,
          versionId: currentVersion.id,
          userId: { in: recipients.map((r) => r.id) },
        },
      })
    : [];
  const ackMap = new Map(acks.map((a) => [a.userId, a]));

  return recipients.map((u) => {
    const ack = ackMap.get(u.id);
    return {
      userId: u.id,
      userName: u.name,
      userEmail: u.email,
      userLocation: u.location,
      userRole: u.role,
      acknowledged: !!ack,
      acknowledgedAt: ack ? ack.at.toISOString() : null,
      via: ack ? ack.via : null,
    };
  });
}

/**
 * Compute read status scoped to a manager's perimeter (their node + descendants).
 * Used by Team Leader (sees only their team), Floor Manager (their
 * subcampaigns), CSDM (their clients), COO (all Operation).
 */
export async function computeReadStatusForManager(
  documentId: string,
  managerUserId: string,
  tenantId: string
): Promise<ReadStatusRow[]> {
  // 1. manager's managed nodes (relation = manager)
  const managedAssignments = await db.orgAssignment.findMany({
    where: {
      userId: managerUserId,
      relation: "manager",
      OR: [{ validTo: null }, { validTo: { gte: new Date() } }],
    },
    select: { nodeId: true },
  });
  if (managedAssignments.length === 0) return [];

  // 2. for each managed node, compute all descendants (the perimeter)
  const perimeterNodeIds = new Set<string>();
  for (const a of managedAssignments) {
    await collectDescendants(a.nodeId, perimeterNodeIds);
  }

  // 3. all users who are members of any perimeter node
  const members = await db.orgAssignment.findMany({
    where: {
      nodeId: { in: Array.from(perimeterNodeIds) },
      relation: "member",
      OR: [{ validTo: null }, { validTo: { gte: new Date() } }],
    },
    select: { userId: true },
  });
  const memberIds = Array.from(new Set(members.map((m) => m.userId)));

  // 4. read status for those users
  const all = await computeReadStatus(documentId, tenantId);
  return all.filter((r) => memberIds.includes(r.userId));
}

async function collectDescendants(nodeId: string, acc: Set<string>) {
  if (acc.has(nodeId)) return;
  acc.add(nodeId);
  const children = await db.orgNode.findMany({
    where: { parentId: nodeId },
    select: { id: true },
  });
  for (const c of children) {
    await collectDescendants(c.id, acc);
  }
}
