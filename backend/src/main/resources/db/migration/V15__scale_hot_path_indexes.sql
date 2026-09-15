-- Hot-path indexes for the 100k-member operating target.
-- Every statement is additive and idempotent so a rolling deploy can apply it
-- safely to an existing PostgreSQL installation.

CREATE INDEX IF NOT EXISTS ix_messages_match_created_desc
    ON messages(match_id, created_at DESC, id DESC);

CREATE INDEX IF NOT EXISTS ix_messages_match_unread_sender
    ON messages(match_id, sender_id, read_at)
    WHERE read_at IS NULL;

CREATE INDEX IF NOT EXISTS ix_notifications_user_created_desc
    ON notifications(user_id, created_at DESC, id DESC);

CREATE INDEX IF NOT EXISTS ix_date_plans_match_created_desc
    ON date_plans(match_id, created_at DESC, id DESC);

CREATE INDEX IF NOT EXISTS ix_reports_reporter_created_desc
    ON reports(reporter_id, created_at DESC, id DESC);

CREATE INDEX IF NOT EXISTS ix_oauth_flows_active_expiry
    ON oauth_flows(expires_at)
    WHERE used_at IS NULL;

