-- PR1: Create activity view that normalizes message table to "activity"
-- This view transforms message records into a standardized activity format
-- Using ONLY columns that actually exist in the message table

-- Drop existing view first to avoid column structure conflicts
DROP VIEW IF EXISTS activity_view;

CREATE VIEW activity_view AS
SELECT 
    m.id,
    m.tenant_id,
    'job'::activity_entity_type as entity_type,
    m.job_id as entity_id,
    COALESCE(m.user_author, 'Unknown') as author,
    m.message_body as body_html,
    regexp_replace(m.message_body, '<[^>]*>', '', 'g') as body_text,
    COALESCE(m.created_at, m.updated_at) as occurred_at,
    m.created_at,
    m.updated_at,
    -- Additional fields for future extensibility (using existing columns)
    NULL::uuid as contact_id,  -- message table doesn't have contact_id
    CASE 
        WHEN COALESCE(m.user_author, '') = 'System' THEN 'system'
        ELSE 'user'
    END as activity_type,
    -- Extract importance from message content
    CASE 
        WHEN LOWER(m.message_body) ~ 'urgent|deadline|inspection|material list|important' THEN 'high'
        WHEN COALESCE(m.user_author, '') = 'System' THEN 'low'
        ELSE 'normal'
    END as priority
FROM message m
WHERE m.job_id IS NOT NULL;