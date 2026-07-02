import { Model } from '@nozbe/watermelondb';
import { field, date, readonly, writer } from '@nozbe/watermelondb/decorators';

export default class User extends Model {
  static table = 'users';

  @field('name') name!: string;
  @field('avatar_url') avatarUrl?: string;
  @field('avatar_r2_key') avatarR2Key?: string; // R2 cloud copy
  @field('passcode') passcode?: string;
  @field('is_awake') isAwake!: boolean;
  @date('last_interaction') lastInteraction!: number;

  @readonly @date('created_at') createdAt!: number;
  @date('updated_at') updatedAt!: number;

  /**
   * Toggle awake state with proper reactivity
   */
  @writer async toggleAwake(): Promise<void> {
    await this.update((record) => {
      record.isAwake = !record.isAwake;
      record.lastInteraction = Date.now();
    });
  }

  /**
   * Set awake state explicitly
   */
  @writer async setAwake(isAwake: boolean): Promise<void> {
    if (this.isAwake === isAwake) return;
    await this.update((record) => {
      record.isAwake = isAwake;
      record.lastInteraction = Date.now();
    });
  }

  /**
   * Update last interaction timestamp
   */
  @writer async touch(): Promise<void> {
    await this.update((record) => {
      record.lastInteraction = Date.now();
    });
  }
}
