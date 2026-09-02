package kr.morrow.api.config

import kr.morrow.api.service.ApiException
import kr.morrow.api.service.DatingService
import kr.morrow.api.service.IdentityService
import kr.morrow.api.service.RealtimeHub
import org.springframework.context.annotation.Configuration
import org.springframework.context.annotation.Bean
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty
import org.springframework.data.redis.connection.RedisConnectionFactory
import org.springframework.data.redis.listener.ChannelTopic
import org.springframework.data.redis.listener.RedisMessageListenerContainer
import org.springframework.http.server.ServerHttpRequest
import org.springframework.http.server.ServerHttpResponse
import org.springframework.web.socket.CloseStatus
import org.springframework.web.socket.TextMessage
import org.springframework.web.socket.WebSocketHandler
import org.springframework.web.socket.WebSocketSession
import org.springframework.web.socket.config.annotation.EnableWebSocket
import org.springframework.web.socket.config.annotation.WebSocketConfigurer
import org.springframework.web.socket.config.annotation.WebSocketHandlerRegistry
import org.springframework.web.socket.handler.TextWebSocketHandler
import org.springframework.web.socket.server.HandshakeInterceptor
import org.springframework.web.util.UriComponentsBuilder
import tools.jackson.databind.ObjectMapper
import java.util.UUID

@Configuration
@EnableWebSocket
class RealtimeConfig(
    private val handler: MorrowWebSocketHandler,
    private val interceptor: MorrowHandshakeInterceptor,
    private val properties: MorrowProperties,
) : WebSocketConfigurer {
    override fun registerWebSocketHandlers(registry: WebSocketHandlerRegistry) {
        registry.addHandler(handler, "/api/ws/matches/*", "/api/ws/inbox")
            .addInterceptors(interceptor)
            .setAllowedOrigins(properties.publicAppUrl)
    }
}

@Configuration
@ConditionalOnProperty(
    prefix = "morrow",
    name = ["realtime-redis-enabled"],
    havingValue = "true",
    matchIfMissing = true,
)
class RealtimeRedisConfig {
    @Bean
    fun realtimeMessageListenerContainer(
        connectionFactory: RedisConnectionFactory,
        hub: RealtimeHub,
    ): RedisMessageListenerContainer = RedisMessageListenerContainer().apply {
        setConnectionFactory(connectionFactory)
        addMessageListener(hub, ChannelTopic(RealtimeHub.CHANNEL))
    }
}

@Configuration
class MorrowHandshakeInterceptor(
    private val properties: MorrowProperties,
    private val identity: IdentityService,
) : HandshakeInterceptor {
    override fun beforeHandshake(
        request: ServerHttpRequest,
        response: ServerHttpResponse,
        wsHandler: WebSocketHandler,
        attributes: MutableMap<String, Any>,
    ): Boolean {
        val cookies = request.headers["Cookie"].orEmpty().flatMap { header -> header.split(';') }
            .mapNotNull { part -> part.trim().split('=', limit = 2).takeIf { it.size == 2 } }
            .associate { it[0] to it[1] }
        val auth = identity.resolve(cookies[properties.sessionCookieName], request.headers.getFirst("X-Coders-User")) ?: return false
        val principal = identity.requirePrincipal(auth)
        attributes["userId"] = principal.userId
        attributes["codersId"] = principal.codersId
        return true
    }

    override fun afterHandshake(
        request: ServerHttpRequest,
        response: ServerHttpResponse,
        wsHandler: WebSocketHandler,
        exception: Exception?,
    ) = Unit
}

@org.springframework.stereotype.Component
class MorrowWebSocketHandler(
    private val hub: RealtimeHub,
    private val dating: DatingService,
    private val mapper: ObjectMapper,
) : TextWebSocketHandler() {
    override fun afterConnectionEstablished(session: WebSocketSession) {
        val userId = session.userId()
        val matchId = session.matchId()
        if (matchId == null) {
            hub.joinInbox(userId, session)
            hub.send(session, mapOf("type" to "inbox_ready", "user_id" to userId.toString(), "heartbeat_seconds" to 25))
        } else {
            dating.ownedMatch(matchId, userId)
            hub.joinMatch(matchId, session)
            hub.send(session, mapOf("type" to "ready", "match_id" to matchId.toString(), "user_id" to userId.toString(), "heartbeat_seconds" to 25))
            hub.publishMatch(matchId, mapOf("type" to "presence", "match_id" to matchId.toString(), "user_id" to userId.toString(), "online" to true))
        }
    }

    override fun handleTextMessage(session: WebSocketSession, message: TextMessage) {
        val userId = session.userId()
        val node = runCatching { mapper.readTree(message.payload) }.getOrNull() ?: return
        when (node.path("type").asString()) {
            "ping" -> hub.send(session, mapOf("type" to "pong"))
            "typing" -> session.matchId()?.let { matchId ->
                hub.publishMatch(matchId, mapOf("type" to "typing", "match_id" to matchId.toString(), "user_id" to userId.toString(), "active" to node.path("active").asBoolean(false)))
            }
            "read" -> session.matchId()?.let { dating.markRead(userId, it) }
            "message" -> session.matchId()?.let { matchId ->
                val clientId = runCatching { UUID.fromString(node.path("client_id").asString()) }.getOrNull()
                val body = node.path("body").asString("")
                try {
                    dating.sendMessage(userId, matchId, kr.morrow.api.web.MessageRequest(body, clientId))
                } catch (error: ApiException) {
                    hub.send(session, mapOf("type" to "error", "detail" to error.message, "client_id" to clientId?.toString()))
                }
            }
        }
    }

    override fun afterConnectionClosed(session: WebSocketSession, status: CloseStatus) {
        val userId = session.attributes["userId"] as? UUID ?: return
        val matchId = session.matchId()
        if (matchId == null) hub.leaveInbox(userId, session)
        else {
            hub.leaveMatch(matchId, session)
            hub.publishMatch(matchId, mapOf("type" to "presence", "match_id" to matchId.toString(), "user_id" to userId.toString(), "online" to false))
        }
    }

    override fun handleTransportError(session: WebSocketSession, exception: Throwable) {
        if (session.isOpen) session.close(CloseStatus.SERVER_ERROR)
    }

    private fun WebSocketSession.userId(): UUID = attributes["userId"] as? UUID
        ?: throw ApiException(401, "로그인이 필요해요")

    private fun WebSocketSession.matchId(): UUID? {
        val path = UriComponentsBuilder.fromUri(uri ?: return null).build().path ?: return null
        if (!path.startsWith("/api/ws/matches/")) return null
        return runCatching { UUID.fromString(path.substringAfterLast('/')) }.getOrNull()
    }
}
