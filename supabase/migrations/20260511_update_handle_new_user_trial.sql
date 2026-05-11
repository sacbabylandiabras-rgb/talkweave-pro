CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  -- Insert profile with whatsapp and 2-day trial
  INSERT INTO public.profiles (
    id, 
    email, 
    full_name, 
    whatsapp, 
    subscription_status, 
    subscription_expires_at, 
    max_instances
  )
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    COALESCE(NEW.raw_user_meta_data->>'whatsapp', NULL),
    'active', -- Ativado por padrão
    (now() + interval '2 days'), -- Expira em 2 dias
    1 -- Limite padrão de instâncias
  );
  
  -- Assign default 'user' role
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'user');
  
  RETURN NEW;
END;
$function$;

-- Update current function to also set is_active
CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  -- Insert profile with whatsapp, active status and 2-day trial
  INSERT INTO public.profiles (
    id, 
    email, 
    full_name, 
    whatsapp, 
    is_active,
    subscription_status, 
    subscription_expires_at, 
    max_instances
  )
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    COALESCE(NEW.raw_user_meta_data->>'whatsapp', NULL),
    true, -- Ativado (is_active)
    'active', -- Status da assinatura
    (now() + interval '2 days'), -- Expira em 2 dias
    1 -- Limite padrão de instâncias
  );
  
  -- Assign default 'user' role
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'user');
  
  RETURN NEW;
END;
$function$;
