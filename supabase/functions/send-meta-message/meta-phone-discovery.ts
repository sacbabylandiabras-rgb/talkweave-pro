export interface MetaCredentialsForDiscovery {
  access_token: string;
  business_account_id?: string | null;
  phone_number_id?: string | null;
  waba_id?: string | null;
}

export interface MetaPhoneNumberInfo {
  id: string;
  display_phone_number?: string;
  verified_name?: string;
  quality_rating?: string;
  name_status?: string;
  code_verification_status?: string;
  waba_id?: string;
}

interface MetaListResponse<T> {
  data?: T[];
}

interface MetaDebugTokenResponse {
  data?: {
    granular_scopes?: Array<{
      scope?: string;
      target_ids?: string[];
    }>;
  };
}

async function safeMetaGet<T>(url: string, accessToken: string): Promise<T | null> {
  try {
    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    const payload = await response.json().catch(() => null);

    if (!response.ok) {
      console.warn("Meta discovery request failed:", url, payload);
      return null;
    }

    return payload as T;
  } catch (error) {
    console.warn("Meta discovery request error:", url, error);
    return null;
  }
}

async function collectWabaIdsFromBusiness(
  businessId: string,
  accessToken: string,
  apiVersion: string,
  accumulator: Set<string>
) {
   const promises = [
     `https://graph.facebook.com/${apiVersion}/${businessId}/owned_whatsapp_business_accounts?limit=250`,
     `https://graph.facebook.com/${apiVersion}/${businessId}/client_whatsapp_business_accounts?limit=250`,
   ].map(url => safeMetaGet<MetaListResponse<{ id: string }>>(url, accessToken));
 
   const results = await Promise.all(promises);
   for (const response of results) {
     for (const account of response?.data || []) {
       if (account?.id) accumulator.add(account.id);
     }
   }
}

async function discoverAccessibleWabaIds(
  creds: MetaCredentialsForDiscovery,
  apiVersion: string
) {
  const wabaIds = new Set<string>();

  if (creds.waba_id) wabaIds.add(creds.waba_id);

  if (creds.business_account_id) {
    await collectWabaIdsFromBusiness(
      creds.business_account_id,
      creds.access_token,
      apiVersion,
      wabaIds
    );
  }

  const businesses = await safeMetaGet<MetaListResponse<{ id: string }>>(
    `https://graph.facebook.com/${apiVersion}/me/businesses?fields=id&limit=250`,
    creds.access_token
  );

   if (businesses?.data?.length) {
     await Promise.all(
       businesses.data.map(business => 
         business?.id ? collectWabaIdsFromBusiness(business.id, creds.access_token, apiVersion, wabaIds) : Promise.resolve()
       )
     );
   }

  const debugToken = await safeMetaGet<MetaDebugTokenResponse>(
    `https://graph.facebook.com/${apiVersion}/debug_token?input_token=${encodeURIComponent(creds.access_token)}&access_token=${encodeURIComponent(creds.access_token)}`,
    creds.access_token
  );

  for (const scope of debugToken?.data?.granular_scopes || []) {
    if (scope.scope === "whatsapp_business_management") {
      for (const targetId of scope.target_ids || []) {
        if (targetId) wabaIds.add(targetId);
      }
    }
  }

  return Array.from(wabaIds);
}

export async function listAccessiblePhoneNumbers(
  creds: MetaCredentialsForDiscovery,
  apiVersion: string
) {
  const numbers: MetaPhoneNumberInfo[] = [];
  const seenIds = new Set<string>();
  const wabaIds = await discoverAccessibleWabaIds(creds, apiVersion);

  console.log(`[phone-discovery] Found ${wabaIds.length} WABA IDs:`, wabaIds);
  console.log(`[phone-discovery] Creds: business_account_id=${creds.business_account_id}, waba_id=${creds.waba_id}, phone_number_id=${creds.phone_number_id}`);

   const phonePromises = wabaIds.map(wabaId => {
      const url = `https://graph.facebook.com/${apiVersion}/${wabaId}/phone_numbers?fields=id,display_phone_number,verified_name,quality_rating,name_status,code_verification_status,status&limit=250`;
     return safeMetaGet<MetaListResponse<MetaPhoneNumberInfo>>(url, creds.access_token).then(response => ({ wabaId, response }));
   });
 
   const phoneResults = await Promise.all(phonePromises);
   for (const { wabaId, response } of phoneResults) {
     for (const number of response?.data || []) {
       if (!number?.id || seenIds.has(number.id)) continue;
       seenIds.add(number.id);
       numbers.push({ ...number, waba_id: wabaId });
     }
   }

  if (numbers.length === 0 && creds.phone_number_id) {
    console.log(`[phone-discovery] No numbers from WABAs, falling back to single phone_number_id: ${creds.phone_number_id}`);
    const currentNumber = await safeMetaGet<MetaPhoneNumberInfo>(
      `https://graph.facebook.com/${apiVersion}/${creds.phone_number_id}?fields=id,display_phone_number,verified_name,quality_rating,name_status,code_verification_status`,
      creds.access_token
    );

    if (currentNumber?.id && !seenIds.has(currentNumber.id)) {
      numbers.push(currentNumber);
    }
  }

  console.log(`[phone-discovery] Total numbers found: ${numbers.length}`, numbers.map(n => `${n.display_phone_number} (${n.id})`));

  return numbers.sort((left, right) =>
    (left.display_phone_number || "").localeCompare(right.display_phone_number || "", "pt-BR")
  );
}