import { createClient } from "npm:@supabase/supabase-js@2.58.0";

export interface UserZAPICredentials {
  instanceId: string;
  token: string;
  clientToken: string;
   userId: string;
   instanceName: string;
   provider: string;
   evolutionApiUrl?: string;
 }

const isWhatsAppInstance = (instance: any) => {
  const provider = String(instance?.api_provider || 'zapi').toLowerCase();
  const type = String(instance?.instance_type || '').toLowerCase();
  const name = String(instance?.instance_name || '').toLowerCase();
  const hasCurrentCredentials = Boolean((instance?.evolution_api_url && instance?.evolution_api_key) || (instance?.zapi_instance_id && instance?.zapi_token));
  return hasCurrentCredentials && type !== 'mobile' && !name.includes('mobile');
};

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

  const { data: zapiInstances } = await adminClient
    .from('zapi_instances')
    .select('zapi_instance_id, zapi_token, zapi_client_token, instance_name, api_provider, instance_type, is_default, evolution_api_url, evolution_api_key')
    .eq('user_id', user.id)
    .eq('is_active', true)
    .order('is_default', { ascending: false })
    .order('updated_at', { ascending: false });

  const zapi = zapiInstances?.find(isWhatsAppInstance);
  
  if (zapi) {
    console.log(`✅ Found WhatsApp credentials (${zapi.api_provider}) for user ${user.id}`);
    return {
      instanceId: zapi.zapi_instance_id,
      token: zapi.zapi_token || '',
      clientToken: zapi.zapi_client_token || '',
      userId: user.id,
      instanceName: zapi.instance_name || 'WhatsApp Instance',
      provider: zapi.api_provider || 'zapi',
      evolutionApiUrl: zapi.evolution_api_url,
      evolutionApiKey: zapi.evolution_api_key,
    };
  }

  throw new Error('Nenhuma conexão WhatsApp atual configurada. Crie ou conecte uma instância em Dispositivos.');
}
