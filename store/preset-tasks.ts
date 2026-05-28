import { TaskCategory } from './types';

export interface PresetTask {
  id: string;
  label: string;
  category: TaskCategory;
  pointValue: number;
}

export const PRESET_TASKS: PresetTask[] = [
  { id: 'wash-dishes',    label: 'Wash the dishes',    category: 'kitchen',     pointValue: 20 },
  { id: 'wipe-counters',  label: 'Wipe down counters', category: 'kitchen',     pointValue: 15 },
  { id: 'clean-stovetop', label: 'Clean the stovetop', category: 'kitchen',     pointValue: 30 },
  { id: 'scrub-toilet',   label: 'Scrub the toilet',   category: 'bathroom',    pointValue: 40 },
  { id: 'wipe-sink',      label: 'Wipe sink & mirror', category: 'bathroom',    pointValue: 20 },
  { id: 'make-bed',       label: 'Make the bed',       category: 'bedroom',     pointValue: 10 },
  { id: 'tidy-floor',     label: 'Tidy the floor',     category: 'bedroom',     pointValue: 15 },
  { id: 'vacuum',         label: 'Vacuum the floor',   category: 'living_room', pointValue: 30 },
  { id: 'dust-surfaces',  label: 'Dust surfaces',      category: 'living_room', pointValue: 20 },
  { id: 'take-out-trash', label: 'Take out the trash', category: 'trash',       pointValue: 15 },
];

// Mulberry32 — fast, high-quality 32-bit seeded RNG
function makeRng(seed: number): () => number {
  let s = seed;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 0x100000000;
  };
}

function seededShuffle<T>(arr: T[], rng: () => number): T[] {
  const result = [...arr];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

/**
 * Returns `count` tasks from `pool`, balanced across categories, deterministic
 * for a given `dateStr` ("YYYY-MM-DD"). Stable across app restarts on the same day.
 */
export function getDailyRoll(
  dateStr: string,
  pool: PresetTask[] = PRESET_TASKS,
  count = 6,
): PresetTask[] {
  const seed = parseInt(dateStr.replace(/-/g, ''), 10);
  const rng = makeRng(seed);

  // Group by category
  const byCategory = pool.reduce<Record<string, PresetTask[]>>((acc, task) => {
    (acc[task.category] ??= []).push(task);
    return acc;
  }, {});

  // Shuffle both the category order and tasks within each category
  const categories = seededShuffle(Object.keys(byCategory), rng);
  const shuffled = Object.fromEntries(
    categories.map((cat) => [cat, seededShuffle(byCategory[cat], rng)]),
  );

  // Round-robin across categories until we have `count` tasks
  const result: PresetTask[] = [];
  let round = 0;
  while (result.length < count) {
    let added = 0;
    for (const cat of categories) {
      if (result.length >= count) break;
      if (round < shuffled[cat].length) {
        result.push(shuffled[cat][round]);
        added++;
      }
    }
    round++;
    if (added === 0) break; // pool exhausted (shouldn't happen with current data)
  }

  return result;
}
