"use client";

import { createContext, useContext, useState } from "react";

import { AdminFrame, BoardSkeleton, FamilyFrame, LoadError } from "@/components/frame";
import { usePoll } from "@/components/use-poll";
import type { AdminPayload, Driver, HouseholdPayload } from "@/lib/types";

type GarageContextValue = {
  data: HouseholdPayload;
  driver: Driver | null;
  chooseDriver: (id: string) => void;
  apply: (next: HouseholdPayload) => void;
  reload: () => Promise<void>;
};

const GarageContext = createContext<GarageContextValue | null>(null);

export function useGarage(): GarageContextValue {
  const value = useContext(GarageContext);
  if (!value) throw new Error("The garage screen is outside its provider.");
  return value;
}

function storedDriver(householdId: string, drivers: Driver[]): string | null {
  if (typeof window === "undefined") return null;
  const saved = localStorage.getItem(`fcb-driver:${householdId}`);
  if (saved && drivers.some((driver) => driver.id === saved)) return saved;
  return null;
}

export function HouseholdProvider({
  householdId,
  children,
}: {
  householdId: string;
  children: React.ReactNode;
}) {
  const poll = usePoll<HouseholdPayload>(`/api/households/${householdId}`);
  const [scope, setScope] = useState(householdId);
  const [picked, setPicked] = useState<string | null | undefined>(undefined);
  if (scope !== householdId) {
    setScope(householdId);
    setPicked(undefined);
  }

  if (!poll.data) {
    return (
      <FamilyFrame householdId={householdId}>
        {poll.error && !poll.loading ? (
          <LoadError message={poll.error} onRetry={() => void poll.load()} />
        ) : (
          <BoardSkeleton />
        )}
      </FamilyFrame>
    );
  }

  const data = poll.data;
  const driverId = picked !== undefined ? picked : storedDriver(data.household.id, data.drivers);
  const driver = data.drivers.find((item) => item.id === driverId) ?? null;

  return (
    <GarageContext.Provider
      value={{
        data,
        driver,
        chooseDriver: (id: string) => {
          localStorage.setItem(`fcb-driver:${data.household.id}`, id);
          setPicked(id);
        },
        apply: poll.apply,
        reload: poll.load,
      }}
    >
      <FamilyFrame householdId={householdId}>{children}</FamilyFrame>
    </GarageContext.Provider>
  );
}

type AdminContextValue = {
  data: AdminPayload;
  apply: (next: HouseholdPayload) => void;
  reload: () => Promise<void>;
};

const AdminContext = createContext<AdminContextValue | null>(null);

export function useAdmin(): AdminContextValue {
  const value = useContext(AdminContext);
  if (!value) throw new Error("The approval screen is outside its provider.");
  return value;
}

export function AdminProvider({ token, children }: { token: string; children: React.ReactNode }) {
  const poll = usePoll<AdminPayload>(`/api/admin/${token}`);

  const apply = (next: HouseholdPayload) => {
    const carried = next as HouseholdPayload & { adminToken?: string };
    poll.apply({ ...next, adminToken: carried.adminToken ?? token });
  };

  if (!poll.data) {
    return (
      <AdminFrame token={token}>
        {poll.error && !poll.loading ? (
          <LoadError message={poll.error} onRetry={() => void poll.load()} />
        ) : (
          <BoardSkeleton />
        )}
      </AdminFrame>
    );
  }

  return (
    <AdminContext.Provider value={{ data: poll.data, apply, reload: poll.load }}>
      <AdminFrame token={token} householdId={poll.data.household.id} name={poll.data.household.name}>
        {children}
      </AdminFrame>
    </AdminContext.Provider>
  );
}
