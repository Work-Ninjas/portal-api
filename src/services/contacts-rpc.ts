import { Contact, PaginationResponse } from '../types';
import { getDatabase } from './database';
import { logger } from '../utils/logger';

export class ContactsService {
  constructor() {}

  async listContacts(params: {
    limit: number;
    offset: number;
    sort?: string;
    dir?: string;
    q?: string;
    traceId: string;
    clientId: string;
  }): Promise<PaginationResponse & { data: Contact[] }> {
    
    logger.info('RPC call', {
      endpoint: '/v1/contacts',
      client_id: params.clientId,
      rpc: 'api_list_contacts',
      traceId: params.traceId,
      clientIdType: typeof params.clientId,
      clientIdLength: params.clientId.length
    });

    try {
      const db = getDatabase();
      
      // Call api_list_contacts RPC - tenant resolution happens in DB
      const { data: rawContacts, error } = await db.supabase.rpc('api_list_contacts', {
        p_client_id: params.clientId,
        p_limit: params.limit,
        p_offset: params.offset,
        p_sort: params.sort || 'created_at',
        p_dir: params.dir || 'desc',
        p_q: params.q || null
      });

      if (error) {
        logger.error('RPC error calling api_list_contacts', {
          error: error.message,
          client_id: params.clientId,
          traceId: params.traceId
        });
        throw new Error(`RPC error: ${error.message}`);
      }

      // Passthrough response - map to API Contact format
      const contacts = (rawContacts || []).map((record: any) => this.mapRpcToApiContact(record));

      // For pagination, we need total count - make a separate count call
      const { data: countData, error: countError } = await db.supabase.rpc('api_list_contacts', {
        p_client_id: params.clientId,
        p_limit: 10000, // Large limit to get total
        p_offset: 0,
        p_sort: 'created_at',
        p_dir: 'desc',
        p_q: params.q || null
      });

      let total = 0;
      if (!countError && countData) {
        total = countData.length;
      }

      const hasMore = params.offset + params.limit < total;

      logger.info('RPC result', {
        client_id: params.clientId,
        rpc: 'api_list_contacts',
        returnedCount: contacts.length,
        total,
        hasMore,
        traceId: params.traceId
      });

      return {
        data: contacts,
        total,
        limit: params.limit,
        offset: params.offset,
        has_more: hasMore
      };

    } catch (error) {
      logger.error('ContactsService.listContacts RPC error', {
        error: error instanceof Error ? error.message : 'Unknown error',
        client_id: params.clientId,
        traceId: params.traceId
      });
      throw error;
    }
  }

  async getContactById(params: {
    id: string;
    traceId: string;
    clientId: string;
  }): Promise<Contact> {
    
    logger.info('RPC call', {
      endpoint: '/v1/contacts/:id',
      client_id: params.clientId,
      contact_id: params.id,
      rpc: 'api_get_contact',
      traceId: params.traceId
    });

    try {
      const db = getDatabase();
      
      // Call api_get_contact RPC - tenant resolution happens in DB
      const { data: rawContacts, error } = await db.supabase.rpc('api_get_contact', {
        p_client_id: params.clientId,
        p_contact_id: params.id
      });

      if (error) {
        logger.error('RPC error calling api_get_contact', {
          error: error.message,
          client_id: params.clientId,
          contact_id: params.id,
          traceId: params.traceId
        });
        throw new Error(`RPC error: ${error.message}`);
      }

      // RPC returns array, get first result
      const record = rawContacts?.[0];
      if (!record) {
        logger.warn('Contact not found via RPC', { 
          client_id: params.clientId,
          contact_id: params.id,
          traceId: params.traceId
        });
        throw new Error(`Contact not found: ${params.id}`);
      }

      return this.mapRpcToApiContact(record);

    } catch (error) {
      logger.error('ContactsService.getContactById RPC error', {
        error: error instanceof Error ? error.message : 'Unknown error',
        client_id: params.clientId,
        contact_id: params.id,
        traceId: params.traceId
      });
      throw error;
    }
  }

  /**
   * Map RPC response to API Contact format
   * Passthrough approach - include all fields from RPC
   */
  private mapRpcToApiContact(record: any): Contact {
    const contact: Contact = {
      id: record.id,
      name: record.name || 'Unknown',
      emails: [], // Initialize required field
      created_at: record.created_at,
      updated_at: record.updated_at
    };

    // Passthrough: Add emails if available
    if (record.email) {
      contact.emails = [{
        email: record.email,
        type: 'other' as const,
        is_primary: true
      }];
    } else {
      contact.emails = [];
    }

    // Passthrough: Add phones if available
    if (record.phone) {
      contact.phones = [{
        phone: record.phone,
        type: 'other' as const,
        is_primary: true
      }];
    }

    // Passthrough: Add any additional fields from RPC
    // This allows DB schema evolution without API redeploy
    Object.keys(record).forEach(key => {
      if (!['id', 'name', 'email', 'phone', 'created_at', 'updated_at', 'tenant_id'].includes(key)) {
        (contact as any)[key] = record[key];
      }
    });

    return contact;
  }
}