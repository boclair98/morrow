package kr.morrow.api.web

import jakarta.validation.Valid
import jakarta.validation.constraints.Max
import jakarta.validation.constraints.Min
import jakarta.validation.constraints.Size
import kr.morrow.api.service.DatingService
import kr.morrow.api.service.ApiException
import kr.morrow.api.service.IdentityService
import kr.morrow.api.service.NotificationService
import kr.morrow.api.service.UserService
import org.springframework.http.HttpStatus
import org.springframework.jdbc.core.JdbcTemplate
import org.springframework.security.core.Authentication
import org.springframework.validation.annotation.Validated
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.DeleteMapping
import org.springframework.web.bind.annotation.PatchMapping
import org.springframework.web.bind.annotation.PathVariable
import org.springframework.web.bind.annotation.PostMapping
import org.springframework.web.bind.annotation.PutMapping
import org.springframework.web.bind.annotation.RequestBody
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.RequestParam
import org.springframework.web.bind.annotation.ResponseStatus
import org.springframework.web.bind.annotation.RestController
import java.util.UUID

@RestController
@Validated
class ApiController(
    private val identity: IdentityService,
    private val users: UserService,
    private val dating: DatingService,
    private val notifications: NotificationService,
    private val jdbc: JdbcTemplate,
) {
    @GetMapping("/api/health/live")
    fun live() = mapOf("status" to "ok", "runtime" to "spring-boot-kotlin")

    @GetMapping("/api/health")
    fun health(): Map<String, String> {
        jdbc.queryForObject("select 1", Int::class.java)
        val requiredTables = setOf("users", "messages", "saved_profiles")
        val existingTables = jdbc.query(
            """
            select lower(table_name)
            from information_schema.tables
            where lower(table_schema) = 'public'
              and lower(table_name) in ('users', 'messages', 'saved_profiles')
            """.trimIndent(),
        ) { result, _ -> result.getString(1) }.toSet()
        if (!existingTables.containsAll(requiredTables)) {
            throw ApiException(503, "데이터베이스 마이그레이션이 아직 완료되지 않았어요")
        }
        return mapOf("status" to "ok", "database" to "postgresql", "persistence" to "jpa")
    }

    @GetMapping("/api/me")
    fun me(authentication: Authentication?) = users.me(identity.requirePrincipal(authentication).userId)

    @PutMapping("/api/profile")
    fun profile(
        authentication: Authentication?,
        @Valid @RequestBody body: ProfileRequest,
    ) = dating.saveProfile(identity.requirePrincipal(authentication).userId, body)

    @PatchMapping("/api/profile")
    fun updateProfile(
        authentication: Authentication?,
        @Valid @RequestBody body: ProfileDetailsRequest,
    ) = dating.updateProfile(identity.requirePrincipal(authentication).userId, body)

    @GetMapping("/api/discover")
    fun discover(
        authentication: Authentication?,
        @RequestParam(defaultValue = "8") @Min(1) @Max(20) limit: Int,
        @RequestParam(required = false) @Size(max = 32) area: String?,
        @RequestParam(required = false) @Min(20) @Max(49) minAge: Int?,
        @RequestParam(required = false) @Min(20) @Max(49) maxAge: Int?,
        @RequestParam(required = false) @Size(max = 32) availability: String?,
        @RequestParam(required = false) @Size(max = 32) interest: String?,
        @RequestParam(defaultValue = "false") photoOnly: Boolean,
    ) = dating.discover(identity.requirePrincipal(authentication).userId, limit, area, minAge, maxAge, availability, interest, photoOnly)

    @GetMapping("/api/saved-profiles")
    fun savedProfiles(
        authentication: Authentication?,
        @RequestParam(defaultValue = "50") @Min(1) @Max(50) limit: Int,
    ) = dating.savedProfiles(identity.requirePrincipal(authentication).userId, limit)

    @PostMapping("/api/saved-profiles/{targetId}")
    fun saveProfileForLater(authentication: Authentication?, @PathVariable targetId: UUID) =
        dating.saveProfileForLater(identity.requirePrincipal(authentication).userId, targetId)

    @DeleteMapping("/api/saved-profiles/{targetId}")
    fun removeSavedProfile(authentication: Authentication?, @PathVariable targetId: UUID) =
        dating.removeSavedProfile(identity.requirePrincipal(authentication).userId, targetId)

    @PostMapping("/api/swipes")
    fun swipe(authentication: Authentication?, @Valid @RequestBody body: SwipeRequest) =
        dating.swipe(identity.requirePrincipal(authentication).userId, body)

    @GetMapping("/api/matches")
    fun matches(
        authentication: Authentication?,
        @RequestParam(defaultValue = "30") @Min(1) @Max(50) limit: Int,
    ) = dating.matches(identity.requirePrincipal(authentication).userId, limit)

    @GetMapping("/api/matches/{matchId}/messages")
    fun messages(
        authentication: Authentication?,
        @PathVariable matchId: UUID,
        @RequestParam(defaultValue = "40") @Min(1) @Max(50) limit: Int,
    ) = dating.messages(identity.requirePrincipal(authentication).userId, matchId, limit)

    @PostMapping("/api/matches/{matchId}/messages")
    @ResponseStatus(HttpStatus.CREATED)
    fun sendMessage(
        authentication: Authentication?,
        @PathVariable matchId: UUID,
        @Valid @RequestBody body: MessageRequest,
    ) = dating.sendMessage(identity.requirePrincipal(authentication).userId, matchId, body)

    @PostMapping("/api/matches/{matchId}/read")
    fun read(authentication: Authentication?, @PathVariable matchId: UUID) =
        dating.markRead(identity.requirePrincipal(authentication).userId, matchId)

    @GetMapping("/api/matches/{matchId}/plans")
    fun plans(authentication: Authentication?, @PathVariable matchId: UUID) =
        dating.listPlans(identity.requirePrincipal(authentication).userId, matchId)

    @PostMapping("/api/matches/{matchId}/plans")
    @ResponseStatus(HttpStatus.CREATED)
    fun createPlan(
        authentication: Authentication?,
        @PathVariable matchId: UUID,
        @Valid @RequestBody body: DatePlanRequest,
    ) = dating.createPlan(identity.requirePrincipal(authentication).userId, matchId, body)

    @PostMapping("/api/matches/{matchId}/plans/{planId}/respond")
    fun respondPlan(
        authentication: Authentication?,
        @PathVariable matchId: UUID,
        @PathVariable planId: UUID,
        @Valid @RequestBody body: DatePlanResponseRequest,
    ) = dating.respondPlan(identity.requirePrincipal(authentication).userId, matchId, planId, body)

    @PostMapping("/api/matches/{matchId}/plans/{planId}/safe")
    fun safe(
        authentication: Authentication?,
        @PathVariable matchId: UUID,
        @PathVariable planId: UUID,
    ) = dating.confirmSafe(identity.requirePrincipal(authentication).userId, matchId, planId)

    @PostMapping("/api/matches/{matchId}/plans/{planId}/feedback")
    @ResponseStatus(HttpStatus.CREATED)
    fun feedback(
        authentication: Authentication?,
        @PathVariable matchId: UUID,
        @PathVariable planId: UUID,
        @Valid @RequestBody body: DateFeedbackRequest,
    ) = dating.feedback(identity.requirePrincipal(authentication).userId, matchId, planId, body)

    @PostMapping("/api/matches/{matchId}/close")
    fun close(
        authentication: Authentication?,
        @PathVariable matchId: UUID,
        @Valid @RequestBody body: CloseMatchRequest,
    ) = dating.close(identity.requirePrincipal(authentication).userId, matchId, body.reason)

    @PostMapping("/api/safety/block")
    fun block(authentication: Authentication?, @RequestBody body: SafetyRequest) =
        dating.block(identity.requirePrincipal(authentication).userId, body.userId)

    @PostMapping("/api/safety/report")
    @ResponseStatus(HttpStatus.CREATED)
    fun report(authentication: Authentication?, @Valid @RequestBody body: ReportRequest) =
        dating.report(identity.requirePrincipal(authentication).userId, body)

    @GetMapping("/api/notifications")
    fun notifications(
        authentication: Authentication?,
        @RequestParam(defaultValue = "30") @Min(1) @Max(50) limit: Int,
    ) = notifications.list(identity.requirePrincipal(authentication).userId, limit)

    @PostMapping("/api/notifications/{id}/read")
    fun readNotification(authentication: Authentication?, @PathVariable id: UUID): Map<String, String> {
        notifications.read(identity.requirePrincipal(authentication).userId, id)
        return mapOf("status" to "ok")
    }

    @PostMapping("/api/notifications/read-all")
    fun readAll(authentication: Authentication?) = mapOf(
        "status" to "ok",
        "count" to notifications.readAll(identity.requirePrincipal(authentication).userId),
    )
}

