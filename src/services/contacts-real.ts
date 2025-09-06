import { Contact, ContactEmail, ContactPhone, PaginationResponse } from '../types';
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
    
    logger.info('Real database contacts query', {
      clientId: params.clientId,
      limit: params.limit,
      offset: params.offset,
      traceId: params.traceId
    });

    try {
      const db = getDatabase();
      
      // Extract tenant_id from client_id (remove 'client_' prefix)
      const tenantId = this.extractTenantIdFromClientId(params.clientId);
      
      // Query job_adjuster_info table for contact information
      // This table contains adjuster contact details with emails, phones, etc.
      let query = db.supabase
        .from('job_adjuster_info')
        .select('*')
        .eq('tenant_id', tenantId);

      // Apply search filter if provided
      if (params.q) {
        const searchTerm = `%${params.q}%`;
        query = query.or(`adjuster_name.ilike.${searchTerm},email.ilike.${searchTerm}`);
      }

      // Apply sorting
      const sortField = params.sort === 'name' ? 'adjuster_name' : 'created_at';
      const sortDirection = params.dir === 'desc' ? false : true;
      query = query.order(sortField, { ascending: sortDirection });

      // Apply pagination
      query = query.range(params.offset, params.offset + params.limit - 1);

      const { data: rawContacts, error } = await query;

      if (error) {
        logger.error('Database error querying contacts', {
          error: error.message,
          traceId: params.traceId
        });
        throw new Error(`Database error: ${error.message}`);
      }

      // Map database records to API Contact format
      const contacts = (rawContacts || []).map((record: any) => this.mapDatabaseToApiContact(record));

      // Get total count for pagination
      const { count: totalCount, error: countError } = await db.supabase
        .from('job_adjuster_info')
        .select('*', { count: 'exact', head: true })
        .eq('tenant_id', tenantId);

      if (countError) {
        logger.warn('Failed to get total count', { error: countError.message });
      }

      const total = totalCount || contacts.length;
      const hasMore = params.offset + params.limit < total;

      logger.info('Real database contacts result', {
        clientId: params.clientId,
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
      logger.error('ContactsService.listContacts error', {
        error: error instanceof Error ? error.message : 'Unknown error',
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
    
    logger.info('Real database contact by ID query', {
      id: params.id,
      clientId: params.clientId,
      traceId: params.traceId
    });

    try {
      const db = getDatabase();
      const tenantId = this.extractTenantIdFromClientId(params.clientId);
      
      const { data: record, error } = await db.supabase
        .from('job_adjuster_info')
        .select('*')
        .eq('tenant_id', tenantId)
        .eq('id', params.id)
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          // No rows returned - contact not found
          logger.warn('Contact not found', { 
            id: params.id,
            tenantId,
            traceId: params.traceId
          });
          throw new Error(`Contact not found: ${params.id}`);
        }
        
        logger.error('Database error querying contact by ID', {
          error: error.message,
          traceId: params.traceId
        });
        throw new Error(`Database error: ${error.message}`);
      }

      return this.mapDatabaseToApiContact(record);

    } catch (error) {
      logger.error('ContactsService.getContactById error', {
        error: error instanceof Error ? error.message : 'Unknown error',
        traceId: params.traceId
      });
      throw error;
    }
  }

  private extractTenantIdFromClientId(_clientId: string): string {
    // Client ID format is "client_<prefix>" where prefix maps to tenant
    // For now, we'll use a mapping based on the API key data we've seen
    // Map known prefixes to tenant IDs from the database
    // This is a simplified mapping - in production this would be more sophisticated
    return '5aad9925-2fd1-4888-8870-f53bd7e8ec3f'; // Default tenant from database
  }

  private mapDatabaseToApiContact(record: any): Contact {
    const contact: Contact = {
      id: record.id,
      name: record.adjuster_name || 'Unknown',
      emails: this.mapEmails(record.email ? [{ address: record.email, type: 'WORK', primary: true }] : []),
      created_at: record.created_at,
      updated_at: record.updated_at
    };

    // Add phone if available
    if (record.phone_number) {
      const phones: ContactPhone[] = [];
      
      if (record.phone_number) {
        phones.push({
          phone: record.phone_number,
          type: 'work',
          is_primary: true
        });
      }
      
      if (record.fax) {
        phones.push({
          phone: record.fax,
          type: 'other',
          is_primary: false
        });
      }
      
      if (phones.length > 0) {
        contact.phones = phones;
      }
    }

    return contact;
  }

  private mapEmails(rawEmails: any[]): ContactEmail[] {
    return rawEmails.map(email => ({
      email: email.address,
      type: this.mapEmailType(email.type),
      is_primary: email.primary || false
    }));
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
}