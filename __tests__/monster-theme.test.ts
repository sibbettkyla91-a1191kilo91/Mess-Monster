import {
  DEFAULT_PALETTE,
  LUNA_PALETTE,
  MonsterPalette,
  NILLY_PALETTE,
} from '@/monster-theme';

const HEX_COLOR = /^#[0-9a-fA-F]{3}([0-9a-fA-F]{3})?$/;

function validatePalette(palette: MonsterPalette) {
  const colorFields: (keyof MonsterPalette)[] = [
    'accent', 'accentLight', 'accentDark', 'text', 'tabTint',
  ];
  for (const field of colorFields) {
    expect(palette[field]).toMatch(HEX_COLOR);
  }
}

// ─── NILLY_PALETTE ────────────────────────────────────────────────────────────

describe('NILLY_PALETTE', () => {
  it('has all required fields', () => {
    expect(NILLY_PALETTE).toHaveProperty('accent');
    expect(NILLY_PALETTE).toHaveProperty('accentLight');
    expect(NILLY_PALETTE).toHaveProperty('accentDark');
    expect(NILLY_PALETTE).toHaveProperty('text');
    expect(NILLY_PALETTE).toHaveProperty('tabTint');
    expect(NILLY_PALETTE).toHaveProperty('monster');
  });

  it('has valid hex color values', () => {
    validatePalette(NILLY_PALETTE);
  });

  it('identifies as nilly', () => {
    expect(NILLY_PALETTE.monster).toBe('nilly');
  });

  it('uses a mint-green accent', () => {
    // Nilly is described as mint green — accent should be a green-ish hex
    expect(NILLY_PALETTE.accent).toBe('#52b788');
  });
});

// ─── LUNA_PALETTE ─────────────────────────────────────────────────────────────

describe('LUNA_PALETTE', () => {
  it('has all required fields', () => {
    expect(LUNA_PALETTE).toHaveProperty('accent');
    expect(LUNA_PALETTE).toHaveProperty('accentLight');
    expect(LUNA_PALETTE).toHaveProperty('accentDark');
    expect(LUNA_PALETTE).toHaveProperty('text');
    expect(LUNA_PALETTE).toHaveProperty('tabTint');
    expect(LUNA_PALETTE).toHaveProperty('monster');
  });

  it('has valid hex color values', () => {
    validatePalette(LUNA_PALETTE);
  });

  it('identifies as luna', () => {
    expect(LUNA_PALETTE.monster).toBe('luna');
  });

  it('uses a red accent (dark witchy aesthetic)', () => {
    expect(LUNA_PALETTE.accent).toBe('#cc2222');
  });
});

// ─── DEFAULT_PALETTE ──────────────────────────────────────────────────────────

describe('DEFAULT_PALETTE', () => {
  it('is the same reference as NILLY_PALETTE', () => {
    expect(DEFAULT_PALETTE).toBe(NILLY_PALETTE);
  });
});

// ─── palette distinctness ─────────────────────────────────────────────────────

describe('palette distinctness', () => {
  it('Nilly and Luna accents are different colors', () => {
    expect(NILLY_PALETTE.accent).not.toBe(LUNA_PALETTE.accent);
  });

  it('Nilly and Luna tabTints are different', () => {
    expect(NILLY_PALETTE.tabTint).not.toBe(LUNA_PALETTE.tabTint);
  });

  it('palettes have different monster identifiers', () => {
    expect(NILLY_PALETTE.monster).not.toBe(LUNA_PALETTE.monster);
  });
});
