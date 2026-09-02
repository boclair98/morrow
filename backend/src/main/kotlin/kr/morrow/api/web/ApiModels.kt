package kr.morrow.api.web

import jakarta.validation.constraints.Max
import jakarta.validation.constraints.Min
import jakarta.validation.constraints.NotBlank
import jakarta.validation.constraints.Pattern
import jakarta.validation.constraints.Size
import java.time.Instant
import java.util.UUID

data class ProfileDetailsRequest(
    @field:NotBlank @field:Size(max = 20) val displayName: String,
    @field:Min(20) @field:Max(49) val age: Int,
    @field:Pattern(regexp = "woman|man|other") val gender: String,
    @field:Pattern(regexp = "woman|man|all") val seeking: String,
    @field:Size(max = 32) val area: String,
    @field:NotBlank @field:Size(max = 48) val job: String,
    @field:Size(min = 10, max = 240) val bio: String,
    @field:NotBlank @field:Size(max = 32) val dateStyle: String,
    @field:Size(min = 3, max = 6) val interests: List<String>,
    @field:Size(min = 1, max = 4) val availability: List<String>,
    @field:Min(20) @field:Max(49) val minPreferredAge: Int = 20,
    @field:Min(20) @field:Max(49) val maxPreferredAge: Int = 39,
    @field:Min(3) @field:Max(200) val maxDistanceKm: Int = 30,
)

data class ProfileRequest(
    @field:NotBlank @field:Size(max = 20) val displayName: String,
    @field:Min(20) @field:Max(49) val age: Int,
    @field:Pattern(regexp = "woman|man|other") val gender: String,
    @field:Pattern(regexp = "woman|man|all") val seeking: String,
    @field:Size(max = 32) val area: String,
    @field:NotBlank @field:Size(max = 48) val job: String,
    @field:Size(min = 10, max = 240) val bio: String,
    @field:NotBlank @field:Size(max = 32) val dateStyle: String,
    @field:Size(min = 3, max = 6) val interests: List<String>,
    @field:Size(min = 1, max = 4) val availability: List<String>,
    @field:Min(20) @field:Max(49) val minPreferredAge: Int = 20,
    @field:Min(20) @field:Max(49) val maxPreferredAge: Int = 39,
    @field:Min(3) @field:Max(200) val maxDistanceKm: Int = 30,
    @field:Size(max = 12) val referralCode: String? = null,
    val termsAgreed: Boolean,
    val privacyAgreed: Boolean,
    val adultConfirmed: Boolean,
    val marketingOptIn: Boolean = false,
) {
    fun details() = ProfileDetailsRequest(
        displayName,
        age,
        gender,
        seeking,
        area,
        job,
        bio,
        dateStyle,
        interests,
        availability,
        minPreferredAge,
        maxPreferredAge,
        maxDistanceKm,
    )
}

data class SwipeRequest(val targetId: UUID, @field:Pattern(regexp = "like|pass") val decision: String)
data class MessageRequest(@field:NotBlank @field:Size(max = 500) val body: String, val clientId: UUID? = null)
data class CloseMatchRequest(@field:Pattern(regexp = "not_fit|need_time|met_someone|uncomfortable|other") val reason: String)
data class SafetyRequest(val userId: UUID)
data class ReportRequest(
    val userId: UUID,
    @field:Pattern(regexp = "fake_profile|harassment|money_request|no_show|married|other") val category: String,
    @field:Size(max = 500) val detail: String = "",
    val block: Boolean = true,
)

data class DatePlanRequest(
    @field:Size(min = 2, max = 80) val title: String,
    @field:Size(max = 32) val area: String,
    val scheduledFor: Instant,
    @field:Size(max = 240) val note: String = "",
    @field:Size(max = 32) val placeId: String? = null,
    @field:Size(max = 100) val placeName: String? = null,
    @field:Size(max = 500) val placeUrl: String? = null,
    @field:Size(max = 160) val roadAddress: String? = null,
    @field:Min(-180) @field:Max(180) val longitude: Double? = null,
    @field:Min(-90) @field:Max(90) val latitude: Double? = null,
)
data class DatePlanResponseRequest(@field:Pattern(regexp = "accepted|declined") val status: String)
data class DateFeedbackRequest(
    val attended: Boolean,
    val feltSafe: Boolean,
    val wouldMeetAgain: Boolean,
    @field:Size(max = 500) val note: String = "",
)

data class ConsentRequest(
    val termsAgreed: Boolean,
    val privacyAgreed: Boolean,
    val adultConfirmed: Boolean,
    val marketingOptIn: Boolean = false,
)

data class AccountSettingsRequest(
    val discoverable: Boolean? = null,
    val marketingOptIn: Boolean? = null,
    val notifyMatches: Boolean? = null,
    val notifyMessages: Boolean? = null,
    val notifyDates: Boolean? = null,
    @field:Min(20) @field:Max(49) val minPreferredAge: Int? = null,
    @field:Min(20) @field:Max(49) val maxPreferredAge: Int? = null,
    @field:Min(5) @field:Max(300) val maxDistanceKm: Int? = null,
)

data class DeleteAccountRequest(val confirmation: String)
data class VerificationRequestBody(@field:Size(max = 240) val note: String = "")
data class ReferralRequest(@field:Size(min = 8, max = 12) val code: String)
data class PhotoRequest(@field:Size(min = 32, max = 4_000_000) val dataUrl: String, val isPublic: Boolean = true)
data class SyncAnswerRequest(@field:Min(0) @field:Max(2) val round: Int, @field:Size(min = 1, max = 180) val answer: String)
data class ResolveReportRequest(
    @field:Pattern(regexp = "dismiss|warn|suspend_7d|ban") val resolution: String,
    @field:Size(max = 500) val note: String = "",
)
data class ModeratePhotoRequest(
    @field:Pattern(regexp = "approved|rejected") val decision: String,
    @field:Size(max = 240) val reason: String = "",
)
data class ReviewVerificationRequest(
    @field:Pattern(regexp = "approved|rejected") val decision: String,
    @field:Size(max = 500) val note: String = "",
)

object DatingOptions {
    val areaCenters: Map<String, Pair<Double, Double>?> = mapOf(
        "성수" to (37.5446 to 127.0559), "연남" to (37.5627 to 126.9220),
        "강남" to (37.4979 to 127.0276), "잠실" to (37.5133 to 127.1001),
        "한남" to (37.5346 to 127.0005), "을지로" to (37.5660 to 126.9910),
        "망원" to (37.5560 to 126.9014), "신촌" to (37.5598 to 126.9425),
        "여의도" to (37.5219 to 126.9245), "인천" to (37.4563 to 126.7052),
        "수원" to (37.2636 to 127.0286), "성남" to (37.4200 to 127.1265),
        "고양" to (37.6584 to 126.8320), "용인" to (37.2411 to 127.1776),
        "대전" to (36.3504 to 127.3845), "세종" to (36.4800 to 127.2890),
        "부산" to (35.1796 to 129.0756), "대구" to (35.8714 to 128.6014),
        "광주" to (35.1595 to 126.8526), "울산" to (35.5384 to 129.3114),
        "창원" to (35.2279 to 128.6811), "제주" to (33.4996 to 126.5312), "기타" to null,
    )
    val interests = setOf("카페", "전시", "맛집", "산책", "러닝", "영화", "음악", "여행", "독서", "요리", "반려동물", "운동")
    val availability = setOf("평일 저녁", "금요일 밤", "토요일 낮", "토요일 저녁", "일요일 낮", "일요일 저녁")
}
