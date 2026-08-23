import React, { useEffect } from "react";
import {
  View,
  Pressable,
  Text,
  StyleSheet,
  ActivityIndicator,
  Image,
} from "react-native";
import { useMusicStore } from "@/store/use-music-store";
import { usePlayerStore } from "@/store/use-player-store";
import { ThemedText } from "./themed-text";

export function MusicPlayer() {
  const currentSong = useMusicStore((s) => s.currentSong);
  const isPlaying = useMusicStore((s) => s.isPlaying);
  const isLoading = useMusicStore((s) => s.isLoading);
  const error = useMusicStore((s) => s.error);
  const currentIndex = useMusicStore((s) => s.currentIndex);
  const playlistLength = useMusicStore((s) => s.getPlaylistLength());

  const nextSong = useMusicStore((s) => s.nextSong);
  const previousSong = useMusicStore((s) => s.previousSong);
  const togglePlay = useMusicStore((s) => s.togglePlay);
  const fetchPopularHits = useMusicStore((s) => s.fetchPopularHits);

  const canUseMusic = usePlayerStore((s) => s.isPremium);

  // Load music on mount if premium
  useEffect(() => {
    if (canUseMusic && !currentSong && !isLoading) {
      fetchPopularHits();
    }
  }, [canUseMusic]);

  // Don't show player if not premium
  if (!canUseMusic) {
    return null;
  }

  // Loading state
  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="small" color="#52b788" />
        <ThemedText style={styles.loadingText}>Loading music...</ThemedText>
      </View>
    );
  }

  // Error state
  if (error) {
    return (
      <View style={styles.errorContainer}>
        <ThemedText style={styles.errorText}>🎵 Music unavailable</ThemedText>
        <Pressable
          style={({ pressed }) => [
            {
              opacity: pressed ? 0.6 : 1,
            },
          ]}
          onPress={() => fetchPopularHits()}
        >
          <ThemedText style={styles.retryText}>Retry</ThemedText>
        </Pressable>
      </View>
    );
  }

  // No songs loaded
  if (!currentSong) {
    return null;
  }

  return (
    <View style={styles.container}>
      {/* Album Art */}
      {currentSong.imageUrl ? (
        <Image source={{ uri: currentSong.imageUrl }} style={styles.albumArt} />
      ) : (
        <View style={[styles.albumArt, styles.placeholderAlbumArt]}>
          <Text style={styles.placeholderEmoji}>🎵</Text>
        </View>
      )}

      {/* Song Info */}
      <View style={styles.infoContainer}>
        <ThemedText style={styles.songName} numberOfLines={1}>
          {currentSong.name}
        </ThemedText>
        <ThemedText style={styles.artistName} numberOfLines={1}>
          {currentSong.artist}
        </ThemedText>
      </View>

      {/* Controls */}
      <View style={styles.controls}>
        <Pressable
          style={({ pressed }) => [
            styles.controlButton,
            { opacity: pressed ? 0.6 : 1 },
          ]}
          onPress={previousSong}
        >
          <Text style={styles.controlText}>⏮</Text>
        </Pressable>

        <Pressable
          style={({ pressed }) => [
            styles.playButton,
            { opacity: pressed ? 0.6 : 1 },
          ]}
          onPress={togglePlay}
        >
          <Text style={styles.playButtonText}>{isPlaying ? "⏸" : "▶"}</Text>
        </Pressable>

        <Pressable
          style={({ pressed }) => [
            styles.controlButton,
            { opacity: pressed ? 0.6 : 1 },
          ]}
          onPress={nextSong}
        >
          <Text style={styles.controlText}>⏭</Text>
        </Pressable>
      </View>

      {/* Playlist Position */}
      <ThemedText style={styles.playlistInfo}>
        {currentIndex + 1} / {playlistLength}
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: "rgba(82, 183, 136, 0.1)",
    borderRadius: 12,
    padding: 12,
    gap: 8,
    marginBottom: 16,
  },
  loadingContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "rgba(82, 183, 136, 0.1)",
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
  },
  loadingText: {
    fontSize: 12,
    opacity: 0.7,
  },
  errorContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "rgba(204, 34, 34, 0.1)",
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
  },
  errorText: {
    fontSize: 12,
    flex: 1,
  },
  retryText: {
    fontSize: 12,
    color: "#52b788",
    fontWeight: "600",
  },
  albumArt: {
    width: "100%",
    aspectRatio: 1,
    borderRadius: 8,
    backgroundColor: "#2a2a3e",
  },
  placeholderAlbumArt: {
    justifyContent: "center",
    alignItems: "center",
  },
  placeholderEmoji: {
    fontSize: 40,
  },
  infoContainer: {
    gap: 2,
  },
  songName: {
    fontSize: 14,
    fontWeight: "600",
  },
  artistName: {
    fontSize: 12,
    opacity: 0.7,
  },
  controls: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 20,
    marginTop: 4,
  },
  controlButton: {
    width: 40,
    height: 40,
    justifyContent: "center",
    alignItems: "center",
  },
  controlText: {
    fontSize: 18,
  },
  playButton: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: "#52b788",
    justifyContent: "center",
    alignItems: "center",
  },
  playButtonText: {
    fontSize: 20,
    color: "#fff",
  },
  playlistInfo: {
    textAlign: "center",
    fontSize: 11,
    opacity: 0.5,
  },
});
