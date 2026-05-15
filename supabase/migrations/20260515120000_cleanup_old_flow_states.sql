-- Habilitar pg_cron se ainda não estiver habilitado
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Remove job anterior se existir para evitar duplicatas
DO $$
BEGIN
  PERFORM cron.unschedule('cleanup-old-flow-states');
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

-- Agenda a limpeza a cada hora
SELECT cron.schedule(
  'cleanup-old-flow-states',
  '0 * * * *',
  $$
  DELETE FROM message_logs
  WHERE keyword_matched LIKE '__flow_capture__%'
  AND created_at < now() - interval '24 hours';
  $$
);

-- Executa uma limpeza manual imediata
DELETE FROM message_logs
WHERE keyword_matched LIKE '__flow_capture__%'
AND created_at < now() - interval '24 hours';
