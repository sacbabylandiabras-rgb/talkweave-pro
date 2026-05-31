UPDATE public.telegram_flow_sessions
SET status='finished', waiting_for=NULL
WHERE waiting_for='payment';
