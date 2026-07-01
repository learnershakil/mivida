/**
 * VaultService
 *
 * Secure storage with passcode protection for notes, media, and audio.
 *
 * Features:
 * - Long-press avatar to open vault
 * - Passcode protection stored in Settings table
 * - Secure storage for notes, photos, videos, and audio
 * - Event logging for ACCESS ATTEMPTS ONLY (vault data is NOT logged)
 * - Permanent deletion (no soft delete for vault content)
 *
 * Privacy: Vault data operations are NOT logged to protect user privacy.
 * Only vault open/close/reset actions are logged.
 */

import { Q } from '@nozbe/watermelondb';
import * as FileSystem from 'expo-file-system/legacy';
import { database } from '../database';
import VaultMedia, { VaultMediaType } from '../database/models/VaultMedia';
import Settings from '../database/models/Settings';
import { emitEvent, EventTypes } from './eventLogger';

// Vault storage directory
const VAULT_DIR = `${FileSystem.documentDirectory}vault/`;
const VAULT_AUDIO_DIR = `${VAULT_DIR}audio/`;
const VAULT_MEDIA_DIR = `${VAULT_DIR}media/`;

/**
 * Ensure vault directories exist
 */
async function ensureVaultDirectories(): Promise<void> {
  const dirs = [VAULT_DIR, VAULT_AUDIO_DIR, VAULT_MEDIA_DIR];
  for (const dir of dirs) {
    const dirInfo = await FileSystem.getInfoAsync(dir);
    if (!dirInfo.exists) {
      await FileSystem.makeDirectoryAsync(dir, { intermediates: true });
    }
  }
}

export interface AddNoteParams {
  title?: string;
  content: string;
  userId: string;
}

export interface AddMediaParams {
  uri: string;
  mediaType: 'image' | 'video';
  filename?: string;
  userId: string;
}

export interface AddAudioParams {
  uri: string;
  filename?: string;
  title?: string;
  duration?: number;
  userId: string;
}

/**
 * Get user settings
 */
async function getSettings(userId: string): Promise<Settings | null> {
  const settings = await database
    .get<Settings>('settings')
    .query(Q.where('user_id', userId))
    .fetch();
  return settings.length > 0 ? settings[0] : null;
}

/**
 * Check if vault is set up with a passcode
 */
export async function isVaultSetup(userId: string = 'default'): Promise<boolean> {
  const settings = await getSettings(userId);
  return !!settings?.vaultPasscodeHash;
}

/**
 * Set up vault with a passcode
 */
export async function setupVault(passcode: string, userId: string): Promise<void> {
  if (passcode.length < 4) {
    throw new Error('Passcode must be at least 4 digits');
  }

  const hash = hashPasscode(passcode);
  let settings = await getSettings(userId);

  await database.write(async () => {
    if (settings) {
      await settings.update((record) => {
        record.vaultPasscodeHash = hash;
      });
    } else {
      settings = await database.get<Settings>('settings').create((record) => {
        record.userId = userId;
        record.vaultPasscodeHash = hash;
        record.deadManThresholdMinutes = 180;
        record.deadManEnabled = true;
        record.notificationIntensity = 'medium';
        record.notificationSound = 'default';
        record.notificationSoundEnabled = true;
        record.notificationVibrationEnabled = true;
        record.lockdownStrictness = 'normal';
        record.lockdownAllowCalls = true;
        record.taskMode = 'weekday';
        record.autoLoadFixedTasks = true;
        record.exportFormat = 'jsonl';
        record.includeDeviceInfo = false;
        record.timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
        record.vaultAutoLockMinutes = 5;
      });
    }
  });

  await emitEvent({
    eventType: EventTypes.VAULT_OPENED,
    entityType: 'vault',
    entityId: 'setup',
    payload: { action: 'setup_completed' },
    userId,
  });
}

/**
 * Verify vault passcode
 */
export async function verifyPasscode(passcode: string, userId: string): Promise<boolean> {
  const settings = await getSettings(userId);
  const storedHash = settings?.vaultPasscodeHash;

  if (!storedHash) {
    await emitEvent({
      eventType: EventTypes.VAULT_CLOSED,
      entityType: 'vault',
      entityId: 'access',
      payload: { result: 'not_setup' },
      userId,
    });
    return false;
  }

  const inputHash = hashPasscode(passcode);
  const isValid = inputHash === storedHash;

  await emitEvent({
    eventType: isValid ? EventTypes.VAULT_OPENED : EventTypes.VAULT_CLOSED,
    entityType: 'vault',
    entityId: 'access',
    payload: {
      result: isValid ? 'success' : 'failed',
      attemptedAt: Date.now(),
    },
    userId,
  });

  return isValid;
}

