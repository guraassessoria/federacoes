import { DashboardShellLayout } from "@/components/dashboard-shell-layout";

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <DashboardShellLayout>{children}</DashboardShellLayout>;
}