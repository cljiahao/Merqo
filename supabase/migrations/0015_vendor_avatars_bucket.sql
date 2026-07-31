-- merqo/supabase/migrations/0015_vendor_avatars_bucket.sql
-- Storage bucket for the vendor profile-icon upload (ImageUploader on
-- /profile), mirroring qkit's booth-images bucket pattern.

INSERT INTO storage.buckets (id, name, public)
VALUES ('vendor-avatars', 'vendor-avatars', true)
ON CONFLICT (id) DO NOTHING;

-- Public-read (avatars are shown in the account menu, no auth required to view).
CREATE POLICY "vendor_avatars_public_read"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'vendor-avatars');

-- A vendor may write only under their own "{auth.uid()}/..." path.
CREATE POLICY "vendor_avatars_owner_insert"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'vendor-avatars'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "vendor_avatars_owner_update"
  ON storage.objects FOR UPDATE TO authenticated
  USING (
    bucket_id = 'vendor-avatars'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "vendor_avatars_owner_delete"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'vendor-avatars'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );
