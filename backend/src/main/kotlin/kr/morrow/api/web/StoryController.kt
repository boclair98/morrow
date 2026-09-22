package kr.morrow.api.web

import jakarta.validation.Valid
import kr.morrow.api.service.IdentityService
import kr.morrow.api.service.StoryService
import org.springframework.http.CacheControl
import org.springframework.http.HttpHeaders
import org.springframework.http.HttpStatus
import org.springframework.http.MediaType
import org.springframework.http.ResponseEntity
import org.springframework.security.core.Authentication
import org.springframework.web.bind.annotation.DeleteMapping
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.PathVariable
import org.springframework.web.bind.annotation.PostMapping
import org.springframework.web.bind.annotation.RequestBody
import org.springframework.web.bind.annotation.RequestParam
import org.springframework.web.bind.annotation.RestController
import java.time.Duration
import java.util.UUID

@RestController
class StoryController(
    private val identity: IdentityService,
    private val stories: StoryService,
) {
    @GetMapping("/api/stories")
    fun feed(authentication: Authentication?, @RequestParam(defaultValue = "60") limit: Int) =
        stories.feed(identity.requirePrincipal(authentication).userId, limit.coerceIn(1, 60))

    @GetMapping("/api/stories/mine")
    fun mine(authentication: Authentication?, @RequestParam(defaultValue = "20") limit: Int) =
        stories.mine(identity.requirePrincipal(authentication).userId, limit.coerceIn(1, 30))

    @PostMapping("/api/stories")
    fun create(
        authentication: Authentication?,
        @Valid @RequestBody body: StoryRequest,
    ): ResponseEntity<Map<String, Any?>> = ResponseEntity.status(HttpStatus.CREATED).body(
        stories.create(identity.requirePrincipal(authentication).userId, body),
    )

    @PostMapping("/api/stories/{storyId}/reaction")
    fun react(authentication: Authentication?, @PathVariable storyId: UUID) =
        stories.react(identity.requirePrincipal(authentication).userId, storyId)

    @DeleteMapping("/api/stories/{storyId}")
    fun delete(authentication: Authentication?, @PathVariable storyId: UUID) =
        stories.delete(identity.requirePrincipal(authentication).userId, storyId)

    @GetMapping("/api/stories/{storyId}/media")
    fun content(authentication: Authentication?, @PathVariable storyId: UUID): ResponseEntity<ByteArray> {
        val item = stories.content(identity.requirePrincipal(authentication).userId, storyId)
        return ResponseEntity.ok()
            .contentType(MediaType.parseMediaType(item.contentType))
            .cacheControl(CacheControl.maxAge(Duration.ofMinutes(10)).cachePrivate())
            .header(HttpHeaders.CONTENT_DISPOSITION, "inline")
            .header(HttpHeaders.VARY, "Cookie")
            .eTag("\"${item.etag}\"")
            .body(item.bytes)
    }
}
