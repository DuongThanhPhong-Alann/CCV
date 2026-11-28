import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import ActivityMonitor from "@/components/activity-monitor";
import { isActivityAdminEmail } from "@/lib/activity-types";
import { authOptions } from "@/lib/auth-options";

export const dynamic = "force-dynamic";

export default async function ActivityPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/login");
  if (!isActivityAdminEmail(session.user.email)) redirect("/");
  return <ActivityMonitor />;
}
