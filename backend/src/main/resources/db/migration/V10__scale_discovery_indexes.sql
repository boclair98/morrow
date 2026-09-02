-- Read-path indexes for the discovery and profile-photo hot paths.
-- These are additive and safe for existing installations (including the
-- baseline-at-9 production database).  They keep key lookups bounded as the
-- member and impression tables grow.

CREATE INDEX IF NOT EXISTS ix_users_discovery_cursor
    ON users(status, discoverable, profile_complete, last_seen_at DESC, id);

CREATE INDEX IF NOT EXISTS ix_discovery_impressions_viewer_target_shown
    ON discovery_impressions(viewer_id, target_id, shown_at DESC);

CREATE INDEX IF NOT EXISTS ix_profile_photos_owner_visibility_position
    ON profile_photos(owner_id, is_public, moderation_status, position, created_at);

CREATE INDEX IF NOT EXISTS ix_swipes_swiper_target_decision
    ON swipes(swiper_id, target_id, decision);
