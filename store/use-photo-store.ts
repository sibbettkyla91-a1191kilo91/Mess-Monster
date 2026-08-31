import AsyncStorage from "@react-native-async-storage/async-storage";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

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

export const usePhotoStore = create<PhotoState>()(
  persist(
    (set, get) => ({
      photos: [],

      addPhoto: (record) =>
        set((s) => ({ photos: [record, ...s.photos].slice(0, 200) })), // keep last 200

      totalPhotos: () => get().photos.length,
    }),
    {
      name: "mm-photos",
      storage: createJSONStorage(() => AsyncStorage),
    },
  ),
);
