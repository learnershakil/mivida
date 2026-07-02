import { Paths, Directory, File } from 'expo-file-system';
import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import { Audio, AVPlaybackStatus } from 'expo-av';
import { database } from '../database';
import MusicTrack from '../database/models/MusicTrack';
import MusicCategory from '../database/models/MusicCategory';
import { emitEvent, EventTypes } from './eventLogger';

// Directory for storing music files
const getMusicDirectory = () => new Directory(Paths.document, 'music');

// Directory for storing album art
const getAlbumArtDirectory = () => new Directory(Paths.document, 'album_art');

// Ensure music directory exists
export const ensureMusicDirectory = async (): Promise<Directory> => {
  const musicDir = getMusicDirectory();
  if (!musicDir.exists) {
    musicDir.create();
  }
  return musicDir;
};

// Ensure album art directory exists
export const ensureAlbumArtDirectory = async (): Promise<Directory> => {
  const artDir = getAlbumArtDirectory();
  if (!artDir.exists) {
    artDir.create();
  }
  return artDir;
};

// Default album arts for system categories
export const DEFAULT_ALBUM_ARTS: Record<string, string> = {
  focus: 'https://images.unsplash.com/photo-1614613535308-eb5fbd3d2c17?q=80&w=300',
  ambient: 'https://images.unsplash.com/photo-1515694346937-94d85e41e6f0?q=80&w=300',
  motivation: 'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?q=80&w=300',
  sleep: 'https://images.unsplash.com/photo-1489549132488-d00b7eee80f1?q=80&w=300',
  other: 'https://images.unsplash.com/photo-1511379938547-c1f69419868d?q=80&w=300',
  default: 'https://images.unsplash.com/photo-1511379938547-c1f69419868d?q=80&w=300',
};

// Get audio duration using expo-av
export const getAudioDuration = async (uri: string): Promise<number> => {
  try {
    const { sound, status } = await Audio.Sound.createAsync({ uri }, { shouldPlay: false });

    if (status.isLoaded && status.durationMillis) {
      await sound.unloadAsync();
      return Math.floor(status.durationMillis / 1000); // Return seconds
    }

    await sound.unloadAsync();
    return 0;
  } catch (error) {
    console.error('[MusicService] Error getting audio duration:', error);
    return 0;
  }
};

// Pick audio files from device
export const pickAudioFiles = async (): Promise<DocumentPicker.DocumentPickerResult> => {
  try {
    const result = await DocumentPicker.getDocumentAsync({
      type: 'audio/*',
      multiple: true,
      copyToCacheDirectory: true,
    });

    return result;
  } catch (error) {
    console.error('[MusicService] Error picking audio files:', error);
    throw error;
  }
};

// Parse filename to extract title and artist
export const parseFileName = (fileName: string): { title: string; artist: string } => {
  // Remove extension
  const nameWithoutExt = fileName.replace(/\.[^.]+$/, '');

  // Try to split by " - " (common format: "Artist - Title")
  if (nameWithoutExt.includes(' - ')) {
    const parts = nameWithoutExt.split(' - ');
    return {
      artist: parts[0].trim(),
      title: parts.slice(1).join(' - ').trim(),
    };
  }

  // Default: use filename as title, unknown artist
  return {
    title: nameWithoutExt.trim(),
    artist: 'Unknown Artist',
  };
};

