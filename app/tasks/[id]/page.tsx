import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import TaskDetail from "@/components/task-detail";
import { authOptions } from "@/lib/auth-options";

export const dynamic = "force-dynamic";

export default async function TaskDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/login");
  const { id } = await params;
  return <TaskDetail taskId={id} />;
}
