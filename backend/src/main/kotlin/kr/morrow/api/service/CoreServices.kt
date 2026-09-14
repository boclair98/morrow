package kr.morrow.api.service

import kr.morrow.api.config.LegalVersions
import kr.morrow.api.config.MorrowProperties
import kr.morrow.api.domain.NotificationEntity
import kr.morrow.api.domain.ProfilePhotoEntity
import kr.morrow.api.domain.UserEntity
import kr.morrow.api.repository.NotificationRepository
import kr.morrow.api.repository.ProfilePhotoRepository
import kr.morrow.api.repository.UserRepository
import org.springframework.data.domain.PageRequest
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional
import software.amazon.awssdk.auth.credentials.AwsBasicCredentials
import software.amazon.awssdk.auth.credentials.StaticCredentialsProvider
import software.amazon.awssdk.core.sync.RequestBody
import software.amazon.awssdk.regions.Region
import software.amazon.awssdk.services.s3.S3Client
import software.amazon.awssdk.services.s3.S3Configuration
import software.amazon.awssdk.services.s3.model.DeleteObjectRequest
import software.amazon.awssdk.services.s3.model.PutObjectRequest
import java.net.URI
import java.time.Instant
import java.util.UUID

@Service
class UserService(
    private val users: UserRepository,
    private val photos: ProfilePhotoRepository,
    private val properties: MorrowProperties,
) {
    @Transactional
    fun current(userId: UUID, requireLegal: Boolean = true): UserEntity {
        val user = users.findById(userId).orElseThrow { ApiException(401, "로그인이 필요해요") }
        ensureActive(user, requireLegal)
        user.lastSeenAt = Instant.now()
        return user
    }

    fun ensureActive(user: UserEntity, requireLegal: Boolean = true) {
        if (user.status == "suspended" && user.suspendedUntil?.isBefore(Instant.now()) == true) {
            user.status = "active"
            user.suspendedUntil = null
        }
        if (user.status != "active") throw ApiException(403, "현재 이용이 제한된 계정이에요")
        if (requireLegal && !legalComplete(user)) throw ApiException(409, "필수 동의를 먼저 완료해주세요")
    }

    fun legalComplete(user: UserEntity): Boolean =
        user.termsVersion == LegalVersions.TERMS &&
            user.privacyVersion == LegalVersions.PRIVACY &&
            user.termsAgreedAt != null && user.privacyAgreedAt != null && user.adultConfirmedAt != null

    @Transactional(readOnly = true)
    fun me(userId: UUID): Map<String, Any?> {
        val user = users.findById(userId).orElseThrow { ApiException(401, "로그인이 필요해요") }
        val photoItems = photos.findByOwnerIdOrderByPositionAscCreatedAtAsc(user.id).map(::photoMeta)
        return linkedMapOf(
            "id" to user.id.toString(), "coders_id" to user.codersId.toString(),
            "display_name" to user.displayName, "age" to user.age, "gender" to user.gender,
            "seeking" to user.seeking, "area" to user.area, "job" to user.job, "bio" to user.bio,
            "date_style" to user.dateStyle, "interests" to user.interests, "availability" to user.availability,
            "min_preferred_age" to user.minPreferredAge, "max_preferred_age" to user.maxPreferredAge,
            "max_distance_km" to user.maxDistanceKm, "profile_complete" to user.profileComplete,
            "account_verified" to user.accountVerified, "verification_status" to user.verificationStatus,
            "verified_at" to user.verifiedAt, "status" to user.status, "discoverable" to user.discoverable,
            "legal_complete" to legalComplete(user), "current_terms_version" to LegalVersions.TERMS,
            "current_privacy_version" to LegalVersions.PRIVACY, "notify_matches" to user.notifyMatches,
            "notify_messages" to user.notifyMessages, "notify_dates" to user.notifyDates,
            "marketing_opt_in" to user.marketingOptIn, "suspended_until" to user.suspendedUntil,
            "is_admin" to properties.admins.contains(user.codersId), "photos" to photoItems,
            "first_seen_at" to user.firstSeenAt,
        )
    }
}