// Add track to library
export const addTrackToLibrary = async (
  fileUri: string,
  fileName: string,
  userId: string,
  category: string = 'other',
  customTitle?: string,
  customArtist?: string
): Promise<MusicTrack> => {
  const musicDir = await ensureMusicDirectory();

  // Generate unique filename
  const uniqueFileName = `${Date.now()}_${fileName}`;

  // Create source and destination file objects
  const sourceFile = new File(fileUri);
  const destFile = new File(musicDir, uniqueFileName);

  // Copy file to app's internal storage
  sourceFile.copy(destFile);

  // Get audio duration
  const duration = await getAudioDuration(destFile.uri);

  // Parse filename if custom title/artist not provided
  const parsed = parseFileName(fileName);
  const title = customTitle || parsed.title;
  const artist = customArtist || parsed.artist;

  // Create track in database
  const track = await database.write(async () => {
    return database.get<MusicTrack>('music_tracks').create((t) => {
      t.title = title;
      t.artist = artist;
      t.album = '';
      t.fileUri = destFile.uri;
      t.fileName = uniqueFileName;
      t.duration = duration;
      t.category = category;
      t.isFavorite = false;
      t.playCount = 0;
      t.userId = userId;
    });
  });

  // Log event
  await emitEvent({
    eventType: EventTypes.MUSIC_PLAYBACK,
    entityType: 'music',
    entityId: track.id,
    payload: { action: 'added', trackTitle: title, artist, category },
    userId,
  });

  console.log('[MusicService] Track added:', title);

  // Cloud copy: push the audio file to R2 in the background and store the key (syncs to MusicTrack.r2Key).
  (async () => {
    try {
      const { uploadToR2 } = await import('./uploadService');
      const key = await uploadToR2(destFile.uri, 'music', 'audio/mpeg');
      await database.write(async () => {
        await track.update((t) => {
          t.r2Key = key;
        });
      });
      console.log('[MusicService] track uploaded to R2:', key);
    } catch (e) {
      console.warn('[MusicService] R2 upload failed (kept local)', e);
    }
  })();

  return track;
};

// Delete track from library
export const deleteTrack = async (track: MusicTrack, userId: string): Promise<void> => {
  // Delete file from storage
  try {
    const file = new File(track.fileUri);
    if (file.exists) {
      file.delete();
    }
  } catch (error) {
    console.warn('[MusicService] Error deleting file:', error);
  }

  // Log event before deletion
  await emitEvent({
    eventType: EventTypes.MUSIC_PLAYBACK,
    entityType: 'music',
    entityId: track.id,
    payload: { action: 'deleted', trackTitle: track.title },
    userId,
  });

  // Delete from database
  await database.write(async () => {
    await track.destroyPermanently();
  });

  console.log('[MusicService] Track deleted:', track.title);
};

// Toggle favorite status
export const toggleFavorite = async (track: MusicTrack, userId: string): Promise<boolean> => {
  const newStatus = !track.isFavorite;

  await database.write(async () => {
    await track.update((t) => {
      t.isFavorite = newStatus;
    });
  });

  await emitEvent({
    eventType: EventTypes.MUSIC_PLAYBACK,
    entityType: 'music',
    entityId: track.id,
    payload: { action: newStatus ? 'favorited' : 'unfavorited', trackTitle: track.title },
    userId,
  });

  return newStatus;
};

// Increment play count
export const incrementPlayCount = async (track: MusicTrack): Promise<void> => {
  await database.write(async () => {
    await track.update((t) => {
      t.playCount = t.playCount + 1;
    });
  });
};

// Update track details
export const updateTrack = async (
  track: MusicTrack,
  updates: { title?: string; artist?: string; album?: string; category?: string }
): Promise<void> => {
  await database.write(async () => {
    await track.update((t) => {
      if (updates.title !== undefined) t.title = updates.title;
      if (updates.artist !== undefined) t.artist = updates.artist;
      if (updates.album !== undefined) t.album = updates.album;
      if (updates.category !== undefined) t.category = updates.category;
    });
  });
};

// Get all tracks for a user
export const getUserTracks = async (userId: string): Promise<MusicTrack[]> => {
  const tracks = await database.get<MusicTrack>('music_tracks').query().fetch();

  return tracks.filter((t) => t.userId === userId);
};

// Get tracks by category
export const getTracksByCategory = async (
  userId: string,
  category: string
): Promise<MusicTrack[]> => {
  const allTracks = await getUserTracks(userId);
  return allTracks.filter((t) => t.category === category);
};

// Get favorite tracks
export const getFavoriteTracks = async (userId: string): Promise<MusicTrack[]> => {
  const allTracks = await getUserTracks(userId);
  return allTracks.filter((t) => t.isFavorite);
};

// Audio player class for better control
export class MusicPlayer {
  private sound: Audio.Sound | null = null;
  private currentTrackId: string | null = null;
  private onPlaybackStatusUpdate: ((status: AVPlaybackStatus) => void) | null = null;

