package kr.morrow.api.repository

import jakarta.persistence.LockModeType
import kr.morrow.api.domain.*
import org.springframework.data.domain.Pageable
import org.springframework.data.jpa.repository.JpaRepository
import org.springframework.data.jpa.repository.Lock
import org.springframework.data.jpa.repository.Modifying
import org.springframework.data.jpa.repository.Query
import org.springframework.data.repository.query.Param
import java.time.Instant
import java.util.UUID

interface UserRepository : JpaRepository<UserEntity, UUID> {
    fun findByCodersId(codersId: UUID): UserEntity?
    fun findByReferralCode(referralCode: String): UserEntity?
    fun countByReferredByUserId(userId: UUID): Long
    fun countByStatusIn(statuses: Collection<String>): Long
    fun countByLastSeenAtAfter(after: Instant): Long
    fun countByFirstSeenAtAfter(after: Instant): Long

    @Query(
        """
        select u from UserEntity u
        where u.id <> :viewerId
          and u.profileComplete = true
          and u.status = 'active'
          and u.discoverable = true
          and u.termsVersion = :termsVersion
          and u.privacyVersion = :privacyVersion
          and u.adultConfirmedAt is not null
          and u.age between :minAge and :maxAge
          and u.minPreferredAge <= :viewerAge
          and u.maxPreferredAge >= :viewerAge
          and (:seeking = 'all' or u.gender = :seeking)
          and (u.seeking = 'all' or u.seeking = :viewerGender)
          and not exists (select b.id from BlockEntity b where
                (b.blockerId = :viewerId and b.blockedId = u.id)
             or (b.blockerId = u.id and b.blockedId = :viewerId))
        order by u.lastSeenAt desc
        """,
    )
    fun findStoryAuthors(
        @Param("viewerId") viewerId: UUID,
        @Param("termsVersion") termsVersion: String,
        @Param("privacyVersion") privacyVersion: String,
        @Param("minAge") minAge: Int,
        @Param("maxAge") maxAge: Int,
        @Param("viewerAge") viewerAge: Int,
        @Param("seeking") seeking: String,
        @Param("viewerGender") viewerGender: String,
        pageable: Pageable,
    ): List<UserEntity>

    @Query(
        """
        select u from UserEntity u
        where u.id <> :viewerId
          and u.profileComplete = true
          and u.status = 'active'
          and u.discoverable = true
          and u.termsVersion = :termsVersion
          and u.privacyVersion = :privacyVersion
          and u.adultConfirmedAt is not null
          and u.age between :minAge and :maxAge
          and u.minPreferredAge <= :viewerAge
          and u.maxPreferredAge >= :viewerAge
          and (:seeking = 'all' or u.gender = :seeking)
          and (u.seeking = 'all' or u.seeking = :viewerGender)
          and not exists (select b.id from BlockEntity b where
                (b.blockerId = :viewerId and b.blockedId = u.id)
             or (b.blockerId = u.id and b.blockedId = :viewerId))
          and not exists (select s.id from SwipeEntity s where s.swiperId = :viewerId and s.targetId = u.id)
          and not exists (select d.id from DiscoveryImpressionEntity d where
                d.viewerId = :viewerId and d.targetId = u.id and d.shownAt >= :recentAfter)
        order by u.lastSeenAt desc
        """,
    )
    fun findDiscoveryCandidates(
        @Param("viewerId") viewerId: UUID,
        @Param("termsVersion") termsVersion: String,
        @Param("privacyVersion") privacyVersion: String,
        @Param("minAge") minAge: Int,
        @Param("maxAge") maxAge: Int,
        @Param("viewerAge") viewerAge: Int,
        @Param("seeking") seeking: String,
        @Param("viewerGender") viewerGender: String,
        @Param("recentAfter") recentAfter: Instant,
        pageable: Pageable,
    ): List<UserEntity>
}

