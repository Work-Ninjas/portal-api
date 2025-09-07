-- PR1: RPC function api_list_activity
-- Polimórfico function to list activities for any entity type with comprehensive filtering

CREATE OR REPLACE FUNCTION api_list_activity(
    p_client_id UUID,
    p_entity_type activity_entity_type DEFAULT NULL,
    p_entity_id UUID DEFAULT NULL,
    p_author TEXT DEFAULT NULL,
    p_since TIMESTAMP WITH TIME ZONE DEFAULT NULL,
    p_until TIMESTAMP WITH TIME ZONE DEFAULT NULL,
    p_q TEXT DEFAULT NULL,
    p_activity_type TEXT DEFAULT NULL,
    p_priority TEXT DEFAULT NULL,
    p_limit INTEGER DEFAULT 25,
    p_offset INTEGER DEFAULT 0,
    p_sort TEXT DEFAULT 'occurred_at',
    p_dir TEXT DEFAULT 'desc'
)
RETURNS TABLE (
    id UUID,
    entity_type activity_entity_type,
    entity_id UUID,
    author TEXT,
    body_html TEXT,
    body_text TEXT,
    occurred_at TIMESTAMP WITH TIME ZONE,
    activity_type TEXT,
    priority TEXT,
    created_at TIMESTAMP WITH TIME ZONE,
    updated_at TIMESTAMP WITH TIME ZONE,
    contact_id UUID,
    -- Metadata for API response
    has_more BOOLEAN
) 
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_tenant_id UUID;
    v_total_count INTEGER;
    v_returned_count INTEGER;
    v_order_clause TEXT;
BEGIN
    -- 1. Use client_id directly as tenant_id (same as api_list_contacts)
    v_tenant_id := p_client_id;

    -- 2. Validate entity parameters
    IF (p_entity_type IS NOT NULL AND p_entity_id IS NULL) OR 
       (p_entity_type IS NULL AND p_entity_id IS NOT NULL) THEN
        RAISE EXCEPTION 'Both p_entity_type and p_entity_id must be provided together or both NULL';
    END IF;

    -- 3. Build dynamic ORDER BY clause
    v_order_clause := CASE 
        WHEN p_sort IN ('occurred_at', 'created_at', 'updated_at', 'author') THEN p_sort
        ELSE 'occurred_at'
    END;
    
    v_order_clause := v_order_clause || CASE 
        WHEN LOWER(p_dir) = 'asc' THEN ' ASC'
        ELSE ' DESC'
    END;

    -- 4. Get total count for pagination
    SELECT COUNT(*)::INTEGER INTO v_total_count
    FROM activity_view a
    WHERE a.tenant_id = v_tenant_id
        AND (p_entity_type IS NULL OR (a.entity_type = p_entity_type AND a.entity_id = p_entity_id))
        AND (p_author IS NULL OR a.author ILIKE '%' || p_author || '%')
        AND (p_since IS NULL OR a.occurred_at >= p_since)
        AND (p_until IS NULL OR a.occurred_at <= p_until)
        AND (p_q IS NULL OR (a.body_text ILIKE '%' || p_q || '%' OR a.author ILIKE '%' || p_q || '%'))
        AND (p_activity_type IS NULL OR a.activity_type = p_activity_type)
        AND (p_priority IS NULL OR a.priority = p_priority);

    -- 5. Return paginated results with dynamic ordering
    RETURN QUERY EXECUTE format('
        SELECT 
            a.id,
            a.entity_type,
            a.entity_id,
            a.author,
            a.body_html,
            a.body_text,
            a.occurred_at,
            a.activity_type,
            a.priority,
            a.created_at,
            a.updated_at,
            a.contact_id,
            -- Calculate has_more for each row
            CASE 
                WHEN (ROW_NUMBER() OVER (ORDER BY %s) + %s) < %s THEN true
                ELSE false
            END as has_more
        FROM activity_view a
        WHERE a.tenant_id = $1
            AND ($2 IS NULL OR (a.entity_type = $2 AND a.entity_id = $3))
            AND ($4 IS NULL OR a.author ILIKE ''%%'' || $4 || ''%%'')
            AND ($5 IS NULL OR a.occurred_at >= $5)
            AND ($6 IS NULL OR a.occurred_at <= $6)
            AND ($7 IS NULL OR (a.body_text ILIKE ''%%'' || $7 || ''%%'' OR a.author ILIKE ''%%'' || $7 || ''%%''))
            AND ($8 IS NULL OR a.activity_type = $8)
            AND ($9 IS NULL OR a.priority = $9)
        ORDER BY %s
        LIMIT $10 OFFSET $11',
        v_order_clause,
        p_offset,
        v_total_count,
        v_order_clause
    ) USING v_tenant_id, p_entity_type, p_entity_id, p_author, p_since, p_until, p_q, p_activity_type, p_priority, p_limit, p_offset;
END;
$$;