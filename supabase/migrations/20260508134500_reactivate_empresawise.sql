UPDATE public.profiles
SET is_active = true, updated_at = now()
WHERE email = 'empresawisee@gmail.com'
  AND subscription_status = 'active'
  AND (subscription_expires_at IS NULL OR subscription_expires_at > now());
