DO $$
DECLARE
  target_user_id uuid;
BEGIN
  SELECT id INTO target_user_id
  FROM public.profiles
  WHERE lower(email) = lower('sac.canal360@gmail.com')
  LIMIT 1;
  IF target_user_id IS NULL THEN
    RAISE EXCEPTION 'Admin target account sac.canal360@gmail.com was not found';
  END IF;

  DELETE FROM public.platform_admins
  WHERE user_id <> target_user_id;

  INSERT INTO public.platform_admins (user_id)
  VALUES (target_user_id)
  ON CONFLICT (user_id) DO NOTHING;
END;
$$;
