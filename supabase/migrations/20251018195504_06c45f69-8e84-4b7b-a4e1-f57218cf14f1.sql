
-- Adicionar role de admin para o usuário william.gds123@gmail.com
INSERT INTO public.user_roles (user_id, role)
VALUES ('1470f83b-f2cb-42cd-b93e-8cf7afb56d5e', 'admin')
ON CONFLICT (user_id, role) DO NOTHING;
