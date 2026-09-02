package kr.morrow.api.service

import kr.morrow.api.domain.MatchEntity
import kr.morrow.api.domain.MatchSyncAnswerEntity
import kr.morrow.api.domain.MatchSyncEntity
import kr.morrow.api.domain.UserEntity
import kr.morrow.api.repository.MatchSyncAnswerRepository
import kr.morrow.api.repository.MatchSyncRepository
import kr.morrow.api.repository.UserRepository
import kr.morrow.api.web.SyncAnswerRequest
import org.springframework.dao.DataIntegrityViolationException
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional
import java.time.Instant
import java.util.UUID

@Service
class MatchSyncService(
    private val syncs: MatchSyncRepository,
    private val answers: MatchSyncAnswerRepository,
    private val users: UserRepository,
    private val dating: DatingService,
    private val userService: UserService,
    private val notifications: NotificationService,
    private val realtime: RealtimeHub,
) {
    @Transactional(readOnly = true)
    fun get(userId: UUID, matchId: UUID): Map<String, Any?> {
        val viewer = users.findById(userId).orElseThrow { ApiException(401, "로그인이 필요해요") }
        val match = dating.ownedMatch(matchId, viewer.id)
        val sync = syncs.findByMatchId(match.id) ?: return mapOf("started" to false, "session" to null)
        return mapOf("started" to true, "session" to payload(sync, match, viewer))
    }

    @Transactional
    fun start(userId: UUID, matchId: UUID): Map<String, Any?> {
        val viewer = userService.current(userId)
        val match = dating.ownedMatch(matchId, viewer.id)
        if (match.status != "active") throw ApiException(409, "종료된 대화예요")
        var sync = syncs.findByMatchId(match.id)
        if (sync == null) {
            val first = users.findById(match.userAId).orElseThrow { ApiException(404, "매칭 사용자를 찾지 못했어요") }
            val second = users.findById(match.userBId).orElseThrow { ApiException(404, "매칭 사용자를 찾지 못했어요") }
            try {
                sync = syncs.saveAndFlush(MatchSyncEntity(matchId = match.id, prompts = buildPrompts(first, second)))
            } catch (_: DataIntegrityViolationException) {
                sync = syncs.findByMatchId(match.id)
            }
        }
        return mapOf("started" to true, "session" to payload(sync ?: throw ApiException(500, "Sync를 시작하지 못했어요"), match, viewer))
    }

    @Transactional
    fun answer(userId: UUID, matchId: UUID, request: SyncAnswerRequest): Map<String, Any?> {
        val viewer = userService.current(userId)
        val match = dating.ownedMatch(matchId, viewer.id)
        if (match.status != "active") throw ApiException(409, "종료된 대화예요")
        val sync = syncs.findByMatchIdForUpdate(match.id) ?: throw ApiException(404, "Sync를 먼저 시작해주세요")
        if (sync.status != "active") throw ApiException(409, "이미 완료된 Sync예요")
        if (request.round != sync.currentRound) throw ApiException(409, "이미 지나간 Sync 라운드예요")
        if (request.answer.any { it in "<>\\{}" }) throw ApiException(422, "입력할 수 없는 문자가 포함되어 있어요")
        if (answers.findBySyncIdAndRoundIndexAndUserId(sync.id, request.round, viewer.id) != null) throw ApiException(409, "이미 이 라운드에 답변했어요")
        answers.saveAndFlush(MatchSyncAnswerEntity(syncId = sync.id, roundIndex = request.round, userId = viewer.id, answer = cleanText(request.answer, 180)))
        val count = answers.countBySyncIdAndRoundIndex(sync.id, request.round)
        val recipientId = if (match.userAId == viewer.id) match.userBId else match.userAId
        if (count >= 2) {
            sync.currentRound += 1
            if (sync.currentRound == 3) { sync.status = "completed"; sync.completedAt = Instant.now() }
            val title = if (sync.status == "completed") "Sync 카드가 완성됐어요" else "Sync ${request.round + 1}라운드가 공개됐어요"
            val body = if (sync.status == "completed") "서로의 답변이 모두 공개됐어요. 이제 대화를 이어가 보세요." else "서로의 답변을 확인하고 다음 질문에 답해보세요."
            listOf(viewer.id, recipientId).forEach { target -> notifications.create(target, "sync", title, body, "match", match.id, "sync-round:${sync.id}:${request.round}:$target") }
        } else {
            notifications.create(recipientId, "sync", "새로운 Sync 답변을 기다리고 있어요", "${viewer.displayName}님이 ${request.round + 1}라운드에 답했어요. 답하면 동시에 공개돼요.", "match", match.id, "sync-waiting:${sync.id}:${request.round}:${viewer.id}")
        }
        realtime.publishMatch(match.id, mapOf("type" to "match_sync_updated", "match_id" to match.id.toString(), "round" to request.round, "status" to sync.status, "current_round" to sync.currentRound))
        return mapOf("started" to true, "session" to payload(sync, match, viewer))
    }

    private fun payload(sync: MatchSyncEntity, match: MatchEntity, viewer: UserEntity): Map<String, Any?> {
        val rows = answers.findBySyncIdOrderByRoundIndexAscCreatedAtAsc(sync.id)
        val grouped = rows.groupBy { it.roundIndex }
        val revealed = (0..2).mapNotNull { round ->
            val roundAnswers = grouped[round].orEmpty()
            if (roundAnswers.size < 2) null else mapOf(
                "round" to round,
                "prompt" to promptText(sync, round),
                "answers" to roundAnswers.sortedByDescending { it.userId == viewer.id }.map { mapOf("mine" to (it.userId == viewer.id), "answer" to it.answer) },
            )
        }
        val currentAnswers = grouped[sync.currentRound].orEmpty()
        val myAnswer = currentAnswers.firstOrNull { it.userId == viewer.id }?.answer
        val summary = if (sync.status == "completed") {
            val first = users.findById(match.userAId).orElseThrow()
            val second = users.findById(match.userBId).orElseThrow()
            summary(first, second)
        } else null
        return linkedMapOf(
            "id" to sync.id.toString(), "status" to sync.status, "current_round" to sync.currentRound,
            "total_rounds" to 3, "prompts" to (0..2).map { mapOf("round" to it, "text" to promptText(sync, it)) },
            "revealed_rounds" to revealed, "my_answer" to myAnswer, "current_round_answers" to currentAnswers.size,
            "waiting_for_partner" to (myAnswer != null && currentAnswers.size < 2),
            "can_answer" to (sync.status == "active" && sync.currentRound < 3 && myAnswer == null),
            "summary" to summary, "started_at" to sync.startedAt, "completed_at" to sync.completedAt,
        )
    }

    private fun buildPrompts(first: UserEntity, second: UserEntity): MutableList<MutableMap<String, Any?>> {
        val commonInterests = first.interests.filter { it in second.interests }.take(3)
        val commonTimes = first.availability.filter { it in second.availability }.take(3)
        val prompts = listOf(
            commonInterests.firstOrNull()?.let { "${it}를 같이 즐긴다면 가장 먼저 해보고 싶은 건?" } ?: "요즘 하루 중 가장 기분 좋은 순간은 언제예요?",
            commonTimes.firstOrNull()?.let { "${it}에 만난다면 어떤 분위기가 가장 편할까요?" } ?: "첫 만남에서 편안함을 느끼는 작은 배려는 뭐예요?",
            "서로를 알게 되면 꼭 해보고 싶은 작은 약속은 뭐예요?",
        )
        return prompts.mapIndexed { index, text -> mutableMapOf<String, Any?>("round" to index, "text" to text) }.toMutableList()
    }

    private fun promptText(sync: MatchSyncEntity, round: Int): String = sync.prompts.firstOrNull { (it["round"] as? Number)?.toInt() == round }?.get("text")?.toString()
        ?: "서로를 알게 되면 꼭 해보고 싶은 작은 약속은 뭐예요?"

    private fun summary(first: UserEntity, second: UserEntity): Map<String, Any> {
        val commonInterests = first.interests.filter { it in second.interests }.take(3)
        val commonTimes = first.availability.filter { it in second.availability }.take(3)
        val idea = mapOf(
            "카페" to "카페에서 서로의 취향 플레이리스트를 나눠보기", "전시" to "전시 하나를 보고 마음에 남은 작품을 골라보기",
            "맛집" to "새로운 맛집에서 서로 먹어보고 싶은 메뉴를 고르기", "산책" to "산책하기 좋은 길을 천천히 걸으며 이야기하기",
            "영화" to "영화를 보고 가장 기억에 남은 장면 이야기하기", "음악" to "서로의 플레이리스트를 교환하고 라이브 공연 찾아보기",
        )[commonInterests.firstOrNull()] ?: "조용한 공간에서 서로 좋아하는 이야기를 천천히 나눠보기"
        val area = first.area ?: second.area
        return mapOf("common_interests" to commonInterests, "common_times" to commonTimes, "first_date_idea" to if (area != null) "$area 에서 $idea" else idea)
    }
}
