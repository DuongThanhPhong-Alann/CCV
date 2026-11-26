import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import CodeTaskDetail from "@/components/code-task-detail";
import { authOptions } from "@/lib/auth-options";

export const dynamic = "force-dynamic";

export default async function CodeTaskDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/login");
  const { id } = await params;
  return <CodeTaskDetail taskId={id} />;
}
