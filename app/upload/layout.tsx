import { DashboardShellLayout } from "@/components/dashboard-shell-layout";

export default function UploadLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <DashboardShellLayout>{children}</DashboardShellLayout>;
}