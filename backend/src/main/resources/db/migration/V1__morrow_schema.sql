CREATE TABLE users (
    id UUID PRIMARY KEY,
    coders_id UUID NOT NULL UNIQUE,
    display_name VARCHAR(64) NOT NULL,
    age SMALLINT,
    gender VARCHAR(16),
    seeking VARCHAR(16),
    area VARCHAR(32),
    job VARCHAR(48),
    bio VARCHAR(240),
    date_style VARCHAR(32),
    interests JSON NOT NULL DEFAULT '[]',
    availability JSON NOT NULL DEFAULT '[]',
    min_preferred_age SMALLINT NOT NULL DEFAULT 20,
    max_preferred_age SMALLINT NOT NULL DEFAULT 39,
    max_distance_km SMALLINT NOT NULL DEFAULT 30,
    home_latitude DOUBLE PRECISION,
    home_longitude DOUBLE PRECISION,
    profile_complete BOOLEAN NOT NULL DEFAULT FALSE,
    account_verified BOOLEAN NOT NULL DEFAULT FALSE,
    verification_status VARCHAR(16) NOT NULL DEFAULT 'unverified',
    verified_at TIMESTAMPTZ,
    status VARCHAR(16) NOT NULL DEFAULT 'active',
    suspended_until TIMESTAMPTZ,
    safety_strikes SMALLINT NOT NULL DEFAULT 0,
    discoverable BOOLEAN NOT NULL DEFAULT TRUE,
    terms_version VARCHAR(16),
    privacy_version VARCHAR(16),
    terms_agreed_at TIMESTAMPTZ,
    privacy_agreed_at TIMESTAMPTZ,
    adult_confirmed_at TIMESTAMPTZ,
    marketing_opt_in BOOLEAN NOT NULL DEFAULT FALSE,
    marketing_opt_in_at TIMESTAMPTZ,
    notify_matches BOOLEAN NOT NULL DEFAULT TRUE,
    notify_messages BOOLEAN NOT NULL DEFAULT TRUE,
    notify_dates BOOLEAN NOT NULL DEFAULT TRUE,
    first_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    last_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    referral_code VARCHAR(12) NOT NULL UNIQUE,
    referred_by_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    trust_score SMALLINT NOT NULL DEFAULT 50,
    date_feedback_count INTEGER NOT NULL DEFAULT 0,
    no_show_count INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT ck_users_preferred_age CHECK (min_preferred_age >= 20 AND max_preferred_age >= min_preferred_age)
);

CREATE INDEX ix_users_discovery_ready ON users(status, discoverable, profile_complete, last_seen_at DESC);
CREATE INDEX ix_users_area_profile ON users(area, profile_complete);

