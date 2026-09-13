-- Retention primitive: let members keep a small, free shortlist for a later visit.
-- The unique pair and self-check enforce the invariant even under concurrent clicks.

CREATE TABLE saved_profiles (
    id UUID PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    target_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_saved_profiles_user_target UNIQUE (user_id, target_user_id),
    CONSTRAINT ck_saved_profiles_not_self CHECK (user_id <> target_user_id)
);

CREATE INDEX ix_saved_profiles_user_created
    ON saved_profiles(user_id, created_at DESC);

CREATE INDEX ix_saved_profiles_target
    ON saved_profiles(target_user_id);
