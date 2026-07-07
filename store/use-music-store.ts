import { create } from "zustand";

export interface SpotifySong {
  id: string;
  name: string;
  artist: string;
  album: string;
  imageUrl: string;
  previewUrl: string | null; // May be null if preview unavailable
  externalUrl: string;
}

interface MusicState {
  // Current playback
  currentSong: SpotifySong | null;
  isPlaying: boolean;
  playlist: SpotifySong[];
  currentIndex: number;

  // UI state
  isLoading: boolean;
  error: string | null;
  lastFetchedAt: number | null;
}

interface MusicStore extends MusicState {
  // Playlist management
  fetchPopularHits: () => Promise<void>;
  nextSong: () => void;
  previousSong: () => void;
  togglePlay: () => void;
  setSong: (song: SpotifySong) => void;

  // Helpers
  getCurrentSong: () => SpotifySong | null;
  getPlaylistLength: () => number;
}

export const useMusicStore = create<MusicStore>((set, get) => ({
  currentSong: null,
  isPlaying: false,
  playlist: [],
  currentIndex: 0,
  isLoading: false,
  error: null,
  lastFetchedAt: null,

  // Fetch popular hits from Spotify free API
  fetchPopularHits: async () => {
    set({ isLoading: true, error: null });
    try {
      // Using Spotify's public API (no authentication required for some endpoints)
      // This fetches the top 50 tracks globally
      const response = await fetch(
        "https://api.spotify.com/v1/browse/new-releases?country=US&limit=50",
        {
          headers: {
            Accept: "application/json",
          },
        },
      );

      if (!response.ok) {
        throw new Error(`Spotify API error: ${response.status}`);
      }

      const data = await response.json();

      // Transform Spotify albums/tracks to our format
      const songs: SpotifySong[] =
        data.albums?.items?.slice(0, 30).map((album: any) => ({
          id: album.id,
          name: album.name,
          artist: album.artists?.[0]?.name || "Unknown",
          album: album.name,
          imageUrl: album.images?.[0]?.url || "",
          previewUrl: null, // New releases don't have preview URLs
          externalUrl: album.external_urls?.spotify || "",
        })) || [];

      if (songs.length === 0) {
        throw new Error("No songs fetched from Spotify");
      }

      set({
        playlist: songs,
        currentSong: songs[0],
        currentIndex: 0,
        isLoading: false,
        lastFetchedAt: Date.now(),
      });
    } catch (error) {
      console.error("Failed to fetch Spotify songs:", error);
      set({
        error: error instanceof Error ? error.message : "Failed to load music",
        isLoading: false,
      });
    }
  },

  // Skip to next song
  nextSong: () => {
    const state = get();
    const nextIndex = (state.currentIndex + 1) % state.playlist.length;
    set({
      currentIndex: nextIndex,
      currentSong: state.playlist[nextIndex] || null,
    });
  },

  // Go to previous song
  previousSong: () => {
    const state = get();
    const prevIndex =
      state.currentIndex === 0
        ? state.playlist.length - 1
        : state.currentIndex - 1;
    set({
      currentIndex: prevIndex,
      currentSong: state.playlist[prevIndex] || null,
    });
  },

  // Toggle play/pause
  togglePlay: () => {
    set((state) => ({
      isPlaying: !state.isPlaying,
    }));
  },

  // Manually set current song
  setSong: (song: SpotifySong) => {
    const state = get();
    const index = state.playlist.findIndex((s) => s.id === song.id);
    set({
      currentSong: song,
      currentIndex: index >= 0 ? index : 0,
    });
  },

  // Get current song
  getCurrentSong: () => get().currentSong,

  // Get playlist length
  getPlaylistLength: () => get().playlist.length,
}));