interface ProfilePhotoRepository : JpaRepository<ProfilePhotoEntity, UUID> {
    fun findByOwnerIdOrderByPositionAscCreatedAtAsc(ownerId: UUID): List<ProfilePhotoEntity>
    fun findByOwnerIdAndIsPublicTrueAndModerationStatusOrderByPositionAscCreatedAtAsc(
        ownerId: UUID,
        moderationStatus: String,
        pageable: Pageable,
    ): List<ProfilePhotoEntity>
    fun findByOwnerIdInAndIsPublicTrueAndModerationStatusOrderByPositionAscCreatedAtAsc(
        ownerIds: Collection<UUID>,
        moderationStatus: String,
    ): List<ProfilePhotoEntity>
    fun countByOwnerId(ownerId: UUID): Long
    fun existsByOwnerIdAndSha256(ownerId: UUID, sha256: String): Boolean
    fun existsByOwnerIdAndIsPublicTrueAndModerationStatus(ownerId: UUID, moderationStatus: String): Boolean
    fun findByModerationStatusOrderByCreatedAtAsc(moderationStatus: String, pageable: Pageable): List<ProfilePhotoEntity>
    fun countByModerationStatus(moderationStatus: String): Long
}

interface SwipeRepository : JpaRepository<SwipeEntity, UUID> {
    fun findBySwiperIdAndTargetId(swiperId: UUID, targetId: UUID): SwipeEntity?
    fun existsBySwiperIdAndTargetIdAndDecision(swiperId: UUID, targetId: UUID, decision: String): Boolean
    fun countBySwiperIdAndCreatedAtAfter(swiperId: UUID, createdAt: Instant): Long
    fun findBySwiperId(swiperId: UUID): List<SwipeEntity>
    fun findFirstBySwiperIdOrderByCreatedAtDesc(swiperId: UUID): SwipeEntity?

    @Modifying
    @Query("delete from SwipeEntity s where s.swiperId = :swiperId and s.targetId = :targetId")
    fun deleteBySwiperIdAndTargetId(@Param("swiperId") swiperId: UUID, @Param("targetId") targetId: UUID): Int

    /**
     * Returns current incoming likes that are still safe to show.  The
     * recipient must never see an account they have blocked (or that blocked
     * them), and an already-active match belongs in the matches inbox instead.
     * Keeping this filter in the query avoids loading an unbounded swipe
     * history into the application as the member base grows.
     */
    @Query(
        """
        select s from SwipeEntity s
        where s.targetId = :targetId
          and s.decision = 'like'
          and not exists (select b.id from BlockEntity b where
                (b.blockerId = :targetId and b.blockedId = s.swiperId)
             or (b.blockerId = s.swiperId and b.blockedId = :targetId))
          and not exists (select own.id from SwipeEntity own where
                own.swiperId = :targetId and own.targetId = s.swiperId)
          and not exists (select m.id from MatchEntity m where
                m.status = 'active'
            and ((m.userAId = :targetId and m.userBId = s.swiperId)
             or (m.userAId = s.swiperId and m.userBId = :targetId)))
        order by s.createdAt desc
        """,
    )
    fun findReceivedLikes(@Param("targetId") targetId: UUID, pageable: Pageable): List<SwipeEntity>
}

interface MatchRepository : JpaRepository<MatchEntity, UUID> {
    fun countByMatchedAtAfter(after: Instant): Long
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select m from MatchEntity m where m.userAId = :userA and m.userBId = :userB")
    fun findPairForUpdate(@Param("userA") userA: UUID, @Param("userB") userB: UUID): MatchEntity?

    @Query("select m from MatchEntity m where m.status = 'active' and (m.userAId = :userId or m.userBId = :userId) order by m.matchedAt desc")
    fun findActiveForUser(@Param("userId") userId: UUID, pageable: Pageable): List<MatchEntity>

    @Query("select m from MatchEntity m where m.userAId = :userId or m.userBId = :userId order by m.matchedAt desc")
    fun findAllForUser(@Param("userId") userId: UUID): List<MatchEntity>
}

interface MessageRepository : JpaRepository<MessageEntity, UUID> {
    fun countByCreatedAtAfter(after: Instant): Long
    fun findBySenderIdAndClientId(senderId: UUID, clientId: UUID): MessageEntity?
    fun findByMatchIdOrderByCreatedAtDesc(matchId: UUID, pageable: Pageable): List<MessageEntity>
    fun findByMatchIdAndCreatedAtBeforeOrderByCreatedAtDesc(matchId: UUID, createdAt: Instant, pageable: Pageable): List<MessageEntity>
    fun findFirstByMatchIdOrderByCreatedAtDesc(matchId: UUID): MessageEntity?
    fun countByMatchIdAndSenderIdNotAndReadAtIsNull(matchId: UUID, senderId: UUID): Long
    fun findByMatchIdInOrderByCreatedAtAsc(matchIds: Collection<UUID>, pageable: Pageable): List<MessageEntity>

