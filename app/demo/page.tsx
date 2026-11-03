import { redirect } from "next/navigation";

import { DEMO_HOUSEHOLD_ID } from "@/lib/demo";

export default function DemoPage() {
  redirect(`/h/${DEMO_HOUSEHOLD_ID}`);
}
