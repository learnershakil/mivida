import { Q } from '@nozbe/watermelondb';
import { database } from '../database';
import Category from '../database/models/Category';

const DEFAULT_CATEGORIES = ['Work', 'Health', 'Personal', 'Learning'];

class CategoryService {
  /** All non-deleted categories for a user, alphabetically. */
  async getAll(userId: string): Promise<Category[]> {
    const rows = await database
      .get<Category>('categories')
      .query(Q.where('user_id', userId), Q.where('deleted_at', null))
      .fetch();
    return rows.sort((a, b) => a.name.localeCompare(b.name));
  }

  /**
   * Return the category matching `name` (case-insensitive), creating it if missing (source='mobile').
   * This is how a category typed on the task screen enters the master list and syncs everywhere (§4.5).
   */
  async ensureCategory(
    name: string,
    userId: string,
    source: 'web' | 'mobile' = 'mobile',
  ): Promise<Category | null> {
    const trimmed = name.trim();
    if (!trimmed) return null;

    const existing = await this.getAll(userId);
    const match = existing.find((c) => c.name.toLowerCase() === trimmed.toLowerCase());
    if (match) return match;

    return await database.write(async () =>
      database.get<Category>('categories').create((c) => {
        c.name = trimmed;
        c.source = source;
        c.userId = userId;
      }),
    );
  }

  /** Seed a few default categories the first time the list would otherwise be empty. */
  async seedDefaultsIfEmpty(userId: string): Promise<void> {
    const existing = await this.getAll(userId);
    if (existing.length > 0) return;
    await database.write(async () => {
      for (const name of DEFAULT_CATEGORIES) {
        await database.get<Category>('categories').create((c) => {
          c.name = name;
          c.source = 'mobile';
          c.userId = userId;
        });
      }
    });
  }

  async delete(categoryId: string): Promise<void> {
    await database.write(async () => {
      const cat = await database.get<Category>('categories').find(categoryId);
      await cat.markAsDeleted();
    });
  }
}

export default new CategoryService();