    /**
     * One query for the conversation preview on the matches screen.  A
     * DISTINCT ON query is intentionally PostgreSQL-specific because the
     * production database is PostgreSQL and it avoids one round trip per
     * match as the member base grows.
     */
    @Query(
        value = """
            select distinct on (match_id) *
            from messages
            where match_id in (:matchIds)
            order by match_id, created_at desc, id desc
        """,
        nativeQuery = true,
    )
    fun findLatestByMatchIds(@Param("matchIds") matchIds: Collection<UUID>): List<MessageEntity>

    @Query(
        """
            select m.matchId, count(m.id)
            from MessageEntity m
            where m.matchId in :matchIds
              and m.senderId <> :readerId
              and m.readAt is null
            group by m.matchId
        """,
    )
    fun unreadCountsByMatchIds(
        @Param("matchIds") matchIds: Collection<UUID>,
        @Param("readerId") readerId: UUID,
    ): List<Array<Any>>

    @Modifying
    @Query("update MessageEntity m set m.readAt = :readAt where m.matchId = :matchId and m.senderId <> :readerId and m.readAt is null")
    fun markRead(@Param("matchId") matchId: UUID, @Param("readerId") readerId: UUID, @Param("readAt") readAt: Instant): Int
}

interface DatePlanRepository : JpaRepository<DatePlanEntity, UUID> {
    fun findByMatchIdOrderByScheduledForDescCreatedAtDesc(matchId: UUID, pageable: Pageable): List<DatePlanEntity>
    fun findByProposerId(proposerId: UUID): List<DatePlanEntity>
}

interface AuthIdentityRepository : JpaRepository<AuthIdentityEntity, UUID> {
    fun findByProviderAndProviderSubject(provider: String, providerSubject: String): AuthIdentityEntity?
    fun existsByEmail(email: String): Boolean
    fun existsByUserId(userId: UUID): Boolean
    fun findByUserId(userId: UUID): List<AuthIdentityEntity>
}

interface AuthSessionRepository : JpaRepository<AuthSessionEntity, UUID> {
    fun findByTokenHashAndExpiresAtAfter(tokenHash: String, expiresAt: Instant): AuthSessionEntity?
    fun findByTokenHash(tokenHash: String): AuthSessionEntity?
}

interface OAuthFlowRepository : JpaRepository<OAuthFlowEntity, UUID> {
    fun findByStateHash(stateHash: String): OAuthFlowEntity?
}

interface BlockRepository : JpaRepository<BlockEntity, UUID> {
    fun existsByBlockerIdAndBlockedId(blockerId: UUID, blockedId: UUID): Boolean
    fun findByBlockerId(blockerId: UUID): List<BlockEntity>
}

interface ReportRepository : JpaRepository<ReportEntity, UUID> {
    fun findByReporterIdOrderByCreatedAtDesc(reporterId: UUID, pageable: Pageable): List<ReportEntity>
    fun countByReporterIdAndCreatedAtAfter(reporterId: UUID, createdAt: Instant): Long
    fun existsByReporterIdAndReportedIdAndCategoryAndCreatedAtAfter(
        reporterId: UUID,
        reportedId: UUID,
        category: String,
        createdAt: Instant,
    ): Boolean
    fun countByStatus(status: String): Long
    fun findByStatusOrderByCreatedAtAsc(status: String, pageable: Pageable): List<ReportEntity>
}

interface NotificationRepository : JpaRepository<NotificationEntity, UUID> {
    fun findByUserIdOrderByCreatedAtDesc(userId: UUID, pageable: Pageable): List<NotificationEntity>
    fun countByUserIdAndReadAtIsNull(userId: UUID): Long
    fun findByIdAndUserId(id: UUID, userId: UUID): NotificationEntity?
    fun existsByUserIdAndDedupeKey(userId: UUID, dedupeKey: String): Boolean

    @Modifying
    @Query("update NotificationEntity n set n.readAt = :readAt where n.userId = :userId and n.readAt is null")
    fun markAllRead(@Param("userId") userId: UUID, @Param("readAt") readAt: Instant): Int
}

interface VerificationRequestRepository : JpaRepository<VerificationRequestEntity, UUID> {
    fun findFirstByUserIdOrderByRequestedAtDesc(userId: UUID): VerificationRequestEntity?
    fun findByUserIdAndStatus(userId: UUID, status: String): VerificationRequestEntity?
    fun countByStatus(status: String): Long
    fun findByStatusOrderByRequestedAtAsc(status: String, pageable: Pageable): List<VerificationRequestEntity>
}

