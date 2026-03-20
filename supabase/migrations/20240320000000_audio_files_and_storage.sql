-- 1. Create audio_files table if it doesn't exist
CREATE TABLE IF NOT EXISTS public.audio_files (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    url TEXT NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('vignette', 'track', 'commercial')),
    file_name TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- 2. Enable RLS on audio_files
ALTER TABLE public.audio_files ENABLE ROW LEVEL SECURITY;

-- 3. Policies for audio_files
-- Allow public read access
CREATE POLICY "Allow public read on audio_files" ON public.audio_files
    FOR SELECT USING (true);

-- Allow authenticated users to insert/update/delete
CREATE POLICY "Allow authenticated insert on audio_files" ON public.audio_files
    FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Allow authenticated update on audio_files" ON public.audio_files
    FOR UPDATE USING (auth.role() = 'authenticated');

CREATE POLICY "Allow authenticated delete on audio_files" ON public.audio_files
    FOR DELETE USING (auth.role() = 'authenticated');

-- 4. Storage Bucket Policies
-- Note: These assume the buckets 'vinhetas', 'trilhas', and 'comerciais' exist.
-- If they don't, they should be created in the Supabase Dashboard.

-- Policy for 'vinhetas' bucket
CREATE POLICY "Allow authenticated uploads to vinhetas" ON storage.objects
    FOR INSERT WITH CHECK (bucket_id = 'vinhetas' AND auth.role() = 'authenticated');

CREATE POLICY "Allow public read from vinhetas" ON storage.objects
    FOR SELECT USING (bucket_id = 'vinhetas');

CREATE POLICY "Allow authenticated delete from vinhetas" ON storage.objects
    FOR DELETE USING (bucket_id = 'vinhetas' AND auth.role() = 'authenticated');

-- Policy for 'trilhas' bucket
CREATE POLICY "Allow authenticated uploads to trilhas" ON storage.objects
    FOR INSERT WITH CHECK (bucket_id = 'trilhas' AND auth.role() = 'authenticated');

CREATE POLICY "Allow public read from trilhas" ON storage.objects
    FOR SELECT USING (bucket_id = 'trilhas');

CREATE POLICY "Allow authenticated delete from trilhas" ON storage.objects
    FOR DELETE USING (bucket_id = 'trilhas' AND auth.role() = 'authenticated');

-- Policy for 'comerciais' bucket
CREATE POLICY "Allow authenticated uploads to comerciais" ON storage.objects
    FOR INSERT WITH CHECK (bucket_id = 'comerciais' AND auth.role() = 'authenticated');

CREATE POLICY "Allow public read from comerciais" ON storage.objects
    FOR SELECT USING (bucket_id = 'comerciais');

CREATE POLICY "Allow authenticated delete from comerciais" ON storage.objects
    FOR DELETE USING (bucket_id = 'comerciais' AND auth.role() = 'authenticated');
