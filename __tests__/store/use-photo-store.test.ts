import { usePhotoStore, PhotoRecord } from '@/store/use-photo-store';

jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn().mockResolvedValue(null),
  setItem: jest.fn().mockResolvedValue(undefined),
  removeItem: jest.fn().mockResolvedValue(undefined),
}));

const makePhoto = (overrides: Partial<PhotoRecord> = {}): PhotoRecord => ({
  taskId: 'wash-dishes',
  photoUri: 'file:///photos/wash-dishes.jpg',
  takenAt: Date.now(),
  ...overrides,
});

beforeEach(() => {
  usePhotoStore.setState({ photos: [] });
});

// ─── addPhoto ─────────────────────────────────────────────────────────────────

describe('addPhoto', () => {
  it('adds a photo to an empty list', () => {
    usePhotoStore.getState().addPhoto(makePhoto());
    expect(usePhotoStore.getState().photos).toHaveLength(1);
  });

  it('prepends photos so the most recent is first', () => {
    const older = makePhoto({ taskId: 'make-bed', takenAt: 1000 });
    const newer = makePhoto({ taskId: 'vacuum',   takenAt: 2000 });

    usePhotoStore.getState().addPhoto(older);
    usePhotoStore.getState().addPhoto(newer);

    expect(usePhotoStore.getState().photos[0].taskId).toBe('vacuum');
  });

  it('preserves all photo fields', () => {
    const photo = makePhoto({ taskId: 'scrub-toilet', photoUri: 'file:///test.jpg', takenAt: 12345 });
    usePhotoStore.getState().addPhoto(photo);
    expect(usePhotoStore.getState().photos[0]).toEqual(photo);
  });

  it('caps history at 200 photos', () => {
    for (let i = 0; i < 210; i++) {
      usePhotoStore.getState().addPhoto(makePhoto({ taskId: `task-${i}`, takenAt: i }));
    }
    expect(usePhotoStore.getState().photos).toHaveLength(200);
  });

  it('keeps the newest photos when the cap is hit', () => {
    for (let i = 0; i < 205; i++) {
      usePhotoStore.getState().addPhoto(makePhoto({ taskId: `task-${i}`, takenAt: i }));
    }
    // The last photo added (task-204) should be at the front
    expect(usePhotoStore.getState().photos[0].taskId).toBe('task-204');
  });
});

// ─── totalPhotos ──────────────────────────────────────────────────────────────

describe('totalPhotos', () => {
  it('returns 0 when no photos exist', () => {
    expect(usePhotoStore.getState().totalPhotos()).toBe(0);
  });

  it('returns the correct count after adding photos', () => {
    usePhotoStore.getState().addPhoto(makePhoto());
    usePhotoStore.getState().addPhoto(makePhoto());
    usePhotoStore.getState().addPhoto(makePhoto());
    expect(usePhotoStore.getState().totalPhotos()).toBe(3);
  });
});

// ─── todayPhotos ──────────────────────────────────────────────────────────────

describe('todayPhotos', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-05-27T12:00:00Z'));
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('returns an empty array when no photos exist', () => {
    expect(usePhotoStore.getState().todayPhotos()).toHaveLength(0);
  });

  it('includes photos taken today', () => {
    const todayPhoto = makePhoto({ takenAt: new Date('2026-05-27T09:00:00Z').getTime() });
    usePhotoStore.getState().addPhoto(todayPhoto);
    expect(usePhotoStore.getState().todayPhotos()).toHaveLength(1);
  });

  it('excludes photos taken before today', () => {
    const yesterday = makePhoto({ takenAt: new Date('2026-05-26T23:59:59Z').getTime() });
    usePhotoStore.getState().addPhoto(yesterday);
    expect(usePhotoStore.getState().todayPhotos()).toHaveLength(0);
  });

  it('correctly separates today and yesterday photos', () => {
    const todayPhoto = makePhoto({ taskId: 'vacuum',   takenAt: new Date('2026-05-27T08:00:00Z').getTime() });
    const oldPhoto   = makePhoto({ taskId: 'make-bed', takenAt: new Date('2026-05-26T20:00:00Z').getTime() });

    usePhotoStore.getState().addPhoto(todayPhoto);
    usePhotoStore.getState().addPhoto(oldPhoto);

    const todays = usePhotoStore.getState().todayPhotos();
    expect(todays).toHaveLength(1);
    expect(todays[0].taskId).toBe('vacuum');
  });
});