interface DiscoveryImpressionRepository : JpaRepository<DiscoveryImpressionEntity, UUID> {
    @Query("select d.targetId, count(d.id) from DiscoveryImpressionEntity d where d.targetId in :targetIds and d.shownAt >= :after group by d.targetId")
    fun exposureCounts(@Param("targetIds") targetIds: Collection<UUID>, @Param("after") after: Instant): List<Array<Any>>

    fun findByTargetIdAndShownAtAfterOrderByShownAtDesc(
        targetId: UUID,
        after: Instant,
        pageable: Pageable,
    ): List<DiscoveryImpressionEntity>

    fun findByViewerIdAndShownAtAfterOrderByShownAtDesc(
        viewerId: UUID,
        after: Instant,
        pageable: Pageable,
    ): List<DiscoveryImpressionEntity>
}

interface SavedProfileRepository : JpaRepository<SavedProfileEntity, UUID> {
    fun findByUserIdOrderByCreatedAtDesc(userId: UUID, pageable: Pageable): List<SavedProfileEntity>
    fun findByUserIdAndTargetUserIdIn(userId: UUID, targetUserIds: Collection<UUID>): List<SavedProfileEntity>
    fun existsByUserIdAndTargetUserId(userId: UUID, targetUserId: UUID): Boolean
    fun countByUserId(userId: UUID): Long
    fun deleteByUserIdAndTargetUserId(userId: UUID, targetUserId: UUID): Long

    @Modifying
    @Query(
        value = """
            insert into saved_profiles (id, user_id, target_user_id, created_at)
            values (:id, :userId, :targetUserId, now())
            on conflict (user_id, target_user_id) do nothing
        """,
        nativeQuery = true,
    )
    fun insertIfAbsent(
        @Param("id") id: UUID,
        @Param("userId") userId: UUID,
        @Param("targetUserId") targetUserId: UUID,
    ): Int
}

interface DateFeedbackRepository : JpaRepository<DateFeedbackEntity, UUID> {
    fun existsByPlanIdAndReviewerId(planId: UUID, reviewerId: UUID): Boolean
    fun findByReviewerId(reviewerId: UUID): List<DateFeedbackEntity>
}

interface MatchSyncRepository : JpaRepository<MatchSyncEntity, UUID> {
    fun findByMatchId(matchId: UUID): MatchSyncEntity?
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select s from MatchSyncEntity s where s.matchId = :matchId")
    fun findByMatchIdForUpdate(@Param("matchId") matchId: UUID): MatchSyncEntity?
}

interface MatchSyncAnswerRepository : JpaRepository<MatchSyncAnswerEntity, UUID> {
    fun findBySyncIdOrderByRoundIndexAscCreatedAtAsc(syncId: UUID): List<MatchSyncAnswerEntity>
    fun findBySyncIdAndRoundIndexAndUserId(syncId: UUID, roundIndex: Int, userId: UUID): MatchSyncAnswerEntity?
    fun countBySyncIdAndRoundIndex(syncId: UUID, roundIndex: Int): Long
}

interface ModerationActionRepository : JpaRepository<ModerationActionEntity, UUID>

interface StoryRepository : JpaRepository<StoryEntity, UUID> {
    fun countByCreatedAtAfter(after: Instant): Long
    @Query(
        """
        select s from StoryEntity s
        where s.expiresAt > :now
          and s.authorId in :authorIds
        order by s.createdAt desc
        """,
    )
    fun findActiveForAuthors(
        @Param("authorIds") authorIds: Collection<UUID>,
        @Param("now") now: Instant,
        pageable: Pageable,
    ): List<StoryEntity>

    fun findByAuthorIdAndExpiresAtAfterOrderByCreatedAtDesc(
        authorId: UUID,
        now: Instant,
        pageable: Pageable,
    ): List<StoryEntity>
}

interface StoryReactionRepository : JpaRepository<StoryReactionEntity, UUID> {
    fun existsByStoryIdAndUserId(storyId: UUID, userId: UUID): Boolean
    fun countByStoryId(storyId: UUID): Long
    fun findByStoryIdInAndUserId(storyIds: Collection<UUID>, userId: UUID): List<StoryReactionEntity>
    fun deleteByStoryIdAndUserId(storyId: UUID, userId: UUID): Long
}

