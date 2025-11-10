import { createClient } from "https://esm.sh/@supabase/supabase-js@2.58.0";

export interface UserZAPICredentials {
  instanceId: string;
  token: string;
  clientToken: string;
  userId: string;
}

export async function getUserZAPICredentials(
  req: Request,
  supabaseUrl: string,
  supabaseServiceKey: string
): Promise<UserZAPICredentials> {
  // Get the authorization header
  const authHeader = req.headers.get('authorization');
  if (!authHeader) {
    throw new Error('No authorization header');
  }

  // Create supabase client with the auth header to get user context
  const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    global: {
      headers: {
        Authorization: authHeader,
      },
    },
  });

  // Get the authenticated user
  const { data: { user }, error: userError } = await supabase.auth.getUser();
  
  if (userError || !user) {
    throw new Error('Unauthorized: ' + (userError?.message || 'User not found'));
  }

  console.log(`📋 Fetching Z-API credentials for user: ${user.id}`);

  // Get user's Z-API credentials from profile
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('zapi_instance_id, zapi_token, zapi_client_token')
    .eq('id', user.id)
    .single();

  if (profileError) {
    throw new Error('Failed to fetch user profile: ' + profileError.message);
  }

  if (!profile) {
    throw new Error('User profile not found');
  }

  if (!profile.zapi_instance_id || !profile.zapi_token || !profile.zapi_client_token) {
    throw new Error('Z-API credentials not configured for this user. Please configure in Profile settings.');
  }

  console.log(`✅ Found Z-API credentials for user ${user.id}`);

  return {
    instanceId: profile.zapi_instance_id,
    token: profile.zapi_token,
    clientToken: profile.zapi_client_token,
    userId: user.id,
  };
}
