import { redirect } from "next/navigation";
import FarmWorkspace from "@/components/FarmWorkspace";
import { getSessionUser } from "@/lib/user-session";

export const dynamic = "force-dynamic";

export default async function Home() {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  return <FarmWorkspace currentUser={user} />;
}
