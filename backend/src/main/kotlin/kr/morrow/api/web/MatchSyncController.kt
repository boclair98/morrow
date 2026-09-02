package kr.morrow.api.web

import jakarta.validation.Valid
import kr.morrow.api.service.IdentityService
import kr.morrow.api.service.MatchSyncService
import org.springframework.security.core.Authentication
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.PathVariable
import org.springframework.web.bind.annotation.PostMapping
import org.springframework.web.bind.annotation.RequestBody
import org.springframework.web.bind.annotation.RestController
import java.util.UUID

@RestController
class MatchSyncController(private val identity: IdentityService, private val sync: MatchSyncService) {
    @GetMapping("/api/matches/{matchId}/sync")
    fun get(authentication: Authentication?, @PathVariable matchId: UUID) = sync.get(identity.requirePrincipal(authentication).userId, matchId)

    @PostMapping("/api/matches/{matchId}/sync/start")
    fun start(authentication: Authentication?, @PathVariable matchId: UUID) = sync.start(identity.requirePrincipal(authentication).userId, matchId)

    @PostMapping("/api/matches/{matchId}/sync/answers")
    fun answer(authentication: Authentication?, @PathVariable matchId: UUID, @Valid @RequestBody body: SyncAnswerRequest) =
        sync.answer(identity.requirePrincipal(authentication).userId, matchId, body)
}
