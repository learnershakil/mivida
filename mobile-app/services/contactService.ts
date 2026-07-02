import { Q } from '@nozbe/watermelondb';
import { database } from '../database';
import Contact from '../database/models/Contact';

class ContactService {
  /**
   * Fetch all non-deleted contacts for a user (AUDIT §4.7: getAll previously ignored userId).
   */
  async getAll(userId: string): Promise<Contact[]> {
    const rows = await database
      .get<Contact>('contacts')
      .query(Q.where('user_id', userId), Q.where('deleted_at', null))
      .fetch();
    return rows.sort((a, b) => a.name.localeCompare(b.name));
  }

  /**
   * Create a new contact
   */
  async create(data: { name: string; email?: string; phone?: string; socials?: any; source?: string; userId: string }) {
    return await database.write(async () => {
      return await database.get<Contact>('contacts').create((contact) => {
        contact.name = data.name;
        contact.email = data.email;
        contact.phone = data.phone;
        contact.socials = data.socials;
        contact.source = data.source;
        contact.userId = data.userId;
      });
    });
  }

  /**
   * Update a contact
   */
  async update(contactId: string, data: Partial<{ name: string; email: string; phone: string; socials: any; source: string }>) {
    return await database.write(async () => {
      const contact = await database.get<Contact>('contacts').find(contactId);
      return await contact.update((c) => {
        if (data.name !== undefined) c.name = data.name;
        if (data.email !== undefined) c.email = data.email;
        if (data.phone !== undefined) c.phone = data.phone;
        if (data.socials !== undefined) c.socials = data.socials;
        if (data.source !== undefined) c.source = data.source;
      });
    });
  }

  /**
   * Delete a contact (marks as deleted internally in WatermelonDB sync protocol)
   */
  async delete(contactId: string) {
    return await database.write(async () => {
      const contact = await database.get<Contact>('contacts').find(contactId);
      await contact.markAsDeleted();
    });
  }
}

export default new ContactService();
