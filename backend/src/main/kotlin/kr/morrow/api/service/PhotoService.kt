package kr.morrow.api.service

import kr.morrow.api.config.MorrowProperties
import kr.morrow.api.domain.ProfilePhotoEntity
import kr.morrow.api.repository.BlockRepository
import kr.morrow.api.repository.ProfilePhotoRepository
import kr.morrow.api.repository.UserRepository
import kr.morrow.api.web.PhotoRequest
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional
import java.nio.charset.StandardCharsets
import java.security.MessageDigest
import java.util.Base64
import java.util.UUID

data class PhotoContent(val bytes: ByteArray, val contentType: String, val etag: String)

@Service
class PhotoService(
    private val photos: ProfilePhotoRepository,
    private val users: UserRepository,
    private val blocks: BlockRepository,
    private val userService: UserService,
    private val storage: MediaStorage,
    private val properties: MorrowProperties,
) {
    @Transactional(readOnly = true)
    fun list(userId: UUID): Map<String, Any> = mapOf(
        "items" to photos.findByOwnerIdOrderByPositionAscCreatedAtAsc(userId).map(::photoMeta),
        "limit" to 6,
    )

    @Transactional
    fun add(userId: UUID, request: PhotoRequest): Map<String, Any?> {
        userService.current(userId)
        val count = photos.countByOwnerId(userId)
        if (count >= 6) throw ApiException(409, "사진은 최대 6장까지 올릴 수 있어요")
        val decoded = decodeImage(request.dataUrl)
        val digest = sha256Bytes(decoded.second)
        if (photos.existsByOwnerIdAndSha256(userId, digest)) throw ApiException(409, "이미 등록한 사진이에요")
        val id = UUID.randomUUID()
        val extension = mapOf("image/jpeg" to "jpg", "image/png" to "png", "image/webp" to "webp").getValue(decoded.first)
        var storageKey: String? = null
        var databaseContent: ByteArray? = decoded.second
        if (storage.configured) {
            storageKey = "profile/$userId/$id.$extension"
            runCatching { storage.put(storageKey, decoded.second, decoded.first) }
                .getOrElse { throw ApiException(503, "사진 저장소에 잠시 연결할 수 없어요") }
            databaseContent = null
        }
        val photo = photos.save(
            ProfilePhotoEntity(
                id = id,
                ownerId = userId,
                contentType = decoded.first,
                content = databaseContent,
                storageKey = storageKey,
                byteSize = decoded.second.size,
                position = count.toInt(),
                isPublic = request.isPublic,
                sha256 = digest,
                moderationStatus = "pending",
            ),
        )
        return mapOf("photo" to photoMeta(photo))
    }

    @Transactional
    fun primary(userId: UUID, photoId: UUID): Map<String, Any?> {
        userService.current(userId)
        val all = photos.findByOwnerIdOrderByPositionAscCreatedAtAsc(userId)
        val target = all.firstOrNull { it.id == photoId } ?: throw ApiException(404, "사진을 찾지 못했어요")
        target.position = 0
        all.filter { it.id != photoId }.forEachIndexed { index, photo -> photo.position = index + 1 }
        return mapOf("photo" to photoMeta(target))
    }

    @Transactional
    fun delete(userId: UUID, photoId: UUID): Map<String, String> {
        userService.current(userId)
        val photo = photos.findById(photoId).orElseThrow { ApiException(404, "사진을 찾지 못했어요") }
        if (photo.ownerId != userId) throw ApiException(404, "사진을 찾지 못했어요")
        val storageKey = photo.storageKey
        photos.delete(photo)
        photos.flush()
        photos.findByOwnerIdOrderByPositionAscCreatedAtAsc(userId).forEachIndexed { index, item -> item.position = index }
        storage.delete(storageKey)
        return mapOf("status" to "ok")
    }

    @Transactional(readOnly = true)
    fun content(viewerId: UUID, photoId: UUID): PhotoContent {
        userService.current(viewerId)
        val photo = photos.findById(photoId).orElseThrow { ApiException(404, "사진을 찾지 못했어요") }
        if (photo.ownerId != viewerId) {
            val viewer = users.findById(viewerId).orElseThrow { ApiException(401, "로그인이 필요해요") }
            val blocked = blocks.existsByBlockerIdAndBlockedId(viewerId, photo.ownerId) || blocks.existsByBlockerIdAndBlockedId(photo.ownerId, viewerId)
            if (blocked || !photo.isPublic || (photo.moderationStatus != "approved" && viewer.codersId !in properties.admins)) {
                throw ApiException(404, "사진을 찾지 못했어요")
            }
        }
        val bytes = photo.storageKey?.let(storage::fetch) ?: photo.content ?: throw ApiException(404, "사진을 찾지 못했어요")
        return PhotoContent(bytes, photo.contentType, photo.sha256 ?: photo.id.toString())
    }

    internal fun decodeImage(dataUrl: String): Pair<String, ByteArray> {
        val comma = dataUrl.indexOf(',')
        if (comma < 0) throw ApiException(422, "이미지 형식을 확인해주세요")
        val header = dataUrl.substring(0, comma)
        if (!header.startsWith("data:") || ";base64" !in header) throw ApiException(422, "이미지 형식을 확인해주세요")
        val contentType = header.substringAfter("data:").substringBefore(';').lowercase()
        if (contentType !in setOf("image/jpeg", "image/png", "image/webp")) throw ApiException(415, "JPG, PNG, WEBP 이미지만 올릴 수 있어요")
        val content = runCatching { Base64.getDecoder().decode(dataUrl.substring(comma + 1).toByteArray(StandardCharsets.US_ASCII)) }
            .getOrElse { throw ApiException(422, "이미지 데이터를 읽지 못했어요") }
        if (content.size > 1_800_000) throw ApiException(413, "사진은 1.8MB 이하로 올려주세요")
        val valid = when (contentType) {
            "image/jpeg" -> content.size >= 3 && content[0] == 0xff.toByte() && content[1] == 0xd8.toByte() && content[2] == 0xff.toByte()
            "image/png" -> content.take(8).toByteArray().contentEquals(byteArrayOf(0x89.toByte(), 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a))
            else -> content.size >= 12 && String(content, 0, 4) == "RIFF" && String(content, 8, 4) == "WEBP"
        }
        if (!valid) throw ApiException(422, "실제 이미지 파일을 확인해주세요")
        return contentType to content
    }

    private fun sha256Bytes(content: ByteArray): String = MessageDigest.getInstance("SHA-256")
        .digest(content).joinToString("") { "%02x".format(it) }
}
