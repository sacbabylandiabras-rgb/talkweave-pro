DO $$ 
BEGIN 
    ALTER TABLE public.zapi_instances ALTER COLUMN zapi_instance_id DROP NOT NULL;
    ALTER TABLE public.zapi_instances ALTER COLUMN zapi_token DROP NOT NULL;
    ALTER COLUMN zapi_client_token DROP NOT NULL;
EXCEPTION 
    WHEN OTHERS THEN 
        RAISE NOTICE 'Erro ao alterar colunas: %', SQLERRM;
END $$;
