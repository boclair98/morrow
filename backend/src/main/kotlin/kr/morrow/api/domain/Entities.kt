package kr.morrow.api.domain

import jakarta.persistence.Column
import jakarta.persistence.Entity
import jakarta.persistence.Id
import jakarta.persistence.Table
import jakarta.persistence.UniqueConstraint
import org.hibernate.annotations.CreationTimestamp
import org.hibernate.annotations.JdbcTypeCode
import org.hibernate.annotations.UpdateTimestamp
import org.hibernate.type.SqlTypes
import java.time.Instant
import java.util.UUID

@Entity
@Table(name = "users")
class UserEntity(
    @Id var id: UUID = UUID.randomUUID(),
    @Column(name = "coders_id", nullable = false, unique = true) var codersId: UUID = UUID.randomUUID(),
    @Column(name = "display_name", nullable = false, length = 64) var displayName: String = "",
    var age: Int? = null,
    var gender: String? = null,
    var seeking: String? = null,
    var area: String? = null,
    var job: String? = null,
    var bio: String? = null,
    @Column(name = "date_style") var dateStyle: String? = null,
    @JdbcTypeCode(SqlTypes.JSON)
    @Column(columnDefinition = "json", nullable = false)
    var interests: MutableList<String> = mutableListOf(),
    @JdbcTypeCode(SqlTypes.JSON)
    @Column(columnDefinition = "json", nullable = false)
    var availability: MutableList<String> = mutableListOf(),
    @Column(name = "min_preferred_age", nullable = false) var minPreferredAge: Int = 20,
    @Column(name = "max_preferred_age", nullable = false) var maxPreferredAge: Int = 39,
    @Column(name = "max_distance_km", nullable = false) var maxDistanceKm: Int = 30,
    @Column(name = "home_latitude") var homeLatitude: Double? = null,
    @Column(name = "home_longitude") var homeLongitude: Double? = null,
    @Column(name = "profile_complete", nullable = false) var profileComplete: Boolean = false,
    @Column(name = "account_verified", nullable = false) var accountVerified: Boolean = false,
    @Column(name = "verification_status", nullable = false) var verificationStatus: String = "unverified",
    @Column(name = "verified_at") var verifiedAt: Instant? = null,
    @Column(nullable = false) var status: String = "active",
    @Column(name = "suspended_until") var suspendedUntil: Instant? = null,
    @Column(name = "safety_strikes", nullable = false) var safetyStrikes: Int = 0,
    @Column(nullable = false) var discoverable: Boolean = true,
    @Column(name = "terms_version") var termsVersion: String? = null,
    @Column(name = "privacy_version") var privacyVersion: String? = null,
    @Column(name = "terms_agreed_at") var termsAgreedAt: Instant? = null,
    @Column(name = "privacy_agreed_at") var privacyAgreedAt: Instant? = null,
    @Column(name = "adult_confirmed_at") var adultConfirmedAt: Instant? = null,
    @Column(name = "marketing_opt_in", nullable = false) var marketingOptIn: Boolean = false,
    @Column(name = "marketing_opt_in_at") var marketingOptInAt: Instant? = null,
    @Column(name = "notify_matches", nullable = false) var notifyMatches: Boolean = true,
    @Column(name = "notify_messages", nullable = false) var notifyMessages: Boolean = true,
    @Column(name = "notify_dates", nullable = false) var notifyDates: Boolean = true,
    @CreationTimestamp @Column(name = "first_seen_at", updatable = false) var firstSeenAt: Instant = Instant.now(),
    @UpdateTimestamp @Column(name = "last_seen_at") var lastSeenAt: Instant = Instant.now(),
    @Column(name = "referral_code", nullable = false, unique = true, length = 12) var referralCode: String = "",
    @Column(name = "referred_by_user_id") var referredByUserId: UUID? = null,
    @Column(name = "trust_score", nullable = false) var trustScore: Int = 50,
    @Column(name = "date_feedback_count", nullable = false) var dateFeedbackCount: Int = 0,
    @Column(name = "no_show_count", nullable = false) var noShowCount: Int = 0,
)

@Entity
@Table(name = "profile_photos")
class ProfilePhotoEntity(
    @Id var id: UUID = UUID.randomUUID(),
    @Column(name = "owner_id", nullable = false) var ownerId: UUID = UUID.randomUUID(),
    @Column(name = "content_type", nullable = false) var contentType: String = "image/webp",
    @Column(columnDefinition = "bytea") var content: ByteArray? = null,
    @Column(name = "storage_key", unique = true) var storageKey: String? = null,
    @Column(name = "byte_size", nullable = false) var byteSize: Int = 0,
    @Column(nullable = false) var position: Int = 0,
    @Column(name = "is_public", nullable = false) var isPublic: Boolean = true,
    var sha256: String? = null,
    @Column(name = "moderation_status", nullable = false) var moderationStatus: String = "pending",
    @Column(name = "moderation_reason") var moderationReason: String? = null,
    @Column(name = "moderated_at") var moderatedAt: Instant? = null,
    @CreationTimestamp @Column(name = "created_at", updatable = false) var createdAt: Instant = Instant.now(),
)

