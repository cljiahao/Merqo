import { describe, it, expect, vi, beforeEach } from "vitest";

const h = vi.hoisted(() => ({
  uploadMock: vi.fn(),
  getPublicUrlMock: vi.fn(),
}));

vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({
    storage: {
      from: (bucket: string) => ({
        upload: (...args: unknown[]) => h.uploadMock(bucket, ...args),
        getPublicUrl: (...args: unknown[]) =>
          h.getPublicUrlMock(bucket, ...args),
      }),
    },
  }),
}));

import { uploadVendorAvatar } from "./image-upload-adapter";

beforeEach(() => {
  h.uploadMock.mockReset();
  h.getPublicUrlMock.mockReset();
});

describe("uploadVendorAvatar", () => {
  it("uploads to the vendor-avatars bucket at vendorId/<uuid>.<ext> and returns the public URL", async () => {
    h.uploadMock.mockResolvedValue({ error: null });
    h.getPublicUrlMock.mockReturnValue({
      data: {
        publicUrl:
          "https://proj.supabase.co/storage/v1/object/public/vendor-avatars/vendor-123/some-uuid.webp",
      },
    });

    const url = await uploadVendorAvatar({
      bucket: "vendor-avatars",
      path: "vendor-123/some-uuid.webp",
      blob: new Blob(["x"], { type: "image/webp" }),
      contentType: "image/webp",
    });

    expect(url).toMatch(/^https?:\/\//);
    expect(h.uploadMock).toHaveBeenCalledWith(
      "vendor-avatars",
      "vendor-123/some-uuid.webp",
      expect.any(Blob),
      { upsert: false, contentType: "image/webp" },
    );
  });

  it("propagates a storage upload failure", async () => {
    h.uploadMock.mockResolvedValue({ error: new Error("upload failed") });

    await expect(
      uploadVendorAvatar({
        bucket: "vendor-avatars",
        path: "vendor-123/x.webp",
        blob: new Blob(["x"]),
        contentType: "image/webp",
      }),
    ).rejects.toThrow();
  });
});
