package kr.morrow.api

import jakarta.validation.Validation
import kr.morrow.api.service.safeOAuthReturnTo
import kr.morrow.api.service.sha256
import kr.morrow.api.web.DatingOptions
import kr.morrow.api.web.ProfileDetailsRequest
import org.junit.jupiter.api.TestInstance
import org.springframework.boot.test.context.SpringBootTest
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertTrue

class ApiContractTest {
    private val validator = Validation.buildDefaultValidatorFactory().validator

    @Test
    fun `valid production profile satisfies the API contract`() {
        val profile = ProfileDetailsRequest(
            displayName = "모로우",
            age = 27,
            gender = "woman",
            seeking = "man",
            area = "성수",
            job = "디자이너",
            bio = "천천히 대화하며 서로를 알아가고 싶어요.",
            dateStyle = "카페와 산책",
            interests = listOf("카페", "전시", "산책"),
            availability = listOf("토요일 낮"),
        )
        assertTrue(validator.validate(profile).isEmpty())
        assertTrue(profile.area in DatingOptions.areaCenters)
        assertTrue(DatingOptions.interests.containsAll(profile.interests))
    }

    @Test
    fun `underage and malformed social preferences are rejected`() {
        val profile = ProfileDetailsRequest(
            displayName = "x",
            age = 19,
            gender = "unknown",
            seeking = "unknown",
            area = "성수",
            job = "학생",
            bio = "충분히 긴 자기소개를 작성했습니다.",
            dateStyle = "산책",
            interests = listOf("카페", "전시", "산책"),
            availability = listOf("토요일 낮"),
        )
        assertTrue(validator.validate(profile).size >= 3)
    }

    @Test
    fun `oauth return path cannot escape the public origin`() {
        assertEquals("/", safeOAuthReturnTo("https://evil.example/steal"))
        assertEquals("/", safeOAuthReturnTo("//evil.example/steal"))
        assertEquals("/matches", safeOAuthReturnTo("/matches"))
    }

    @Test
    fun `session tokens are stored as stable sha256 digests`() {
        assertEquals(64, sha256("secret-session").length)
        assertEquals(sha256("secret-session"), sha256("secret-session"))
    }
}

@SpringBootTest(
    properties = [
        "spring.datasource.url=jdbc:h2:mem:morrow;MODE=PostgreSQL;DB_CLOSE_DELAY=-1",
        "spring.datasource.driver-class-name=org.h2.Driver",
        "spring.jpa.hibernate.ddl-auto=create-drop",
        "spring.main.lazy-initialization=false",
        "spring.data.jpa.repositories.bootstrap-mode=default",
        "spring.flyway.enabled=false",
        "spring.data.redis.repositories.enabled=false",
        "morrow.realtime-redis-enabled=false",
        "morrow.dev-fake-user=00000000-0000-0000-0000-000000000001",
    ],
)
@TestInstance(TestInstance.Lifecycle.PER_CLASS)
class ApplicationContextTest {
    @Test
    fun `spring security jpa websocket and controllers start together`() = Unit
}
