export type MonsterId = "nilly" | "luna";

export const MONSTER_IDS: readonly MonsterId[] = ["nilly", "luna"];

/** Treat a missing or unknown selection as Nilly. */
export function resolveMonsterId(id: MonsterId | null | undefined): MonsterId {
  return id === "luna" ? "luna" : "nilly";
}

export const PET_SLICE_KEYS = [
  "health",
  "happiness",
  "lastCaredAt",
  "lastSessionAt",
  "evolutionStage",
  "totalPointsEarned",
  "adultVariant",
  "categoryCompletions",
  "pendingEvolution",
  "pendingPremiumGate",
  "premiumGateShownFor",
] as const;

export type PetSliceKey = (typeof PET_SLICE_KEYS)[number];

export const INVENTORY_SLICE_KEYS = ["owned", "placed", "equipped"] as const;
