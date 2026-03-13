-- Migration to ensure radio_settings and stations tables are ready for branding and driver mode features

-- Create radio_settings if it doesn't exist
CREATE TABLE IF NOT EXISTS public.radio_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT DEFAULT 'Radio GeorgeFctech',
    logo TEXT DEFAULT 'https://bcfckpzvbltnsryqbwif.supabase.co/storage/v1/object/public/meus_arquivos/logo-web-radio.png',
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS on radio_settings
ALTER TABLE public.radio_settings ENABLE ROW LEVEL SECURITY;

-- Policies for radio_settings
CREATE POLICY "Allow public read on radio_settings" ON public.radio_settings
    FOR SELECT USING (true);

CREATE POLICY "Allow admin update on radio_settings" ON public.radio_settings
    FOR ALL USING (auth.role() = 'authenticated');

-- Ensure stations table has necessary fields
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'stations' AND column_name = 'latitude') THEN
        ALTER TABLE public.stations ADD COLUMN latitude FLOAT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'stations' AND column_name = 'longitude') THEN
        ALTER TABLE public.stations ADD COLUMN longitude FLOAT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'stations' AND column_name = 'stream_url') THEN
        ALTER TABLE public.stations ADD COLUMN stream_url TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'stations' AND column_name = 'cover_url') THEN
        ALTER TABLE public.stations ADD COLUMN cover_url TEXT;
    END IF;
END $$;

-- Insert default settings if empty
INSERT INTO public.radio_settings (name, logo)
SELECT 'Radio GeorgeFctech', 'https://bcfckpzvbltnsryqbwif.supabase.co/storage/v1/object/public/meus_arquivos/logo-web-radio.png'
WHERE NOT EXISTS (SELECT 1 FROM public.radio_settings);
