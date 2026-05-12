-- Reativa a conta vgetulio072@gmail.com
UPDATE public.profiles
SET is_active = true,
    subscription_status = 'active',
    subscription_expires_at = GREATEST(COALESCE(subscription_expires_at, now()), now() + interval '30 days')
WHERE email = 'vgetulio072@gmail.com';
