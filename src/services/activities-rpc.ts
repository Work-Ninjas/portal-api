import { Activity, ActivityEntityType, ActivityType, ActivityPriority, PaginationResponse } from '../types';
import { getDatabase } from './database';
import { logger } from '../utils/logger';

export class ActivitiesService {
  constructor() {}

  async listActivities(params: {
    entityType?: ActivityEntityType;
    entityId?: string;
    author?: string;
    since?: string;
    until?: string;
    q?: string;
    activityType?: ActivityType;
    priority?: ActivityPriority;
    limit: number;
    offset: number;
    sort?: string;
    dir?: string;
    traceId: string;
    clientId: string;
  }): Promise<PaginationResponse & { data: Activity[] }> {
    
    logger.info('RPC call', {
      endpoint: '/v1/activity',
      client_id: params.clientId,
      entity_type: params.entityType,
      entity_id: params.entityId,
      rpc: 'api_list_activity',
      traceId: params.traceId
    });

    try {
      const db = getDatabase();
      
      // ✅ LLAMADA RPC DIRECTA (siguiendo patrón exitoso)
      const { data: rawActivities, error } = await db.supabase.rpc('api_list_activity', {
        p_client_id: params.clientId,
        p_entity_type: params.entityType || null,
        p_entity_id: params.entityId || null,
        p_author: params.author || null,
        p_since: params.since || null,
        p_until: params.until || null,
        p_q: params.q || null,
        p_activity_type: params.activityType || null,
        p_priority: params.priority || null,
        p_limit: params.limit,
        p_offset: params.offset,
        p_sort: params.sort || 'occurred_at',
        p_dir: params.dir || 'desc'
      });

      if (error) {
        logger.error('RPC error calling api_list_activity', {
          error: error.message,
          client_id: params.clientId,
          entity_type: params.entityType,
          entity_id: params.entityId,
          traceId: params.traceId
        });
        
        // Handle specific error cases
        if (error.message.includes('Both p_entity_type and p_entity_id must be provided together')) {
          throw new Error('Both entity_type and entity_id must be provided together or both omitted');
        }
        throw new Error(`RPC error: ${error.message}`);
      }

      // ✅ MAPEO DE RESPUESTA (passthrough approach)
      const activities = (rawActivities || []).map((record: any) => this.mapRpcToApiActivity(record));

      // ✅ CONTEO TOTAL (segunda llamada RPC para paginación)
      const { data: countData, error: countError } = await db.supabase.rpc('api_list_activity', {
        p_client_id: params.clientId,
        p_entity_type: params.entityType || null,
        p_entity_id: params.entityId || null,
        p_author: params.author || null,
        p_since: params.since || null,
        p_until: params.until || null,
        p_q: params.q || null,
        p_activity_type: params.activityType || null,
        p_priority: params.priority || null,
        p_limit: 10000, // Large limit to get total
        p_offset: 0,
        p_sort: 'occurred_at',
        p_dir: 'desc'
      });

      let total = 0;
      if (!countError && countData) {
        total = countData.length;
      }

      const hasMore = params.offset + params.limit < total;

      logger.info('RPC result', {
        client_id: params.clientId,
        entity_type: params.entityType,
        entity_id: params.entityId,
        rpc: 'api_list_activity',
        returnedCount: activities.length,
        total,
        hasMore,
        traceId: params.traceId
      });

      return {
        data: activities,
        total,
        limit: params.limit,
        offset: params.offset,
        has_more: hasMore
      };

    } catch (error) {
      logger.error('ActivitiesService.listActivities RPC error', {
        error: error instanceof Error ? error.message : 'Unknown error',
        client_id: params.clientId,
        entity_type: params.entityType,
        entity_id: params.entityId,
        traceId: params.traceId
      });
      throw error;
    }
  }

  async getActivity(params: {
    activityId: string;
    traceId: string;
    clientId: string;
  }): Promise<Activity> {
    
    logger.info('RPC call', {
      endpoint: '/v1/activity/:id',
      client_id: params.clientId,
      activity_id: params.activityId,
      rpc: 'api_get_activity',
      traceId: params.traceId
    });

    try {
      const db = getDatabase();
      
      // ✅ LLAMADA RPC DIRECTA
      const { data: rawActivity, error } = await db.supabase.rpc('api_get_activity', {
        p_client_id: params.clientId,
        p_activity_id: params.activityId
      });

      if (error) {
        logger.error('RPC error calling api_get_activity', {
          error: error.message,
          client_id: params.clientId,
          activity_id: params.activityId,
          traceId: params.traceId
        });
        
        // Handle specific error cases
        if (error.message.includes('Activity not found or access denied')) {
          throw new Error('Activity not found or access denied');
        }
        throw new Error(`RPC error: ${error.message}`);
      }

      if (!rawActivity || rawActivity.length === 0) {
        throw new Error('Activity not found or access denied');
      }

      const activity = this.mapRpcToApiActivity(rawActivity[0]);

      logger.info('RPC result', {
        client_id: params.clientId,
        activity_id: params.activityId,
        rpc: 'api_get_activity',
        found: true,
        traceId: params.traceId
      });

      return activity;

    } catch (error) {
      logger.error('ActivitiesService.getActivity RPC error', {
        error: error instanceof Error ? error.message : 'Unknown error',
        client_id: params.clientId,
        activity_id: params.activityId,
        traceId: params.traceId
      });
      throw error;
    }
  }

  /**
   * Map RPC response to API Activity format
   * Passthrough approach - include all fields from RPC
   */
  private mapRpcToApiActivity(record: any): Activity {
    const activity: Activity = {
      id: record.id,
      entity_type: record.entity_type,
      entity_id: record.entity_id,
      author: record.author || 'Unknown',
      body_html: record.body_html || '',
      body_text: record.body_text || '',
      occurred_at: record.occurred_at,
      activity_type: record.activity_type || 'user',
      priority: record.priority || 'normal',
      created_at: record.created_at,
      updated_at: record.updated_at
    };

    // Add optional fields if present
    if (record.contact_id) {
      activity.contact_id = record.contact_id;
    }

    // ✅ EXTENSIÓN PARA CAMPOS FUTUROS
    const extendedActivity = activity as any;

    // Add any additional fields as needed for future expansion
    if (record.job_title) {
      extendedActivity.job_title = record.job_title;
    }
    
    if (record.contact_name) {
      extendedActivity.contact_name = record.contact_name;
    }

    return extendedActivity;
  }
}