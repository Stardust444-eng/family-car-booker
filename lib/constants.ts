export const LIMITS = {
  name: 40,
  carName: 24,
  driverName: 24,
  place: 80,
  reason: 140,
  note: 200,
  cars: 6,
  drivers: 12,
  admins: 2,
} as const;

export const CAR_COLORS = [
  { id: "harbor", name: "Harbor", hex: "#2f6f8f" },
  { id: "brake", name: "Brake light", hex: "#c4552a" },
  { id: "leaf", name: "Leaf", hex: "#2f7d4f" },
  { id: "bus", name: "School bus", hex: "#c4920a" },
  { id: "plum", name: "Plum", hex: "#7a4e8a" },
  { id: "slate", name: "Slate", hex: "#4d5c66" },
  { id: "cherry", name: "Cherry", hex: "#a33b4a" },
  { id: "sand", name: "Sand", hex: "#a68462" },
] as const;

export function isCarColor(hex: string): boolean {
  return CAR_COLORS.some((color) => color.hex.toLowerCase() === hex.toLowerCase());
}
