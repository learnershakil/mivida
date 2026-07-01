import { Model } from '@nozbe/watermelondb';
import { field, date, readonly } from '@nozbe/watermelondb/decorators';

/**
 * Category - master list of task categories.
 * Configured from the web (source='web') or created on-device (source='mobile'); synced to the DB so a
 * category typed on mobile appears everywhere after sync (AUDIT §4.5).
 */
export default class Category extends Model {
  static table = 'categories';

  @field('name') name!: string;
  @field('color') color?: string;
  @field('source') source?: 'web' | 'mobile';

  @field('user_id') userId!: string;

  @readonly @date('created_at') createdAt!: number;
  @date('updated_at') updatedAt!: number;
  @date('deleted_at') deletedAt?: number;
}
