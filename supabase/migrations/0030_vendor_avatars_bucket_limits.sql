-- Harden the vendor-avatars bucket. It was created (0015) public-read with no
-- size or MIME constraint, so the browser-side resize in ImageUploader was the
-- only guard: a direct storage call with a signed-in JWT could upload an
-- arbitrarily large file, or a non-image such as an HTML payload that this
-- public bucket would then serve. Enforce the limits at the bucket so they
-- hold regardless of client. 5 MB and JPEG/PNG/WebP match qkit's booth-images,
-- stockkit's vendor-avatars and loopkit's vendor-images.
UPDATE storage.buckets
SET
  file_size_limit = 5242880, -- 5 MB
  allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/webp']
WHERE id = 'vendor-avatars';
