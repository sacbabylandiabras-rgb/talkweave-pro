-- Adicionar role de admin para o usuário souzaecombr@gmail.com
INSERT INTO public.user_roles (user_id, role)
VALUES ('7dbabade-25ea-4c04-8f7f-62bb99911dd4', 'admin')
ON CONFLICT (user_id, role) DO NOTHING;