@Entity
@Table(name = "swipes")
class SwipeEntity(
    @Id var id: UUID = UUID.randomUUID(),
    @Column(name = "swiper_id", nullable = false) var swiperId: UUID = UUID.randomUUID(),
    @Column(name = "target_id", nullable = false) var targetId: UUID = UUID.randomUUID(),
    @Column(nullable = false) var decision: String = "pass",
    @CreationTimestamp @Column(name = "created_at") var createdAt: Instant = Instant.now(),
)

@Entity
@Table(name = "matches")
class MatchEntity(
    @Id var id: UUID = UUID.randomUUID(),
    @Column(name = "user_a_id", nullable = false) var userAId: UUID = UUID.randomUUID(),
    @Column(name = "user_b_id", nullable = false) var userBId: UUID = UUID.randomUUID(),
    @Column(nullable = false) var status: String = "active",
    @CreationTimestamp @Column(name = "matched_at") var matchedAt: Instant = Instant.now(),
    @Column(name = "closed_at") var closedAt: Instant? = null,
    @Column(name = "closed_by_id") var closedById: UUID? = null,
    @Column(name = "closed_reason") var closedReason: String? = null,
)

@Entity
@Table(name = "messages")
class MessageEntity(
    @Id var id: UUID = UUID.randomUUID(),
    @Column(name = "match_id", nullable = false) var matchId: UUID = UUID.randomUUID(),
    @Column(name = "sender_id", nullable = false) var senderId: UUID = UUID.randomUUID(),
    @Column(name = "client_id") var clientId: UUID? = null,
    @Column(nullable = false, length = 500) var body: String = "",
    @Column(name = "attachment_content_type", length = 32) var attachmentContentType: String? = null,
    @Column(name = "attachment_content", columnDefinition = "bytea") var attachmentContent: ByteArray? = null,
    @Column(name = "attachment_storage_key", length = 300, unique = true) var attachmentStorageKey: String? = null,
    @Column(name = "attachment_byte_size") var attachmentByteSize: Int? = null,
    @Column(name = "read_at") var readAt: Instant? = null,
    @CreationTimestamp @Column(name = "created_at") var createdAt: Instant = Instant.now(),
)

@Entity
@Table(name = "date_plans")
class DatePlanEntity(
    @Id var id: UUID = UUID.randomUUID(),
    @Column(name = "match_id", nullable = false) var matchId: UUID = UUID.randomUUID(),
    @Column(name = "proposer_id", nullable = false) var proposerId: UUID = UUID.randomUUID(),
    @Column(nullable = false) var title: String = "",
    @Column(nullable = false) var area: String = "",
    @Column(name = "scheduled_for", nullable = false) var scheduledFor: Instant = Instant.now(),
    var note: String? = null,
    @Column(name = "place_id") var placeId: String? = null,
    @Column(name = "place_name") var placeName: String? = null,
    @Column(name = "place_url") var placeUrl: String? = null,
    @Column(name = "road_address") var roadAddress: String? = null,
    var longitude: Double? = null,
    var latitude: Double? = null,
    @Column(nullable = false) var status: String = "pending",
    @Column(name = "responded_by_id") var respondedById: UUID? = null,
    @Column(name = "responded_at") var respondedAt: Instant? = null,
    @Column(name = "proposer_safe_at") var proposerSafeAt: Instant? = null,
    @Column(name = "responder_safe_at") var responderSafeAt: Instant? = null,
    @CreationTimestamp @Column(name = "created_at") var createdAt: Instant = Instant.now(),
)

@Entity
@Table(name = "auth_identities")
class AuthIdentityEntity(
    @Id var id: UUID = UUID.randomUUID(),
    @Column(name = "user_id", nullable = false) var userId: UUID = UUID.randomUUID(),
    @Column(nullable = false) var provider: String = "",
    @Column(name = "provider_subject", nullable = false) var providerSubject: String = "",
    @Column(unique = true) var email: String? = null,
    @CreationTimestamp @Column(name = "created_at") var createdAt: Instant = Instant.now(),
    @Column(name = "last_login_at") var lastLoginAt: Instant = Instant.now(),
)

@Entity
@Table(name = "auth_sessions")
class AuthSessionEntity(
    @Id var id: UUID = UUID.randomUUID(),
    @Column(name = "user_id", nullable = false) var userId: UUID = UUID.randomUUID(),
    @Column(name = "token_hash", nullable = false, unique = true) var tokenHash: String = "",
    @Column(name = "expires_at", nullable = false) var expiresAt: Instant = Instant.now(),
    @Column(name = "last_used_at") var lastUsedAt: Instant = Instant.now(),
    @CreationTimestamp @Column(name = "created_at") var createdAt: Instant = Instant.now(),
)

