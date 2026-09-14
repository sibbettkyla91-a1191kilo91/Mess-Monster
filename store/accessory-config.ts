/**
 * Accessory wear — the only file to edit after a sprite redraw.
 *
 * Anchors are fractions of the monster picture box (not the phone screen),
 * so they survive different devices. After new art lands, open the Tune tab,
 * nudge the sliders, and paste the printed block back into ACCESSORY_ANCHORS.
 *
 * LAYERING (current art):
 * The monster is one flat image. Horns and head are the same pixels. An
 * accessory cannot sit "behind the horns" — that would hide it behind the
 * whole body. zIndex only orders accessories against each other. Everything
 * draws in front of the monster. True behind-horns layering needs layered
 * sprite exports later; do not try to fake it here.
 */

export type AccessoryMonster = "nilly" | "luna";
export type AccessoryStage = "baby" | "teen" | "adult";
export type AccessorySlot = "head" | "face" | "neck";

export interface SlotAnchor {
  /** Center left/right. 0 = left edge of the monster picture, 1 = right. */
  x: number;
  /** Center up/down. 0 = top of the monster picture, 1 = bottom. */
  y: number;
  /** Size vs the monster picture. 1 = same size as the monster square. */
  scale: number;
  /** Tilt in degrees. 0 = upright. Negative tilts one way, positive the other. */
  rotation: number;
  /** Draw order among accessories only (higher = in front of other items). */
  zIndex: number;
}

/**
 * TEMPORARY: Luna's witch hat is painted into the base sprite; no hatless
 * art exists yet. Set to false when that art lands — no other code change.
 */
export const LUNA_HEAD_SLOT_LOCKED = true;

export const ACCESSORY_STAGES: AccessoryStage[] = ["baby", "teen", "adult"];
export const ACCESSORY_SLOTS: AccessorySlot[] = ["head", "face", "neck"];

export type AccessoryAnimation =
  | { kind: "static" }
  | {
      kind: "transform";
      /** bob = up/down, sway = left/right, tilt = extra rotate */
      preset: "bob" | "sway" | "tilt";
      amount?: number;
      durationMs?: number;
    }
  | {
      /**
       * Future: play an array of image frames. Not built yet — the
       * renderer treats this as static so adding frames later is a
       * new branch, not a rewrite.
       */
      kind: "frames";
      frames: unknown[];
      fps?: number;
    };

export interface AccessoryDef {
  id: string;
  slot: AccessorySlot;
  animation: AccessoryAnimation;
}

export const ACCESSORY_DEFS: Record<string, AccessoryDef> = {
  "acc-bow": {
    id: "acc-bow",
    slot: "head",
    animation: { kind: "transform", preset: "bob", amount: 3, durationMs: 1400 },
  },
  "acc-crown": { id: "acc-crown", slot: "head", animation: { kind: "static" } },
  "acc-flower": { id: "acc-flower", slot: "head", animation: { kind: "static" } },
  "acc-witch-hat": {
    id: "acc-witch-hat",
    slot: "head",
    animation: { kind: "static" },
  },
  "acc-sunglasses": {
    id: "acc-sunglasses",
    slot: "face",
    animation: { kind: "static" },
  },
  "acc-scarf": { id: "acc-scarf", slot: "neck", animation: { kind: "static" } },
};

export const ACCESSORY_IDS = Object.keys(ACCESSORY_DEFS);

/** Rough starting values — tune in the Tune tab, don't chase perfection here. */
const NILLY_ANCHORS: Record<AccessoryStage, Record<AccessorySlot, SlotAnchor>> =
  {
    baby: {
      head: { x: 0.5, y: 0.22, scale: 0.42, rotation: 0, zIndex: 2 },
      face: { x: 0.5, y: 0.4, scale: 0.36, rotation: 0, zIndex: 3 },
      neck: { x: 0.5, y: 0.6, scale: 0.4, rotation: 0, zIndex: 1 },
    },
    teen: {
      head: { x: 0.5, y: 0.18, scale: 0.4, rotation: 0, zIndex: 2 },
      face: { x: 0.5, y: 0.36, scale: 0.34, rotation: 0, zIndex: 3 },
      neck: { x: 0.5, y: 0.56, scale: 0.38, rotation: 0, zIndex: 1 },
    },
    adult: {
      // New adult bust: horns at the top, crystal in the left hand.
      head: { x: 0.5, y: 0.14, scale: 0.3, rotation: 0, zIndex: 2 },
      face: { x: 0.5, y: 0.4, scale: 0.24, rotation: 0, zIndex: 3 },
      neck: { x: 0.5, y: 0.62, scale: 0.3, rotation: 0, zIndex: 1 },
    },
  };

const LUNA_ANCHORS: Record<AccessoryStage, Record<AccessorySlot, SlotAnchor>> = {
  baby: {
    head: { x: 0.5, y: 0.18, scale: 0.44, rotation: 0, zIndex: 2 },
    face: { x: 0.5, y: 0.38, scale: 0.36, rotation: 0, zIndex: 3 },
    neck: { x: 0.5, y: 0.58, scale: 0.4, rotation: 0, zIndex: 1 },
  },
  teen: {
    head: { x: 0.5, y: 0.14, scale: 0.42, rotation: 0, zIndex: 2 },
    face: { x: 0.5, y: 0.34, scale: 0.34, rotation: 0, zIndex: 3 },
    neck: { x: 0.5, y: 0.54, scale: 0.38, rotation: 0, zIndex: 1 },
  },
  adult: {
    // Canonical adult art: painted-in hat + horns, amber eyes lower in frame.
    head: { x: 0.5, y: 0.18, scale: 0.36, rotation: 0, zIndex: 2 },
    face: { x: 0.5, y: 0.42, scale: 0.26, rotation: 0, zIndex: 3 },
    neck: { x: 0.5, y: 0.58, scale: 0.32, rotation: 0, zIndex: 1 },
  },
};

export const ACCESSORY_ANCHORS: Record<
  AccessoryMonster,
  Record<AccessoryStage, Record<AccessorySlot, SlotAnchor>>
> = {
  nilly: NILLY_ANCHORS,
  luna: LUNA_ANCHORS,
};

export function resolveAccessoryStage(
  stage: string,
): AccessoryStage | null {
  if (stage === "baby" || stage === "teen" || stage === "adult") return stage;
  if (stage === "ascended") return "adult";
  return null;
}

export function getSlotAnchor(
  monster: AccessoryMonster,
  stage: AccessoryStage,
  slot: AccessorySlot,
): SlotAnchor {
  return ACCESSORY_ANCHORS[monster][stage][slot];
}

export function getAccessoryDef(itemId: string): AccessoryDef | undefined {
  return ACCESSORY_DEFS[itemId];
}

export function isAccessorySlotLocked(
  monster: AccessoryMonster,
  slot: AccessorySlot,
): boolean {
  return LUNA_HEAD_SLOT_LOCKED && monster === "luna" && slot === "head";
}

export function formatAnchorSnippet(
  monster: AccessoryMonster,
  stage: AccessoryStage,
  slot: AccessorySlot,
  anchor: SlotAnchor,
): string {
  return `[${monster} / ${stage} / ${slot}]
{
  x: ${anchor.x},
  y: ${anchor.y},
  scale: ${anchor.scale},
  rotation: ${anchor.rotation},
  zIndex: ${anchor.zIndex},
}`;
}
