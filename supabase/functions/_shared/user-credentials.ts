import { createClient } from "npm:@supabase/supabase-js@2.58.0";

export interface UserZAPICredentials {
  instanceId: string;
  token: string;
  clientToken: string;
  userId: string;
  instanceName: string;
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

  // Fetch only active Z-API instances, explicitly ignoring uazapi
  const { data: zapiInstances } = await adminClient
    .from('zapi_instances')
    .select('zapi_instance_id, zapi_token, zapi_client_token, instance_name, api_provider, is_default')
    .eq('user_id', user.id)
    .eq('is_active', true)
    .neq('api_provider', 'uazapi')
    .order('is_default', { ascending: false });

  const zapi = zapiInstances?.[0];
  
  if (zapi) {
    console.log(`✅ Found Z-API credentials for user ${user.id}`);
    return {
      instanceId: zapi.zapi_instance_id,
      token: zapi.zapi_token || '',
      clientToken: zapi.zapi_client_token || '',
      userId: user.id,
      instanceName: zapi.instance_name || 'Z-API Instance',
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
