package kr.morrow.api.service

import org.springframework.stereotype.Service
import org.springframework.data.redis.connection.Message
import org.springframework.data.redis.connection.MessageListener
import org.springframework.data.redis.core.StringRedisTemplate
import org.springframework.web.socket.TextMessage
import org.springframework.web.socket.WebSocketSession
import tools.jackson.databind.ObjectMapper
import java.util.UUID
import java.util.concurrent.ConcurrentHashMap

/**
 * Local WebSocket registry with Redis Pub/Sub fan-out.
 *
 * WebSocket sessions are intentionally kept in-process, but every published
 * event is also copied to Redis so another API replica can deliver it to its
 * own connected clients. The source id prevents the publishing replica from
 * delivering its own event twice when Redis echoes the subscription.
 */
@Service
class RealtimeHub(
    private val objectMapper: ObjectMapper,
    private val redis: StringRedisTemplate,
) : MessageListener {
    companion object {
        const val CHANNEL = "morrow:realtime:v1"
    }

    private val sourceId = UUID.randomUUID().toString()
    private val matches = ConcurrentHashMap<UUID, MutableSet<WebSocketSession>>()
    private val inboxes = ConcurrentHashMap<UUID, MutableSet<WebSocketSession>>()

    fun joinMatch(matchId: UUID, session: WebSocketSession) {
        matches.computeIfAbsent(matchId) { ConcurrentHashMap.newKeySet() }.add(session)
    }

    fun leaveMatch(matchId: UUID, session: WebSocketSession) {
        matches[matchId]?.let { set ->
            set.remove(session)
            if (set.isEmpty()) matches.remove(matchId, set)
        }
    }

    fun joinInbox(userId: UUID, session: WebSocketSession) {
        inboxes.computeIfAbsent(userId) { ConcurrentHashMap.newKeySet() }.add(session)
    }

    fun leaveInbox(userId: UUID, session: WebSocketSession) {
        inboxes[userId]?.let { set ->
            set.remove(session)
            if (set.isEmpty()) inboxes.remove(userId, set)
        }
    }

    fun publishMatch(matchId: UUID, payload: Any) {
        publish(matches[matchId], payload)
        publishRemote("match", matchId, payload)
    }

    fun publishInbox(userId: UUID, payload: Any) {
        publish(inboxes[userId], payload)
        publishRemote("inbox", userId, payload)
    }

    fun send(session: WebSocketSession, payload: Any) {
        if (session.isOpen) synchronized(session) { session.sendMessage(TextMessage(objectMapper.writeValueAsString(payload))) }
    }

    override fun onMessage(message: Message, pattern: ByteArray?) {
        val envelope = runCatching {
            objectMapper.readValue(message.body, RealtimeEnvelope::class.java)
        }.getOrNull() ?: return
        if (envelope.source == sourceId) return
        val key = runCatching { UUID.fromString(envelope.key) }.getOrNull() ?: return
        when (envelope.kind) {
            "match" -> publish(matches[key], envelope.payload)
            "inbox" -> publish(inboxes[key], envelope.payload)
        }
    }

    private fun publishRemote(kind: String, key: UUID, payload: Any) {
        @Suppress("UNCHECKED_CAST")
        val mapPayload = (payload as? Map<*, *>)
            ?.entries
            ?.associate { it.key.toString() to it.value }
            ?: mapOf("value" to payload)
        val envelope = RealtimeEnvelope(sourceId, kind, key.toString(), mapPayload)
        runCatching {
            redis.convertAndSend(CHANNEL, objectMapper.writeValueAsString(envelope))
        }.onFailure {
            // Redis is an enhancement for cross-replica delivery. The local
            // session has already received the event, so a Redis outage must
            // not turn a successful chat write into a failed API response.
        }
    }

    private fun publish(sessions: Set<WebSocketSession>?, payload: Any) {
        if (sessions.isNullOrEmpty()) return
        val text = TextMessage(objectMapper.writeValueAsString(payload))
        sessions.toList().forEach { session ->
            runCatching { if (session.isOpen) synchronized(session) { session.sendMessage(text) } }
                .onFailure { session.close() }
        }
    }

    private data class RealtimeEnvelope(
        val source: String,
        val kind: String,
        val key: String,
        val payload: Map<String, Any?>,
    )
}