/**
 * Change vault passcode
 */
export async function changePasscode(
  currentPasscode: string,
  newPasscode: string,
  userId: string
): Promise<boolean> {
  const isValid = await verifyPasscode(currentPasscode, userId);

  if (!isValid) {
    return false;
  }

  if (newPasscode.length < 4) {
    throw new Error('New passcode must be at least 4 digits');
  }

  const hash = hashPasscode(newPasscode);
  const settings = await getSettings(userId);

  if (settings) {
    await database.write(async () => {
      await settings.update((record) => {
        record.vaultPasscodeHash = hash;
      });
    });
  }

  await emitEvent({
    eventType: EventTypes.VAULT_OPENED,
    entityType: 'vault',
    entityId: 'settings',
    payload: { action: 'passcode_changed' },
    userId,
  });

  return true;
}

// ============================================
// NOTES - Text notes in vault
// ============================================

/**
 * Add a text note to vault (NOT logged for privacy)
 */
export async function addNote(params: AddNoteParams): Promise<VaultMedia> {
  const { title, content, userId } = params;

  const note = await database.write(async () => {
    return await database.get<VaultMedia>('vault_media').create((record) => {
      record.mediaType = 'note';
      record.title = title;
      record.content = content;
      record.userId = userId;
    });
  });

  return note;
}

/**
 * Update a text note (NOT logged for privacy)
 */
export async function updateNote(
  noteId: string,
  title: string | undefined,
  content: string,
  userId: string
): Promise<void> {
  const note = await database.get<VaultMedia>('vault_media').find(noteId);

  await database.write(async () => {
    await note.update((record) => {
      record.title = title;
      record.content = content;
    });
  });
}

/**
 * Get all notes
 */
export async function getNotes(userId: string): Promise<VaultMedia[]> {
  const notes = await database
    .get<VaultMedia>('vault_media')
    .query(Q.where('user_id', userId), Q.where('media_type', 'note'), Q.where('deleted_at', null))
    .fetch();
  return notes;
}

// ============================================
// MEDIA - Images and Videos
// ============================================

/**
 * Add image/video to vault (NOT logged for privacy)
 */
export async function addMedia(params: AddMediaParams): Promise<VaultMedia> {
  const { uri, mediaType, filename, userId } = params;

  // Ensure vault directories exist
  await ensureVaultDirectories();

  // Copy media to permanent storage
  const ext = mediaType === 'video' ? 'mp4' : 'jpg';
  const permanentFilename = `${Date.now()}_${filename || `media.${ext}`}`;
  const permanentUri = `${VAULT_MEDIA_DIR}${permanentFilename}`;

  try {
    await FileSystem.copyAsync({
      from: uri,
      to: permanentUri,
    });
  } catch (error) {
    console.error('[VaultService] Failed to copy media file:', error);
    throw new Error('Failed to save media file');
  }

  const media = await database.write(async () => {
    return await database.get<VaultMedia>('vault_media').create((record) => {
      record.uri = permanentUri;
      record.mediaType = mediaType;
      record.filename = permanentFilename;
      record.userId = userId;
    });
  });

  return media;
}

/**
 * Get all images and videos
 */
export async function getMedia(userId: string): Promise<VaultMedia[]> {
  const media = await database
    .get<VaultMedia>('vault_media')
    .query(
      Q.where('user_id', userId),
      Q.or(Q.where('media_type', 'image'), Q.where('media_type', 'video')),
      Q.where('deleted_at', null)
    )
    .fetch();
  return media;
}

// ============================================
// AUDIO - Voice notes and recordings
// ============================================

/**
 * Add audio/voice note to vault (NOT logged for privacy)
 */
export async function addAudio(params: AddAudioParams): Promise<VaultMedia> {
  const { uri, filename, title, duration, userId } = params;

  // Ensure vault directories exist
  await ensureVaultDirectories();

  // Copy audio to permanent storage
  const permanentFilename = `${Date.now()}_${filename || 'recording.m4a'}`;
  const permanentUri = `${VAULT_AUDIO_DIR}${permanentFilename}`;

  try {
    await FileSystem.copyAsync({
      from: uri,
      to: permanentUri,
    });
  } catch (error) {
    console.error('[VaultService] Failed to copy audio file:', error);
    throw new Error('Failed to save audio file');
  }

  const audio = await database.write(async () => {
    return await database.get<VaultMedia>('vault_media').create((record) => {
      record.uri = permanentUri;
      record.mediaType = 'audio';
      record.filename = permanentFilename;
      record.title = title;
      record.duration = duration;
      record.userId = userId;
    });
  });

  return audio;
}

/**
 * Update audio title
 */
