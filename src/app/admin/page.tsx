import { redirect } from "next/navigation";
import FarmWorkspace from "@/components/FarmWorkspace";
import { hasAdminSession } from "@/lib/admin-session";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  if (!(await hasAdminSession())) {
    redirect("/admin/login");
  }

  return <FarmWorkspace adminMode initialTab="dashboard" />;
}
