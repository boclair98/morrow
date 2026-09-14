package kr.morrow.api.service

import kr.morrow.api.config.LegalVersions
import kr.morrow.api.config.MorrowProperties
import kr.morrow.api.domain.UserEntity
import kr.morrow.api.domain.VerificationRequestEntity
import kr.morrow.api.repository.*
import kr.morrow.api.web.AccountSettingsRequest
import kr.morrow.api.web.ConsentRequest
import org.springframework.data.domain.PageRequest
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional
import java.time.Duration
import java.time.Instant
import java.util.UUID

@Service
class AccountService(
    private val users: UserRepository,
    private val photos: ProfilePhotoRepository,
    private val swipes: SwipeRepository,
    private val matches: MatchRepository,
    private val messages: MessageRepository,
    private val plans: DatePlanRepository,
    private val blocks: BlockRepository,
    private val reports: ReportRepository,
    private val verifications: VerificationRequestRepository,
    private val feedback: DateFeedbackRepository,
    private val identities: AuthIdentityRepository,
    private val userService: UserService,
    private val media: MediaStorage,
    private val notifications: NotificationService,
    private val properties: MorrowProperties,
) {
    fun settingsItem(user: UserEntity): Map<String, Any?> = linkedMapOf(
        "discoverable" to user.discoverable, "marketing_opt_in" to user.marketingOptIn,
        "notify_matches" to user.notifyMatches, "notify_messages" to user.notifyMessages,
        "notify_dates" to user.notifyDates, "min_preferred_age" to user.minPreferredAge,
        "max_preferred_age" to user.maxPreferredAge, "max_distance_km" to user.maxDistanceKm,
        "legal_complete" to userService.legalComplete(user), "terms_version" to user.termsVersion,
        "privacy_version" to user.privacyVersion, "current_terms_version" to LegalVersions.TERMS,
        "current_privacy_version" to LegalVersions.PRIVACY, "adult_confirmed" to (user.adultConfirmedAt != null),
        "status" to user.status, "suspended_until" to user.suspendedUntil,
    )

    @Transactional
    fun consents(userId: UUID, request: ConsentRequest): Map<String, Any?> {
        if (!request.termsAgreed || !request.privacyAgreed || !request.adultConfirmed) throw ApiException(422, "필수 동의와 만 20세 이상 확인이 필요해요")
        val user = userService.current(userId, requireLegal = false)
        val now = Instant.now()
        user.termsVersion = LegalVersions.TERMS; user.privacyVersion = LegalVersions.PRIVACY
        user.termsAgreedAt = now; user.privacyAgreedAt = now; user.adultConfirmedAt = now
        if (user.marketingOptIn != request.marketingOptIn) user.marketingOptInAt = now.takeIf { request.marketingOptIn }
        user.marketingOptIn = request.marketingOptIn
        return mapOf("status" to "ok", "settings" to settingsItem(user))
    }

    @Transactional(readOnly = true)
    fun settings(userId: UUID): Map<String, Any?> = settingsItem(users.findById(userId).orElseThrow { ApiException(401, "로그인이 필요해요") })

    @Transactional
    fun updateSettings(userId: UUID, request: AccountSettingsRequest): Map<String, Any?> {
        val user = userService.current(userId)
        val nextMin = request.minPreferredAge ?: user.minPreferredAge
        val nextMax = request.maxPreferredAge ?: user.maxPreferredAge
        if (nextMin > nextMax) throw ApiException(422, "선호 최소 나이는 최대 나이보다 높을 수 없어요")
        request.discoverable?.let { user.discoverable = it }
        request.marketingOptIn?.let { next ->
            if (user.marketingOptIn != next) user.marketingOptInAt = Instant.now().takeIf { next }
            user.marketingOptIn = next
        }
        request.notifyMatches?.let { user.notifyMatches = it }
        request.notifyMessages?.let { user.notifyMessages = it }
        request.notifyDates?.let { user.notifyDates = it }
        request.minPreferredAge?.let { user.minPreferredAge = it }
        request.maxPreferredAge?.let { user.maxPreferredAge = it }
        request.maxDistanceKm?.let { user.maxDistanceKm = it }
        return mapOf("status" to "ok", "settings" to settingsItem(user))
    }

    @Transactional(readOnly = true)
    fun reports(userId: UUID): Map<String, Any> = mapOf("items" to reports
        .findByReporterIdOrderByCreatedAtDesc(userId, PageRequest.of(0, 50)).map { report ->
            mapOf("id" to report.id.toString(), "category" to report.category, "status" to report.status,
                "resolution" to report.resolution, "created_at" to report.createdAt, "resolved_at" to report.resolvedAt)
        })

    @Transactional(readOnly = true)
    fun export(userId: UUID): Map<String, Any?> {
        val user = users.findById(userId).orElseThrow { ApiException(401, "로그인이 필요해요") }
        val matchRows = matches.findAllForUser(user.id)
        val matchIds = matchRows.map { it.id }
        val messageRows = if (matchIds.isEmpty()) emptyList() else messages.findByMatchIdInOrderByCreatedAtAsc(matchIds, PageRequest.of(0, 10_000))
        return linkedMapOf(
            "exported_at" to Instant.now(), "message_export_limit" to 10_000,
            "profile" to mapOf(
                "id" to user.id.toString(), "coders_id" to user.codersId.toString(), "display_name" to user.displayName,
                "age" to user.age, "gender" to user.gender, "seeking" to user.seeking, "area" to user.area,
                "job" to user.job, "bio" to user.bio, "date_style" to user.dateStyle,
                "interests" to user.interests, "availability" to user.availability,
                "min_preferred_age" to user.minPreferredAge, "max_preferred_age" to user.maxPreferredAge,
                "max_distance_km" to user.maxDistanceKm, "verification_status" to user.verificationStatus,
                "verified_at" to user.verifiedAt, "referral_code" to user.referralCode, "status" to user.status,
                "discoverable" to user.discoverable, "first_seen_at" to user.firstSeenAt,
            ),
            "consents" to settingsItem(user),
            "photos" to photos.findByOwnerIdOrderByPositionAscCreatedAtAsc(user.id).map { mapOf("id" to it.id.toString(), "content_type" to it.contentType, "byte_size" to it.byteSize, "position" to it.position, "moderation_status" to it.moderationStatus, "created_at" to it.createdAt) },
            "swipes" to swipes.findBySwiperId(user.id).map { mapOf("target_id" to it.targetId.toString(), "decision" to it.decision, "created_at" to it.createdAt) },
            "matches" to matchRows.map { match -> mapOf("id" to match.id.toString(), "other_user_id" to (if (match.userAId == user.id) match.userBId else match.userAId).toString(), "status" to match.status, "matched_at" to match.matchedAt, "closed_at" to match.closedAt, "closed_reason" to match.closedReason) },
            "messages" to messageRows.map { mapOf("id" to it.id.toString(), "match_id" to it.matchId.toString(), "sender_id" to it.senderId.toString(), "mine" to (it.senderId == user.id), "body" to it.body, "attachment_content_type" to it.attachmentContentType, "attachment_byte_size" to it.attachmentByteSize, "created_at" to it.createdAt, "read_at" to it.readAt) },
            "date_plans" to plans.findByProposerId(user.id).map { mapOf("id" to it.id.toString(), "match_id" to it.matchId.toString(), "title" to it.title, "area" to it.area, "scheduled_for" to it.scheduledFor, "status" to it.status) },
            "blocked_user_ids" to blocks.findByBlockerId(user.id).map { it.blockedId.toString() },
            "verification_requests" to listOfNotNull(verifications.findFirstByUserIdOrderByRequestedAtDesc(user.id)).map { mapOf("id" to it.id.toString(), "method" to it.method, "status" to it.status, "note" to it.note, "requested_at" to it.requestedAt, "reviewed_at" to it.reviewedAt) },
            "date_feedback" to feedback.findByReviewerId(user.id).map { mapOf("plan_id" to it.planId.toString(), "attended" to it.attended, "felt_safe" to it.feltSafe, "would_meet_again" to it.wouldMeetAgain, "note" to it.note, "created_at" to it.createdAt) },
            "reports" to reports.findByReporterIdOrderByCreatedAtDesc(user.id, PageRequest.of(0, 1000)).map { mapOf("id" to it.id.toString(), "category" to it.category, "status" to it.status, "resolution" to it.resolution, "created_at" to it.createdAt) },
        )
    }

    @Transactional
    fun delete(userId: UUID, confirmation: String): Map<String, String> {
        if (confirmation != "MORROW 탈퇴") throw ApiException(422, "탈퇴 확인 문구를 입력해주세요")
        val user = users.findById(userId).orElseThrow { ApiException(401, "로그인이 필요해요") }
        photos.findByOwnerIdOrderByPositionAscCreatedAtAsc(user.id).mapNotNull { it.storageKey }.forEach(media::delete)
        matches.findAllForUser(user.id)
            .map { it.id }
            .let { matchIds -> if (matchIds.isEmpty()) emptyList() else messages.findByMatchIdInOrderByCreatedAtAsc(matchIds, PageRequest.of(0, 10_000)) }
            .mapNotNull { it.attachmentStorageKey }
            .forEach(media::delete)
        users.delete(user)
        return mapOf("status" to "deleted")
    }

    @Transactional(readOnly = true)
    fun verification(userId: UUID): Map<String, Any?> {
        val user = users.findById(userId).orElseThrow { ApiException(401, "로그인이 필요해요") }
        return verificationItem(user, verifications.findFirstByUserIdOrderByRequestedAtDesc(user.id))
    }

    @Transactional
    fun requestVerification(userId: UUID, note: String): Map<String, Any?> {
        val user = userService.current(userId)
        if (user.accountVerified) return verificationItem(user, verifications.findFirstByUserIdOrderByRequestedAtDesc(user.id))
        if (!user.profileComplete) throw ApiException(409, "프로필을 먼저 완성해주세요")
        if (!identities.existsByUserId(user.id)) throw ApiException(409, "소셜 로그인 계정 확인이 필요해요")
        if (!photos.existsByOwnerIdAndIsPublicTrueAndModerationStatus(user.id, "approved")) throw ApiException(409, "운영팀이 승인한 얼굴 프로필 사진이 1장 이상 필요해요")
        verifications.findByUserIdAndStatus(user.id, "pending")?.let { return verificationItem(user, it) }
        val request = verifications.save(VerificationRequestEntity(userId = user.id, note = cleanText(note, 240).ifBlank { null }))
        user.verificationStatus = "pending"
        return verificationItem(user, request)
    }

    @Transactional(readOnly = true)
    fun referral(userId: UUID): Map<String, Any> {
        val user = users.findById(userId).orElseThrow { ApiException(401, "로그인이 필요해요") }
        return referralItem(user)
    }

    @Transactional
    fun redeem(userId: UUID, code: String): Map<String, Any> {
        val user = userService.current(userId)
        if (user.referredByUserId != null) throw ApiException(409, "이미 초대 코드를 등록했어요")
        if (user.firstSeenAt < Instant.now().minus(Duration.ofDays(14))) throw ApiException(409, "초대 코드는 가입 후 14일 안에 등록할 수 있어요")
        val inviter = users.findByReferralCode(code.trim().uppercase()) ?: throw ApiException(404, "초대 코드를 확인해주세요")
        if (inviter.id == user.id) throw ApiException(400, "내 초대 코드는 등록할 수 없어요")
        user.referredByUserId = inviter.id
        notifications.create(inviter.id, "growth", "친구가 MORROW에 합류했어요", "초대 링크를 통해 새로운 회원이 가입했어요.", "profile", user.id, "referral:${user.id}")
        return referralItem(user)
    }

    private fun referralItem(user: UserEntity): Map<String, Any> = mapOf(
        "code" to user.referralCode,
        "invite_url" to "${properties.publicAppUrl.trimEnd('/')}/login?ref=${user.referralCode}",
        "invited_count" to users.countByReferredByUserId(user.id),
        "redeemed" to (user.referredByUserId != null),
    )

    private fun verificationItem(user: UserEntity, request: VerificationRequestEntity?): Map<String, Any?> = mapOf(
        "verified" to user.accountVerified, "status" to user.verificationStatus, "verified_at" to user.verifiedAt,
        "request" to request?.let { mapOf("id" to it.id.toString(), "method" to it.method, "status" to it.status, "note" to it.note.takeIf { _ -> it.status == "rejected" }, "requested_at" to it.requestedAt, "reviewed_at" to it.reviewedAt) },
    )
}

