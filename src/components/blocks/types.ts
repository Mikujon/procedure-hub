import type { BlockType } from "@prisma/client";

/** Client-side shape of a Block as returned by GET /api/procedures/[id]/blocks (JSON, dates as strings). */
export interface ClientBlock {
  id: string;
  type: BlockType;
  content: any;
  parentBlockId: string | null;
  sortOrder: number;
  children: ClientBlock[];
}
