import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import ErdEditor from "@/components/erd-editor";
import { authOptions } from "@/lib/auth-options";

export const dynamic = "force-dynamic";

export default async function DiagramPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/login");

  const { id } = await params;
  return <ErdEditor diagramId={id} />;
}
