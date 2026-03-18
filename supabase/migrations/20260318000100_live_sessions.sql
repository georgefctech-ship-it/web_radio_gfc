CREATE TABLE IF NOT EXISTS public.live_sessions (
    id TEXT PRIMARY KEY,
    is_live BOOLEAN NOT NULL DEFAULT FALSE,
    broadcaster_name TEXT,
    started_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.live_sessions ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_policies
        WHERE schemaname = 'public'
          AND tablename = 'live_sessions'
          AND policyname = 'Allow public read on live_sessions'
    ) THEN
        CREATE POLICY "Allow public read on live_sessions"
            ON public.live_sessions
            FOR SELECT
            USING (true);
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM pg_policies
        WHERE schemaname = 'public'
          AND tablename = 'live_sessions'
          AND policyname = 'Allow authenticated write on live_sessions'
    ) THEN
        CREATE POLICY "Allow authenticated write on live_sessions"
            ON public.live_sessions
            FOR ALL
            USING (auth.role() = 'authenticated')
            WITH CHECK (auth.role() = 'authenticated');
    END IF;
END $$;

INSERT INTO public.live_sessions (id, is_live, broadcaster_name, started_at, updated_at)
VALUES ('global', FALSE, NULL, NULL, NOW())
ON CONFLICT (id) DO NOTHING;
