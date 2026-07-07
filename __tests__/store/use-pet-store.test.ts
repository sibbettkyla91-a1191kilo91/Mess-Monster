import { deriveMood, usePetStore } from "@/store/use-pet-store";

jest.mock("@react-native-async-storage/async-storage", () => ({
  getItem: jest.fn().mockResolvedValue(null),
  setItem: jest.fn().mockResolvedValue(undefined),
  removeItem: jest.fn().mockResolvedValue(undefined),
}));

const hoursAgo = (h: number) => Date.now() - h * 3_600_000;

beforeEach(() => {
  usePetStore.setState({
    health: 100,
    happiness: 100,
    lastCaredAt: Date.now(),
    lastSessionAt: Date.now(),
  });
});

// ─── deriveMood ───────────────────────────────────────────────────────────────

describe("deriveMood", () => {
  it("returns thriving when both stats are high (avg >= 75)", () => {
    expect(deriveMood(100, 100)).toBe("thriving");
    expect(deriveMood(80, 80)).toBe("thriving");
    expect(deriveMood(75, 76)).toBe("thriving"); // avg = 75.5
  });

  it("returns happy in the mid-high range (avg 55–74)", () => {
    expect(deriveMood(60, 60)).toBe("happy");
    expect(deriveMood(70, 42)).toBe("happy"); // avg = 56
    expect(deriveMood(55, 56)).toBe("happy"); // avg = 55.5
  });

  it("returns neutral in the middle range (avg 35–54)", () => {
    expect(deriveMood(40, 40)).toBe("neutral");
    expect(deriveMood(50, 22)).toBe("neutral"); // avg = 36
    expect(deriveMood(35, 36)).toBe("neutral"); // avg = 35.5
  });

  it("returns sad in the low range (avg 15–34)", () => {
    expect(deriveMood(20, 20)).toBe("sad");
    expect(deriveMood(30, 2)).toBe("sad"); // avg = 16
    expect(deriveMood(15, 16)).toBe("sad"); // avg = 15.5
  });

  it("returns sick when stats are very low (avg < 15)", () => {
    expect(deriveMood(0, 0)).toBe("sick");
    expect(deriveMood(14, 14)).toBe("sick"); // avg = 14
    expect(deriveMood(20, 8)).toBe("sick"); // avg = 14
  });
});

// ─── usePetStore ──────────────────────────────────────────────────────────────

describe("usePetStore", () => {
  it("initialises with full stats", () => {
    const { health, happiness } = usePetStore.getState();
    expect(health).toBe(100);
    expect(happiness).toBe(100);
  });

  it("mood is thriving with full stats", () => {
    const { health, happiness } = usePetStore.getState();
    expect(deriveMood(health, happiness)).toBe("thriving");
  });
});

// ─── care ─────────────────────────────────────────────────────────────────────

describe("care()", () => {
  it("boosts health and happiness", () => {
    usePetStore.setState({ health: 50, happiness: 40 });
    usePetStore.getState().care();
    const { health, happiness } = usePetStore.getState();
    expect(health).toBe(65); // 50 + 15
    expect(happiness).toBe(60); // 40 + 20
  });

  it("caps both stats at 100", () => {
    usePetStore.setState({ health: 95, happiness: 90 });
    usePetStore.getState().care();
    const { health, happiness } = usePetStore.getState();
    expect(health).toBe(100);
    expect(happiness).toBe(100); // 90 + 20 would exceed 100
  });

  it("updates lastCaredAt to now", () => {
    const before = Date.now();
    usePetStore.getState().care();
    expect(usePetStore.getState().lastCaredAt).toBeGreaterThanOrEqual(before);
  });

  it("mood becomes thriving after care() from a low state", () => {
    usePetStore.setState({ health: 100, happiness: 100 });
    const { health, happiness } = usePetStore.getState();
    expect(deriveMood(health, happiness)).toBe("thriving");
  });
});

// ─── applyDecay ───────────────────────────────────────────────────────────────

describe("applyDecay()", () => {
  it("decays health and happiness proportionally to elapsed hours", () => {
    usePetStore.setState({
      health: 100,
      happiness: 100,
      lastSessionAt: hoursAgo(2),
    });
    usePetStore.getState().applyDecay();
    const { health, happiness } = usePetStore.getState();
    // health:    100 - 1.5 * 2 = 97
    // happiness: 100 - 2.0 * 2 = 96
    expect(health).toBeCloseTo(97, 0);
    expect(happiness).toBeCloseTo(96, 0);
  });

  it("applies correct decay after 24 hours", () => {
    usePetStore.setState({
      health: 100,
      happiness: 100,
      lastSessionAt: hoursAgo(24),
    });
    usePetStore.getState().applyDecay();
    const { health, happiness } = usePetStore.getState();
    // health:    100 - 1.5 * 24 = 64
    // happiness: 100 - 2.0 * 24 = 52
    expect(health).toBeCloseTo(64, 0);
    expect(happiness).toBeCloseTo(52, 0);
    expect(deriveMood(health, happiness)).toBe("happy");
  });

  it("clamps stats to 0 — never goes negative", () => {
    usePetStore.setState({
      health: 100,
      happiness: 100,
      lastSessionAt: hoursAgo(1000),
    });
    usePetStore.getState().applyDecay();
    expect(usePetStore.getState().health).toBe(0);
    expect(usePetStore.getState().happiness).toBe(0);
  });

  it("updates lastSessionAt to now", () => {
    const before = Date.now();
    usePetStore.setState({ lastSessionAt: hoursAgo(2) });
    usePetStore.getState().applyDecay();
    expect(usePetStore.getState().lastSessionAt).toBeGreaterThanOrEqual(before);
  });

  it("is a no-op when elapsed time is trivially small (< 36 s)", () => {
    usePetStore.setState({ health: 80, happiness: 75 });
    // lastSessionAt defaults to Date.now() from beforeEach — elapsed ≈ 0
    usePetStore.getState().applyDecay();
    expect(usePetStore.getState().health).toBe(80);
    expect(usePetStore.getState().happiness).toBe(75);
  });

  it("mood is sick after 60+ hours of neglect", () => {
    usePetStore.setState({
      health: 100,
      happiness: 100,
      lastSessionAt: hoursAgo(60),
    });
    usePetStore.getState().applyDecay();
    const { health, happiness } = usePetStore.getState();
    // health:    100 - 1.5 * 60 = 10
    // happiness: 100 - 2.0 * 60 = 0 (clamped)
    // avg = 5 → sick
    expect(deriveMood(health, happiness)).toBe("sick");
  });
});
