-- Cross-kit billing settings: currently just the bundle-discount toggle.
-- Singleton row, same shape as qkit's own platform_settings (id pinned to
-- 1, public-read, no UPDATE policy for any client role — writes go
-- through the service-role admin action only). See
-- docs/superpowers/specs/2026-08-16-bundle-discount-toggle-design.md.

CREATE TABLE merqo.billing_settings (
  id                       INT         PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  bundle_discount_enabled  BOOLEAN     NOT NULL DEFAULT false,
  updated_at               TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO merqo.billing_settings (id)
  VALUES (1)
  ON CONFLICT (id) DO NOTHING;

ALTER TABLE merqo.billing_settings ENABLE ROW LEVEL SECURITY;

-- Not secret - a future kit's own plan/checkout page will eventually need
-- to read this directly to decide whether to show bundle pricing.
CREATE POLICY "billing_settings_public_select" ON merqo.billing_settings
  FOR SELECT USING (true);

GRANT SELECT ON merqo.billing_settings TO anon;
GRANT SELECT ON merqo.billing_settings TO authenticated;
