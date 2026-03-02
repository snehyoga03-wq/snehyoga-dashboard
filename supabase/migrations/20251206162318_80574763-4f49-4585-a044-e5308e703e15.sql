CREATE OR REPLACE FUNCTION public.add_subscription_days(phone text, days integer)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  UPDATE public.main_data_registration
  SET days_left = COALESCE(days_left, 0) + days
  WHERE mobile_number = phone;
  
  RETURN FOUND;
END;
$$;