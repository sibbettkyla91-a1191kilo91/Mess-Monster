/**
 * Monster name randomizer.
 * Nilly names lean kawaii/cosy; Luna names lean spooky/mystical.
 */

const NILLY_NAMES = [
  "Biscuit",
  "Mochi",
  "Pudding",
  "Jellybean",
  "Sprout",
  "Daisy",
  "Pebble",
  "Coco",
  "Tofu",
  "Clover",
  "Pistachio",
  "Waffles",
  "Pippin",
  "Turnip",
  "Boba",
  "Marshmallow",
  "Noodle",
  "Tater",
  "Doodle",
  "Smudge",
  "Bubbles",
  "Pickles",
  "Pretzel",
  "Radish",
  "Squishy",
];

const LUNA_NAMES = [
  "Raven",
  "Shade",
  "Cobweb",
  "Hex",
  "Grimoire",
  "Nightshade",
  "Eclipse",
  "Obsidian",
  "Vex",
  "Murk",
  "Specter",
  "Jinx",
  "Dusk",
  "Morticia",
  "Crypt",
  "Banshee",
  "Wraith",
  "Morbid",
  "Styx",
  "Phantom",
  "Vesper",
  "Nocturne",
  "Dirge",
  "Blight",
  "Voidling",
];

/**
 * Returns a random monster name.
 * If `monster` is provided, picks from that character's name pool.
 * Otherwise draws from the full combined pool.
 */
export function randomMonsterName(monster?: "nilly" | "luna"): string {
  const pool =
    monster === "nilly"
      ? NILLY_NAMES
      : monster === "luna"
        ? LUNA_NAMES
        : [...NILLY_NAMES, ...LUNA_NAMES];
  return pool[Math.floor(Math.random() * pool.length)];
}
