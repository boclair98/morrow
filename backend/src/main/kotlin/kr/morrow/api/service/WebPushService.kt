package kr.morrow.api.service

import kr.morrow.api.config.MorrowProperties
import kr.morrow.api.domain.NotificationEntity
import kr.morrow.api.domain.PushSubscriptionEntity
import kr.morrow.api.repository.PushSubscriptionRepository
import kr.morrow.api.repository.UserRepository
import kr.morrow.api.web.PushSubscriptionRequest
import nl.martijndwars.webpush.Notification
import nl.martijndwars.webpush.PushService
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional
import tools.jackson.databind.ObjectMapper
import java.net.URI
import java.time.Instant
import java.util.Base64
import java.util.UUID

@Service
class WebPushService(
    private val subscriptions: PushSubscriptionRepository,
    private val users: UserRepository,
    private val properties: MorrowProperties,
    private val objectMapper: ObjectMapper,
) {
    val enabled: Boolean
        get() = properties.pushVapidPublicKey.isNotBlank() && properties.pushVapidPrivateKey.isNotBlank()

    fun publicKey(): String? = properties.pushVapidPublicKey.takeIf { it.isNotBlank() }

    @Transactional
    fun subscribe(userId: UUID, request: PushSubscriptionRequest) {
        validateSubscription(request)
        val subscription = subscriptions.findByEndpoint(request.endpoint)
            ?: PushSubscriptionEntity(endpoint = request.endpoint)
        subscription.userId = userId
        subscription.p256dh = request.p256dh
        subscription.auth = request.auth
        subscription.lastUsedAt = Instant.now()
        subscriptions.save(subscription)
    }

    @Transactional
    fun unsubscribe(userId: UUID, endpoint: String) {
        if (endpoint.isBlank() || endpoint.length > 2048) throw ApiException(400, "알림 구독 주소가 올바르지 않아요")
        subscriptions.deleteByUserIdAndEndpoint(userId, endpoint)
    }

    /**
     * A failed push must never make the match/message transaction fail. The
     * in-app notification has already been persisted, so the browser can
     * still catch up when it returns.
     */
    @Transactional
    fun send(item: NotificationEntity) {
        if (!enabled) return
        val user = users.findById(item.userId).orElse(null) ?: return
        if (!userWantsPush(user = user, kind = item.kind)) return
        val targets = subscriptions.findByUserId(item.userId)
        if (targets.isEmpty()) return
        val payload = runCatching {
            objectMapper.writeValueAsString(
                linkedMapOf(
                    "title" to item.title,
                    "body" to item.body,
                    "url" to actionUrl(item),
                    "action_type" to item.actionType,
                    "action_id" to item.actionId?.toString(),
                ),
            )
        }.getOrNull() ?: return
        val push = runCatching {
            PushService(properties.pushVapidPublicKey, properties.pushVapidPrivateKey, properties.pushVapidSubject)
        }.getOrNull() ?: return
        targets.forEach { subscription ->
            runCatching {
                deliver(
                    push,
                    Notification(
                        subscription.endpoint,
                        subscription.p256dh,
                        subscription.auth,
                        payload,
                    ),
                )
                subscription.lastUsedAt = Instant.now()
            }
        }
    }

    /**
     * web-push-java exposes Apache HttpResponse in PushService.send's return
     * signature, but that legacy type is intentionally not on our application
     * compile classpath. Reflection keeps the delivery boundary isolated while
     * still invoking the library's public one-argument send method.
     */
    private fun deliver(push: PushService, notification: Notification) {
        push.javaClass.getMethod("send", Notification::class.java).invoke(push, notification)
    }

    private fun actionUrl(item: NotificationEntity): String = when (item.actionType) {
        "match", "message", "date", "sync" -> "/?open=matches${item.actionId?.let { "&id=$it" } ?: ""}"
        "story" -> "/?open=stories"
        else -> "/"
    }

    private fun userWantsPush(user: kr.morrow.api.domain.UserEntity, kind: String): Boolean = when (kind) {
        "match" -> user.notifyMatches
        "message" -> user.notifyMessages
        "date" -> user.notifyDates
        else -> true
    }

    private fun validateSubscription(request: PushSubscriptionRequest) {
        val endpoint = runCatching { URI(request.endpoint) }.getOrNull()
        if (endpoint?.scheme != "https" || endpoint.host.isNullOrBlank()) {
            throw ApiException(400, "알림 구독 주소가 올바르지 않아요")
        }
        val p256dh = runCatching { Base64.getUrlDecoder().decode(request.p256dh) }.getOrNull()
        val auth = runCatching { Base64.getUrlDecoder().decode(request.auth) }.getOrNull()
        if (p256dh?.size != 65 || auth == null || auth.size < 16) {
            throw ApiException(400, "알림 구독 키가 올바르지 않아요")
        }
    }
}
