package kr.morrow.api.service

import kr.morrow.api.config.LegalVersions
import kr.morrow.api.domain.*
import kr.morrow.api.repository.*
import kr.morrow.api.web.*
import org.springframework.dao.DataIntegrityViolationException
import org.springframework.data.domain.PageRequest
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional
import java.time.Duration
import java.time.Instant
import java.util.UUID
import kotlin.math.asin
import kotlin.math.cos
import kotlin.math.round
import kotlin.math.sin
import kotlin.math.sqrt

@Service
class DatingService(
    private val users: UserRepository,
    private val photos: ProfilePhotoRepository,
    private val swipes: SwipeRepository,
    private val matches: MatchRepository,
    private val messages: MessageRepository,
    private val plans: DatePlanRepository,
    private val feedback: DateFeedbackRepository,
    private val blocks: BlockRepository,
    private val reports: ReportRepository,
    private val impressions: DiscoveryImpressionRepository,
    private val userService: UserService,
    private val notifications: NotificationService,
    private val realtime: RealtimeHub,
) {
    @Transactional
    fun saveProfile(userId: UUID, request: ProfileRequest): Map<String, Any> {
        val user = userService.current(userId, requireLegal = false)
        if (!request.termsAgreed || !request.privacyAgreed || !request.adultConfirmed) {
            throw ApiException(422, "필수 동의와 만 20세 이상 확인이 필요해요")
        }
        applyProfile(user, request.details())
        val code = request.referralCode?.trim()?.uppercase()?.takeIf { it.isNotBlank() }
        if (code != null && user.referredByUserId == null) {
            val inviter = users.findByReferralCode(code) ?: throw ApiException(422, "초대 코드를 확인해주세요")
            if (inviter.id == user.id) throw ApiException(422, "내 초대 코드는 등록할 수 없어요")
            user.referredByUserId = inviter.id
            notifications.create(
                inviter.id, "growth", "친구가 MORROW에 합류했어요", "초대 링크를 통해 새로운 회원이 가입했어요.",
                "profile", user.id, "referral:${user.id}",
            )
        }
        val now = Instant.now()
        user.termsVersion = LegalVersions.TERMS
        user.privacyVersion = LegalVersions.PRIVACY
        user.termsAgreedAt = now
        user.privacyAgreedAt = now
        user.adultConfirmedAt = now
        user.marketingOptIn = request.marketingOptIn
        user.marketingOptInAt = now.takeIf { request.marketingOptIn }
        user.profileComplete = true
        return mapOf("status" to "ok", "profile_complete" to true)
    }

    @Transactional
    fun updateProfile(userId: UUID, request: ProfileDetailsRequest): Map<String, Any> {
        val user = userService.current(userId)
        if (!user.profileComplete) throw ApiException(409, "프로필을 먼저 완성해주세요")
        applyProfile(user, request)
        return mapOf("status" to "ok", "profile_complete" to true)
    }

    private fun applyProfile(user: UserEntity, request: ProfileDetailsRequest) {
        if (request.minPreferredAge > request.maxPreferredAge) throw ApiException(422, "선호 나이 범위를 확인해주세요")
        if (request.area !in DatingOptions.areaCenters) throw ApiException(422, "활동 지역을 확인해주세요")
        if (request.interests.distinct().size != request.interests.size || !DatingOptions.interests.containsAll(request.interests)) {
            throw ApiException(422, "관심사를 확인해주세요")
        }
        if (request.availability.distinct().size != request.availability.size || !DatingOptions.availability.containsAll(request.availability)) {
            throw ApiException(422, "가능 시간을 확인해주세요")
        }
        listOf(request.displayName, request.job, request.bio, request.dateStyle).forEach {
            if (it.any { char -> char in "<>\\{}" }) throw ApiException(422, "입력할 수 없는 문자가 포함되어 있어요")
        }
        user.displayName = cleanText(request.displayName, 20)
        user.age = request.age
        user.gender = request.gender
        user.seeking = request.seeking
        user.area = request.area
        user.job = cleanText(request.job, 48)
        user.bio = cleanText(request.bio, 240)
        user.dateStyle = cleanText(request.dateStyle, 32)
        user.interests = request.interests.toMutableList()
        user.availability = request.availability.toMutableList()
        user.minPreferredAge = request.minPreferredAge
        user.maxPreferredAge = request.maxPreferredAge
        user.maxDistanceKm = request.maxDistanceKm
        val center = DatingOptions.areaCenters[request.area]
        user.homeLatitude = center?.first
        user.homeLongitude = center?.second
    }

    @Transactional
    fun discover(
        userId: UUID,
        limit: Int,
        area: String?,
        minAge: Int?,
        maxAge: Int?,
        availability: String?,
        interest: String?,
        photoOnly: Boolean,
    ): Map<String, Any> {
        val viewer = userService.current(userId)
        if (!viewer.profileComplete || viewer.age == null || viewer.gender == null || viewer.seeking == null) {
            throw ApiException(409, "프로필을 먼저 완성해주세요")
        }
        val candidateLimit = maxOf(40, minOf(200, limit * 4))
        val candidates = users.findDiscoveryCandidates(
            viewer.id,
            LegalVersions.TERMS,
            LegalVersions.PRIVACY,
            viewer.minPreferredAge,
            viewer.maxPreferredAge,
            viewer.age!!,
            viewer.seeking!!,
            viewer.gender!!,
            Instant.now().minus(Duration.ofHours(6)),
            PageRequest.of(0, candidateLimit),
        ).filter { candidate ->
            (area == null || area !in DatingOptions.areaCenters || candidate.area == area) &&
                (minAge == null || (candidate.age ?: 0) >= minAge) &&
                (maxAge == null || (candidate.age ?: 100) <= maxAge) &&
                (availability == null || availability !in DatingOptions.availability || availability in candidate.availability) &&
                (interest == null || interest !in DatingOptions.interests || interest in candidate.interests)
        }
        val ids = candidates.map { it.id }
        val groupedPhotos = if (ids.isEmpty()) emptyMap() else photos
            .findByOwnerIdInAndIsPublicTrueAndModerationStatusOrderByPositionAscCreatedAtAsc(ids, "approved")
            .groupBy { it.ownerId }
        val exposure = if (ids.isEmpty()) emptyMap() else impressions
            .exposureCounts(ids, Instant.now().minus(Duration.ofDays(7)))
            .associate { row -> row[0] as UUID to (row[1] as Long).toInt() }
        val cards = candidates.mapNotNull { candidate ->
            val distance = distanceKm(viewer, candidate)
            if (distance != null && distance > viewer.maxDistanceKm) null
            else {
                val candidatePhotos = groupedPhotos[candidate.id].orEmpty()
                if (photoOnly && candidatePhotos.isEmpty()) null
                else userCard(candidate, viewer, candidatePhotos, distance, exposure[candidate.id] ?: 0)
            }
        }.sortedWith(
            compareByDescending<Map<String, Any?>> { (it["common_times"] as List<*>).isNotEmpty() }
                .thenByDescending { (it["common_times"] as List<*>).size }
                .thenByDescending { it["discovery_score"] as Int },
        )
        val visible = cards.take(limit)
        impressions.saveAll(visible.map { DiscoveryImpressionEntity(viewerId = viewer.id, targetId = UUID.fromString(it["id"] as String)) })
        return mapOf("items" to visible, "has_more" to (cards.size > limit))
    }

    @Transactional
    fun swipe(userId: UUID, request: SwipeRequest): Map<String, Any?> {
        val user = userService.current(userId)
        if (request.targetId == user.id) throw ApiException(400, "내 프로필에는 반응할 수 없어요")
        val target = users.findById(request.targetId).orElseThrow { ApiException(404, "프로필을 찾지 못했어요") }
        if (!target.profileComplete || target.status != "active" || !target.discoverable || !userService.legalComplete(target)) {
            throw ApiException(404, "프로필을 찾지 못했어요")
        }
        if (blocks.existsByBlockerIdAndBlockedId(user.id, target.id) || blocks.existsByBlockerIdAndBlockedId(target.id, user.id)) {
            throw ApiException(404, "프로필을 찾지 못했어요")
        }
        if (swipes.countBySwiperIdAndCreatedAtAfter(user.id, Instant.now().minus(Duration.ofDays(1))) >= 80) {
            throw ApiException(429, "오늘 확인할 수 있는 추천을 모두 봤어요")
        }
        val swipe = swipes.findBySwiperIdAndTargetId(user.id, target.id)
            ?: SwipeEntity(swiperId = user.id, targetId = target.id)
        swipe.decision = request.decision
        swipe.createdAt = Instant.now()
        swipes.save(swipe)
        if (request.decision != "like" || !swipes.existsBySwiperIdAndTargetIdAndDecision(target.id, user.id, "like")) {
            return mapOf("matched" to false)
        }
        val pair = listOf(user.id, target.id).sortedBy(UUID::toString)
        var match = matches.findPairForUpdate(pair[0], pair[1])
        var created = false
        if (match == null) {
            try {
                match = matches.saveAndFlush(MatchEntity(userAId = pair[0], userBId = pair[1]))
                created = true
            } catch (_: DataIntegrityViolationException) {
                match = matches.findPairForUpdate(pair[0], pair[1])
            }
        }
        val finalMatch = match ?: throw ApiException(409, "매칭을 생성하지 못했어요")
        if (finalMatch.status != "active") {
            finalMatch.status = "active"
            finalMatch.closedAt = null
            finalMatch.closedById = null
            finalMatch.closedReason = null
        }
        if (created) {
            notifications.create(target.id, "match", "새로운 인연이 연결됐어요", "${user.displayName}님과 서로 호감을 보냈어요.", "match", finalMatch.id, "match:${finalMatch.id}:${target.id}")
            notifications.create(user.id, "match", "새로운 인연이 연결됐어요", "${target.displayName}님과 서로 호감을 보냈어요.", "match", finalMatch.id, "match:${finalMatch.id}:${user.id}")
            realtime.publishInbox(target.id, mapOf("type" to "match_created", "match_id" to finalMatch.id.toString()))
        }
        return mapOf("matched" to true, "match_id" to finalMatch.id.toString(), "person" to target.displayName)
    }

    @Transactional(readOnly = true)
    fun matches(userId: UUID, limit: Int): Map<String, Any> {
        val user = users.findById(userId).orElseThrow { ApiException(401, "로그인이 필요해요") }
        val rows = matches.findActiveForUser(user.id, PageRequest.of(0, limit))
        val otherIds = rows.map { if (it.userAId == user.id) it.userBId else it.userAId }
        val people = users.findAllById(otherIds).associateBy { it.id }
        val photoGroups = if (otherIds.isEmpty()) emptyMap() else photos
            .findByOwnerIdInAndIsPublicTrueAndModerationStatusOrderByPositionAscCreatedAtAsc(otherIds, "approved")
            .groupBy { it.ownerId }
        val items = rows.mapNotNull { match ->
            val otherId = if (match.userAId == user.id) match.userBId else match.userAId
            val other = people[otherId] ?: return@mapNotNull null
            val last = messages.findFirstByMatchIdOrderByCreatedAtDesc(match.id)
            linkedMapOf(
                "id" to match.id.toString(), "person" to userCard(other, user, photoGroups[other.id].orEmpty()),
                "matched_at" to match.matchedAt, "last_message" to last?.body,
                "last_message_at" to last?.createdAt,
                "unread_count" to messages.countByMatchIdAndSenderIdNotAndReadAtIsNull(match.id, user.id),
                "last_active_at" to other.lastSeenAt,
            )
        }
        return mapOf("items" to items)
    }

    @Transactional
    fun messages(userId: UUID, matchId: UUID, limit: Int): Map<String, Any> {
        val user = userService.current(userId)
        ownedMatch(matchId, user.id)
        val rows = messages.findByMatchIdOrderByCreatedAtDesc(matchId, PageRequest.of(0, limit)).reversed()
        messages.markRead(matchId, user.id, Instant.now())
        return mapOf("items" to rows.map { messageItem(it, user.id) })
    }

    @Transactional
    fun sendMessage(userId: UUID, matchId: UUID, request: MessageRequest): Map<String, Any?> {
        val user = userService.current(userId)
        val match = ownedMatch(matchId, user.id)
        if (match.status != "active") throw ApiException(409, "종료된 대화예요")
        request.clientId?.let { existingId ->
            messages.findBySenderIdAndClientId(user.id, existingId)?.let { return messageItem(it, user.id) }
        }
        val message = messages.save(
            MessageEntity(
                matchId = match.id,
                senderId = user.id,
                clientId = request.clientId,
                body = cleanText(request.body, 500),
            ),
        )
        val recipientId = if (match.userAId == user.id) match.userBId else match.userAId
        val recipient = users.findById(recipientId).orElse(null)
        if (recipient?.notifyMessages == true) {
            notifications.create(recipientId, "message", "${user.displayName}님의 새 메시지", message.body.take(80), "match", match.id, "message:${message.id}")
        }
        realtime.publishMatch(match.id, mapOf("type" to "message", "match_id" to match.id.toString(), "item" to messageItem(message, UUID(0, 0))))
        realtime.publishInbox(recipientId, mapOf("type" to "message", "match_id" to match.id.toString()))
        return messageItem(message, user.id)
    }

    @Transactional
    fun markRead(userId: UUID, matchId: UUID): Map<String, Any> {
        val user = userService.current(userId)
        ownedMatch(matchId, user.id)
        val now = Instant.now()
        val count = messages.markRead(matchId, user.id, now)
        realtime.publishMatch(matchId, mapOf("type" to "read", "match_id" to matchId.toString(), "reader_id" to user.id.toString(), "read_at" to now, "count" to count))
        return mapOf("status" to "ok", "count" to count, "read_at" to now)
    }

    @Transactional(readOnly = true)
    fun listPlans(userId: UUID, matchId: UUID): Map<String, Any> {
        val user = users.findById(userId).orElseThrow { ApiException(401, "로그인이 필요해요") }
        ownedMatch(matchId, user.id)
        val items = plans.findByMatchIdOrderByScheduledForDescCreatedAtDesc(matchId, PageRequest.of(0, 12)).reversed()
            .map { planItem(it, user.id) }
        return mapOf("items" to items)
    }

    @Transactional
    fun createPlan(userId: UUID, matchId: UUID, request: DatePlanRequest): Map<String, Any?> {
        val user = userService.current(userId)
        val match = ownedMatch(matchId, user.id)
        if (match.status != "active") throw ApiException(409, "종료된 대화예요")
        if (request.area !in DatingOptions.areaCenters) throw ApiException(422, "활동 지역을 확인해주세요")
        if (request.scheduledFor <= Instant.now()) throw ApiException(422, "미래 시간을 선택해주세요")
        if (request.placeUrl != null && !request.placeUrl.startsWith("https://place.map.kakao.com/")) {
            throw ApiException(422, "카카오맵 장소 주소를 확인해주세요")
        }
        val plan = plans.save(
            DatePlanEntity(
                matchId = match.id, proposerId = user.id, title = cleanText(request.title, 80), area = request.area,
                scheduledFor = request.scheduledFor, note = cleanText(request.note, 240).ifBlank { null },
                placeId = request.placeId, placeName = request.placeName?.let { cleanText(it, 100) },
                placeUrl = request.placeUrl, roadAddress = request.roadAddress?.let { cleanText(it, 160) },
                longitude = request.longitude, latitude = request.latitude,
            ),
        )
        val recipientId = if (match.userAId == user.id) match.userBId else match.userAId
        val recipient = users.findById(recipientId).orElse(null)
        if (recipient?.notifyDates == true) {
            notifications.create(recipientId, "date", "새 약속 제안이 도착했어요", "${user.displayName}님이 ${request.area}에서 만날 시간을 제안했어요.", "match", match.id, "date-plan:${plan.id}")
        }
        return mapOf("item" to planItem(plan, user.id))
    }

    @Transactional
    fun respondPlan(userId: UUID, matchId: UUID, planId: UUID, request: DatePlanResponseRequest): Map<String, Any?> {
        val user = userService.current(userId)
        ownedMatch(matchId, user.id)
        val plan = plans.findById(planId).orElseThrow { ApiException(404, "약속을 찾지 못했어요") }
        if (plan.matchId != matchId) throw ApiException(404, "약속을 찾지 못했어요")
        if (plan.proposerId == user.id) throw ApiException(400, "내 제안에는 답변할 수 없어요")
        if (plan.status != "pending") throw ApiException(409, "이미 답변한 약속이에요")
        plan.status = request.status
        plan.respondedById = user.id
        plan.respondedAt = Instant.now()
        val proposer = users.findById(plan.proposerId).orElse(null)
        if (proposer?.notifyDates == true) {
            val text = if (request.status == "accepted") "수락했어요" else "이번에는 어렵다고 답했어요"
            notifications.create(proposer.id, "date", "약속 제안에 답변이 왔어요", "${user.displayName}님이 약속을 $text.", "match", matchId, "date-response:${plan.id}")
        }
        return mapOf("item" to planItem(plan, user.id))
    }

    @Transactional
    fun confirmSafe(userId: UUID, matchId: UUID, planId: UUID): Map<String, Any?> {
        val user = userService.current(userId)
        ownedMatch(matchId, user.id)
        val plan = plans.findById(planId).orElseThrow { ApiException(404, "약속을 찾지 못했어요") }
        if (plan.matchId != matchId || plan.status != "accepted") throw ApiException(409, "수락된 약속에서만 확인할 수 있어요")
        if (Instant.now().isBefore(plan.scheduledFor.minus(Duration.ofHours(4)))) throw ApiException(409, "약속 4시간 전부터 확인할 수 있어요")
        if (plan.proposerId == user.id) plan.proposerSafeAt = plan.proposerSafeAt ?: Instant.now()
        else plan.responderSafeAt = plan.responderSafeAt ?: Instant.now()
        return mapOf("item" to planItem(plan, user.id))
    }

    @Transactional
    fun feedback(userId: UUID, matchId: UUID, planId: UUID, request: DateFeedbackRequest): Map<String, Any> {
        val user = userService.current(userId)
        val match = ownedMatch(matchId, user.id)
        val plan = plans.findById(planId).orElseThrow { ApiException(404, "약속을 찾지 못했어요") }
        if (plan.matchId != match.id || plan.status != "accepted") throw ApiException(409, "수락된 약속에만 후기를 남길 수 있어요")
        if (plan.scheduledFor > Instant.now()) throw ApiException(409, "약속 시간이 지난 뒤 후기를 남길 수 있어요")
        if (feedback.existsByPlanIdAndReviewerId(plan.id, user.id)) throw ApiException(409, "이미 후기를 남겼어요")
        val reviewedId = if (match.userAId == user.id) match.userBId else match.userAId
        val reviewed = users.findById(reviewedId).orElseThrow { ApiException(404, "상대 계정을 찾지 못했어요") }
        feedback.save(DateFeedbackEntity(planId = plan.id, reviewerId = user.id, reviewedUserId = reviewed.id, attended = request.attended, feltSafe = request.feltSafe, wouldMeetAgain = request.wouldMeetAgain, note = cleanText(request.note, 500).ifBlank { null }))
        reviewed.dateFeedbackCount += 1
        val delta = if (!request.attended) -8 else if (request.feltSafe) 2 else -5
        if (!request.attended) reviewed.noShowCount += 1
        reviewed.trustScore = (reviewed.trustScore + delta).coerceIn(0, 100)
        return mapOf("status" to "saved", "safety_follow_up_recommended" to !request.feltSafe)
    }

    @Transactional
    fun close(userId: UUID, matchId: UUID, reason: String): Map<String, String> {
        val user = userService.current(userId)
        val match = ownedMatch(matchId, user.id)
        match.status = "closed"
        match.closedById = user.id
        match.closedReason = reason
        match.closedAt = Instant.now()
        realtime.publishMatch(match.id, mapOf("type" to "match_closed", "match_id" to match.id.toString(), "closed_by_id" to user.id.toString(), "reason" to reason))
        return mapOf("status" to "closed")
    }

    @Transactional
    fun block(userId: UUID, targetId: UUID): Map<String, String> {
        val user = userService.current(userId)
        if (targetId == user.id) throw ApiException(400, "내 계정은 차단할 수 없어요")
        if (!users.existsById(targetId)) throw ApiException(404, "프로필을 찾지 못했어요")
        if (!blocks.existsByBlockerIdAndBlockedId(user.id, targetId)) blocks.save(BlockEntity(blockerId = user.id, blockedId = targetId))
        matches.findAllForUser(user.id).filter { match ->
            match.status == "active" && setOf(match.userAId, match.userBId) == setOf(user.id, targetId)
        }.forEach { match ->
            match.status = "closed"; match.closedById = user.id; match.closedReason = "blocked"; match.closedAt = Instant.now()
            realtime.publishMatch(match.id, mapOf("type" to "match_closed", "match_id" to match.id.toString(), "closed_by_id" to user.id.toString(), "reason" to "blocked"))
        }
        return mapOf("status" to "blocked")
    }

    @Transactional
    fun report(userId: UUID, request: ReportRequest): Map<String, Any> {
        val user = userService.current(userId)
        if (request.userId == user.id) throw ApiException(400, "내 계정은 신고할 수 없어요")
        if (!users.existsById(request.userId)) throw ApiException(404, "프로필을 찾지 못했어요")
        val since = Instant.now().minus(Duration.ofHours(24))
        if (reports.countByReporterIdAndCreatedAtAfter(user.id, since) >= 10) throw ApiException(429, "신고 접수가 많아요. 잠시 후 다시 시도해주세요")
        if (reports.existsByReporterIdAndReportedIdAndCategoryAndCreatedAtAfter(user.id, request.userId, request.category, since)) {
            throw ApiException(409, "같은 내용의 신고가 이미 접수됐어요")
        }
        val report = reports.save(ReportEntity(reporterId = user.id, reportedId = request.userId, category = request.category, detail = cleanText(request.detail, 500).ifBlank { null }, priority = if (request.category in setOf("money_request", "harassment")) "urgent" else "normal"))
        notifications.create(user.id, "safety", "신고가 안전 운영팀에 접수됐어요", "처리 결과는 안전센터와 알림에서 확인할 수 있어요.", "safety", report.id, "report-received:${report.id}")
        if (request.block) block(user.id, request.userId)
        return mapOf("status" to "received", "blocked" to request.block)
    }

    fun ownedMatch(matchId: UUID, userId: UUID): MatchEntity {
        val match = matches.findById(matchId).orElseThrow { ApiException(404, "매칭을 찾지 못했어요") }
        if (userId != match.userAId && userId != match.userBId) throw ApiException(404, "매칭을 찾지 못했어요")
        return match
    }

    private fun messageItem(message: MessageEntity, viewerId: UUID): Map<String, Any?> = linkedMapOf(
        "id" to message.id.toString(), "client_id" to message.clientId?.toString(),
        "sender_id" to message.senderId.toString(), "body" to message.body,
        "mine" to (message.senderId == viewerId), "created_at" to message.createdAt, "read_at" to message.readAt,
    )

    private fun planItem(plan: DatePlanEntity, viewerId: UUID): Map<String, Any?> {
        val mine = plan.proposerId == viewerId
        return linkedMapOf(
            "id" to plan.id.toString(), "title" to plan.title, "area" to plan.area,
            "scheduled_for" to plan.scheduledFor, "note" to plan.note, "place_id" to plan.placeId,
            "place_name" to plan.placeName, "place_url" to plan.placeUrl, "road_address" to plan.roadAddress,
            "longitude" to plan.longitude, "latitude" to plan.latitude, "status" to plan.status, "mine" to mine,
            "my_safe_confirmed" to ((if (mine) plan.proposerSafeAt else plan.responderSafeAt) != null),
            "feedback_submitted" to feedback.existsByPlanIdAndReviewerId(plan.id, viewerId), "created_at" to plan.createdAt,
        )
    }

    private fun userCard(
        user: UserEntity,
        viewer: UserEntity,
        profilePhotos: List<ProfilePhotoEntity>,
        distance: Double? = distanceKm(viewer, user),
        recentExposure: Int = 0,
    ): Map<String, Any?> {
        val commonInterests = user.interests.intersect(viewer.interests.toSet()).sorted()
        val commonTimes = viewer.availability.filter { it in user.availability }
        val score = (68 + commonInterests.size * 5 + commonTimes.size * 7 + if (user.area == viewer.area) 5 else 0).coerceAtMost(98)
        val discoveryScore = (score + minOf(profilePhotos.size, 3) * 3 + if (user.accountVerified) 4 else 0 +
            ((user.trustScore - 50) / 5).coerceIn(-5, 5) - minOf(15, recentExposure / 3)).coerceIn(0, 100)
        val reasons = buildList {
            commonTimes.firstOrNull()?.let { add("$it 시간이 맞아요") }
            commonInterests.firstOrNull()?.let { add("$it 취향이 같아요") }
            if (user.area == viewer.area) add("같은 생활권이에요")
            else distance?.let { add("약 ${maxOf(1, round(it).toInt())}km 거리예요") }
        }.take(3)
        return linkedMapOf(
            "id" to user.id.toString(), "display_name" to user.displayName, "age" to user.age,
            "area" to user.area, "job" to user.job, "bio" to user.bio, "date_style" to user.dateStyle,
            "interests" to user.interests, "availability" to user.availability,
            "common_interests" to commonInterests, "common_times" to commonTimes,
            "compatibility" to score, "discovery_score" to discoveryScore,
            "distance_km" to distance?.let { round(it * 10) / 10 }, "match_reasons" to reasons,
            "photos" to profilePhotos.filter { it.isPublic }.map { mapOf("id" to it.id.toString(), "url" to "/api/photos/${it.id}", "content_type" to it.contentType, "position" to it.position) },
            "photo_count" to profilePhotos.count { it.isPublic },
            "photo_prompt" to if (profilePhotos.isNotEmpty()) "사진을 올린 프로필" else "사진 없이도 취향을 먼저 확인해요",
            "account_verified" to user.accountVerified,
        )
    }

    private fun distanceKm(first: UserEntity, second: UserEntity): Double? {
        val lat1 = first.homeLatitude ?: return null
        val lon1 = first.homeLongitude ?: return null
        val lat2 = second.homeLatitude ?: return null
        val lon2 = second.homeLongitude ?: return null
        val firstLat = Math.toRadians(lat1)
        val secondLat = Math.toRadians(lat2)
        val deltaLat = secondLat - firstLat
        val deltaLon = Math.toRadians(lon2 - lon1)
        val value = sin(deltaLat / 2).let { it * it } + cos(firstLat) * cos(secondLat) * sin(deltaLon / 2).let { it * it }
        return 6371.0 * 2 * asin(sqrt(value))
    }
}
