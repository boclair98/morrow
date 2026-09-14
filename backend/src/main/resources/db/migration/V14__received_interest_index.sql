-- Keep the incoming-interest inbox fast without scanning every decision.
-- The partial index is additive and safe for existing installations.
CREATE INDEX IF NOT EXISTS ix_swipes_received_likes
    ON swipes(target_id, created_at DESC)
    WHERE decision = 'like';

