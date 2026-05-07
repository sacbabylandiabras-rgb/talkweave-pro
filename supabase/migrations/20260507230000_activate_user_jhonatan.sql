-- Activate user jhonatanwisee@gmail.com who has paid but remained inactive
UPDATE profiles
SET is_active = true,
    updated_at = NOW()
WHERE id = 'd2ead472-70cd-48e5-9c54-4249a74308f8';
