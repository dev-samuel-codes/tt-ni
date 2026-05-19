-- 롤백:
-- ALTER TABLE public.supplement_products DROP CONSTRAINT IF EXISTS supplement_products_source_type_check;
-- ALTER TABLE public.supplement_products ADD CONSTRAINT supplement_products_source_type_check CHECK (source_type IN ('manual', 'photo'));
-- ALTER TABLE public.supplement_products DROP COLUMN IF EXISTS exa_search_url;

ALTER TABLE public.supplement_products DROP CONSTRAINT IF EXISTS supplement_products_source_type_check;
ALTER TABLE public.supplement_products ADD CONSTRAINT supplement_products_source_type_check CHECK (source_type IN ('manual', 'photo', 'search'));

ALTER TABLE public.supplement_products ADD COLUMN IF NOT EXISTS exa_search_url text;
