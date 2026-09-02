package kr.morrow.api.web

import jakarta.validation.Valid
import kr.morrow.api.service.AdminService
import kr.morrow.api.service.IdentityService
import org.springframework.security.core.Authentication
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.PathVariable
import org.springframework.web.bind.annotation.PostMapping
import org.springframework.web.bind.annotation.RequestBody
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.RestController
import java.util.UUID

@RestController
@RequestMapping("/api/admin")
class AdminController(private val identity: IdentityService, private val admin: AdminService) {
    private fun codersId(auth: Authentication?) = identity.requirePrincipal(auth).codersId

    @GetMapping("/overview") fun overview(auth: Authentication?) = admin.overview(codersId(auth))
    @GetMapping("/reports") fun reports(auth: Authentication?) = admin.reports(codersId(auth))
    @PostMapping("/reports/{id}/resolve") fun resolve(auth: Authentication?, @PathVariable id: UUID, @Valid @RequestBody body: ResolveReportRequest) = admin.resolve(codersId(auth), id, body)
    @GetMapping("/photos") fun photos(auth: Authentication?) = admin.photos(codersId(auth))
    @PostMapping("/photos/{id}/moderate") fun moderate(auth: Authentication?, @PathVariable id: UUID, @Valid @RequestBody body: ModeratePhotoRequest) = admin.moderate(codersId(auth), id, body)
    @GetMapping("/verifications") fun verifications(auth: Authentication?) = admin.verifications(codersId(auth))
    @PostMapping("/verifications/{id}/review") fun review(auth: Authentication?, @PathVariable id: UUID, @Valid @RequestBody body: ReviewVerificationRequest) = admin.review(codersId(auth), id, body)
}
