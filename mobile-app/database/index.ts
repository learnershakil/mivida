import { Database } from '@nozbe/watermelondb';
import SQLiteAdapter from '@nozbe/watermelondb/adapters/sqlite';
import { Platform } from 'react-native';

import { schema, SCHEMA_VERSION } from './schema';
import { migrations } from './migrations';
import User from './models/User';
import Task from './models/Task';
import FinanceLog from './models/FinanceLog';
import NotificationLog from './models/NotificationLog';
import MoodLog from './models/MoodLog';
import VaultMedia from './models/VaultMedia';
import EventLog from './models/EventLog';
import Settings from './models/Settings';
import MusicTrack from './models/MusicTrack';
import MusicCategory from './models/MusicCategory';
import CodingLog from './models/CodingLog';
import Contact from './models/Contact';
import Category from './models/Category';
import SensorStat from './models/SensorStat';

// Detect if running in Expo Go (no native modules available)
// In Expo Go, JSI is not available for WatermelonDB
const isExpoGo = typeof global !== 'undefined' && !(global as any)?.nativeModuleProxy;

// SQLite adapter configuration
// JSI is disabled for Expo Go compatibility - enable for development builds
const adapter = new SQLiteAdapter({
  schema,
  migrations,
  jsi: false, // Set to true when using development build (expo prebuild)
  onSetUpError: (error) => {
    console.error('[Database] Failed to initialize:', error);
  },
});

// Database instance with all model classes
export const database = new Database({
  adapter,
  modelClasses: [
    User,
    Settings,
    Task,
    FinanceLog,
    NotificationLog,
    MoodLog,
    VaultMedia,
    EventLog,
    MusicTrack,
    MusicCategory,
    CodingLog,
    Contact,
    Category,
    SensorStat,
  ],
});

// Export schema version for sync/export features
export { SCHEMA_VERSION };
