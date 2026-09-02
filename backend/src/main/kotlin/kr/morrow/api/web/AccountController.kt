package kr.morrow.api.web

import jakarta.validation.Valid
import kr.morrow.api.service.AccountService
import kr.morrow.api.service.IdentityService
import org.springframework.http.CacheControl
import org.springframework.http.HttpHeaders
import org.springframework.http.MediaType
import org.springframework.http.ResponseEntity
import org.springframework.security.core.Authentication
import org.springframework.web.bind.annotation.DeleteMapping
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.PatchMapping
import org.springframework.web.bind.annotation.PostMapping
import org.springframework.web.bind.annotation.RequestBody
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.RestController

@RestController
@RequestMapping("/api/account")
class AccountController(private val identity: IdentityService, private val account: AccountService) {
    @PostMapping("/consents")
    fun consents(authentication: Authentication?, @RequestBody body: ConsentRequest) =
        account.consents(identity.requirePrincipal(authentication).userId, body)

    @GetMapping("/settings")
    fun settings(authentication: Authentication?) = account.settings(identity.requirePrincipal(authentication).userId)

    @PatchMapping("/settings")
    fun update(authentication: Authentication?, @Valid @RequestBody body: AccountSettingsRequest) =
        account.updateSettings(identity.requirePrincipal(authentication).userId, body)

    @GetMapping("/reports")
    fun reports(authentication: Authentication?) = account.reports(identity.requirePrincipal(authentication).userId)

    @GetMapping("/export")
    fun export(authentication: Authentication?): ResponseEntity<Map<String, Any?>> = ResponseEntity.ok()
        .contentType(MediaType.APPLICATION_JSON)
        .cacheControl(CacheControl.noStore())
        .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"morrow-account-data.json\"")
        .body(account.export(identity.requirePrincipal(authentication).userId))

    @DeleteMapping
    fun delete(authentication: Authentication?, @RequestBody body: DeleteAccountRequest) =
        account.delete(identity.requirePrincipal(authentication).userId, body.confirmation)
}

@RestController
class TrustGrowthController(private val identity: IdentityService, private val account: AccountService) {
    @GetMapping("/api/verification")
    fun verification(authentication: Authentication?) = account.verification(identity.requirePrincipal(authentication).userId)

    @PostMapping("/api/verification/request")
    fun requestVerification(authentication: Authentication?, @Valid @RequestBody body: VerificationRequestBody): ResponseEntity<Map<String, Any?>> =
        ResponseEntity.status(201).body(account.requestVerification(identity.requirePrincipal(authentication).userId, body.note))

    @GetMapping("/api/growth/referral")
    fun referral(authentication: Authentication?) = account.referral(identity.requirePrincipal(authentication).userId)

    @PostMapping("/api/growth/referral/redeem")
    fun redeem(authentication: Authentication?, @Valid @RequestBody body: ReferralRequest) =
        account.redeem(identity.requirePrincipal(authentication).userId, body.code)
}
