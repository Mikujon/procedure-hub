import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { toggleFavorite, listVisibleFavorites } from "@/lib/favorites";

const schema = z.object({ procedureId: z.string() });

/** Toggle a favorite for the current user. Returns { favorited: boolean }. */
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const userId = (session.user as any).id as string;
  const tenantId = (session.user as any).tenantId as string;
  const globalRole = (session.user as any).globalRole;

  const parsed = schema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const result = await toggleFavorite({ id: userId, tenantId, globalRole }, parsed.data.procedureId);
  if (result.status === "not_found") return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (result.status === "forbidden") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  return NextResponse.json({ favorited: result.favorited });
}

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const userId = (session.user as any).id as string;
  const tenantId = (session.user as any).tenantId as string;
  const globalRole = (session.user as any).globalRole;

  const favorites = await listVisibleFavorites({ id: userId, tenantId, globalRole });
  return NextResponse.json({ favorites });
}
