import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import CodeTasksWorkspace from "@/components/code-tasks-workspace";
import { authOptions } from "@/lib/auth-options";

export const dynamic = "force-dynamic";

export default async function CodeTasksPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/login");
  return <CodeTasksWorkspace />;
}
