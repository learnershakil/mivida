import { Model } from '@nozbe/watermelondb';
import { field, text, date, readonly } from '@nozbe/watermelondb/decorators';

export default class MusicTrack extends Model {
  static table = 'music_tracks';

  @text('title') title!: string;
  @text('artist') artist!: string;
  @text('album') album!: string;
  @text('file_uri') fileUri!: string;
  @text('file_name') fileName!: string;
  @text('album_art_uri') albumArtUri!: string | null;
  @field('duration') duration!: number;
  @text('category') category!: string;
  @field('is_favorite') isFavorite!: boolean;
  @field('play_count') playCount!: number;
  @text('user_id') userId!: string;
  @readonly @date('created_at') createdAt!: Date;
  @readonly @date('updated_at') updatedAt!: Date;
}