@Entity
@Table(name = "oauth_flows")
class OAuthFlowEntity(
    @Id var id: UUID = UUID.randomUUID(),
    @Column(nullable = false) var provider: String = "",
    @Column(name = "state_hash", nullable = false, unique = true) var stateHash: String = "",
    @Column(name = "code_verifier") var codeVerifier: String? = null,
    var nonce: String? = null,
    @Column(name = "expires_at", nullable = false) var expiresAt: Instant = Instant.now(),
    @Column(name = "used_at") var usedAt: Instant? = null,
    @CreationTimestamp @Column(name = "created_at") var createdAt: Instant = Instant.now(),
)

@Entity
@Table(name = "blocks")
class BlockEntity(
    @Id var id: UUID = UUID.randomUUID(),
    @Column(name = "blocker_id", nullable = false) var blockerId: UUID = UUID.randomUUID(),
    @Column(name = "blocked_id", nullable = false) var blockedId: UUID = UUID.randomUUID(),
    @CreationTimestamp @Column(name = "created_at") var createdAt: Instant = Instant.now(),
)

@Entity
@Table(name = "reports")
class ReportEntity(
    @Id var id: UUID = UUID.randomUUID(),
    @Column(name = "reporter_id", nullable = false) var reporterId: UUID = UUID.randomUUID(),
    @Column(name = "reported_id", nullable = false) var reportedId: UUID = UUID.randomUUID(),
    @Column(nullable = false) var category: String = "other",
    var detail: String? = null,
    @Column(nullable = false) var status: String = "pending",
    @Column(nullable = false) var priority: String = "normal",
    var resolution: String? = null,
    @Column(name = "admin_note") var adminNote: String? = null,
    @Column(name = "resolved_at") var resolvedAt: Instant? = null,
    @CreationTimestamp @Column(name = "created_at") var createdAt: Instant = Instant.now(),
)

@Entity
@Table(name = "notifications")
class NotificationEntity(
    @Id var id: UUID = UUID.randomUUID(),
    @Column(name = "user_id", nullable = false) var userId: UUID = UUID.randomUUID(),
    @Column(nullable = false) var kind: String = "system",
    @Column(nullable = false) var title: String = "",
    @Column(nullable = false) var body: String = "",
    @Column(name = "action_type") var actionType: String? = null,
    @Column(name = "action_id") var actionId: UUID? = null,
    @Column(name = "dedupe_key") var dedupeKey: String? = null,
    @Column(name = "read_at") var readAt: Instant? = null,
    @CreationTimestamp @Column(name = "created_at") var createdAt: Instant = Instant.now(),
)

@Entity
@Table(name = "verification_requests")
class VerificationRequestEntity(
    @Id var id: UUID = UUID.randomUUID(),
    @Column(name = "user_id", nullable = false) var userId: UUID = UUID.randomUUID(),
    @Column(nullable = false) var method: String = "manual",
    @Column(name = "provider_transaction_id", unique = true) var providerTransactionId: String? = null,
    @Column(nullable = false) var status: String = "pending",
    var note: String? = null,
    @Column(name = "reviewer_coders_id") var reviewerCodersId: UUID? = null,
    @CreationTimestamp @Column(name = "requested_at") var requestedAt: Instant = Instant.now(),
    @Column(name = "reviewed_at") var reviewedAt: Instant? = null,
)

@Entity
@Table(name = "discovery_impressions")
class DiscoveryImpressionEntity(
    @Id var id: UUID = UUID.randomUUID(),
    @Column(name = "viewer_id", nullable = false) var viewerId: UUID = UUID.randomUUID(),
    @Column(name = "target_id", nullable = false) var targetId: UUID = UUID.randomUUID(),
    @CreationTimestamp @Column(name = "shown_at") var shownAt: Instant = Instant.now(),
)

@Entity
@Table(
    name = "saved_profiles",
    uniqueConstraints = [
        UniqueConstraint(
            name = "uq_saved_profiles_user_target",
            columnNames = ["user_id", "target_user_id"],
        ),
    ],
)
class SavedProfileEntity(
    @Id var id: UUID = UUID.randomUUID(),
    @Column(name = "user_id", nullable = false) var userId: UUID = UUID.randomUUID(),
    @Column(name = "target_user_id", nullable = false) var targetUserId: UUID = UUID.randomUUID(),
    @CreationTimestamp @Column(name = "created_at", updatable = false) var createdAt: Instant = Instant.now(),
)

