 import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
 import { createClient } from "https://esm.sh/@supabase/supabase-js@2"
 import { corsHeaders } from "../_shared/cors.ts"
 import { getUserZAPICredentials } from "../_shared/user-credentials.ts"
 
 serve(async (req) => {
   if (req.method === 'OPTIONS') {
     return new Response(null, { headers: corsHeaders })
   }
 
   try {
     const supabaseUrl = Deno.env.get('SUPABASE_URL')!
     const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
     const adminClient = createClient(supabaseUrl, supabaseServiceKey)
     const credentials = await getUserZAPICredentials(req, supabaseUrl, supabaseServiceKey)
 
     const { instanceId } = await req.json().catch(() => ({}))
     
     // Get instance credentials
     const { data: instance } = await adminClient
       .from('zapi_instances')
       .select('*')
       .eq('user_id', credentials.userId)
       .or(`id.eq.${instanceId || credentials.instanceId},zapi_instance_id.eq.${instanceId || credentials.instanceId}`)
       .maybeSingle()
 
     if (!instance) {
       throw new Error('Instance not found')
     }
 
      const provider = (instance.api_provider || 'zapi').toLowerCase()
      const isZapi = provider === 'zapi';
      const isUazapi = provider === 'uazapi' || provider === 'uazapi_warmup';

      if (!isZapi && !isUazapi) {
        return new Response(JSON.stringify({ success: false, message: 'Only Z-API and UAZAPI are supported for full metadata sync' }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }


      let chats = [];
      
      if (isZapi) {
        const baseUrl = `https://api.z-api.io/instances/${instance.zapi_instance_id}/token/${instance.zapi_token}`;
        const headers = {
          'Content-Type': 'application/json',
          'Client-Token': instance.zapi_client_token || ''
        };

        // Fetch all chats which include metadata and photos
        const chatsRes = await fetch(`${baseUrl}/chats`, { headers });
        if (chatsRes.ok) {
          chats = await chatsRes.json();
        }

         // Also fetch groups specifically to ensure all groups are captured
         try {
           const groupsRes = await fetch(`${baseUrl}/groups`, { headers });
           if (groupsRes.ok) {
             const groups = await groupsRes.json();
             if (Array.isArray(groups)) {
               chats = [...chats, ...groups];
             }
           }
         } catch (err) {
           console.error('Error fetching Z-API groups:', err);
          }

          // Fetch communities to ensure all community metadata is captured
          try {
            const communitiesRes = await fetch(`${baseUrl}/communities`, { headers });
            if (communitiesRes.ok) {
              const communities = await communitiesRes.json();
              if (Array.isArray(communities)) {
                // For each community, fetch its full metadata
                for (const community of communities) {
                  const communityId = community.id || community.phone || community.jid;
                  if (communityId) {
                    const metadataRes = await fetch(`${baseUrl}/community-metadata/${communityId}`, { headers });
                    if (metadataRes.ok) {
                      const metadata = await metadataRes.ok ? await metadataRes.json() : null;
                      if (metadata) {
                        chats.push(metadata);
                      }
                    } else {
                      // Fallback to basic community info if detailed metadata fails
                      chats.push(community);
                    }
                  }
                }
              }
            }
          } catch (err) {
            console.error('Error fetching Z-API communities:', err);
          }
        } else if (isUazapi) {
          const apiUrl = (instance.evolution_api_url || '').replace(/\/+$/, '');
          const apiToken = instance.evolution_api_key || instance.zapi_token || '';
          
          if (apiUrl && apiToken) {
            try {
              // UAZAPI (Evolution API) - Fetch chats
              const chatsRes = await fetch(`${apiUrl}/chat/find/all`, {
                headers: { 'Content-Type': 'application/json', 'token': apiToken }
              });
              if (chatsRes.ok) {
                const data = await chatsRes.json();
                const rawChats = Array.isArray(data) ? data : (data?.response || data?.data || []);
                chats = [...chats, ...rawChats];
              }

              // Fetch groups as well
              const groupsRes = await fetch(`${apiUrl}/group/find/all`, {
                headers: { 'Content-Type': 'application/json', 'token': apiToken }
              });
              if (groupsRes.ok) {
                const data = await groupsRes.json();
                const rawGroups = Array.isArray(data) ? data : (data?.response || data?.data || []);
                chats = [...chats, ...rawGroups];
              }
            } catch (err) {
              console.error('Error fetching UAZAPI chats/groups:', err);
            }
          }
        }


      if (!Array.isArray(chats)) {
        chats = [];
      }

      const upserts = chats.map(chat => {
        const phone = chat.id || chat.phone || chat.jid || chat.number;
        if (!phone) return null;
        
        let photoUrl = chat.profilePictureUrl || chat.imgUrl || chat.image || chat.profileThumbnail || chat.photo || null;
        if (photoUrl === 'null' || photoUrl === 'undefined' || (typeof photoUrl === 'string' && !photoUrl.startsWith('http'))) {
          photoUrl = null;
        }

        const name = chat.name || chat.contactName || chat.pushname || chat.verifiedName || '';

        // Detect community status from available metadata
        const isCommunity = chat.isCommunity === true || 
                           chat.isGroupAnnouncement === true || 
                           !!chat.communityId || 
                           (chat.id && chat.id.includes('@newsletter')); // Newsletter/Channels
        
        const communityId = chat.communityId || null;

        return {
          phone,
          name: name.trim(),
          profile_picture_url: photoUrl,
          is_community: isCommunity,
          community_id: communityId,
          user_id: credentials.userId,
          updated_at: new Date().toISOString()
        };
      }).filter(Boolean);

      if (upserts.length > 0) {
        // Process in chunks to avoid too large payloads
        const CHUNK_SIZE = 100;
        for (let i = 0; i < upserts.length; i += CHUNK_SIZE) {
          const chunk = upserts.slice(i, i + CHUNK_SIZE);
          await adminClient
            .from('saved_contacts')
            .upsert(chunk, { onConflict: 'phone,user_id' });
        }
      }

      return new Response(JSON.stringify({ success: true, count: upserts.length }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
 
   } catch (error) {
     console.error('Error syncing metadata:', error)
     return new Response(JSON.stringify({ success: false, error: error.message }), {
       status: 500,
       headers: { ...corsHeaders, 'Content-Type': 'application/json' }
     })
   }
 })