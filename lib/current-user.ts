import { getServerSession } from "next-auth";
import { ObjectId } from "mongodb";
import { authOptions } from "@/lib/auth-options";

export async function currentOwnerId() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id || !/^[0-9a-f]{24}$/i.test(session.user.id)) return null;
  return new ObjectId(session.user.id);
}
