-- Atomically consume one API usage unit and return whether the request is allowed.
CREATE OR REPLACE FUNCTION consume_api_usage(
  p_user_id uuid,
  p_api_type text,
  p_daily_limit integer
)
RETURNS TABLE(allowed boolean, used integer, limit_count integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  next_count integer;
BEGIN
  IF p_user_id IS NULL THEN
    RAISE EXCEPTION 'p_user_id is required';
  END IF;

  IF p_api_type IS NULL OR length(trim(p_api_type)) = 0 THEN
    RAISE EXCEPTION 'p_api_type is required';
  END IF;

  IF p_daily_limit IS NULL OR p_daily_limit < 1 THEN
    RAISE EXCEPTION 'p_daily_limit must be greater than zero';
  END IF;

  IF auth.role() <> 'service_role' AND auth.uid() IS DISTINCT FROM p_user_id THEN
    RAISE EXCEPTION 'Cannot consume API usage for another user';
  END IF;

  INSERT INTO api_usage (user_id, usage_date, api_type, call_count)
  VALUES (p_user_id, CURRENT_DATE, p_api_type, 1)
  ON CONFLICT (user_id, usage_date, api_type)
  DO UPDATE SET
    call_count = api_usage.call_count + 1,
    updated_at = now()
  WHERE api_usage.call_count < p_daily_limit
  RETURNING call_count INTO next_count;

  IF next_count IS NULL THEN
    SELECT call_count
      INTO next_count
      FROM api_usage
     WHERE user_id = p_user_id
       AND usage_date = CURRENT_DATE
       AND api_type = p_api_type;

    RETURN QUERY SELECT false, COALESCE(next_count, p_daily_limit), p_daily_limit;
    RETURN;
  END IF;

  RETURN QUERY SELECT true, next_count, p_daily_limit;
END;
$$;

REVOKE ALL ON FUNCTION consume_api_usage(uuid, text, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION consume_api_usage(uuid, text, integer) TO authenticated, service_role;
