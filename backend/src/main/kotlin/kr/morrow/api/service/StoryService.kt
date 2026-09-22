package kr.morrow.api.service

import kr.morrow.api.config.LegalVersions
import kr.morrow.api.domain.StoryEntity
import kr.morrow.api.domain.StoryReactionEntity
import kr.morrow.api.domain.UserEntity
import kr.morrow.api.repository.BlockRepository
import kr.morrow.api.repository.ProfilePhotoRepository
import kr.morrow.api.repository.StoryReactionRepository
import kr.morrow.api.repository.StoryRepository
import kr.morrow.api.repository.UserRepository
import kr.morrow.api.web.StoryRequest
import org.springframework.data.domain.PageRequest
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional
import java.time.Duration
import java.time.Instant
import java.util.UUID

@Service
class StoryService(
    private val stories: StoryRepository,
    private val reactions: StoryReactionRepository,
    private val users: UserRepository,
    private val photos: ProfilePhotoRepository,
    private val blocks: BlockRepository,
    private val userService: UserService,
    private val photoService: PhotoService,
    private val storage: MediaStorage,
) {
    @Transactional(readOnly = true)
    fun feed(userId: UUID, limit: Int): Map<String, Any> {
        val viewer = userService.current(userId)
        val authors = users.findStoryAuthors(
            viewer.id,
            LegalVersions.TERMS,
            LegalVersions.PRIVACY,
            viewer.minPreferredAge,
            viewer.maxPreferredAge,
            viewer.age ?: 20,
            viewer.seeking ?: "all",
            viewer.gender ?: "other",
            PageRequest.of(0, 120),
        )
        val authorIds = (authors.map { it.id } + viewer.id).distinct()
        val safeLimit = limit.coerceIn(1, 60)
        val rows = stories.findActiveForAuthors(authorIds, Instant.now(), PageRequest.of(0, safeLimit))
        return mapOf("items" to rows.map { storyItem(it, viewer.id) })
    }

    @Transactional(readOnly = true)
    fun mine(userId: UUID, limit: Int): Map<String, Any> {
        val viewer = userService.current(userId)
        val rows = stories.findByAuthorIdAndExpiresAtAfterOrderByCreatedAtDesc(
            viewer.id,
            Instant.now(),
            PageRequest.of(0, limit.coerceIn(1, 30)),
        )
        return mapOf("items" to rows.map { storyItem(it, viewer.id) })
    }

    @Transactional
    fun create(userId: UUID, request: StoryRequest): Map<String, Any?> {
        val author = userService.current(userId)
        val body = cleanText(request.body, 240)
        val decoded = request.photoDataUrl?.takeIf { it.isNotBlank() }?.let(photoService::decodeImage)
        if (body.isBlank() && decoded == null) throw ApiException(422, "짧은 글이나 사진을 하나 이상 올려주세요")
        val id = UUID.randomUUID()
        val extension = decoded?.first?.substringAfter('/') ?: "jpg"
        var storageKey: String? = null
        var databaseContent = decoded?.second
        if (decoded != null && storage.configured) {
            storageKey = "story/${author.id}/$id.$extension"
            runCatching { storage.put(storageKey, decoded.second, decoded.first) }
                .getOrElse { throw ApiException(503, "스토리 사진 저장소에 잠시 연결할 수 없어요") }
            databaseContent = null
        }
        val story = stories.save(
            StoryEntity(
                id = id,
                authorId = author.id,
                body = body,
                photoContentType = decoded?.first,
                photoContent = databaseContent,
                photoStorageKey = storageKey,
                photoByteSize = decoded?.second?.size,
                expiresAt = Instant.now().plus(Duration.ofHours(24)),
            ),
        )
        return mapOf("item" to storyItem(story, author.id))
    }

    @Transactional
    fun react(userId: UUID, storyId: UUID): Map<String, Any> {
        val viewer = userService.current(userId)
        val story = stories.findById(storyId).orElseThrow { ApiException(404, "스토리를 찾지 못했어요") }
        if (story.expiresAt <= Instant.now()) throw ApiException(410, "만료된 스토리예요")
        if (story.authorId != viewer.id && (blocks.existsByBlockerIdAndBlockedId(viewer.id, story.authorId) || blocks.existsByBlockerIdAndBlockedId(story.authorId, viewer.id))) {
            throw ApiException(404, "스토리를 찾지 못했어요")
        }
        val existing = reactions.existsByStoryIdAndUserId(story.id, viewer.id)
        if (existing) reactions.deleteByStoryIdAndUserId(story.id, viewer.id)
        else reactions.save(StoryReactionEntity(storyId = story.id, userId = viewer.id))
        return mapOf("reacted" to !existing, "reaction_count" to reactions.countByStoryId(story.id))
    }

    @Transactional
    fun delete(userId: UUID, storyId: UUID): Map<String, String> {
        val viewer = userService.current(userId)
        val story = stories.findById(storyId).orElseThrow { ApiException(404, "스토리를 찾지 못했어요") }
        if (story.authorId != viewer.id) throw ApiException(404, "스토리를 찾지 못했어요")
        stories.delete(story)
        stories.flush()
        storage.delete(story.photoStorageKey)
        return mapOf("status" to "ok")
    }

    @Transactional(readOnly = true)
    fun content(userId: UUID, storyId: UUID): PhotoContent {
        val viewer = userService.current(userId)
        val story = stories.findById(storyId).orElseThrow { ApiException(404, "사진을 찾지 못했어요") }
        if (story.expiresAt <= Instant.now()) throw ApiException(404, "만료된 스토리예요")
        if (story.authorId != viewer.id &&
            (blocks.existsByBlockerIdAndBlockedId(viewer.id, story.authorId) || blocks.existsByBlockerIdAndBlockedId(story.authorId, viewer.id))) {
            throw ApiException(404, "사진을 찾지 못했어요")
        }
        val contentType = story.photoContentType ?: throw ApiException(404, "사진을 찾지 못했어요")
        val bytes = story.photoStorageKey?.let(storage::fetch) ?: story.photoContent
            ?: throw ApiException(404, "사진을 찾지 못했어요")
        return PhotoContent(bytes, contentType, story.id.toString())
    }

    private fun storyItem(story: StoryEntity, viewerId: UUID): Map<String, Any?> {
        val author = users.findById(story.authorId).orElseThrow { ApiException(404, "작성자를 찾지 못했어요") }
        val avatar = photos.findByOwnerIdAndIsPublicTrueAndModerationStatusOrderByPositionAscCreatedAtAsc(
            author.id,
            "approved",
            PageRequest.of(0, 1),
        ).firstOrNull()
        val reacted = reactions.existsByStoryIdAndUserId(story.id, viewerId)
        return linkedMapOf(
            "id" to story.id.toString(),
            "body" to story.body,
            "photo_url" to story.photoContentType?.let { "/api/stories/${story.id}/media" },
            "photo_content_type" to story.photoContentType,
            "photo_byte_size" to story.photoByteSize,
            "created_at" to story.createdAt,
            "expires_at" to story.expiresAt,
            "reaction_count" to reactions.countByStoryId(story.id),
            "reacted" to reacted,
            "mine" to (author.id == viewerId),
            "author" to linkedMapOf(
                "id" to author.id.toString(),
                "display_name" to author.displayName,
                "age" to author.age,
                "area" to author.area,
                "job" to author.job,
                "account_verified" to author.accountVerified,
                "avatar_url" to avatar?.let { "/api/photos/${it.id}" },
            ),
        )
    }
}
