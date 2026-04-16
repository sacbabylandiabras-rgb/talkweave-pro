import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "No auth" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    // Verify user is admin
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const adminClient = createClient(supabaseUrl, serviceKey);
    const { data: roleData } = await adminClient
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .eq("role", "admin")
      .maybeSingle();

    if (!roleData) {
      return new Response(JSON.stringify({ error: "Forbidden" }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Fetch all platform stats using service role
    const now = new Date();
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

    const [allTxRes, todayTxRes, monthTxRes, monthByProviderRes, kycRes, usersRes] = await Promise.all([
      adminClient.from("gateway_transactions").select("amount, fee, status"),
      adminClient.from("gateway_transactions").select("amount, status").gte("created_at", startOfDay),
      adminClient.from("gateway_transactions").select("amount, fee, status").gte("created_at", startOfMonth),
      adminClient.from("gateway_transactions").select("amount, status, metadata").gte("created_at", startOfMonth),
      adminClient.from("gateway_kyc").select("id", { count: "exact", head: true }).eq("status", "submitted"),
      adminClient.from("profiles").select("id", { count: "exact", head: true }),
    ]);

    // Per-acquirer breakdown for current month
    const monthByProvider = monthByProviderRes.data || [];
    const computeAcq = (filter: (t: any) => boolean) => {
      const list = monthByProvider.filter(filter);
      const approvedList = list.filter(isApproved);
      return {
        volumeMonth: approvedList.reduce((s: number, t: any) => s + (t.amount || 0), 0),
        txCount: list.length,
        approvalRate: list.length > 0 ? Math.round((approvedList.length / list.length) * 100) : 100,
      };
    };
    const acquirers = {
      openpix: computeAcq((t) => !t.metadata?.provider || t.metadata?.provider === 'openpix'),
      hubpague: computeAcq((t) => t.metadata?.provider === 'hubpague'),
      cartwave: computeAcq((t) => t.metadata?.provider === 'cartwave'),
    };

    const allTx = allTxRes.data || [];
    const todayTx = todayTxRes.data || [];
    const monthTx = monthTxRes.data || [];
    const isApproved = (t: any) => t.status === "approved" || t.status === "paid";
    const approved = allTx.filter(isApproved);
    const monthApproved = monthTx.filter(isApproved);
    const todayApproved = todayTx.filter(isApproved);

    const stats = {
      totalUsers: usersRes.count || 0,
      pendingKyc: kycRes.count || 0,
      volumeToday: todayApproved.reduce((s: number, t: any) => s + t.amount, 0),
      volumeMonth: monthApproved.reduce((s: number, t: any) => s + t.amount, 0),
      revenueToday: todayApproved.reduce((s: number, t: any) => s + (t.fee || 0), 0),
      revenueMonth: monthApproved.reduce((s: number, t: any) => s + t.fee, 0),
      revenueTotal: approved.reduce((s: number, t: any) => s + t.fee, 0),
      volumeTotal: approved.reduce((s: number, t: any) => s + t.amount, 0),
      approvalRate: allTx.length > 0 ? (approved.length / allTx.length) * 100 : 0,
      totalTransactions: allTx.length,
      approvedTransactions: approved.length,
      feePercent: 6.99,
      feeFixed: 199,
    };

    return new Response(JSON.stringify(stats), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
