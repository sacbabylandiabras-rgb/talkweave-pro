import { createClient } from "npm:@supabase/supabase-js@2.58.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const payload = await req.json();
    console.log("PerfectPay webhook received:", JSON.stringify(payload));

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const saleStatus = payload.sale_status_enum;
    const customerEmail = payload.customer?.email?.toLowerCase()?.trim();
    const customerName = payload.customer?.full_name || payload.customer?.name || "";
    
    // Build full phone: extension + area_code + number
    const phoneExt = payload.customer?.phone_extension || "55";
    const phoneArea = payload.customer?.phone_area_code || "";
    const phoneNum = payload.customer?.phone_number || payload.customer?.phone || "";
    const customerPhone = phoneArea && phoneNum ? `+${phoneExt}${phoneArea}${phoneNum}` : "";

    if (!customerEmail) {
      console.error("No customer email in webhook payload");
      return new Response(JSON.stringify({ error: "No customer email" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`Processing: email=${customerEmail}, status=${saleStatus}, name=${customerName}, phone=${customerPhone}`);

    // Helper: find user by email with pagination
    const findUserByEmail = async (email: string) => {
      let page = 1;
      const perPage = 100;
      while (true) {
        const { data, error } = await supabaseAdmin.auth.admin.listUsers({ page, perPage });
        if (error || !data?.users?.length) return null;
        const found = data.users.find((u) => u.email?.toLowerCase() === email);
        if (found) return found;
        if (data.users.length < perPage) return null;
        page++;
      }
    };

    // Helper: ensure profile exists (upsert)
    const ensureProfile = async (userId: string, data: Record<string, any>) => {
      // Try update first
      const { data: updated, error: updateError } = await supabaseAdmin
        .from("profiles")
        .update(data)
        .eq("id", userId)
        .select("id");

      if (updateError) {
        console.error("Error updating profile:", updateError);
      }

      // If no row was updated, insert
      if (!updated || updated.length === 0) {
        console.log(`Profile not found for ${userId}, creating...`);
        const { error: insertError } = await supabaseAdmin
          .from("profiles")
          .insert({
            id: userId,
            email: data.email || customerEmail,
            full_name: data.full_name || "",
            whatsapp: data.whatsapp || "",
            is_active: data.is_active ?? true,
            subscription_status: data.subscription_status || "active",
          });

        if (insertError) {
          console.error("Error inserting profile:", insertError);
        } else {
          console.log(`Profile created for ${userId}`);
        }
      }
    };

    if (saleStatus === 2) {
      // PAYMENT APPROVED
      const existingUser = await findUserByEmail(customerEmail);

      if (existingUser) {
        console.log(`User already exists: ${existingUser.id}, activating subscription`);
        
        await ensureProfile(existingUser.id, {
          is_active: true,
          subscription_status: "active",
          subscription_expires_at: null,
          full_name: customerName || undefined,
          whatsapp: customerPhone || undefined,
          email: customerEmail,
        });

        return new Response(JSON.stringify({ 
          success: true, 
          action: "reactivated",
          user_id: existingUser.id 
        }), {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Create new user
      const tempPassword = crypto.randomUUID().slice(0, 16) + "Aa1!";
      
      const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
        email: customerEmail,
        password: tempPassword,
        email_confirm: true,
        user_metadata: {
          full_name: customerName,
          whatsapp: customerPhone,
        },
      });

      if (createError) {
        console.error("Error creating user:", createError);
        return new Response(JSON.stringify({ error: createError.message }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      console.log(`User created: ${newUser.user.id}`);

      // Wait a moment for the trigger to create the profile, then ensure it
      await new Promise((r) => setTimeout(r, 1000));
      
      await ensureProfile(newUser.user.id, {
        is_active: true,
        subscription_status: "active",
        full_name: customerName,
        whatsapp: customerPhone,
        email: customerEmail,
      });

      // Also ensure user_roles exists
      const { data: existingRoles } = await supabaseAdmin
        .from("user_roles")
        .select("id")
        .eq("user_id", newUser.user.id);

      if (!existingRoles || existingRoles.length === 0) {
        await supabaseAdmin.from("user_roles").insert({
          user_id: newUser.user.id,
          role: "user",
        });
        console.log(`Role 'user' assigned to ${newUser.user.id}`);
      }

      // Generate password recovery so user can set their own password
      const { data: linkData, error: resetError } = await supabaseAdmin.auth.admin.generateLink({
        type: "recovery",
        email: customerEmail,
        options: {
          redirectTo: "https://zaplynx.com/auth",
        },
      });

      if (resetError) {
        console.error("Error generating recovery link:", resetError);
      } else {
        console.log("Recovery link generated for:", customerEmail);
      }

      return new Response(JSON.stringify({ 
        success: true, 
        action: "created",
        user_id: newUser.user.id 
      }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });

    } else if ([3, 4, 5, 7].includes(saleStatus)) {
      // CANCELED, REFUNDED, CHARGEBACK, or EXPIRED
      const existingUser = await findUserByEmail(customerEmail);

      if (!existingUser) {
        console.log(`No user found for email: ${customerEmail}, nothing to deactivate`);
        return new Response(JSON.stringify({ success: true, action: "no_user_found" }), {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const statusMap: Record<number, string> = {
        3: "canceled",
        4: "refunded",
        5: "chargeback",
        7: "expired",
      };

      await ensureProfile(existingUser.id, {
        is_active: false,
        subscription_status: statusMap[saleStatus] || "inactive",
        email: customerEmail,
      });

      console.log(`User ${existingUser.id} deactivated: ${statusMap[saleStatus]}`);

      return new Response(JSON.stringify({ 
        success: true, 
        action: "deactivated",
        user_id: existingUser.id,
        status: statusMap[saleStatus]
      }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });

    } else {
      console.log(`Ignoring sale_status_enum: ${saleStatus} for ${customerEmail}`);
      return new Response(JSON.stringify({ success: true, action: "ignored", status: saleStatus }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

  } catch (error) {
    console.error("Webhook error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
