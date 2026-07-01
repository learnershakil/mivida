import { Model } from '@nozbe/watermelondb';
import { field, text, date, readonly } from '@nozbe/watermelondb/decorators';

export default class MusicCategory extends Model {
  static table = 'music_categories';

  @text('name') name!: string;
  @text('icon') icon!: string | null;
  @text('color') color!: string | null;
  @text('default_art_uri') defaultArtUri!: string | null;
  @field('position') position!: number;
  @field('is_system') isSystem!: boolean;
  @text('user_id') userId!: string;
  @readonly @date('created_at') createdAt!: Date;
  @readonly @date('updated_at') updatedAt!: Date;
}
