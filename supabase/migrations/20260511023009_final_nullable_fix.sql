
DO $$ 
BEGIN 
    BEGIN
        ALTER TABLE public.zapi_instances ALTER COLUMN zapi_instance_id DROP NOT NULL;
    EXCEPTION WHEN OTHERS THEN 
        RAISE NOTICE 'Already nullable or error: %', SQLERRM;
    END;

    BEGIN
        ALTER TABLE public.zapi_instances ALTER COLUMN zapi_token DROP NOT NULL;
    EXCEPTION WHEN OTHERS THEN 
        RAISE NOTICE 'Already nullable or error: %', SQLERRM;
    END;

    BEGIN
        ALTER TABLE public.zapi_instances ALTER COLUMN zapi_client_token DROP NOT NULL;
    EXCEPTION WHEN OTHERS THEN 
        RAISE NOTICE 'Already nullable or error: %', SQLERRM;
    END;
END $$;