  async loadTrack(track: MusicTrack): Promise<boolean> {
    try {
      // Unload previous sound
      if (this.sound) {
        await this.sound.unloadAsync();
      }

      // Set audio mode for background playback
      await Audio.setAudioModeAsync({
        playsInSilentModeIOS: true,
        staysActiveInBackground: true,
        shouldDuckAndroid: true,
      });

      // Create new sound
      const { sound } = await Audio.Sound.createAsync(
        { uri: track.fileUri },
        { shouldPlay: false },
        this.handlePlaybackStatusUpdate.bind(this)
      );

      this.sound = sound;
      this.currentTrackId = track.id;

      return true;
    } catch (error) {
      console.error('[MusicPlayer] Error loading track:', error);
      return false;
    }
  }

  private handlePlaybackStatusUpdate(status: AVPlaybackStatus) {
    if (this.onPlaybackStatusUpdate) {
      this.onPlaybackStatusUpdate(status);
    }
  }

  setOnPlaybackStatusUpdate(callback: (status: AVPlaybackStatus) => void) {
    this.onPlaybackStatusUpdate = callback;
  }

  async play(): Promise<void> {
    if (this.sound) {
      await this.sound.playAsync();
    }
  }

  async pause(): Promise<void> {
    if (this.sound) {
      await this.sound.pauseAsync();
    }
  }

  async stop(): Promise<void> {
    if (this.sound) {
      await this.sound.stopAsync();
      await this.sound.setPositionAsync(0);
    }
  }

  async seek(positionSeconds: number): Promise<void> {
    if (this.sound) {
      await this.sound.setPositionAsync(positionSeconds * 1000);
    }
  }

  async setVolume(volume: number): Promise<void> {
    if (this.sound) {
      await this.sound.setVolumeAsync(Math.max(0, Math.min(1, volume)));
    }
  }

  async unload(): Promise<void> {
    if (this.sound) {
      await this.sound.unloadAsync();
      this.sound = null;
      this.currentTrackId = null;
    }
  }

  getCurrentTrackId(): string | null {
    return this.currentTrackId;
  }
}

// Export singleton player instance
export const musicPlayer = new MusicPlayer();

// ============================================
// ALBUM ART FUNCTIONS
// ============================================

// Pick image for album art
export const pickAlbumArt = async (): Promise<string | null> => {
  try {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });

    if (!result.canceled && result.assets.length > 0) {
      return result.assets[0].uri;
    }
    return null;
  } catch (error) {
    console.error('[MusicService] Error picking album art:', error);
    return null;
  }
};

// Save album art to internal storage
export const saveAlbumArt = async (sourceUri: string, trackId: string): Promise<string> => {
  const artDir = await ensureAlbumArtDirectory();
  const fileName = `${trackId}_${Date.now()}.jpg`;
  const sourceFile = new File(sourceUri);
  const destFile = new File(artDir, fileName);

  sourceFile.copy(destFile);
  return destFile.uri;
};

// Update track album art
export const updateTrackAlbumArt = async (
  track: MusicTrack,
  artUri: string | null
): Promise<void> => {
  // If there's an existing custom art, delete it
  if (track.albumArtUri) {
    try {
      const oldFile = new File(track.albumArtUri);
      if (oldFile.exists) {
        oldFile.delete();
      }
    } catch (error) {
      console.warn('[MusicService] Error deleting old album art:', error);
    }
  }

  let savedUri: string | null = null;
  if (artUri) {
    savedUri = await saveAlbumArt(artUri, track.id);
  }

  await database.write(async () => {
    await track.update((t) => {
      t.albumArtUri = savedUri;
    });
  });
};

// Get album art for a track (custom > category default > system default)
export const getTrackAlbumArt = async (
  track: MusicTrack,
  categories: MusicCategory[]
): Promise<string> => {
  // 1. Check for custom album art on the track
  if (track.albumArtUri) {
    return track.albumArtUri;
  }

  // 2. Check for category default art
  const category = categories.find((c) => c.name.toLowerCase() === track.category.toLowerCase());
  if (category?.defaultArtUri) {
    return category.defaultArtUri;
  }

  // 3. Fall back to system defaults
  return DEFAULT_ALBUM_ARTS[track.category] || DEFAULT_ALBUM_ARTS.default;
};

// ============================================
// CATEGORY MANAGEMENT FUNCTIONS
// ============================================

