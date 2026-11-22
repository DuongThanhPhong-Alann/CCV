import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import DashboardPage from "@/components/dashboard-page";
import { authOptions } from "@/lib/auth-options";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/login");

  return <DashboardPage />;
}
