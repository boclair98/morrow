package kr.morrow.api.service

import kr.morrow.api.config.MorrowProperties
import kr.morrow.api.domain.ModerationActionEntity
import kr.morrow.api.repository.*
import kr.morrow.api.web.ModeratePhotoRequest
import kr.morrow.api.web.ResolveReportRequest
import kr.morrow.api.web.ReviewVerificationRequest
import org.springframework.data.domain.PageRequest
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional
import java.time.Duration
import java.time.Instant
import java.time.LocalDate
import java.time.ZoneId
import java.util.UUID

@Service
class AdminService(
    private val properties: MorrowProperties,
    private val users: UserRepository,
    private val reports: ReportRepository,
    private val photos: ProfilePhotoRepository,
    private val verifications: VerificationRequestRepository,
    private val matches: MatchRepository,
    private val messages: MessageRepository,
    private val stories: StoryRepository,
    private val identities: AuthIdentityRepository,
    private val actions: ModerationActionRepository,
    private val notifications: NotificationService,
) {
    private fun requireAdmin(codersId: UUID) {
        if (codersId !in properties.admins) throw ApiException(403, "운영자 권한이 필요해요")
    }

    @Transactional(readOnly = true)
    fun overview(codersId: UUID): Map<String, Long> {
        requireAdmin(codersId)
        val today = LocalDate.now(ZoneId.of("Asia/Seoul")).atStartOfDay(ZoneId.of("Asia/Seoul")).toInstant()
        return mapOf(
            "users" to users.count(), "pending_reports" to reports.countByStatus("pending"),
            "pending_photos" to photos.countByModerationStatus("pending"),
            "pending_verifications" to verifications.countByStatus("pending"),
            "restricted_users" to users.countByStatusIn(listOf("suspended", "banned")),
            "active_today" to users.countByLastSeenAtAfter(today),
            "new_today" to users.countByFirstSeenAtAfter(today),
            "matches_today" to matches.countByMatchedAtAfter(today),
            "messages_today" to messages.countByCreatedAtAfter(today),
            "stories_today" to stories.countByCreatedAtAfter(today),
        )
    }

    @Transactional(readOnly = true)
    fun reports(codersId: UUID): Map<String, Any> {
        requireAdmin(codersId)
        val items = reports.findByStatusOrderByCreatedAtAsc("pending", PageRequest.of(0, 100)).map { item ->
            val reporter = users.findById(item.reporterId).orElse(null)
            val reported = users.findById(item.reportedId).orElse(null)
            mapOf(
                "id" to item.id.toString(), "reporter_name" to (reporter?.displayName ?: "탈퇴 회원"),
                "reported_user_id" to item.reportedId.toString(), "reported_name" to (reported?.displayName ?: "탈퇴 회원"),
                "reported_status" to (reported?.status ?: "deleted"), "category" to item.category,
                "detail" to item.detail, "priority" to item.priority, "status" to item.status, "created_at" to item.createdAt,
            )
        }
        return mapOf("items" to items)
    }

    @Transactional
    fun resolve(codersId: UUID, reportId: UUID, request: ResolveReportRequest): Map<String, String> {
        requireAdmin(codersId)
        val report = reports.findById(reportId).orElseThrow { ApiException(404, "신고를 찾지 못했어요") }
        if (report.status != "pending") throw ApiException(409, "이미 처리된 신고예요")
        val target = users.findById(report.reportedId).orElse(null)
        report.status = if (request.resolution == "dismiss") "dismissed" else "resolved"
        report.resolution = request.resolution
        report.adminNote = cleanText(request.note, 500).ifBlank { null }
        report.resolvedAt = Instant.now()
        when (request.resolution) {
            "warn" -> target?.let { it.safetyStrikes += 1 }
            "suspend_7d" -> target?.let { it.status = "suspended"; it.suspendedUntil = Instant.now().plus(Duration.ofDays(7)); it.discoverable = false }
            "ban" -> target?.let { it.status = "banned"; it.discoverable = false }
        }
        actions.save(ModerationActionEntity(adminCodersId = codersId, subjectUserId = target?.id, reportId = report.id, action = request.resolution, note = report.adminNote))
        target?.let { notifications.create(it.id, "safety", "안전 운영팀의 신고 처리 결과가 있어요", "안전센터에서 계정 상태를 확인해주세요.", "safety", report.id, "report-result:${report.id}") }
        return mapOf("status" to "ok", "resolution" to request.resolution)
    }

    @Transactional(readOnly = true)
    fun photos(codersId: UUID): Map<String, Any> {
        requireAdmin(codersId)
        return mapOf("items" to photos.findByModerationStatusOrderByCreatedAtAsc("pending", PageRequest.of(0, 100)).map { photo ->
            val owner = users.findById(photo.ownerId).orElse(null)
            mapOf("id" to photo.id.toString(), "owner_id" to photo.ownerId.toString(), "owner_name" to (owner?.displayName ?: "탈퇴 회원"), "url" to "/api/photos/${photo.id}", "byte_size" to photo.byteSize, "status" to photo.moderationStatus, "created_at" to photo.createdAt)
        })
    }

    @Transactional
    fun moderate(codersId: UUID, photoId: UUID, request: ModeratePhotoRequest): Map<String, String> {
        requireAdmin(codersId)
        val photo = photos.findById(photoId).orElseThrow { ApiException(404, "사진을 찾지 못했어요") }
        photo.moderationStatus = request.decision
        photo.moderationReason = cleanText(request.reason, 240).ifBlank { null }
        photo.moderatedAt = Instant.now()
        actions.save(ModerationActionEntity(adminCodersId = codersId, subjectUserId = photo.ownerId, photoId = photo.id, action = "photo_${request.decision}", note = photo.moderationReason))
        val title = if (request.decision == "approved") "프로필 사진이 승인됐어요" else "프로필 사진을 다시 확인해주세요"
        notifications.create(photo.ownerId, "safety", title, photo.moderationReason ?: if (request.decision == "approved") "이제 추천 프로필에 사진이 노출될 수 있어요." else "다른 사진으로 다시 등록해주세요.", "profile", photo.id, "photo-review:${photo.id}:${request.decision}")
        return mapOf("status" to "ok")
    }

    @Transactional(readOnly = true)
    fun verifications(codersId: UUID): Map<String, Any> {
        requireAdmin(codersId)
        return mapOf("items" to verifications.findByStatusOrderByRequestedAtAsc("pending", PageRequest.of(0, 100)).map { request ->
            val user = users.findById(request.userId).orElse(null)
            val photo = photos.findByOwnerIdOrderByPositionAscCreatedAtAsc(request.userId).firstOrNull { it.moderationStatus == "approved" }
            mapOf(
                "id" to request.id.toString(), "user_id" to request.userId.toString(), "display_name" to (user?.displayName ?: "탈퇴 회원"),
                "age" to user?.age, "area" to user?.area, "method" to request.method, "status" to request.status,
                "note" to request.note, "photo_url" to photo?.let { "/api/photos/${it.id}" },
                "social_providers" to identities.findByUserId(request.userId).map { it.provider }.distinct(), "requested_at" to request.requestedAt,
            )
        })
    }

    @Transactional
    fun review(codersId: UUID, requestId: UUID, body: ReviewVerificationRequest): Map<String, Any> {
        requireAdmin(codersId)
        val request = verifications.findById(requestId).orElseThrow { ApiException(404, "인증 요청을 찾지 못했어요") }
        if (request.status != "pending") throw ApiException(409, "이미 처리된 인증 요청이에요")
        val user = users.findById(request.userId).orElseThrow { ApiException(404, "회원을 찾지 못했어요") }
        request.status = body.decision
        request.note = cleanText(body.note, 500).ifBlank { null }
        request.reviewerCodersId = codersId
        request.reviewedAt = Instant.now()
        user.accountVerified = body.decision == "approved"
        user.verificationStatus = if (body.decision == "approved") "verified" else "rejected"
        user.verifiedAt = Instant.now().takeIf { user.accountVerified }
        actions.save(ModerationActionEntity(adminCodersId = codersId, subjectUserId = user.id, action = "verification_${body.decision}", note = request.note))
        notifications.create(user.id, "safety", if (user.accountVerified) "본인 확인이 완료됐어요" else "본인 확인 요청을 다시 확인해주세요", request.note ?: if (user.accountVerified) "프로필에 인증 배지가 표시돼요." else "안전센터에서 사유를 확인해주세요.", "verification", request.id, "verification-review:${request.id}")
        return mapOf("status" to "ok", "verified" to user.accountVerified)
    }
}
