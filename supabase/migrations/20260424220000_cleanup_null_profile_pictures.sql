-- Limpa registros onde profile_picture_url foi salvo como string literal "null"/"undefined"
UPDATE public.saved_contacts
SET profile_picture_url = NULL
WHERE profile_picture_url IS NOT NULL
  AND (
    LOWER(TRIM(profile_picture_url)) IN ('null', 'undefined', 'false', '')
    OR (profile_picture_url NOT ILIKE 'http%' AND profile_picture_url NOT ILIKE 'data:%')
  );
