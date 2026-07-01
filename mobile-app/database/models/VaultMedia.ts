import { Model } from '@nozbe/watermelondb';
import { field, date, readonly } from '@nozbe/watermelondb/decorators';

/**
 * Media type in vault
 */
export type VaultMediaType = 'image' | 'video' | 'audio' | 'note';

/**
 * VaultMedia - Secure vault content
 *
 * Stores media files in app sandbox.
 * Content is invisible to phone gallery and file managers.
 */
export default class VaultMedia extends Model {
  static table = 'vault_media';

  @field('uri') uri?: string; // Optional for notes
  @field('media_type') mediaType!: VaultMediaType;
  @field('filename') filename?: string;
  @field('title') title?: string; // Title for notes/audio
  @field('content') content?: string; // Text content for notes
  @field('duration') duration?: number; // Audio duration in ms
  @field('user_id') userId!: string;

  @readonly @date('created_at') createdAt!: number;
  @date('updated_at') updatedAt!: number;
  @date('deleted_at') deletedAt?: number;

  /**
   * Check if this is an image
   */
  get isImage(): boolean {
    return this.mediaType === 'image';
  }

  /**
   * Check if this is a video
   */
  get isVideo(): boolean {
    return this.mediaType === 'video';
  }

  /**
   * Check if this is an audio/voice note
   */
  get isAudio(): boolean {
    return this.mediaType === 'audio';
  }

  /**
   * Check if this is a text note
   */
  get isNote(): boolean {
    return this.mediaType === 'note';
  }
}
