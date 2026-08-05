// Backend for @merqo/ui's `ImageUploader`: its `onUpload` is injected so the
// component itself never depends on Supabase. `path` arrives already built as
// `${pathPrefix}/${uuid}.${ext}` — `ImageUploader` builds that internally
// from the `pathPrefix` prop the call site passes (the vendor's auth user
// id), so there's no vendor-scoped work left to do here: this just writes
// the blob and resolves the public URL, the exact call the local
// `ImageUploader` it replaces made directly against `supabase.storage`.
import { createClient } from "@/lib/supabase/client";
import type { ImageUploaderProps } from "@merqo/ui";

export const uploadVendorAvatar: ImageUploaderProps["onUpload"] = async ({
  bucket,
  path,
  blob,
  contentType,
}) => {
  const supabase = createClient();
  const { error } = await supabase.storage
    .from(bucket)
    .upload(path, blob, { upsert: false, contentType });
  if (error) throw error;

  const {
    data: { publicUrl },
  } = supabase.storage.from(bucket).getPublicUrl(path);
  return publicUrl;
};
