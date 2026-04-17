import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

export const useUserRole = (userId: string | undefined) => {
  const [isAdmin, setIsAdmin] = useState(false);
  const [checkedUserId, setCheckedUserId] = useState<string | undefined | null>(null);
  const [checking, setChecking] = useState(true);

  // loading enquanto ainda não verificamos o userId atual
  const loading = checking || checkedUserId !== userId;

  useEffect(() => {
    setChecking(true);
    const checkRole = async () => {
      if (!userId) {
        setIsAdmin(false);
        setCheckedUserId(userId);
        setChecking(false);
        return;
      }

      try {
        const { data, error } = await supabase
          .from("user_roles")
          .select("role")
          .eq("user_id", userId);

        if (error) {
          console.error("Error checking role:", error);
          setIsAdmin(false);
        } else {
          const hasAdminRole = data?.some(r => r.role === 'admin') || false;
          setIsAdmin(hasAdminRole);
        }
      } catch (error) {
        console.error("Error in checkRole:", error);
        setIsAdmin(false);
      } finally {
        setCheckedUserId(userId);
        setChecking(false);
      }
    };

    checkRole();

    // Set up realtime subscription for role changes
    const channel = supabase
      .channel('user_roles_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'user_roles',
          filter: `user_id=eq.${userId}`
        },
        () => {
          checkRole();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId]);

  return { isAdmin, loading };
};
