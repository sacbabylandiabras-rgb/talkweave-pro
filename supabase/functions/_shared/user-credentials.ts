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

  const { data: instance } = await adminClient
    .from('zapi_instances')
    .select('zapi_instance_id, zapi_token, zapi_client_token, instance_name, api_provider')
    .eq('user_id', user.id)
    .eq('is_default', true)
    .maybeSingle();

  const isUazapi = (i: any) => (i?.api_provider || '').toLowerCase() === 'uazapi';

  if (instance && instance.zapi_instance_id && (isUazapi(instance) || (instance.zapi_token && instance.zapi_client_token))) {
    console.log(`✅ Found Z-API credentials from zapi_instances for user ${user.id}`);
    return {
      instanceId: instance.zapi_instance_id,
      token: instance.zapi_token || '',
      clientToken: instance.zapi_client_token || '',
      userId: user.id,
      instanceName: instance.instance_name || 'Instância Padrão',
      isUazapi: isUazapi(instance),
    };
  }

  const { data: anyInstance } = await adminClient
    .from('zapi_instances')
    .select('zapi_instance_id, zapi_token, zapi_client_token, instance_name, api_provider')
    .eq('user_id', user.id)
    .eq('is_active', true)
    .limit(1)
    .maybeSingle();

  if (anyInstance && anyInstance.zapi_instance_id && (isUazapi(anyInstance) || (anyInstance.zapi_token && anyInstance.zapi_client_token))) {
    console.log(`✅ Found Z-API credentials from active instance for user ${user.id}`);
    return {
      instanceId: anyInstance.zapi_instance_id,
      token: anyInstance.zapi_token || '',
      clientToken: anyInstance.zapi_client_token || '',
      userId: user.id,
      instanceName: anyInstance.instance_name || 'Instância Ativa',
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