fun photoMeta(photo: ProfilePhotoEntity): Map<String, Any?> = linkedMapOf(
    "id" to photo.id.toString(), "url" to "/api/photos/${photo.id}", "content_type" to photo.contentType,
    "byte_size" to photo.byteSize, "position" to photo.position, "is_public" to photo.isPublic,
    "moderation_status" to photo.moderationStatus, "moderation_reason" to photo.moderationReason,
)

@Service
class NotificationService(private val notifications: NotificationRepository) {
    @Transactional
    fun create(
        userId: UUID,
        kind: String,
        title: String,
        body: String,
        actionType: String? = null,
        actionId: UUID? = null,
        dedupeKey: String? = null,
    ): NotificationEntity? {
        if (dedupeKey != null && notifications.existsByUserIdAndDedupeKey(userId, dedupeKey)) return null
        return notifications.save(
            NotificationEntity(
                userId = userId,
                kind = kind,
                title = title.take(80),
                body = body.take(240),
                actionType = actionType,
                actionId = actionId,
                dedupeKey = dedupeKey,
            ),
        )
    }

    fun item(item: NotificationEntity): Map<String, Any?> = linkedMapOf(
        "id" to item.id.toString(), "kind" to item.kind, "title" to item.title, "body" to item.body,
        "action_type" to item.actionType, "action_id" to item.actionId?.toString(),
        "read_at" to item.readAt, "created_at" to item.createdAt,
    )

    @Transactional(readOnly = true)
    fun list(userId: UUID, limit: Int): Map<String, Any> = mapOf(
        "items" to notifications.findByUserIdOrderByCreatedAtDesc(userId, PageRequest.of(0, limit)).map(::item),
        "unread_count" to notifications.countByUserIdAndReadAtIsNull(userId),
    )

    @Transactional
    fun read(userId: UUID, id: UUID) {
        val item = notifications.findByIdAndUserId(id, userId) ?: throw ApiException(404, "알림을 찾지 못했어요")
        if (item.readAt == null) item.readAt = Instant.now()
    }

    @Transactional
    fun readAll(userId: UUID): Int = notifications.markAllRead(userId, Instant.now())
}

@Service
class MediaStorage(private val properties: MorrowProperties) {
    val configured: Boolean
        get() = listOf(
            properties.storageBucket,
            properties.storageS3Endpoint,
            properties.storageAccessKey,
            properties.storageSecretKey,
            properties.storagePublicUrl,
        ).all { it.isNotBlank() }

    private val client: S3Client? by lazy {
        if (!configured) null else S3Client.builder()
            .endpointOverride(URI(properties.storageS3Endpoint))
            .credentialsProvider(
                StaticCredentialsProvider.create(
                    AwsBasicCredentials.create(properties.storageAccessKey, properties.storageSecretKey),
                ),
            )
            .region(Region.of(properties.storageRegion.ifBlank { "auto" }))
            .serviceConfiguration(S3Configuration.builder().pathStyleAccessEnabled(true).build())
            .build()
    }

    fun put(key: String, content: ByteArray, contentType: String) {
        if (!key.startsWith("profile/") && !key.startsWith("chat/")) throw IllegalArgumentException("unsupported media key")
        val request = PutObjectRequest.builder().bucket(properties.storageBucket).key(key)
            .contentType(contentType).cacheControl("private, max-age=3600").build()
        client?.putObject(request, RequestBody.fromBytes(content))
            ?: throw IllegalStateException("storage is not configured")
    }

    fun fetch(key: String): ByteArray {
        if (!configured || (!key.startsWith("profile/") && !key.startsWith("chat/"))) throw ApiException(404, "사진을 찾지 못했어요")
        val connection = URI("${properties.storagePublicUrl.trimEnd('/')}/$key").toURL().openConnection()
        connection.connectTimeout = 5_000
        connection.readTimeout = 8_000
        return connection.getInputStream().use { stream -> stream.readNBytes(1_800_001) }.also {
            if (it.size > 1_800_000) throw ApiException(413, "저장된 사진 크기가 올바르지 않아요")
        }
    }

    fun delete(key: String?) {
        if (!configured || key.isNullOrBlank() || (!key.startsWith("profile/") && !key.startsWith("chat/"))) return
        runCatching {
            client?.deleteObject(DeleteObjectRequest.builder().bucket(properties.storageBucket).key(key).build())
        }
    }
}

