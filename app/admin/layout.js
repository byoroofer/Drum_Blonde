import { AdminShell } from "@/components/admin-shell";
import { requireDashboardUser } from "@/core/auth";

export default async function AdminLayout({ children }) {
  const user = await requireDashboardUser();
  return <AdminShell user={user}>{children}</AdminShell>;
}

