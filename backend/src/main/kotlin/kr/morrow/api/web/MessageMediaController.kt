package kr.morrow.api.web

import kr.morrow.api.service.DatingService
import kr.morrow.api.service.IdentityService
import org.springframework.http.CacheControl
import org.springframework.http.HttpHeaders
import org.springframework.http.MediaType
import org.springframework.http.ResponseEntity
import org.springframework.security.core.Authentication
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.PathVariable
import org.springframework.web.bind.annotation.RestController
import java.time.Duration
import java.util.UUID

@RestController
class MessageMediaController(
    private val identity: IdentityService,
    private val dating: DatingService,
) {
    @GetMapping("/api/messages/{messageId}/media")
    fun content(authentication: Authentication?, @PathVariable messageId: UUID): ResponseEntity<ByteArray> {
        val item = dating.messageContent(identity.requirePrincipal(authentication).userId, messageId)
        return ResponseEntity.ok()
            .contentType(MediaType.parseMediaType(item.contentType))
            .cacheControl(CacheControl.maxAge(Duration.ofHours(1)).cachePrivate())
            .header(HttpHeaders.CONTENT_DISPOSITION, "inline")
            .header(HttpHeaders.VARY, "Cookie")
            .eTag("\"${item.etag}\"")
            .body(item.bytes)
    }
}

