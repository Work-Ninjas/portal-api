-- API RPC: Get single job by ID
-- Maps to GET /v1/jobs/:id endpoint
-- This function retrieves a single job by its ID for a specific tenant

CREATE OR REPLACE FUNCTION api_get_job(
  p_client_id UUID,
  p_job_id UUID
)
RETURNS TABLE (
  id UUID,
  job_name TEXT,
  job_number TEXT,
  status TEXT,
  priority TEXT,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ,
  current_milestone TEXT,
  milestone_date TIMESTAMPTZ,
  trade_type TEXT,
  work_type TEXT,
  location_street1 TEXT,
  location_city TEXT,
  location_state TEXT,
  location_zip_code TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_tenant_id UUID;
BEGIN
  -- Resolve client_id to tenant_id
  SELECT tenant_id INTO v_tenant_id
  FROM client_mappings 
  WHERE client_id = p_client_id;
  
  -- If no mapping found, return empty result
  IF v_tenant_id IS NULL THEN
    RETURN;
  END IF;
  
  -- Return the specific job for this tenant
  RETURN QUERY
  SELECT 
    j.id,
    j.job_name,
    j.job_number,
    j.status,
    j.priority,
    j.created_at,
    j.updated_at,
    j.current_milestone,
    j.milestone_date,
    j.trade_type,
    j.work_type,
    j.location_street1,
    j.location_city,
    j.location_state,
    j.location_zip_code
  FROM jobs j
  WHERE j.tenant_id = v_tenant_id 
    AND j.id = p_job_id
  LIMIT 1;
END;
$$;

-- Grant execute permissions to the API service user
GRANT EXECUTE ON FUNCTION api_get_job(UUID, UUID) TO api_user;