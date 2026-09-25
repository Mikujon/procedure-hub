import { db } from "@/lib/db";
import type { UserDTO } from "@/lib/types";
import { ROLE_LABELS } from "@/lib/domain";

// Demo "session": no real auth. The current user is Elena Marchetti (OWNER).
const CURRENT_USER_EMAIL = "elena.marchetti@procedurehub.io";

let cached: { id: string; raw: any } | null = null;

export async function getCurrentUserId(): Promise<string> {
  if (cached) return cached.id;
  const user = await db.user.findUnique({ where: { email: CURRENT_USER_EMAIL } });
  if (!user) throw new Error("Current user not found — seed may have failed.");
  cached = { id: user.id, raw: user };
  return user.id;
}

export async function getCurrentUser(): Promise<UserDTO> {
  const id = await getCurrentUserId();
  const user = await db.user.findUnique({
    where: { id },
    include: { department: true },
  });
  if (!user) throw new Error("Current user not found.");
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role as UserDTO["role"],
    title: user.title,
    avatarColor: user.avatarColor,
    departmentId: user.departmentId,
  };
}

export { ROLE_LABELS };
