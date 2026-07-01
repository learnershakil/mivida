import { Model } from '@nozbe/watermelondb';
import { field, date, readonly } from '@nozbe/watermelondb/decorators';

export default class CodingLog extends Model {
  static table = 'coding_logs';

  @field('user_id') userId!: string;
  @date('date') date!: number;
  @field('duration') duration!: number;
  @field('project') project?: string;
  @field('language') language?: string;

  @readonly @date('created_at') createdAt!: number;
  @readonly @date('updated_at') updatedAt!: number;
  @date('deleted_at') deletedAt?: number;
}
