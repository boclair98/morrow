-- Daily return loop: short-lived member stories with optional photos.
CREATE TABLE IF NOT EXISTS stories (
    id UUID PRIMARY KEY,
    author_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    body VARCHAR(240) NOT NULL,
    photo_content_type VARCHAR(32),
    photo_content BYTEA,
    photo_storage_key VARCHAR(300) UNIQUE,
    photo_byte_size INTEGER,
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ix_stories_active_feed
    ON stories(expires_at DESC, created_at DESC);

CREATE INDEX IF NOT EXISTS ix_stories_author_created
    ON stories(author_id, created_at DESC);

CREATE TABLE IF NOT EXISTS story_reactions (
    id UUID PRIMARY KEY,
    story_id UUID NOT NULL REFERENCES stories(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_story_reactions_story_user UNIQUE(story_id, user_id)
);

CREATE INDEX IF NOT EXISTS ix_story_reactions_story
    ON story_reactions(story_id, created_at DESC);

CREATE INDEX IF NOT EXISTS ix_discovery_impressions_target_shown
    ON discovery_impressions(target_id, shown_at DESC);