export async function updateAudioTitle(
  audioId: string,
  title: string,
  userId: string
): Promise<void> {
  const audio = await database.get<VaultMedia>('vault_media').find(audioId);

  await database.write(async () => {
    await audio.update((record) => {
      record.title = title;
    });
  });
}

/**
 * Get all audio files
 */
export async function getAudio(userId: string): Promise<VaultMedia[]> {
  const audio = await database
    .get<VaultMedia>('vault_media')
    .query(Q.where('user_id', userId), Q.where('media_type', 'audio'), Q.where('deleted_at', null))
    .fetch();
  return audio;
}

// ============================================
// COMMON - Shared operations
// ============================================

/**
 * Rename vault item (title for notes/audio, filename for media)
 */
export async function renameItem(itemId: string, newName: string, userId: string): Promise<void> {
  const item = await database.get<VaultMedia>('vault_media').find(itemId);

  await database.write(async () => {
    await item.update((record) => {
      if (record.mediaType === 'note' || record.mediaType === 'audio') {
        record.title = newName;
      } else {
        record.filename = newName;
        record.title = newName;
      }
    });
  });
}

/**
 * Permanently delete vault item (NOT logged for privacy)
 */
export async function deleteItem(itemId: string, userId: string): Promise<void> {
  const item = await database.get<VaultMedia>('vault_media').find(itemId);

  await database.write(async () => {
    await item.destroyPermanently();
  });
}

/**
 * Get all vault items
 */
export async function getAllItems(userId: string): Promise<VaultMedia[]> {
  const items = await database
    .get<VaultMedia>('vault_media')
    .query(Q.where('user_id', userId), Q.where('deleted_at', null))
    .fetch();
  return items;
}

/**
 * Get vault statistics
 */
export async function getVaultStats(userId: string): Promise<{
  notes: number;
  images: number;
  videos: number;
  audio: number;
  total: number;
}> {
  const items = await getAllItems(userId);

  return {
    notes: items.filter((i) => i.mediaType === 'note').length,
    images: items.filter((i) => i.mediaType === 'image').length,
    videos: items.filter((i) => i.mediaType === 'video').length,
    audio: items.filter((i) => i.mediaType === 'audio').length,
    total: items.length,
  };
}

/**
 * Get vault access history from events
 */
export async function getAccessHistory(
  userId: string
): Promise<{ successful: number; failed: number; lastAccess: number | null }> {
  const { getEventsByType } = await import('./eventLogger');

  const openedEvents = await getEventsByType(EventTypes.VAULT_OPENED, userId);
  const closedEvents = await getEventsByType(EventTypes.VAULT_CLOSED, userId);

  const successful = openedEvents.filter((e) => {
    const payload = e.payload || {};
    return payload.result === 'success';
  }).length;

  const failed = closedEvents.filter((e) => {
    const payload = e.payload || {};
    return payload.result === 'failed';
  }).length;

  const allAccessEvents = [...openedEvents, ...closedEvents].sort(
    (a, b) => b.createdAt - a.createdAt
  );

  return {
    successful,
    failed,
    lastAccess: allAccessEvents.length > 0 ? allAccessEvents[0].createdAt : null,
  };
}

/**
 * Reset vault (clear passcode and optionally all content)
 */
export async function resetVault(userId: string, clearContent: boolean = false): Promise<void> {
  const settings = await getSettings(userId);

  if (settings) {
    await database.write(async () => {
      await settings.update((record) => {
        record.vaultPasscodeHash = undefined;
      });
    });
  }

  if (clearContent) {
    const items = await getAllItems(userId);
    for (const item of items) {
      await deleteItem(item.id, userId);
    }
  }

  await emitEvent({
    eventType: EventTypes.VAULT_CLOSED,
    entityType: 'vault',
    entityId: 'settings',
    payload: {
      action: 'vault_reset',
      contentCleared: clearContent,
    },
    userId,
  });
}

/**
 * Simple passcode hash (use bcrypt in production)
 */
function hashPasscode(passcode: string): string {
  let hash = 0;
  const salt = 'productivitylogger_vault_salt';
  const saltedPasscode = salt + passcode;

  for (let i = 0; i < saltedPasscode.length; i++) {
    const char = saltedPasscode.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash;
  }

  return hash.toString(16);
}

// Default export with all methods
const vaultService = {
  isSetup: isVaultSetup,
  setup: setupVault,
  verify: verifyPasscode,
  changePasscode,
  // Notes
  addNote,
  updateNote,
  getNotes,
  // Media
  addMedia,
  getMedia,
  // Audio
  addAudio,
  updateAudioTitle,
  getAudio,
  // Common
  deleteItem,
  renameItem,
  getAllItems,
  getVaultStats,
  getAccessHistory,
  reset: resetVault,
};

export default vaultService;
