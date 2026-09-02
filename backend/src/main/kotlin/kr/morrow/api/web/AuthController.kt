package kr.morrow.api.web

import jakarta.servlet.http.HttpServletRequest
import jakarta.validation.Valid
import jakarta.validation.constraints.Size
import kr.morrow.api.config.MorrowProperties
import kr.morrow.api.service.ApiException
import kr.morrow.api.service.AuthService
import org.springframework.http.CacheControl
import org.springframework.http.HttpHeaders
import org.springframework.http.HttpStatus
import org.springframework.http.ResponseCookie
import org.springframework.http.ResponseEntity
import org.springframework.web.bind.annotation.CookieValue
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.PathVariable
import org.springframework.web.bind.annotation.PostMapping
import org.springframework.web.bind.annotation.RequestBody
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.RequestParam
import org.springframework.web.bind.annotation.RestController
import java.net.URI
import java.time.Duration

data class OAuthStartRequest(
    @field:Size(max = 2048) val turnstileToken: String = "",
    @field:Size(max = 200) val returnTo: String = "/",
)

@RestController
@RequestMapping("/api/auth")
class AuthController(
    private val auth: AuthService,
    private val properties: MorrowProperties,
) {
    @GetMapping("/providers")
    fun providers(): ResponseEntity<Map<String, Any?>> = ResponseEntity.ok()
        .cacheControl(CacheControl.maxAge(Duration.ofMinutes(5)).cachePublic().staleWhileRevalidate(Duration.ofDays(7)))
        .body(auth.publicConfiguration())

    @PostMapping("/{provider}/start")
    fun start(
        @PathVariable provider: String,
        @Valid @RequestBody body: OAuthStartRequest,
        request: HttpServletRequest,
    ): ResponseEntity<Map<String, String>> {
        val remoteIp = request.getHeader("X-Forwarded-For")?.substringBefore(',')?.trim()
        val result = auth.start(provider, body.turnstileToken, body.returnTo, remoteIp)
        return ResponseEntity.ok()
            .header(HttpHeaders.SET_COOKIE, cookie("morrow_oauth_state", result.state, Duration.ofMinutes(10), "/api/auth").toString())
            .header(HttpHeaders.SET_COOKIE, cookie("morrow_oauth_return_to", result.returnTo, Duration.ofMinutes(10), "/api/auth").toString())
            .body(mapOf("authorization_url" to result.authorizationUrl))
    }

    @GetMapping("/{provider}/callback")
    fun callback(
        @PathVariable provider: String,
        @RequestParam(required = false) code: String?,
        @RequestParam(required = false) state: String?,
        @RequestParam(required = false) error: String?,
        @CookieValue(name = "morrow_oauth_state", required = false) cookieState: String?,
        @CookieValue(name = "morrow_oauth_return_to", required = false) returnTo: String?,
    ): ResponseEntity<Void> {
        if (error != null) return callbackError("cancelled")
        return try {
            val result = auth.callback(provider, code, state, cookieState, returnTo)
            val separator = if ('?' in result.returnTo) '&' else '?'
            val location = URI("${properties.publicAppUrl.trimEnd('/')}${result.returnTo}${separator}auth=success")
            ResponseEntity.status(HttpStatus.SEE_OTHER).location(location)
                .header(HttpHeaders.SET_COOKIE, cookie(properties.sessionCookieName, result.sessionToken, Duration.ofDays(properties.sessionDays), "/").toString())
                .header(HttpHeaders.SET_COOKIE, clearCookie("morrow_oauth_state", "/api/auth").toString())
                .header(HttpHeaders.SET_COOKIE, clearCookie("morrow_oauth_return_to", "/api/auth").toString())
                .build()
        } catch (failure: ApiException) {
            callbackError(if (failure.status == 409) "account_conflict" else failure.message.takeIf { it in setOf("expired", "configuration") } ?: "provider")
        }
    }

    @PostMapping("/logout")
    fun logout(request: HttpServletRequest): ResponseEntity<Void> {
        val session = request.cookies?.firstOrNull { it.name == properties.sessionCookieName }?.value
        auth.logout(session)
        return ResponseEntity.noContent().header(HttpHeaders.SET_COOKIE, clearCookie(properties.sessionCookieName, "/").toString()).build()
    }

    private fun callbackError(code: String): ResponseEntity<Void> = ResponseEntity.status(HttpStatus.SEE_OTHER)
        .location(URI("${properties.publicAppUrl.trimEnd('/')}/login?auth_error=$code"))
        .header(HttpHeaders.SET_COOKIE, clearCookie("morrow_oauth_state", "/api/auth").toString())
        .header(HttpHeaders.SET_COOKIE, clearCookie("morrow_oauth_return_to", "/api/auth").toString())
        .build()

    private fun cookie(name: String, value: String, maxAge: Duration, path: String): ResponseCookie = ResponseCookie.from(name, value)
        .httpOnly(true).secure(properties.secureCookies).sameSite("Lax").path(path).maxAge(maxAge).build()

    private fun clearCookie(name: String, path: String): ResponseCookie = ResponseCookie.from(name, "")
        .httpOnly(true).secure(properties.secureCookies).sameSite("Lax").path(path).maxAge(Duration.ZERO).build()
}
