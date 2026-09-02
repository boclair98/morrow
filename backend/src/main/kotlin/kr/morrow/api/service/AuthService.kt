package kr.morrow.api.service

import kr.morrow.api.config.MorrowProperties
import kr.morrow.api.domain.AuthIdentityEntity
import kr.morrow.api.domain.AuthSessionEntity
import kr.morrow.api.domain.OAuthFlowEntity
import kr.morrow.api.domain.UserEntity
import kr.morrow.api.repository.AuthIdentityRepository
import kr.morrow.api.repository.AuthSessionRepository
import kr.morrow.api.repository.OAuthFlowRepository
import kr.morrow.api.repository.UserRepository
import org.springframework.dao.DataIntegrityViolationException
import org.springframework.http.MediaType
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional
import org.springframework.util.LinkedMultiValueMap
import org.springframework.web.client.RestClient
import org.springframework.web.util.UriComponentsBuilder
import java.nio.charset.StandardCharsets
import java.security.MessageDigest
import java.security.SecureRandom
import java.time.Duration
import java.time.Instant
import java.util.Base64
import java.util.UUID

data class ProviderConfig(val clientId: String, val clientSecret: String, val redirectUri: String)
data class ProviderProfile(val subject: String, val email: String?, val displayName: String?)
data class OAuthStartResult(val authorizationUrl: String, val state: String, val returnTo: String)
data class OAuthCallbackResult(val sessionToken: String, val returnTo: String)

