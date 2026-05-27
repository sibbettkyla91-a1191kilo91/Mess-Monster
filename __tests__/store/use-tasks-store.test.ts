import { useTasksStore } from '@/store/use-tasks-store';
import { CleaningTask } from '@/store/types';

jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn().mockResolvedValue(null),
  setItem: jest.fn().mockResolvedValue(undefined),
  removeItem: jest.fn().mockResolvedValue(undefined),
}));

const makeTask = (overrides: Partial<CleaningTask> = {}): CleaningTask => ({
  id: 'wash-dishes',
  label: 'Wash the dishes',
  category: 'kitchen',
  pointValue: 20,
  completedAt: Date.now(),
  ...overrides,
});

beforeEach(() => {
  useTasksStore.setState({ tasks: [] });
});

// ─── addTask ──────────────────────────────────────────────────────────────────

describe('addTask', () => {
  it('adds a task to an empty list', () => {
    const task = makeTask();
    useTasksStore.getState().addTask(task);
    expect(useTasksStore.getState().tasks).toHaveLength(1);
    expect(useTasksStore.getState().tasks[0]).toEqual(task);
  });

  it('prepends newer tasks to the front of the list', () => {
    const first = makeTask({ id: 'make-bed', label: 'Make the bed' });
    const second = makeTask({ id: 'vacuum', label: 'Vacuum' });

    useTasksStore.getState().addTask(first);
    useTasksStore.getState().addTask(second);

    const { tasks } = useTasksStore.getState();
    expect(tasks[0].id).toBe('vacuum');  // most recent is first
    expect(tasks[1].id).toBe('make-bed');
  });

  it('preserves all task fields', () => {
    const task = makeTask({ pointValue: 40, category: 'bathroom' });
    useTasksStore.getState().addTask(task);
    expect(useTasksStore.getState().tasks[0]).toMatchObject({
      pointValue: 40,
      category: 'bathroom',
    });
  });
});

// ─── removeTask ───────────────────────────────────────────────────────────────

describe('removeTask', () => {
  it('removes a task by id', () => {
    const task = makeTask({ id: 'scrub-toilet' });
    useTasksStore.getState().addTask(task);
    useTasksStore.getState().removeTask('scrub-toilet');
    expect(useTasksStore.getState().tasks).toHaveLength(0);
  });

  it('removes only the matching task when multiple exist', () => {
    useTasksStore.getState().addTask(makeTask({ id: 'task-a' }));
    useTasksStore.getState().addTask(makeTask({ id: 'task-b' }));
    useTasksStore.getState().addTask(makeTask({ id: 'task-c' }));

    useTasksStore.getState().removeTask('task-b');

    const { tasks } = useTasksStore.getState();
    expect(tasks).toHaveLength(2);
    expect(tasks.map((t) => t.id)).not.toContain('task-b');
  });

  it('is a no-op for an id that does not exist', () => {
    useTasksStore.getState().addTask(makeTask({ id: 'task-a' }));
    useTasksStore.getState().removeTask('nonexistent');
    expect(useTasksStore.getState().tasks).toHaveLength(1);
  });
});

// ─── clearHistory ─────────────────────────────────────────────────────────────

describe('clearHistory', () => {
  it('removes all tasks', () => {
    useTasksStore.getState().addTask(makeTask({ id: 'a' }));
    useTasksStore.getState().addTask(makeTask({ id: 'b' }));
    useTasksStore.getState().addTask(makeTask({ id: 'c' }));

    useTasksStore.getState().clearHistory();

    expect(useTasksStore.getState().tasks).toHaveLength(0);
  });

  it('is safe to call on an already-empty list', () => {
    expect(() => useTasksStore.getState().clearHistory()).not.toThrow();
    expect(useTasksStore.getState().tasks).toHaveLength(0);
  });
});
