package kr.morrow.api.config

import org.springframework.boot.context.properties.ConfigurationProperties
import java.net.URI
import java.util.UUID

@ConfigurationProperties("morrow")
data class MorrowProperties(
    val publicAppUrl: String = "https://morrow.coders.kr",
    val authMode: String = "standalone",
    val sessionCookieName: String = "morrow_session",
    val sessionDays: Long = 30,
    val realtimeRedisEnabled: Boolean = true,
    val devFakeUser: String = "",
    val adminCodersIds: String = "",
    val kakaoClientId: String = "",
    val kakaoClientSecret: String = "",
    val kakaoRedirectUri: String = "",
    val naverClientId: String = "",
    val naverClientSecret: String = "",
    val naverRedirectUri: String = "",
    val googleClientId: String = "",
    val googleClientSecret: String = "",
    val googleRedirectUri: String = "",
    val turnstileSiteKey: String = "",
    val turnstileSecretKey: String = "",
    val kakaoMapRestKey: String = "",
    val kakaoMapJsKey: String = "",
    val storageBucket: String = "",
    val storageRegion: String = "auto",
    val storageS3Endpoint: String = "",
    val storageAccessKey: String = "",
    val storageSecretKey: String = "",
    val storagePublicUrl: String = "",
    val pushVapidPublicKey: String = "",
    val pushVapidPrivateKey: String = "",
    val pushVapidSubject: String = "mailto:hello@morrow.coders.kr",
) {
    val secureCookies: Boolean
        get() = runCatching { URI(publicAppUrl).scheme == "https" }.getOrDefault(true)

    val admins: Set<UUID>
        get() = adminCodersIds.split(',').mapNotNull { runCatching { UUID.fromString(it.trim()) }.getOrNull() }.toSet()
}

object LegalVersions {
    const val TERMS = "2026-08-20"
    const val PRIVACY = "2026-08-20"
}