@Service
class AuthService(
    private val properties: MorrowProperties,
    private val flows: OAuthFlowRepository,
    private val identities: AuthIdentityRepository,
    private val sessions: AuthSessionRepository,
    private val users: UserRepository,
    restClientBuilder: RestClient.Builder,
) {
    private val client = restClientBuilder.build()
    private val random = SecureRandom()
    private val supported = setOf("kakao", "naver", "google")

    fun publicConfiguration(): Map<String, Any?> = mapOf(
        "native" to properties.authMode.takeIf { it != "standalone" }?.let { "coders.kr" },
        "turnstile_required" to properties.turnstileSecretKey.isNotBlank(),
        "turnstile_site_key" to properties.turnstileSiteKey.ifBlank { null },
        "kakao_map_js_key" to properties.kakaoMapJsKey.ifBlank { null },
        "providers" to listOf("kakao" to "카카오", "naver" to "네이버", "google" to "Google").map { (id, label) ->
            val configured = providerConfig(id) != null
            mapOf("id" to id, "label" to label, "configured" to configured, "status" to if (configured) "active" else "planned")
        },
    )

    @Transactional
    fun start(provider: String, turnstileToken: String, returnTo: String, remoteIp: String?): OAuthStartResult {
        if (provider !in supported) throw ApiException(404, "지원하지 않는 로그인 방법이에요")
        val config = providerConfig(provider) ?: throw ApiException(503, "아직 설정되지 않은 로그인 방법이에요")
        verifyTurnstile(turnstileToken, remoteIp)
        val state = randomToken(40)
        val verifier = randomToken(64).takeIf { provider == "google" }
        val nonce = randomToken(32).takeIf { provider == "google" }
        flows.save(
            OAuthFlowEntity(
                provider = provider,
                stateHash = sha256(state),
                codeVerifier = verifier,
                nonce = nonce,
                expiresAt = Instant.now().plus(Duration.ofMinutes(10)),
            ),
        )
        return OAuthStartResult(authorizationUrl(provider, config, state, verifier, nonce), state, safeOAuthReturnTo(returnTo))
    }

    @Transactional
    fun callback(provider: String, code: String?, state: String?, cookieState: String?, returnTo: String?): OAuthCallbackResult {
        if (provider !in supported) throw ApiException(400, "unsupported")
        if (code.isNullOrBlank() || state.isNullOrBlank() || cookieState.isNullOrBlank() || !MessageDigest.isEqual(state.toByteArray(), cookieState.toByteArray())) {
            throw ApiException(400, "expired")
        }
        val flow = flows.findByStateHash(sha256(state)) ?: throw ApiException(400, "expired")
        if (flow.provider != provider || flow.usedAt != null || flow.expiresAt <= Instant.now()) throw ApiException(400, "expired")
        val config = providerConfig(provider) ?: throw ApiException(503, "configuration")
        flow.usedAt = Instant.now()
        val accessToken = exchangeCode(provider, config, code, flow, state)
        val profile = providerProfile(provider, accessToken)
        val user = resolveUser(provider, profile)
        val rawSession = randomToken(48)
        sessions.save(
            AuthSessionEntity(
                userId = user.id,
                tokenHash = sha256(rawSession),
                expiresAt = Instant.now().plus(Duration.ofDays(properties.sessionDays)),
            ),
        )
        return OAuthCallbackResult(rawSession, safeOAuthReturnTo(returnTo))
    }

    @Transactional
    fun logout(rawSession: String?) {
        if (!rawSession.isNullOrBlank()) sessions.findByTokenHash(sha256(rawSession))?.let(sessions::delete)
    }

    private fun providerConfig(provider: String): ProviderConfig? {
        val values = when (provider) {
            "kakao" -> listOf(properties.kakaoClientId, properties.kakaoClientSecret, properties.kakaoRedirectUri)
            "naver" -> listOf(properties.naverClientId, properties.naverClientSecret, properties.naverRedirectUri)
            "google" -> listOf(properties.googleClientId, properties.googleClientSecret, properties.googleRedirectUri)
            else -> return null
        }
        if (values.any { it.isBlank() }) return null
        return ProviderConfig(values[0], values[1], values[2])
    }

    private fun verifyTurnstile(token: String, remoteIp: String?) {
        if (properties.turnstileSecretKey.isBlank()) return
        if (token.isBlank()) throw ApiException(422, "사람인지 확인한 뒤 다시 시도해주세요")
        val form = LinkedMultiValueMap<String, String>().apply {
            add("secret", properties.turnstileSecretKey)
            add("response", token)
            remoteIp?.takeIf { it.isNotBlank() }?.let { add("remoteip", it) }
        }
        val result = runCatching {
            client.post().uri("https://challenges.cloudflare.com/turnstile/v0/siteverify")
                .contentType(MediaType.APPLICATION_FORM_URLENCODED).body(form).retrieve().body(Map::class.java)
        }.getOrElse { throw ApiException(503, "보안 확인 서비스에 잠시 연결할 수 없어요") }
        val success = result?.get("success") as? Boolean ?: false
        val hostname = result?.get("hostname")?.toString()
        val expected = runCatching { java.net.URI(properties.publicAppUrl).host }.getOrNull()
        if (!success || expected.isNullOrBlank() || hostname != expected) throw ApiException(403, "보안 확인이 만료됐어요. 다시 시도해주세요")
    }

    private fun authorizationUrl(provider: String, config: ProviderConfig, state: String, verifier: String?, nonce: String?): String {
        val builder = when (provider) {
            "kakao" -> UriComponentsBuilder.fromUriString("https://kauth.kakao.com/oauth/authorize")
                .queryParam("response_type", "code").queryParam("client_id", config.clientId)
                .queryParam("redirect_uri", config.redirectUri).queryParam("state", state)
            "naver" -> UriComponentsBuilder.fromUriString("https://nid.naver.com/oauth2.0/authorize")
                .queryParam("response_type", "code").queryParam("client_id", config.clientId)
                .queryParam("redirect_uri", config.redirectUri).queryParam("state", state)
            else -> {
                val challenge = Base64.getUrlEncoder().withoutPadding().encodeToString(MessageDigest.getInstance("SHA-256").digest((verifier ?: "").toByteArray()))
                UriComponentsBuilder.fromUriString("https://accounts.google.com/o/oauth2/v2/auth")
                    .queryParam("response_type", "code").queryParam("client_id", config.clientId)
                    .queryParam("redirect_uri", config.redirectUri).queryParam("scope", "openid email profile")
                    .queryParam("state", state).queryParam("nonce", nonce ?: "")
                    .queryParam("code_challenge", challenge).queryParam("code_challenge_method", "S256")
                    .queryParam("prompt", "select_account")
            }
        }
        return builder.build().encode().toUriString()
    }

    private fun exchangeCode(provider: String, config: ProviderConfig, code: String, flow: OAuthFlowEntity, state: String): String {
        val form = LinkedMultiValueMap<String, String>().apply {
            add("grant_type", "authorization_code")
            add("client_id", config.clientId)
            add("client_secret", config.clientSecret)
            add("code", code)
            when (provider) {
                "naver" -> add("state", state)
                "google" -> { add("redirect_uri", config.redirectUri); add("code_verifier", flow.codeVerifier ?: "") }
                else -> add("redirect_uri", config.redirectUri)
            }
        }
        val url = when (provider) {
            "kakao" -> "https://kauth.kakao.com/oauth/token"
            "naver" -> "https://nid.naver.com/oauth2.0/token"
            else -> "https://oauth2.googleapis.com/token"
        }
        val result = runCatching {
            client.post().uri(url).contentType(MediaType.APPLICATION_FORM_URLENCODED).body(form).retrieve().body(Map::class.java)
        }.getOrElse { throw ApiException(502, "로그인 제공사에 잠시 연결할 수 없어요") }
        return result?.get("access_token")?.toString()?.takeIf { it.isNotBlank() }
            ?: throw ApiException(502, "로그인 정보를 확인하지 못했어요")
    }

    private fun providerProfile(provider: String, accessToken: String): ProviderProfile {
        val url = when (provider) {
            "kakao" -> "https://kapi.kakao.com/v2/user/me"
            "naver" -> "https://openapi.naver.com/v1/nid/me"
            else -> "https://openidconnect.googleapis.com/v1/userinfo"
        }
        val payload = runCatching {
            client.get().uri(url).header("Authorization", "Bearer $accessToken").retrieve().body(Map::class.java)
        }.getOrElse { throw ApiException(502, "로그인 프로필을 확인하지 못했어요") } ?: emptyMap<Any, Any>()
        fun map(value: Any?): Map<*, *> = value as? Map<*, *> ?: emptyMap<Any, Any>()
        val (subject, email, displayName) = when (provider) {
            "kakao" -> {
                val account = map(payload["kakao_account"])
                val props = map(payload["properties"])
                Triple(payload["id"]?.toString(), account["email"]?.toString().takeIf { account["is_email_verified"] == true }, props["nickname"]?.toString())
            }
            "naver" -> {
                val profile = map(payload["response"])
                Triple(profile["id"]?.toString(), profile["email"]?.toString(), profile["nickname"]?.toString() ?: profile["name"]?.toString())
            }
            else -> Triple(payload["sub"]?.toString(), payload["email"]?.toString().takeIf { payload["email_verified"] == true }, payload["name"]?.toString())
        }
        val safeSubject = subject?.trim()?.takeIf { it.isNotBlank() && it.length <= 191 } ?: throw ApiException(502, "로그인 식별자가 올바르지 않아요")
        return ProviderProfile(safeSubject, email?.trim()?.lowercase(), displayName)
    }

    private fun resolveUser(provider: String, profile: ProviderProfile): UserEntity {
        identities.findByProviderAndProviderSubject(provider, profile.subject)?.let { identity ->
            identity.lastLoginAt = Instant.now()
            return users.findById(identity.userId).orElseThrow { ApiException(409, "로그인 계정을 복구할 수 없어요") }
        }
        if (profile.email != null && identities.existsByEmail(profile.email)) {
            throw ApiException(409, "같은 이메일로 가입된 계정이 있어요. 기존 로그인 방법을 이용해주세요")
        }
        try {
            val codersId = UUID.randomUUID()
            val user = users.saveAndFlush(
                UserEntity(
                    codersId = codersId,
                    displayName = profile.displayName?.let { cleanText(it, 64) } ?: "",
                    referralCode = codersId.toString().replace("-", "").take(12).uppercase(),
                ),
            )
            identities.saveAndFlush(AuthIdentityEntity(userId = user.id, provider = provider, providerSubject = profile.subject, email = profile.email))
            return user
        } catch (_: DataIntegrityViolationException) {
            throw ApiException(409, "같은 계정으로 가입된 사용자가 있어요. 다시 로그인해주세요")
        }
    }

    private fun randomToken(bytes: Int): String = ByteArray(bytes).also(random::nextBytes).let { Base64.getUrlEncoder().withoutPadding().encodeToString(it) }
}

fun safeOAuthReturnTo(value: String?): String {
    if (value.isNullOrBlank() || !value.startsWith('/') || value.startsWith("//") || '\\' in value) return "/"
    val uri = runCatching { java.net.URI(value) }.getOrNull() ?: return "/"
    return if (uri.isAbsolute || uri.host != null) "/" else value.take(200)
}
