import { create } from "zustand";
import { persist } from "zustand/middleware";

import { arrayOr, createSafeStorage, isRecord, recordOr } from "./safe-persist";

export interface PhotoRecord {
  taskId: string;
  photoUri: string;
  takenAt: number; // unix ms
}

interface PhotoState {
  /** History of all photo verifications. Watch this array; never expose a filtered-array helper. */
  photos: PhotoRecord[];

  /** Add a new photo verification record */
  addPhoto: (record: PhotoRecord) => void;

  /** Get total photo count (for stats) */
  totalPhotos: () => number;
}

const MAX_PHOTOS = 200;

function pickPhoto(source: unknown): PhotoRecord | null {
  if (!isRecord(source)) return null;
  if (typeof source.taskId !== "string" || typeof source.photoUri !== "string")
    return null;
  if (typeof source.takenAt !== "number" || !Number.isFinite(source.takenAt))
    return null;
  return {
    taskId: source.taskId,
    photoUri: source.photoUri,
    takenAt: source.takenAt,
  };
}

/** Keep only well-formed records, newest first, within the cap. Exported for tests. */
export function sanitizePhotosPersisted(persisted: unknown): PhotoRecord[] {
  return arrayOr(recordOr(persisted).photos)
    .map(pickPhoto)
    .filter((p): p is PhotoRecord => p !== null)
    .slice(0, MAX_PHOTOS);
}

export const usePhotoStore = create<PhotoState>()(
  persist(
    (set, get) => ({
      photos: [],

      addPhoto: (record) =>
        set((s) => ({ photos: [record, ...s.photos].slice(0, MAX_PHOTOS) })),

      totalPhotos: () => get().photos.length,
    }),
    {
      name: "mm-photos",
      storage: createSafeStorage(),
      merge: (persisted, current) =>
        persisted === undefined
          ? current
          : { ...current, photos: sanitizePhotosPersisted(persisted) },
    },
  ),
);