@Entity
@Table(name = "date_feedback")
class DateFeedbackEntity(
    @Id var id: UUID = UUID.randomUUID(),
    @Column(name = "plan_id", nullable = false) var planId: UUID = UUID.randomUUID(),
    @Column(name = "reviewer_id", nullable = false) var reviewerId: UUID = UUID.randomUUID(),
    @Column(name = "reviewed_user_id", nullable = false) var reviewedUserId: UUID = UUID.randomUUID(),
    @Column(nullable = false) var attended: Boolean = true,
    @Column(name = "felt_safe", nullable = false) var feltSafe: Boolean = true,
    @Column(name = "would_meet_again", nullable = false) var wouldMeetAgain: Boolean = true,
    var note: String? = null,
    @CreationTimestamp @Column(name = "created_at") var createdAt: Instant = Instant.now(),
)

@Entity
@Table(name = "match_syncs")
class MatchSyncEntity(
    @Id var id: UUID = UUID.randomUUID(),
    @Column(name = "match_id", nullable = false, unique = true) var matchId: UUID = UUID.randomUUID(),
    @JdbcTypeCode(SqlTypes.JSON)
    @Column(columnDefinition = "json", nullable = false)
    var prompts: MutableList<MutableMap<String, Any?>> = mutableListOf(),
    @Column(name = "current_round", nullable = false) var currentRound: Int = 0,
    @Column(nullable = false) var status: String = "active",
    @CreationTimestamp @Column(name = "started_at") var startedAt: Instant = Instant.now(),
    @Column(name = "completed_at") var completedAt: Instant? = null,
)

@Entity
@Table(name = "match_sync_answers")
class MatchSyncAnswerEntity(
    @Id var id: UUID = UUID.randomUUID(),
    @Column(name = "sync_id", nullable = false) var syncId: UUID = UUID.randomUUID(),
    @Column(name = "round_index", nullable = false) var roundIndex: Int = 0,
    @Column(name = "user_id", nullable = false) var userId: UUID = UUID.randomUUID(),
    @Column(nullable = false) var answer: String = "",
    @CreationTimestamp @Column(name = "created_at") var createdAt: Instant = Instant.now(),
)

@Entity
@Table(name = "moderation_actions")
class ModerationActionEntity(
    @Id var id: UUID = UUID.randomUUID(),
    @Column(name = "admin_coders_id", nullable = false) var adminCodersId: UUID = UUID.randomUUID(),
    @Column(name = "subject_user_id") var subjectUserId: UUID? = null,
    @Column(name = "report_id") var reportId: UUID? = null,
    @Column(name = "photo_id") var photoId: UUID? = null,
    @Column(nullable = false) var action: String = "",
    var note: String? = null,
    @CreationTimestamp @Column(name = "created_at") var createdAt: Instant = Instant.now(),
)

@Entity
@Table(name = "stories")
class StoryEntity(
    @Id var id: UUID = UUID.randomUUID(),
    @Column(name = "author_id", nullable = false) var authorId: UUID = UUID.randomUUID(),
    @Column(nullable = false, length = 240) var body: String = "",
    @Column(name = "photo_content_type", length = 32) var photoContentType: String? = null,
    @Column(name = "photo_content", columnDefinition = "bytea") var photoContent: ByteArray? = null,
    @Column(name = "photo_storage_key", length = 300, unique = true) var photoStorageKey: String? = null,
    @Column(name = "photo_byte_size") var photoByteSize: Int? = null,
    @Column(name = "expires_at", nullable = false) var expiresAt: Instant = Instant.now(),
    @CreationTimestamp @Column(name = "created_at", updatable = false) var createdAt: Instant = Instant.now(),
)

@Entity
@Table(name = "story_reactions")
class StoryReactionEntity(
    @Id var id: UUID = UUID.randomUUID(),
    @Column(name = "story_id", nullable = false) var storyId: UUID = UUID.randomUUID(),
    @Column(name = "user_id", nullable = false) var userId: UUID = UUID.randomUUID(),
    @CreationTimestamp @Column(name = "created_at", updatable = false) var createdAt: Instant = Instant.now(),
)

@Entity
@Table(
    name = "push_subscriptions",
    uniqueConstraints = [UniqueConstraint(name = "uq_push_subscriptions_endpoint", columnNames = ["endpoint"])],
)
class PushSubscriptionEntity(
    @Id var id: UUID = UUID.randomUUID(),
    @Column(name = "user_id", nullable = false) var userId: UUID = UUID.randomUUID(),
    @Column(nullable = false, length = 2048) var endpoint: String = "",
    @Column(nullable = false, length = 512) var p256dh: String = "",
    @Column(nullable = false, length = 256) var auth: String = "",
    @CreationTimestamp @Column(name = "created_at", updatable = false) var createdAt: Instant = Instant.now(),
    @UpdateTimestamp @Column(name = "last_used_at") var lastUsedAt: Instant = Instant.now(),
)

