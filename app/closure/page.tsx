import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import ClosureBoard from "@/components/closure-board";
import { authOptions } from "@/lib/auth-options";

export const dynamic = "force-dynamic";

export default async function ClosurePage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/login");
  return <ClosureBoard />;
}
