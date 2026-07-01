import { database } from '../database';
import Contact from '../database/models/Contact';

class ContactService {
  /**
   * Fetch all contacts for a user
   */
  async getAll(userId: string): Promise<Contact[]> {
    return await database.get<Contact>('contacts').query().fetch();
  }

  /**
   * Create a new contact
   */
  async create(data: { name: string; email?: string; phone?: string; socials?: any; userId: string }) {
    return await database.write(async () => {
      return await database.get<Contact>('contacts').create((contact) => {
        contact.name = data.name;
        contact.email = data.email;
        contact.phone = data.phone;
        contact.socials = data.socials;
        contact.userId = data.userId;
      });
    });
  }

  /**
   * Update a contact
   */
  async update(contactId: string, data: Partial<{ name: string; email: string; phone: string; socials: any }>) {
    return await database.write(async () => {
      const contact = await database.get<Contact>('contacts').find(contactId);
      return await contact.update((c) => {
        if (data.name !== undefined) c.name = data.name;
        if (data.email !== undefined) c.email = data.email;
        if (data.phone !== undefined) c.phone = data.phone;
        if (data.socials !== undefined) c.socials = data.socials;
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
