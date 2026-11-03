import { AdminProvider } from "@/components/providers";

export default async function ApprovalLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  return <AdminProvider token={token}>{children}</AdminProvider>;
}