// System categories that are created by default
const SYSTEM_CATEGORIES = [
  { name: 'focus', icon: '🎯', color: '#4AC3FF', position: 0 },
  { name: 'ambient', icon: '🌧️', color: '#9B59B6', position: 1 },
  { name: 'motivation', icon: '🔥', color: '#E74C3C', position: 2 },
  { name: 'sleep', icon: '😴', color: '#3498DB', position: 3 },
  { name: 'other', icon: '🎵', color: '#95A5A6', position: 4 },
];

// Initialize default categories if none exist
export const initializeCategories = async (userId: string): Promise<void> => {
  const existingCategories = await database.get<MusicCategory>('music_categories').query().fetch();

  if (existingCategories.length === 0) {
    await database.write(async () => {
      for (const cat of SYSTEM_CATEGORIES) {
        await database.get<MusicCategory>('music_categories').create((c) => {
          c.name = cat.name;
          c.icon = cat.icon;
          c.color = cat.color;
          c.defaultArtUri = DEFAULT_ALBUM_ARTS[cat.name] || null;
          c.position = cat.position;
          c.isSystem = true;
          c.userId = userId;
        });
      }
    });
    console.log('[MusicService] Default categories initialized');
  }
};

// Add a new category
export const addCategory = async (
  name: string,
  userId: string,
  icon?: string,
  color?: string,
  defaultArtUri?: string
): Promise<MusicCategory> => {
  // Get the highest position
  const categories = await database.get<MusicCategory>('music_categories').query().fetch();
  const maxPosition = categories.reduce((max, c) => Math.max(max, c.position), -1);

  const category = await database.write(async () => {
    return database.get<MusicCategory>('music_categories').create((c) => {
      c.name = name;
      c.icon = icon || '🎵';
      c.color = color || '#8E8E93';
      c.defaultArtUri = defaultArtUri || null;
      c.position = maxPosition + 1;
      c.isSystem = false;
      c.userId = userId;
    });
  });

  console.log('[MusicService] Category added:', name);
  return category;
};

// Update category
export const updateCategory = async (
  category: MusicCategory,
  updates: { name?: string; icon?: string; color?: string; defaultArtUri?: string | null }
): Promise<void> => {
  await database.write(async () => {
    await category.update((c) => {
      if (updates.name !== undefined) c.name = updates.name;
      if (updates.icon !== undefined) c.icon = updates.icon;
      if (updates.color !== undefined) c.color = updates.color;
      if (updates.defaultArtUri !== undefined) c.defaultArtUri = updates.defaultArtUri;
    });
  });
};

// Delete category (only non-system categories)
export const deleteCategory = async (category: MusicCategory): Promise<boolean> => {
  if (category.isSystem) {
    console.warn('[MusicService] Cannot delete system category');
    return false;
  }

  await database.write(async () => {
    await category.destroyPermanently();
  });

  console.log('[MusicService] Category deleted:', category.name);
  return true;
};

// Reorder categories
export const reorderCategories = async (
  categories: MusicCategory[],
  newOrder: string[]
): Promise<void> => {
  await database.write(async () => {
    for (let i = 0; i < newOrder.length; i++) {
      const category = categories.find((c) => c.id === newOrder[i]);
      if (category) {
        await category.update((c) => {
          c.position = i;
        });
      }
    }
  });
};

// Save category art to internal storage
export const saveCategoryArt = async (sourceUri: string, categoryId: string): Promise<string> => {
  const artDir = await ensureAlbumArtDirectory();
  const fileName = `cat_${categoryId}_${Date.now()}.jpg`;
  const sourceFile = new File(sourceUri);
  const destFile = new File(artDir, fileName);

  sourceFile.copy(destFile);
  return destFile.uri;
};

// Update category default art
export const updateCategoryArt = async (
  category: MusicCategory,
  artUri: string | null
): Promise<void> => {
  // If there's an existing custom art, delete it (but not URL-based ones)
  if (category.defaultArtUri && !category.defaultArtUri.startsWith('http')) {
    try {
      const oldFile = new File(category.defaultArtUri);
      if (oldFile.exists) {
        oldFile.delete();
      }
    } catch (error) {
      console.warn('[MusicService] Error deleting old category art:', error);
    }
  }

  let savedUri: string | null = null;
  if (artUri) {
    savedUri = await saveCategoryArt(artUri, category.id);
  }

  await updateCategory(category, { defaultArtUri: savedUri });
};
