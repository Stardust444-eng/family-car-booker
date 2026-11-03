import { HouseholdProvider } from "@/components/providers";

export default async function HouseholdLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <HouseholdProvider householdId={id}>{children}</HouseholdProvider>;
}
