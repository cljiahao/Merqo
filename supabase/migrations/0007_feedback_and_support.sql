-- Hub-level help requests, mirroring qkit's own support_messages table
-- (0047_support_messages.sql): a signed-in user reports a problem, the
-- Merqo team resolves it in /admin — no email. Categories cover what Merqo
-- itself owns (vendor access, billing, team membership) plus a catch-all.
CREATE TABLE merqo.support_messages (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  category    TEXT        NOT NULL CHECK (category IN ('vendor_access', 'billing', 'team', 'other')),
  body        TEXT        NOT NULL CHECK (char_length(body) BETWEEN 1 AND 2000),
  status      TEXT        NOT NULL DEFAULT 'open'
                          CHECK (status IN ('open', 'resolved')),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX support_messages_open_idx
  ON merqo.support_messages (status, created_at DESC);

ALTER TABLE merqo.support_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "support_messages_self_insert" ON merqo.support_messages
  FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "support_messages_select" ON merqo.support_messages
  FOR SELECT USING (user_id = auth.uid() OR merqo.is_merqo_team(auth.uid()));

CREATE POLICY "support_messages_team_update" ON merqo.support_messages
  FOR UPDATE USING (merqo.is_merqo_team(auth.uid()));

GRANT SELECT, INSERT, UPDATE ON merqo.support_messages TO authenticated;

-- Hub-level NPS + comment, mirroring qkit's own feedback table
-- (0018_feedback.sql) trimmed to what Merqo actually has — no customers, no
-- orders, no booths, so no rating/booth_id/order_number/source columns.
CREATE TABLE merqo.feedback (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  nps         INT         NOT NULL CHECK (nps BETWEEN 0 AND 10),
  message     TEXT        CHECK (message IS NULL OR char_length(message) <= 2000),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX feedback_created_idx ON merqo.feedback (created_at DESC);

ALTER TABLE merqo.feedback ENABLE ROW LEVEL SECURITY;

CREATE POLICY "feedback_self_insert" ON merqo.feedback
  FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "feedback_team_select" ON merqo.feedback
  FOR SELECT USING (merqo.is_merqo_team(auth.uid()));

GRANT SELECT, INSERT ON merqo.feedback TO authenticated;
