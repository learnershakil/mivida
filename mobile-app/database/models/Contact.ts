import { Model } from '@nozbe/watermelondb';
import { field, date, readonly, json } from '@nozbe/watermelondb/decorators';

const sanitizeSocials = (raw: any) => {
  if (typeof raw === 'object' && raw !== null) return raw;
  if (typeof raw === 'string') {
    try {
      return JSON.parse(raw);
    } catch {
      return {};
    }
  }
  return {};
};

/**
 * Contact - User contacts for delegation
 */
export default class Contact extends Model {
  static table = 'contacts';

  @field('name') name!: string;
  @field('email') email?: string;
  @field('phone') phone?: string;
  @json('socials', sanitizeSocials) socials?: any;
  @field('source') source?: string; // Where you met / got the details (free-text, for future reference)

  @field('user_id') userId!: string;

  @readonly @date('created_at') createdAt!: number;
  @date('updated_at') updatedAt!: number;
  @date('deleted_at') deletedAt?: number;
}
