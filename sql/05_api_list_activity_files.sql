-- COPIED EXACTLY FROM api_list_job_files - Activity Files RPC
-- Only changes: job -> activity, job table -> activity_view

CREATE OR REPLACE FUNCTION public.api_list_activity_files(
    p_client_id uuid, 
    p_activity_id uuid, 
    p_limit integer DEFAULT 25, 
    p_offset integer DEFAULT 0, 
    p_kind text DEFAULT NULL::text
)
RETURNS TABLE(
    id uuid, 
    filename text, 
    kind text, 
    mime_type text, 
    size_bytes bigint, 
    bucket text, 
    object_path text, 
    created_at timestamp with time zone
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
BEGIN
    -- First verify the activity belongs to the tenant (COPIED PATTERN)
    IF NOT EXISTS (
      SELECT 1 FROM activity_view av
      WHERE av.id = p_activity_id AND av.tenant_id = p_client_id
    ) THEN
      RAISE EXCEPTION 'Activity not found or access denied';
    END IF;

    RETURN QUERY
    SELECT
      fa.id,
      fa.filename,
      fa.kind,
      fa.mime_type,
      fa.size_bytes,
      fa.bucket,
      fa.object_path,
      fa.created_at
    FROM file_asset fa
    WHERE fa.tenant_id = p_client_id
      AND fa.entity_type = 'message'  -- CORRECT: entity type is 'message'
      AND fa.entity_id = p_activity_id  -- CHANGE: p_job_id -> p_activity_id
      AND (p_kind IS NULL OR fa.kind = p_kind)
    ORDER BY fa.created_at DESC
    LIMIT p_limit OFFSET p_offset;
END;
$function$