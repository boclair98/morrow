package kr.morrow.api.web

import jakarta.validation.constraints.Size
import kr.morrow.api.config.MorrowProperties
import kr.morrow.api.service.ApiException
import kr.morrow.api.service.IdentityService
import kr.morrow.api.service.UserService
import org.springframework.security.core.Authentication
import org.springframework.validation.annotation.Validated
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.RequestParam
import org.springframework.web.bind.annotation.RestController
import org.springframework.web.client.RestClient

@RestController
@Validated
class PlaceController(
    private val identity: IdentityService,
    private val users: UserService,
    private val properties: MorrowProperties,
    restClientBuilder: RestClient.Builder,
) {
    private val client = restClientBuilder.build()

    @GetMapping("/api/places/search")
    fun search(
        authentication: Authentication?,
        @RequestParam("q") @Size(min = 2, max = 60) rawQuery: String,
    ): Map<String, Any> {
        users.current(identity.requirePrincipal(authentication).userId)
        val key = properties.kakaoMapRestKey.ifBlank { properties.kakaoClientId }
        if (key.isBlank()) throw ApiException(503, "장소 검색이 아직 설정되지 않았어요")
        val query = rawQuery.trim().split(Regex("\\s+")).joinToString(" ")
        val payload = runCatching {
            client.get().uri { builder -> builder.scheme("https").host("dapi.kakao.com").path("/v2/local/search/keyword.json")
                .queryParam("query", query).queryParam("size", 10).queryParam("sort", "accuracy").build() }
                .header("Authorization", "KakaoAK $key").retrieve().body(Map::class.java)
        }.getOrElse { throw ApiException(503, "장소 검색에 잠시 연결할 수 없어요") } ?: emptyMap<Any, Any>()
        val documents = payload["documents"] as? List<*> ?: emptyList<Any>()
        val items = documents.take(10).mapNotNull { item ->
            val place = item as? Map<*, *> ?: return@mapNotNull null
            mapOf(
                "id" to place["id"].toString().take(32), "name" to place["place_name"].toString().take(100),
                "category" to place["category_name"].toString().take(160), "phone" to place["phone"].toString().take(32),
                "address" to (place["road_address_name"]?.toString()?.takeIf { it.isNotBlank() } ?: place["address_name"].toString()).take(160),
                "place_url" to place["place_url"].toString().take(500),
                "longitude" to (place["x"]?.toString()?.toDoubleOrNull() ?: 0.0),
                "latitude" to (place["y"]?.toString()?.toDoubleOrNull() ?: 0.0),
            )
        }
        return mapOf("items" to items, "query" to query)
    }
}
