/**
 * ExportService
 *
 * JSONL export functionality for event logs.
 *
 * Features:
 * - Export all events as JSONL (JSON Lines)
 * - Optional date range filtering
 * - Include device/session metadata
 * - Save to device storage and share
 * - Import JSONL files
 *
 * Format: One JSON object per line, easy to stream and parse.
 */

import { Platform, Alert as RNAlert } from 'react-native';
import { database } from '../database';
import EventLog from '../database/models/EventLog';
import { SCHEMA_VERSION } from '../database/schema';
import { emitEvent, EventTypes } from './eventLogger';

// Lazy load native modules to prevent crash on startup
let FileSystem: typeof import('expo-file-system/legacy') | null = null;
let Sharing: typeof import('expo-sharing') | null = null;

async function getFileSystem() {
  if (!FileSystem) {
    FileSystem = await import('expo-file-system/legacy');
  }
  return FileSystem;
}

async function getSharing() {
  if (!Sharing) {
    Sharing = await import('expo-sharing');
  }
  return Sharing;
}

/**
 * Export options
 */
export interface ExportOptions {
  startDate?: Date;
  endDate?: Date;
  eventTypes?: string[];
  includeDeviceInfo?: boolean;
  userId: string;
}

/**
 * Export metadata included at the start of file
 */
interface ExportMetadata {
  exportVersion: string;
  schemaVersion: number;
  exportedAt: string;
  userId: string;
  totalEvents: number;
  dateRange: {
    start: string;
    end: string;
  };
  device?: {
    platform: string;
    appVersion: string;
  };
}

/**
 * Generate JSONL export of all events
 * Returns the content as a string
 */
export async function exportEventsAsJsonl(options: ExportOptions): Promise<string> {
  const { startDate, endDate, eventTypes, includeDeviceInfo = true, userId } = options;

  // Fetch all events for user
  const allEvents = await database.get<EventLog>('event_logs').query().fetch();

  // Filter events
  let filteredEvents = allEvents.filter((event) => event.userId === userId);

  if (startDate) {
    filteredEvents = filteredEvents.filter((e) => e.createdAt >= startDate.getTime());
  }

  if (endDate) {
    filteredEvents = filteredEvents.filter((e) => e.createdAt <= endDate.getTime());
  }

  if (eventTypes && eventTypes.length > 0) {
    filteredEvents = filteredEvents.filter((e) => eventTypes.includes(e.eventType));
  }

  // Sort by timestamp
  filteredEvents.sort((a, b) => a.createdAt - b.createdAt);

  // Build metadata
  const metadata: ExportMetadata = {
    exportVersion: '1.0',
    schemaVersion: SCHEMA_VERSION,
    exportedAt: new Date().toISOString(),
    userId,
    totalEvents: filteredEvents.length,
    dateRange: {
      start:
        filteredEvents.length > 0
          ? new Date(filteredEvents[0].createdAt).toISOString()
          : new Date().toISOString(),
      end:
        filteredEvents.length > 0
          ? new Date(filteredEvents[filteredEvents.length - 1].createdAt).toISOString()
          : new Date().toISOString(),
    },
  };

  if (includeDeviceInfo) {
    metadata.device = {
      platform: Platform.OS,
      appVersion: '1.0.0', // TODO: Get from app config
    };
  }

  // Build JSONL content
  const lines: string[] = [];

  // First line is metadata
  lines.push(JSON.stringify({ _meta: metadata }));

  // Add events
  for (const event of filteredEvents) {
    const eventData = {
      eventType: event.eventType,
      entityType: event.entityType,
      entityId: event.entityId,
      payload: event.payload ?? null,
      userId: event.userId,
      deviceId: event.deviceId,
      sessionId: event.sessionId,
      timezone: event.timezone,
      schemaVersion: event.schemaVersion,
      createdAt: new Date(event.createdAt).toISOString(),
    };
    lines.push(JSON.stringify(eventData));
  }

  const content = lines.join('\n');

  // Log the export event
  await emitEvent({
    eventType: EventTypes.EXPORT_GENERATED,
    entityType: 'export',
    entityId: `export-${Date.now()}`,
    payload: {
      eventCount: filteredEvents.length,
      contentSize: content.length,
      exportedAt: Date.now(),
    },
    userId,
  });

  return content;
}

/**
 * Get export statistics without generating file
 */
export async function getExportStats(userId: string): Promise<{
  totalEvents: number;
  oldestEvent: Date | null;
  newestEvent: Date | null;
  eventTypeCounts: Record<string, number>;
  estimatedSize: number;
}> {
  const allEvents = await database.get<EventLog>('event_logs').query().fetch();
  const userEvents = allEvents.filter((e) => e.userId === userId);

  if (userEvents.length === 0) {
    return {
      totalEvents: 0,
      oldestEvent: null,
      newestEvent: null,
      eventTypeCounts: {},
      estimatedSize: 0,
    };
  }

  userEvents.sort((a, b) => a.createdAt - b.createdAt);

  const eventTypeCounts: Record<string, number> = {};
  let totalPayloadSize = 0;

  for (const event of userEvents) {
    eventTypeCounts[event.eventType] = (eventTypeCounts[event.eventType] || 0) + 1;
    totalPayloadSize += JSON.stringify(event.payload || {}).length;
  }

  // Estimate ~200 bytes overhead per event + payload
  const estimatedSize = userEvents.length * 200 + totalPayloadSize;

  return {
    totalEvents: userEvents.length,
    oldestEvent: new Date(userEvents[0].createdAt),
    newestEvent: new Date(userEvents[userEvents.length - 1].createdAt),
    eventTypeCounts,
    estimatedSize,
  };
}

