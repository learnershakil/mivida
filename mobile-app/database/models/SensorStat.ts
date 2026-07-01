import { Model } from '@nozbe/watermelondb';
import { field, date, readonly } from '@nozbe/watermelondb/decorators';

/**
 * SensorStat - daily pedometer step counts. Synced to the server, where the fatigue cron reads them.
 */
export default class SensorStat extends Model {
  static table = 'sensor_stats';

  @field('date') date!: number; // day bucket (midnight millis)
  @field('steps') steps!: number;
  @field('meta') meta?: string;
  @field('user_id') userId!: string;

  @readonly @date('created_at') createdAt!: number;
  @date('updated_at') updatedAt!: number;
}
