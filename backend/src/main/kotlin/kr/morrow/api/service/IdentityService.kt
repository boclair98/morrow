package kr.morrow.api.service

import kr.morrow.api.config.MorrowProperties
import kr.morrow.api.domain.AuthSessionEntity
import kr.morrow.api.domain.UserEntity
import kr.morrow.api.repository.AuthSessionRepository
import kr.morrow.api.repository.UserRepository
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken
import org.springframework.security.core.Authentication
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional
import java.nio.charset.StandardCharsets
import java.security.MessageDigest
import java.time.Duration
import java.time.Instant
import java.util.UUID

data class MorrowPrincipal(val codersId: UUID, val userId: UUID)

@Service
class IdentityService(
    private val properties: MorrowProperties,
    private val sessions: AuthSessionRepository,
    private val users: UserRepository,
) {
    @Transactional
    fun resolve(sessionToken: String?, nativeHeader: String?): Authentication? {
        if (properties.authMode != "standalone") {
            parseUuid(nativeHeader)?.let { codersId ->
                val user = getOrCreateUser(codersId)
                return authenticated(user)
            }
        }
        if (!sessionToken.isNullOrBlank()) {
            val session = sessions.findByTokenHashAndExpiresAtAfter(sha256(sessionToken), Instant.now())
            if (session != null) {
                val user = users.findById(session.userId).orElse(null)
                if (user != null) {
                    if (Duration.between(session.lastUsedAt, Instant.now()) >= Duration.ofHours(6)) {
                        session.lastUsedAt = Instant.now()
                    }
                    return authenticated(user)
                }
            }
        }
        parseUuid(properties.devFakeUser)?.let { codersId ->
            return authenticated(getOrCreateUser(codersId))
        }
        return null
    }

    @Transactional
    fun getOrCreateUser(codersId: UUID, displayName: String? = null): UserEntity {
        val existing = users.findByCodersId(codersId)
        if (existing != null) {
            existing.lastSeenAt = Instant.now()
            if (!displayName.isNullOrBlank() && properties.authMode != "standalone") {
                existing.displayName = cleanText(displayName, 64)
            }
            return existing
        }
        val fallbackName = displayName?.takeIf { it.isNotBlank() }?.let { cleanText(it, 64) } ?: ""
        return users.saveAndFlush(
            UserEntity(
                codersId = codersId,
                displayName = fallbackName,
                referralCode = codersId.toString().replace("-", "").take(12).uppercase(),
            ),
        )
    }

    fun requirePrincipal(authentication: Authentication?): MorrowPrincipal {
        return authentication?.principal as? MorrowPrincipal
            ?: throw ApiException(401, "로그인이 필요해요")
    }

    private fun authenticated(user: UserEntity) =
        UsernamePasswordAuthenticationToken.authenticated(MorrowPrincipal(user.codersId, user.id), null, emptyList())
}

fun sha256(value: String): String = MessageDigest.getInstance("SHA-256")
    .digest(value.toByteArray(StandardCharsets.UTF_8))
    .joinToString("") { "%02x".format(it) }

fun parseUuid(value: String?): UUID? = runCatching { UUID.fromString(value?.trim()) }.getOrNull()

fun cleanText(value: String, maxLength: Int): String = value.trim().split(Regex("\\s+")).joinToString(" ").take(maxLength)

class ApiException(val status: Int, override val message: String) : RuntimeException(message)
