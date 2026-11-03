"use client";

import { GarageHeader } from "@/components/bits";
import { WeekView } from "@/components/week-view";
import { useAdmin, useGarage } from "@/components/providers";

export function FamilyWeek() {
  const { data, apply } = useGarage();
  return (
    <WeekView
      data={data}
      apply={apply}
      heading={<GarageHeader title="This week" backHref={`/h/${data.household.id}`} />}
    />
  );
}

export function AdminWeek() {
  const { data, apply } = useAdmin();
  return <WeekView data={data} apply={apply} heading={<h1 className="mb-4 text-[2rem]">This week</h1>} />;
}
