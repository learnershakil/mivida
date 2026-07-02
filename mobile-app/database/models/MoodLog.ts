import { Model } from '@nozbe/watermelondb';
import { field, date, readonly } from '@nozbe/watermelondb/decorators';

/**
 * Mood levels for logging
 */
export type MoodLevel = 'TERRIBLE' | 'BAD' | 'MEH' | 'GOOD' | 'GREAT';

/**
 * MoodLog - User mood entries
 *
 * Stores mood at the time of logging with optional notes.
 * Analytics are derived from these entries via events.
 */
export default class MoodLog extends Model {
  static table = 'mood_logs';

  @field('mood') mood!: MoodLevel;
  @field('mood_value') moodValue!: number; // 1-5 for analytics
  @field('level') level!: number; // 1-5 for analytics
  @field('score10') score10?: number; // raw 1-10 score
  @field('note') note?: string;
  @field('user_id') userId!: string;

  @readonly @date('created_at') createdAt!: Date;
  @date('updated_at') updatedAt!: Date;
  @date('deleted_at') deletedAt?: Date;

  /**
   * Get emoji representation of mood
   */
  get emoji(): string {
    const emojis: Record<MoodLevel, string> = {
      TERRIBLE: '😢',
      BAD: '😔',
      MEH: '😐',
      GOOD: '🙂',
      GREAT: '😄',
    };
    return emojis[this.mood] || '😐';
  }

  /**
   * Get mood label with proper capitalization
   */
  get label(): string {
    return this.mood.charAt(0) + this.mood.slice(1).toLowerCase();
  }
}
