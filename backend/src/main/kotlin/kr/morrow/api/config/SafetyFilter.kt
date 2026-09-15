package kr.morrow.api.config

import jakarta.servlet.FilterChain
import jakarta.servlet.http.HttpServletRequest
import jakarta.servlet.http.HttpServletResponse
import kr.morrow.api.service.sha256
import org.slf4j.LoggerFactory
import org.springframework.core.Ordered
import org.springframework.core.annotation.Order
import org.springframework.data.redis.core.StringRedisTemplate
import org.springframework.stereotype.Component
import org.springframework.web.filter.OncePerRequestFilter
import java.net.URI
import java.time.Duration
import java.time.Instant
import java.util.UUID
import java.util.concurrent.ConcurrentHashMap
import java.util.concurrent.atomic.AtomicInteger
import java.util.concurrent.atomic.AtomicLong

@Component
@Order(Ordered.HIGHEST_PRECEDENCE)
class SafetyFilter(
    private val properties: MorrowProperties,
    private val redis: StringRedisTemplate,
) : OncePerRequestFilter() {
    private val log = LoggerFactory.getLogger(javaClass)
    private val fallback = ConcurrentHashMap<String, LocalBucket>()
    private val fallbackRequests = AtomicLong()

    override fun doFilterInternal(request: HttpServletRequest, response: HttpServletResponse, chain: FilterChain) {
        val requestId = UUID.randomUUID().toString()
        response.setHeader("X-Request-ID", requestId)
        response.setHeader("X-Content-Type-Options", "nosniff")
        response.setHeader("X-Frame-Options", "DENY")
        response.setHeader("Referrer-Policy", "strict-origin-when-cross-origin")
        response.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=()")

        val write = request.method in setOf("POST", "PUT", "PATCH", "DELETE")
        if (write) {
            val mediaUpload = request.requestURI.startsWith("/api/profile/photos") ||
                (request.requestURI.startsWith("/api/matches/") && request.requestURI.endsWith("/messages"))
            val max = if (mediaUpload) 4_000_000L else 32_768L
            if (request.contentLengthLong > max) {
                jsonError(response, 413, "요청 크기가 너무 커요")
                return
            }
            val origin = request.getHeader("Origin")
            if (!origin.isNullOrBlank() && properties.devFakeUser.isBlank() && !sameOrigin(origin, properties.publicAppUrl)) {
                jsonError(response, 403, "허용되지 않은 요청 출처예요")
                return
            }
        }

        val session = request.cookies?.firstOrNull { it.name == properties.sessionCookieName }?.value
        val forwarded = request.getHeader("X-Forwarded-For")?.substringBefore(',')?.trim()
        // `X-Coders-User` is only a platform-trusted identity in native mode.
        // In standalone mode the public nginx proxy forwards ordinary headers,
        // so accepting it here would let a caller mint a new rate-limit bucket
        // on every request. Keep standalone traffic tied to the app session or
        // the forwarded client address instead.
        val platformIdentity = request.getHeader("X-Coders-User")
            ?.takeIf { properties.authMode != "standalone" && it.isNotBlank() }
        val key = platformIdentity
            ?: session?.let(::sha256)
            ?: forwarded
            ?: request.remoteAddr
        val limit = if (write) 45 else 180
        if (!allow("${if (write) "w" else "r"}:$key", limit)) {
            response.setHeader("Retry-After", "60")
            jsonError(response, 429, "요청이 너무 많아요. 잠시 후 다시 시도해주세요")
            return
        }

        chain.doFilter(request, response)
        if (request.requestURI.startsWith("/api/") && request.requestURI != "/api/auth/providers") {
            response.setHeader("Cache-Control", "no-store")
        }
    }

    private fun allow(key: String, limit: Int): Boolean {
        return try {
            val redisKey = "morrow:rate:${Instant.now().epochSecond / 60}:$key"
            val count = redis.opsForValue().increment(redisKey) ?: 1L
            if (count == 1L) redis.expire(redisKey, Duration.ofSeconds(75))
            count <= limit
        } catch (error: Exception) {
            log.debug("Redis rate limiter unavailable; using local fallback", error)
            val minute = Instant.now().epochSecond / 60
            // Redis is the normal shared limiter.  If it is unavailable, keep
            // the per-process safety net bounded so a sustained outage cannot
            // turn an attacker-controlled key space into a memory leak.
            if (fallback.size > 10_000 && fallbackRequests.incrementAndGet() % 64L == 0L) {
                fallback.entries.removeIf { it.value.minute != minute }
            }
            val bucket = fallback.compute(key) { _, old ->
                if (old == null || old.minute != minute) LocalBucket(minute) else old
            }!!
            bucket.count.incrementAndGet() <= limit
        }
    }

    private fun sameOrigin(actual: String, expected: String): Boolean = runCatching {
        val a = URI(actual)
        val e = URI(expected)
        fun port(uri: URI) = if (uri.port >= 0) uri.port else if (uri.scheme == "https") 443 else 80
        a.scheme == e.scheme && a.host == e.host && port(a) == port(e)
    }.getOrDefault(false)

    private fun jsonError(response: HttpServletResponse, status: Int, detail: String) {
        response.status = status
        response.contentType = "application/json;charset=UTF-8"
        response.writer.write("{\"detail\":\"$detail\"}")
    }

    private data class LocalBucket(val minute: Long, val count: AtomicInteger = AtomicInteger())
}

