import { deriveMood, usePetStore } from '@/store/use-pet-store';

jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn().mockResolvedValue(null),
  setItem: jest.fn().mockResolvedValue(undefined),
  removeItem: jest.fn().mockResolvedValue(undefined),
}));

// ─── deriveMood ───────────────────────────────────────────────────────────────

describe('deriveMood', () => {
  const msAgo = (hours: number) => Date.now() - hours * 3_600_000;

  it('returns thriving when cared for within 6 hours', () => {
    expect(deriveMood(msAgo(0))).toBe('thriving');
    expect(deriveMood(msAgo(3))).toBe('thriving');
    expect(deriveMood(msAgo(5.9))).toBe('thriving');
  });

  it('returns happy between 6 and 12 hours', () => {
    expect(deriveMood(msAgo(6))).toBe('happy');
    expect(deriveMood(msAgo(9))).toBe('happy');
    expect(deriveMood(msAgo(11.9))).toBe('happy');
  });

  it('returns neutral between 12 and 24 hours', () => {
    expect(deriveMood(msAgo(12))).toBe('neutral');
    expect(deriveMood(msAgo(18))).toBe('neutral');
    expect(deriveMood(msAgo(23.9))).toBe('neutral');
  });

  it('returns sad between 24 and 48 hours', () => {
    expect(deriveMood(msAgo(24))).toBe('sad');
    expect(deriveMood(msAgo(36))).toBe('sad');
    expect(deriveMood(msAgo(47.9))).toBe('sad');
  });

  it('returns sick after 48 hours or more', () => {
    expect(deriveMood(msAgo(48))).toBe('sick');
    expect(deriveMood(msAgo(72))).toBe('sick');
    expect(deriveMood(msAgo(168))).toBe('sick'); // one week
  });
});

// ─── usePetStore ──────────────────────────────────────────────────────────────

describe('usePetStore', () => {
  beforeEach(() => {
    usePetStore.setState({ lastCaredAt: 0 }); // far in the past → sick
  });

  it('starts with a lastCaredAt timestamp', () => {
    const { lastCaredAt } = usePetStore.getState();
    expect(typeof lastCaredAt).toBe('number');
  });

  it('care() updates lastCaredAt to now', () => {
    const before = Date.now();
    usePetStore.getState().care();
    const { lastCaredAt } = usePetStore.getState();
    expect(lastCaredAt).toBeGreaterThanOrEqual(before);
    expect(lastCaredAt).toBeLessThanOrEqual(Date.now());
  });

  it('mood becomes thriving after care()', () => {
    usePetStore.getState().care();
    expect(deriveMood(usePetStore.getState().lastCaredAt)).toBe('thriving');
  });
});
