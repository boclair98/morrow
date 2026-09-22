CREATE TABLE IF NOT EXISTS push_subscriptions (
    id UUID PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    endpoint VARCHAR(2048) NOT NULL,
    p256dh VARCHAR(512) NOT NULL,
    auth VARCHAR(256) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    last_used_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_push_subscriptions_endpoint UNIQUE(endpoint)
);

CREATE INDEX IF NOT EXISTS ix_push_subscriptions_user
    ON push_subscriptions(user_id, last_used_at DESC);
