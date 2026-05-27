import { randomMonsterName } from '@/store/name-randomizer';

// Exported name pools (re-declared here so tests stay self-contained)
const NILLY_NAMES = [
  'Biscuit', 'Mochi', 'Pudding', 'Jellybean', 'Sprout',
  'Daisy', 'Pebble', 'Coco', 'Tofu', 'Clover',
  'Pistachio', 'Waffles', 'Pippin', 'Turnip', 'Boba',
  'Marshmallow', 'Noodle', 'Tater', 'Doodle', 'Smudge',
  'Bubbles', 'Pickles', 'Pretzel', 'Radish', 'Squishy',
];

const LUNA_NAMES = [
  'Raven', 'Shade', 'Cobweb', 'Hex', 'Grimoire',
  'Nightshade', 'Eclipse', 'Obsidian', 'Vex', 'Murk',
  'Specter', 'Jinx', 'Dusk', 'Morticia', 'Crypt',
  'Banshee', 'Wraith', 'Morbid', 'Styx', 'Phantom',
  'Vesper', 'Nocturne', 'Dirge', 'Blight', 'Voidling',
];

describe('randomMonsterName', () => {
  it('returns a non-empty string', () => {
    const name = randomMonsterName();
    expect(typeof name).toBe('string');
    expect(name.length).toBeGreaterThan(0);
  });

  it('returns a Nilly name when passed "nilly"', () => {
    // Run many times to reduce false-pass probability
    for (let i = 0; i < 50; i++) {
      expect(NILLY_NAMES).toContain(randomMonsterName('nilly'));
    }
  });

  it('never returns a Luna name when passed "nilly"', () => {
    for (let i = 0; i < 50; i++) {
      expect(LUNA_NAMES).not.toContain(randomMonsterName('nilly'));
    }
  });

  it('returns a Luna name when passed "luna"', () => {
    for (let i = 0; i < 50; i++) {
      expect(LUNA_NAMES).toContain(randomMonsterName('luna'));
    }
  });

  it('never returns a Nilly name when passed "luna"', () => {
    for (let i = 0; i < 50; i++) {
      expect(NILLY_NAMES).not.toContain(randomMonsterName('luna'));
    }
  });

  it('returns names from the combined pool when no monster is specified', () => {
    const combined = [...NILLY_NAMES, ...LUNA_NAMES];
    for (let i = 0; i < 50; i++) {
      expect(combined).toContain(randomMonsterName());
    }
  });

  it('uses Math.random to pick the name — first item when random returns 0', () => {
    jest.spyOn(Math, 'random').mockReturnValue(0);
    expect(randomMonsterName('nilly')).toBe(NILLY_NAMES[0]);
    expect(randomMonsterName('luna')).toBe(LUNA_NAMES[0]);
    jest.restoreAllMocks();
  });

  it('uses Math.random to pick the name — last item when random returns just below 1', () => {
    jest.spyOn(Math, 'random').mockReturnValue(0.9999);
    expect(randomMonsterName('nilly')).toBe(NILLY_NAMES[NILLY_NAMES.length - 1]);
    expect(randomMonsterName('luna')).toBe(LUNA_NAMES[LUNA_NAMES.length - 1]);
    jest.restoreAllMocks();
  });
});
