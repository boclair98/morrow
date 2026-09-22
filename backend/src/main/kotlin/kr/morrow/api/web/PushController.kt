package kr.morrow.api.web

import jakarta.validation.Valid
import jakarta.validation.constraints.Size
import kr.morrow.api.service.IdentityService
import kr.morrow.api.service.WebPushService
import org.springframework.security.core.Authentication
import org.springframework.validation.annotation.Validated
import org.springframework.web.bind.annotation.DeleteMapping
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.PostMapping
import org.springframework.web.bind.annotation.RequestBody
import org.springframework.web.bind.annotation.RequestParam
import org.springframework.web.bind.annotation.RestController

@RestController
@Validated
class PushController(
    private val identity: IdentityService,
    private val push: WebPushService,
) {
    @GetMapping("/api/push/config")
    fun config() = mapOf("public_key" to push.publicKey())

    @PostMapping("/api/push/subscription")
    fun subscribe(
        authentication: Authentication?,
        @Valid @RequestBody body: PushSubscriptionRequest,
    ): Map<String, String> {
        push.subscribe(identity.requirePrincipal(authentication).userId, body)
        return mapOf("status" to "subscribed")
    }

    @DeleteMapping("/api/push/subscription")
    fun unsubscribe(
        authentication: Authentication?,
        @RequestParam @Size(max = 2048) endpoint: String,
    ): Map<String, String> {
        push.unsubscribe(identity.requirePrincipal(authentication).userId, endpoint)
        return mapOf("status" to "unsubscribed")
    }
}
