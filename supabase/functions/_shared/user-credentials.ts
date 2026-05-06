import { createClient } from "npm:@supabase/supabase-js@2.58.0";

export interface UserZAPICredentials {
  instanceId: string;
  token: string;
  clientToken: string;
  userId: string;
  instanceName: string;
  isUazapi?: boolean;
}

export async function getUserZAPICredentials(
  req: Request,
  supabaseUrl: string,
  supabaseServiceKey: string
): Promise<UserZAPICredentials> {
  const authHeader = req.headers.get('authorization');
  if (!authHeader) {
    throw new Error('No authorization header');
  }

  const adminClient = createClient(supabaseUrl, supabaseServiceKey);
  const userClient = createClient(supabaseUrl, supabaseServiceKey, {
    global: { headers: { Authorization: authHeader } },
  });

  const { data: { user }, error: userError } = await userClient.auth.getUser();
  if (userError || !user) {
    throw new Error('Unauthorized: ' + (userError?.message || 'User not found'));
  }

  console.log(`📋 Fetching Z-API credentials for user: ${user.id}`);

  // Priorizar instâncias que explicitamente NÃO são uazapi para atender o requisito de usar z-api
  const { data: zapiInstances } = await adminClient
    .from('zapi_instances')
    .select('zapi_instance_id, zapi_token, zapi_client_token, instance_name, api_provider, is_default')
    .eq('user_id', user.id)
    .eq('is_active', true)
    .order('is_default', { ascending: false });

  const zapiOnly = zapiInstances?.find(i => (i.api_provider || '').toLowerCase() !== 'uazapi');
  
  if (zapiOnly) {
    console.log(`✅ Found official Z-API credentials for user ${user.id}`);
    return {
      instanceId: zapiOnly.zapi_instance_id,
      token: zapiOnly.zapi_token || '',
      clientToken: zapiOnly.zapi_client_token || '',
      userId: user.id,
      instanceName: zapiOnly.instance_name || 'Z-API Instance',
      isUazapi: false,
    };
  }

  // Fallback para qualquer uma se não achou específica Z-API (mas o código de envio já deve filtrar)
  const anyInstance = zapiInstances?.[0];
  const isUazapi = (i: any) => (i?.api_provider || '').toLowerCase() === 'uazapi';

  if (anyInstance) {
    return {
      instanceId: anyInstance.zapi_instance_id,
      token: anyInstance.zapi_token || '',
      clientToken: anyInstance.zapi_client_token || '',
      userId: user.id,
      instanceName: anyInstance.instance_name || 'Instância',
      isUazapi: isUazapi(anyInstance),
    };
  }

  const { data: profile } = await adminClient
    .from('profiles')
    .select('zapi_instance_id, zapi_token, zapi_client_token')
    .eq('id', user.id)
    .single();

  if (profile?.zapi_instance_id && profile?.zapi_token && profile?.zapi_client_token) {
    console.log(`✅ Found Z-API credentials from profile for user ${user.id}`);
    return {
      instanceId: profile.zapi_instance_id,
      token: profile.zapi_token,
      clientToken: profile.zapi_client_token,
      userId: user.id,
      instanceName: 'Instância Perfil',
    };
  }

  throw new Error('Z-API credentials not configured. Please configure in settings.');
}
