-- Remove elementos sr-only de templates de email salvos
-- (Gmail e outros clientes ignoram .sr-only e mostram o texto como preview)
UPDATE public.user_email_templates
SET html = regexp_replace(
  html,
  '<([a-z][a-z0-9]*)[^>]*class="[^"]*\bsr-only\b[^"]*"[^>]*>.*?</\1>',
  '',
  'gi'
)
WHERE html ~* 'class="[^"]*\bsr-only\b';
