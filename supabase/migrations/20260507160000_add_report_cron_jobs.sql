-- Criar extensão pg_cron (já deveria estar ativa, mas garantimos)
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Agendar os relatórios para os horários específicos em BRT
-- BRT = UTC-3, então para chamar um endpoint em hora BRT, precisamos fazer em UTC+3

-- 00:00 BRT = 03:00 UTC
SELECT cron.schedule('trigger-report-00h', '0 3 * * *', 'SELECT net.http_post(''http://localhost:3000/functions/v1/trigger-report-slot'', ''{}''::jsonb) as request_id;');

-- 08:00 BRT = 11:00 UTC
SELECT cron.schedule('trigger-report-08h', '0 11 * * *', 'SELECT net.http_post(''http://localhost:3000/functions/v1/trigger-report-slot'', ''{}''::jsonb) as request_id;');

-- 12:00 BRT = 15:00 UTC
SELECT cron.schedule('trigger-report-12h', '0 15 * * *', 'SELECT net.http_post(''http://localhost:3000/functions/v1/trigger-report-slot'', ''{}''::jsonb) as request_id;');

-- 16:30 BRT = 19:30 UTC
SELECT cron.schedule('trigger-report-16h30', '30 19 * * *', 'SELECT net.http_post(''http://localhost:3000/functions/v1/trigger-report-slot'', ''{}''::jsonb) as request_id;');

-- 18:00 BRT = 21:00 UTC
SELECT cron.schedule('trigger-report-18h', '0 21 * * *', 'SELECT net.http_post(''http://localhost:3000/functions/v1/trigger-report-slot'', ''{}''::jsonb) as request_id;');