/**
 * Delete old events (for storage management)
 * Use with caution - events are meant to be immutable
 */
export async function purgeOldEvents(
  userId: string,
  olderThan: Date,
  confirm: boolean = false
): Promise<number> {
  if (!confirm) {
    throw new Error('Must explicitly confirm purge operation');
  }

  const allEvents = await database.get<EventLog>('event_logs').query().fetch();
  const toDelete = allEvents.filter(
    (e) => e.userId === userId && e.createdAt < olderThan.getTime()
  );

  // Actually delete (since events are meant to be immutable, we do hard delete)
  await database.write(async () => {
    for (const event of toDelete) {
      await event.destroyPermanently();
    }
  });

  // Log the purge
  await emitEvent({
    eventType: EventTypes.EXPORT_GENERATED,
    entityType: 'system',
    entityId: 'purge',
    payload: {
      action: 'events_purged',
      count: toDelete.length,
      olderThan: olderThan.toISOString(),
    },
    userId,
  });

  return toDelete.length;
}

/**
 * Format file size for display
 */
export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

/**
 * Generate filename for export
 */
export function generateExportFilename(): string {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  return `productivitylogger-export-${timestamp}.jsonl`;
}

/**
 * Share export content
 * Saves the content to a temp file and shares it
 */
export async function shareExport(content: string, filename: string): Promise<void> {
  console.log(`[ExportService] Export ready: ${filename}`);
  console.log(`[ExportService] Content length: ${content.length} characters`);
  console.log(`[ExportService] Lines: ${content.split('\n').length}`);

  try {
    const SharingModule = await getSharing();
    const FileSystemModule = await getFileSystem();

    // Check if sharing is available
    const isAvailable = await SharingModule.isAvailableAsync();
    if (!isAvailable) {
      throw new Error('Sharing is not available on this device');
    }

    // Create the file in the cache directory
    const fileUri = `${FileSystemModule.cacheDirectory}${filename}`;

    // Write content to file - use utf8 string directly
    await FileSystemModule.writeAsStringAsync(fileUri, content, {
      encoding: 'utf8',
    });

    console.log(`[ExportService] File written to: ${fileUri}`);

    // Share the file
    await SharingModule.shareAsync(fileUri, {
      mimeType: 'application/jsonl',
      dialogTitle: 'Export Event Logs',
      UTI: 'public.json', // For iOS
    });

    console.log('[ExportService] File shared successfully');
  } catch (error) {
    console.error('[ExportService] Failed to share export:', error);
    throw error;
  }
}

/**
 * Save export content to device storage (Productivity Logger/Logs folder)
 * Uses MediaLibrary for Android and FileSystem for iOS
 */
export async function saveExportToDevice(content: string, filename: string): Promise<boolean> {
  console.log(`[ExportService] Saving to device: ${filename}`);

  try {
    const FileSystemModule = await getFileSystem();

    if (Platform.OS === 'android') {
      // Use SAF (Storage Access Framework) for Android
      // First, write to a temp file
      const tempUri = `${FileSystemModule.cacheDirectory}${filename}`;
      await FileSystemModule.writeAsStringAsync(tempUri, content, {
        encoding: 'utf8',
      });

      // Request permissions for external storage
      const permissions =
        await FileSystemModule.StorageAccessFramework.requestDirectoryPermissionsAsync();

      if (!permissions.granted) {
        console.log('[ExportService] Storage permission denied');
        RNAlert.alert('Permission Required', 'Please grant storage access to save exports.');
        return false;
      }

      // Create the file in the selected directory
      const fileUri = await FileSystemModule.StorageAccessFramework.createFileAsync(
        permissions.directoryUri,
        filename,
        'application/jsonl'
      );

      // Read temp file and write to SAF file
      const fileContent = await FileSystemModule.readAsStringAsync(tempUri, { encoding: 'utf8' });
      await FileSystemModule.writeAsStringAsync(fileUri, fileContent, {
        encoding: 'utf8',
      });

      console.log(`[ExportService] File saved to: ${fileUri}`);
      RNAlert.alert(
        'Success',
        `Export saved! Please select or create a "Productivity Logger/Logs" folder.`
      );
      return true;
    } else {
      // For iOS, use the document directory which is accessible via Files app
      const logsDir = `${FileSystemModule.documentDirectory}Logs/`;

      // Ensure Logs directory exists
      const dirInfo = await FileSystemModule.getInfoAsync(logsDir);
      if (!dirInfo.exists) {
        await FileSystemModule.makeDirectoryAsync(logsDir, { intermediates: true });
      }

      const fileUri = `${logsDir}${filename}`;
      await FileSystemModule.writeAsStringAsync(fileUri, content, {
        encoding: 'utf8',
      });

      console.log(`[ExportService] File saved to: ${fileUri}`);
      RNAlert.alert('Success', `Export saved to Files app > Productivity Logger > Logs`);
      return true;
    }
  } catch (error) {
    console.error('[ExportService] Failed to save export to device:', error);
    RNAlert.alert('Error', 'Failed to save export to device storage');
    return false;
  }
}

// Import removed per spec (§8.3): the app only exports. The prior JSONL import pipeline was deleted here.

export default {
  toJsonl: exportEventsAsJsonl,
  getStats: getExportStats,
  purge: purgeOldEvents,
  formatSize: formatFileSize,
  generateFilename: generateExportFilename,
  share: shareExport,
};
