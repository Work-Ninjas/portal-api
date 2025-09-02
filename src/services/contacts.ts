import { Contact, ContactEmail, ContactPhone, ContactAddress, PaginationResponse } from '../types';
import { RpcClient } from './rpc';

export class ContactsService {
  private rpcClient: RpcClient;

  constructor() {
    this.rpcClient = new RpcClient();
  }

  async listContacts(params: {
    limit: number;
    offset: number;
    sort?: string;
    dir?: string;
    q?: string;
    traceId: string;
    clientId: string;
  }): Promise<PaginationResponse & { data: Contact[] }> {
    
    const rpcResult = await this.rpcClient.call<{
      contacts: any[];
      total_count: number;
      has_more: boolean;
    }>({
      method: 'api_list_contacts',
      params: {
        limit: params.limit,
        offset: params.offset,
        sort_field: params.sort,
        sort_direction: params.dir,
        search_query: params.q
      },
      traceId: params.traceId,
      clientId: params.clientId
    });

    const contacts = rpcResult.contacts.map((internal: any) => this.mapInternalToApiContact(internal));

    return {
      data: contacts,
      total: rpcResult.total_count,
      limit: params.limit,
      offset: params.offset,
      has_more: rpcResult.has_more
    };
  }

  async getContactById(params: {
    id: string;
    traceId: string;
    clientId: string;
  }): Promise<Contact> {
    
    const internal = await this.rpcClient.call<any>({
      method: 'api_get_contact',
      params: {
        contact_id: params.id
      },
      traceId: params.traceId,
      clientId: params.clientId
    });

    return this.mapInternalToApiContact(internal);
  }

  private mapInternalToApiContact(internal: any): Contact {
    const contact: Contact = {
      id: internal.contact_id,
      name: internal.full_name,
      emails: this.mapEmails(internal.email_addresses || []),
      created_at: internal.created_timestamp,
      updated_at: internal.updated_timestamp
    };

    // Only include fields that have values (omit vs null policy)
    if (internal.organization) {
      contact.company = internal.organization;
    }

    if (internal.phone_numbers && internal.phone_numbers.length > 0) {
      contact.phones = this.mapPhones(internal.phone_numbers);
    }

    if (internal.postal_address) {
      const address = this.mapAddress(internal.postal_address);
      if (Object.keys(address).length > 0) {
        contact.address = address;
      }
    }

    if (internal.tags && internal.tags.length > 0) {
      contact.tags = internal.tags;
    }

    return contact;
  }

  private mapEmails(internalEmails: any[]): ContactEmail[] {
    return internalEmails.map(email => ({
      email: email.address,
      type: this.mapEmailType(email.type),
      is_primary: email.primary || false
    }));
  }

  private mapPhones(internalPhones: any[]): ContactPhone[] {
    return internalPhones.map(phone => ({
      phone: phone.number,
      type: this.mapPhoneType(phone.type),
      is_primary: phone.primary || false
    }));
  }

  private mapAddress(internalAddress: any): ContactAddress {
    const address: ContactAddress = {};

    if (internalAddress.street_address) {
      address.street = internalAddress.street_address;
    }
    if (internalAddress.city) {
      address.city = internalAddress.city;
    }
    if (internalAddress.state_province) {
      address.state = internalAddress.state_province;
    }
    if (internalAddress.postal_code) {
      address.postal_code = internalAddress.postal_code;
    }
    if (internalAddress.country_code) {
      address.country = internalAddress.country_code;
    }

    return address;
  }

  private mapEmailType(internalType: string): ContactEmail['type'] {
    switch (internalType?.toUpperCase()) {
      case 'WORK':
      case 'BUSINESS':
        return 'work';
      case 'PERSONAL':
      case 'HOME':
        return 'personal';
      default:
        return 'other';
    }
  }

  private mapPhoneType(internalType: string): ContactPhone['type'] {
    switch (internalType?.toUpperCase()) {
      case 'MOBILE':
      case 'CELL':
        return 'mobile';
      case 'WORK':
      case 'BUSINESS':
      case 'OFFICE':
        return 'work';
      case 'HOME':
      case 'PERSONAL':
        return 'home';
      default:
        return 'other';
    }
  }
}