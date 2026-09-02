package kr.morrow.api.web

import jakarta.validation.Valid
import kr.morrow.api.service.IdentityService
import kr.morrow.api.service.PhotoService
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
import org.springframework.web.bind.annotation.RestController
import java.time.Duration
import java.util.UUID

@RestController
class PhotoController(private val identity: IdentityService, private val photos: PhotoService) {
    @GetMapping("/api/profile/photos")
    fun list(authentication: Authentication?) = photos.list(identity.requirePrincipal(authentication).userId)

    @PostMapping("/api/profile/photos")
    fun add(authentication: Authentication?, @Valid @RequestBody body: PhotoRequest): ResponseEntity<Map<String, Any?>> =
        ResponseEntity.status(HttpStatus.CREATED).body(photos.add(identity.requirePrincipal(authentication).userId, body))

    @PostMapping("/api/profile/photos/{photoId}/primary")
    fun primary(authentication: Authentication?, @PathVariable photoId: UUID) =
        photos.primary(identity.requirePrincipal(authentication).userId, photoId)

    @DeleteMapping("/api/profile/photos/{photoId}")
    fun delete(authentication: Authentication?, @PathVariable photoId: UUID) =
        photos.delete(identity.requirePrincipal(authentication).userId, photoId)

    @GetMapping("/api/photos/{photoId}")
    fun content(authentication: Authentication?, @PathVariable photoId: UUID): ResponseEntity<ByteArray> {
        val item = photos.content(identity.requirePrincipal(authentication).userId, photoId)
        return ResponseEntity.ok()
            .contentType(MediaType.parseMediaType(item.contentType))
            .cacheControl(CacheControl.maxAge(Duration.ofHours(1)).cachePrivate())
            .header(HttpHeaders.CONTENT_DISPOSITION, "inline")
            .eTag("\"${item.etag}\"")
            .header(HttpHeaders.VARY, "Cookie")
            .body(item.bytes)
    }
}
