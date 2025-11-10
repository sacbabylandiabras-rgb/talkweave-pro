-- Remover credenciais Z-API de todos os usuários
UPDATE profiles 
SET 
  zapi_instance_id = NULL,
  zapi_token = NULL,
  zapi_client_token = NULL;