CREATE TABLE profile_photos (
    id UUID PRIMARY KEY,
    owner_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    content_type VARCHAR(32) NOT NULL,
    content BYTEA,
    storage_key VARCHAR(300) UNIQUE,
    byte_size INTEGER NOT NULL,
    position SMALLINT NOT NULL DEFAULT 0,
    is_public BOOLEAN NOT NULL DEFAULT TRUE,
    sha256 VARCHAR(64),
    moderation_status VARCHAR(16) NOT NULL DEFAULT 'pending',
    moderation_reason VARCHAR(240),
    moderated_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX ix_profile_photos_owner_position ON profile_photos(owner_id, position);
CREATE INDEX ix_profile_photos_moderation_status ON profile_photos(moderation_status);

CREATE TABLE swipes (
    id UUID PRIMARY KEY,
    swiper_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    target_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    decision VARCHAR(8) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_swipes_pair UNIQUE(swiper_id, target_id),
    CONSTRAINT ck_swipes_not_self CHECK(swiper_id <> target_id)
);
CREATE INDEX ix_swipes_reverse_lookup ON swipes(target_id, swiper_id, decision);

CREATE TABLE matches (
    id UUID PRIMARY KEY,
    user_a_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    user_b_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    status VARCHAR(12) NOT NULL DEFAULT 'active',
    matched_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    closed_at TIMESTAMPTZ,
    closed_by_id UUID REFERENCES users(id) ON DELETE SET NULL,
    closed_reason VARCHAR(32),
    CONSTRAINT uq_matches_pair UNIQUE(user_a_id, user_b_id),
    CONSTRAINT ck_matches_not_self CHECK(user_a_id <> user_b_id)
);
CREATE INDEX ix_matches_user_a_status ON matches(user_a_id, status, matched_at DESC);
CREATE INDEX ix_matches_user_b_status ON matches(user_b_id, status, matched_at DESC);

CREATE TABLE messages (
    id UUID PRIMARY KEY,
    match_id UUID NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
    sender_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    client_id UUID,
    body VARCHAR(500) NOT NULL,
    read_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_messages_sender_client UNIQUE(sender_id, client_id)
);
CREATE INDEX ix_messages_match_created ON messages(match_id, created_at);
CREATE INDEX ix_messages_match_unread ON messages(match_id, read_at, sender_id);

CREATE TABLE blocks (
    id UUID PRIMARY KEY,
    blocker_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    blocked_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_blocks_pair UNIQUE(blocker_id, blocked_id),
    CONSTRAINT ck_blocks_not_self CHECK(blocker_id <> blocked_id)
);

CREATE TABLE reports (
    id UUID PRIMARY KEY,
    reporter_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    reported_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    category VARCHAR(32) NOT NULL,
    detail VARCHAR(500),
    status VARCHAR(16) NOT NULL DEFAULT 'pending',
    priority VARCHAR(12) NOT NULL DEFAULT 'normal',
    resolution VARCHAR(32),
    admin_note VARCHAR(500),
    resolved_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX ix_reports_moderation_queue ON reports(status, priority, created_at);

CREATE TABLE date_plans (
    id UUID PRIMARY KEY,
    match_id UUID NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
    proposer_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title VARCHAR(80) NOT NULL,
    area VARCHAR(32) NOT NULL,
    scheduled_for TIMESTAMPTZ NOT NULL,
    note VARCHAR(240),
    place_id VARCHAR(32),
    place_name VARCHAR(100),
    place_url VARCHAR(500),
    road_address VARCHAR(160),
    longitude DOUBLE PRECISION,
    latitude DOUBLE PRECISION,
    status VARCHAR(12) NOT NULL DEFAULT 'pending',
    responded_by_id UUID REFERENCES users(id) ON DELETE SET NULL,
    responded_at TIMESTAMPTZ,
    proposer_safe_at TIMESTAMPTZ,
    responder_safe_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX ix_date_plans_match_status ON date_plans(match_id, status, scheduled_for);

CREATE TABLE auth_identities (
    id UUID PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    provider VARCHAR(16) NOT NULL,
    provider_subject VARCHAR(191) NOT NULL,
    email VARCHAR(320) UNIQUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    last_login_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_auth_identity UNIQUE(provider, provider_subject)
);

CREATE TABLE auth_sessions (
    id UUID PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash VARCHAR(64) NOT NULL UNIQUE,
    expires_at TIMESTAMPTZ NOT NULL,
    last_used_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX ix_auth_sessions_user_expiry ON auth_sessions(user_id, expires_at);

CREATE TABLE oauth_flows (
    id UUID PRIMARY KEY,
    provider VARCHAR(16) NOT NULL,
    state_hash VARCHAR(64) NOT NULL UNIQUE,
    code_verifier VARCHAR(128),
    nonce VARCHAR(128),
    expires_at TIMESTAMPTZ NOT NULL,
    used_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX ix_oauth_flows_expiry ON oauth_flows(expires_at);

CREATE TABLE notifications (
    id UUID PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    kind VARCHAR(24) NOT NULL,
    title VARCHAR(80) NOT NULL,
    body VARCHAR(240) NOT NULL,
    action_type VARCHAR(24),
    action_id UUID,
    dedupe_key VARCHAR(96),
    read_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_notifications_user_dedupe UNIQUE(user_id, dedupe_key)
);
CREATE INDEX ix_notifications_user_unread ON notifications(user_id, read_at, created_at);

CREATE TABLE verification_requests (
    id UUID PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    method VARCHAR(16) NOT NULL DEFAULT 'manual',
    provider_transaction_id VARCHAR(191) UNIQUE,
    status VARCHAR(16) NOT NULL DEFAULT 'pending',
    note VARCHAR(500),
    reviewer_coders_id UUID,
    requested_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    reviewed_at TIMESTAMPTZ
);
CREATE INDEX ix_verification_requests_queue ON verification_requests(status, requested_at);

CREATE TABLE discovery_impressions (
    id UUID PRIMARY KEY,
    viewer_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    target_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    shown_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX ix_discovery_impressions_viewer_shown ON discovery_impressions(viewer_id, shown_at);

CREATE TABLE date_feedback (
    id UUID PRIMARY KEY,
    plan_id UUID NOT NULL REFERENCES date_plans(id) ON DELETE CASCADE,
    reviewer_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    reviewed_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    attended BOOLEAN NOT NULL,
    felt_safe BOOLEAN NOT NULL,
    would_meet_again BOOLEAN NOT NULL,
    note VARCHAR(500),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_date_feedback_reviewer UNIQUE(plan_id, reviewer_id)
);

CREATE TABLE match_syncs (
    id UUID PRIMARY KEY,
    match_id UUID NOT NULL UNIQUE REFERENCES matches(id) ON DELETE CASCADE,
    prompts JSON NOT NULL,
    current_round SMALLINT NOT NULL DEFAULT 0,
    status VARCHAR(12) NOT NULL DEFAULT 'active',
    started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    completed_at TIMESTAMPTZ,
    CONSTRAINT ck_match_syncs_current_round CHECK(current_round BETWEEN 0 AND 3)
);

CREATE TABLE match_sync_answers (
    id UUID PRIMARY KEY,
    sync_id UUID NOT NULL REFERENCES match_syncs(id) ON DELETE CASCADE,
    round_index SMALLINT NOT NULL,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    answer VARCHAR(180) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_match_sync_answers_user_round UNIQUE(sync_id, round_index, user_id),
    CONSTRAINT ck_match_sync_answers_round CHECK(round_index BETWEEN 0 AND 2)
);

CREATE TABLE moderation_actions (
    id UUID PRIMARY KEY,
    admin_coders_id UUID NOT NULL,
    subject_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    report_id UUID REFERENCES reports(id) ON DELETE SET NULL,
    photo_id UUID REFERENCES profile_photos(id) ON DELETE SET NULL,
    action VARCHAR(32) NOT NULL,
    note VARCHAR(500),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX ix_moderation_actions_created ON moderation_actions(created_at DESC);
