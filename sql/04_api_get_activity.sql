-- PR1: RPC function api_get_activity
-- Get single activity by ID with tenant validation

CREATE OR REPLACE FUNCTION api_get_activity(
    p_client_id UUID,
    p_activity_id UUID
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
    contact_id UUID
) 
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_tenant_id UUID;
BEGIN
    -- 1. Use client_id directly as tenant_id (same as api_list_contacts)
    v_tenant_id := p_client_id;

    -- 2. Return single activity with tenant validation
    RETURN QUERY
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
        a.contact_id
    FROM activity_view a
    WHERE a.tenant_id = v_tenant_id
        AND a.id = p_activity_id;
        
    -- Raise exception if not found
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Activity not found or access denied';
    END IF;
END;
$$;