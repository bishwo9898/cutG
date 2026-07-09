import { DashboardShell } from '@/components/dashboard-shell';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}): React.ReactElement {
  return <DashboardShell>{children}</DashboardShell>;
}
