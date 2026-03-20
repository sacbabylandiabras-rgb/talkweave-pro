import { createClient } from "https://esm.sh/@supabase/supabase-js@2.58.0";

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

    // Extract data from PerfectPay payload
    const saleStatus = payload.sale_status_enum;
    const customerEmail = payload.customer?.email?.toLowerCase()?.trim();
    const customerName = payload.customer?.name || payload.customer?.full_name || "";
    const customerPhone = payload.customer?.phone_number || payload.customer?.phone || "";

    if (!customerEmail) {
      console.error("No customer email in webhook payload");
      return new Response(JSON.stringify({ error: "No customer email" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`Processing: email=${customerEmail}, status=${saleStatus}, name=${customerName}, phone=${customerPhone}`);

    // PerfectPay sale_status_enum:
    // 1 = pending (boleto)
    // 2 = approved/paid
    // 3 = canceled
    // 4 = refunded  
    // 5 = chargeback
    // 6 = waiting_refund
    // 7 = expired

    if (saleStatus === 2) {
      // PAYMENT APPROVED - Create user account automatically
      
      // Check if user already exists
      const { data: existingUsers } = await supabaseAdmin.auth.admin.listUsers();
      const existingUser = existingUsers?.users?.find(
        (u) => u.email?.toLowerCase() === customerEmail
      );

      if (existingUser) {
        // User exists - just activate subscription
        console.log(`User already exists: ${existingUser.id}, activating subscription`);
        
        const { error: updateError } = await supabaseAdmin
          .from("profiles")
          .update({
            is_active: true,
            subscription_status: "active",
            subscription_expires_at: null,
            full_name: customerName || undefined,
          })
          .eq("id", existingUser.id);

        if (updateError) {
          console.error("Error updating profile:", updateError);
        }

        return new Response(JSON.stringify({ 
          success: true, 
          action: "reactivated",
          user_id: existingUser.id 
        }), {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Create new user with random password
      const tempPassword = crypto.randomUUID().slice(0, 16) + "Aa1!";
      
      const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
        email: customerEmail,
        password: tempPassword,
        email_confirm: true, // Auto-confirm email
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

      // Update profile with subscription active
      const { error: profileError } = await supabaseAdmin
        .from("profiles")
        .update({
          is_active: true,
          subscription_status: "active",
          full_name: customerName,
          whatsapp: customerPhone,
        })
        .eq("id", newUser.user.id);

      if (profileError) {
        console.error("Error updating new user profile:", profileError);
      }

      // Send password reset email so user can set their own password
      // The user will receive an email to define their password
      const siteUrl = Deno.env.get("SUPABASE_URL")?.replace(".supabase.co", "").replace("https://", "");
      
      // Use Supabase's built-in password recovery
      const { error: resetError } = await supabaseAdmin.auth.admin.generateLink({
        type: "recovery",
        email: customerEmail,
        options: {
          redirectTo: "https://talkweave-pro.lovable.app/auth",
        },
      });

      if (resetError) {
        console.error("Error generating recovery link:", resetError);
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
      // CANCELED, REFUNDED, CHARGEBACK, or EXPIRED - Deactivate user
      
      const { data: existingUsers } = await supabaseAdmin.auth.admin.listUsers();
      const existingUser = existingUsers?.users?.find(
        (u) => u.email?.toLowerCase() === customerEmail
      );

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

      const { error: deactivateError } = await supabaseAdmin
        .from("profiles")
        .update({
          is_active: false,
          subscription_status: statusMap[saleStatus] || "inactive",
        })
        .eq("id", existingUser.id);

      if (deactivateError) {
        console.error("Error deactivating user:", deactivateError);
      }

      console.log(`User ${existingUser.id} deactivated with status: ${statusMap[saleStatus]}`);

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
      // Other statuses (pending, waiting_refund, etc.) - just log
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
