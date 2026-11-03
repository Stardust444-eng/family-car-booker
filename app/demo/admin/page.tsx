import { redirect } from "next/navigation";

import { DEMO_ADMIN_TOKEN } from "@/lib/demo";

export default function DemoAdminPage() {
  redirect(`/a/${DEMO_ADMIN_TOKEN}`);
}
