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
data class MessageRequest(
    @field:Size(max = 500) val body: String = "",
    val clientId: UUID? = null,
    @field:Size(max = 4_000_000) val attachmentDataUrl: String? = null,
)
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
data class StoryRequest(
    @field:Size(max = 240) val body: String = "",
    @field:Size(max = 4_000_000) val photoDataUrl: String? = null,
)
data class PushSubscriptionRequest(
    @field:NotBlank @field:Size(max = 2048) val endpoint: String,
    @field:NotBlank @field:Size(max = 512) val p256dh: String,
    @field:NotBlank @field:Size(max = 256) val auth: String,
)
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
    private fun centered(center: Pair<Double, Double>, vararg names: String): Map<String, Pair<Double, Double>?> =
        names.associateWith { center }

    /**
     * Nationwide catalog used for server-side validation and distance hints.
     * "전국" and "기타" deliberately have no center, so they opt out of the
     * approximate radius calculation without exposing a precise home location.
     */
    val areaCenters: Map<String, Pair<Double, Double>?> = buildMap {
        put("전국", null)
        put("기타", null)
        putAll(centered(37.5665 to 126.9780,
            "서울", "서울 · 종로구", "서울 · 중구", "서울 · 서대문구", "서울 · 동대문구", "서울 · 성북구",
            "서울 · 강북구", "서울 · 도봉구", "서울 · 노원구", "서울 · 은평구"))
        putAll(centered(37.5172 to 127.0473, "강남", "서울 · 강남구"))
        putAll(centered(37.4837 to 127.0324, "서울 · 서초구"))
        putAll(centered(37.5145 to 127.1059, "잠실", "서울 · 송파구"))
        putAll(centered(37.5663 to 126.9014, "서울 · 마포구"))
        putAll(centered(37.5627 to 126.9220, "연남"))
        putAll(centered(37.5560 to 126.9014, "망원"))
        putAll(centered(37.5598 to 126.9425, "신촌"))
        putAll(centered(37.5326 to 126.9907, "한남", "서울 · 용산구"))
        putAll(centered(37.5660 to 126.9910, "을지로"))
        putAll(centered(37.5446 to 127.0559, "성수", "서울 · 성동구"))
        putAll(centered(37.5385 to 127.0823, "서울 · 광진구"))
        putAll(centered(37.5264 to 126.8963, "서울 · 영등포구"))
        putAll(centered(37.5219 to 126.9245, "여의도"))
        putAll(centered(37.5124 to 126.9393, "서울 · 동작구"))
        putAll(centered(37.4784 to 126.9516, "서울 · 관악구"))
        putAll(centered(37.5509 to 126.8495, "서울 · 강서구"))
        putAll(centered(37.5169 to 126.8666, "서울 · 양천구"))
        putAll(centered(37.4955 to 126.8874, "서울 · 구로구"))
        putAll(centered(37.4569 to 126.8955, "서울 · 금천구"))
        putAll(centered(37.6063 to 127.0927, "서울 · 중랑구"))
        // 부산·대구·인천
        putAll(centered(35.1796 to 129.0756, "부산", "부산 · 중구", "부산 · 부산진구"))
        putAll(centered(35.1631 to 129.1635, "부산 · 해운대구"))
        putAll(centered(35.1459 to 129.1132, "부산 · 수영구"))
        putAll(centered(35.1366 to 129.0842, "부산 · 남구"))
        putAll(centered(35.2050 to 129.0830, "부산 · 동래구"))
        putAll(centered(35.8714 to 128.6014, "대구", "대구 · 중구"))
        putAll(centered(35.8580 to 128.6307, "대구 · 수성구"))
        putAll(centered(35.8298 to 128.5327, "대구 · 달서구"))
        putAll(centered(37.4563 to 126.7052, "인천"))
        putAll(centered(37.4100 to 126.6783, "인천 · 연수구"))
        putAll(centered(37.4473 to 126.7313, "인천 · 남동구"))
        putAll(centered(37.5070 to 126.7219, "인천 · 부평구"))
        putAll(centered(37.5454 to 126.6759, "인천 · 서구"))
        // 광주·대전·울산·세종
        putAll(centered(35.1595 to 126.8526, "광주", "광주 · 서구", "광주 · 북구", "광주 · 광산구"))
        putAll(centered(36.3504 to 127.3845, "대전", "대전 · 서구"))
        putAll(centered(36.3623 to 127.3560, "대전 · 유성구"))
        putAll(centered(35.5384 to 129.3114, "울산", "울산 · 남구", "울산 · 중구"))
        putAll(centered(36.4800 to 127.2890, "세종"))
        // 경기
        putAll(centered(37.2411 to 127.1776, "경기", "용인", "경기 · 용인시"))
        putAll(centered(37.2636 to 127.0286, "수원", "경기 · 수원시"))
        putAll(centered(37.4200 to 127.1265, "성남", "경기 · 성남시"))
        putAll(centered(37.6584 to 126.8320, "고양", "경기 · 고양시"))
        putAll(centered(37.1995 to 126.8312, "경기 · 화성시"))
        putAll(centered(37.5034 to 126.7660, "경기 · 부천시"))
        putAll(centered(37.3943 to 126.9568, "경기 · 안양시"))
        putAll(centered(37.3219 to 126.8309, "경기 · 안산시"))
        putAll(centered(36.9921 to 127.1129, "경기 · 평택시"))
        putAll(centered(37.7381 to 127.0337, "경기 · 의정부시"))
        putAll(centered(37.6360 to 127.2165, "경기 · 남양주시"))
        putAll(centered(37.7604 to 126.7800, "경기 · 파주시"))
        putAll(centered(37.6153 to 126.7158, "경기 · 김포시"))
        putAll(centered(37.4292 to 127.2551, "경기 · 광주시"))
        putAll(centered(37.5393 to 127.2148, "경기 · 하남시"))
        putAll(centered(37.3800 to 126.8030, "경기 · 시흥시"))
        putAll(centered(37.4786 to 126.8644, "경기 · 광명시"))
        putAll(centered(37.3617 to 126.9352, "경기 · 군포시"))
        putAll(centered(37.1498 to 127.0772, "경기 · 오산시"))
        putAll(centered(37.2720 to 127.4348, "경기 · 이천시"))
        putAll(centered(37.7853 to 127.0458, "경기 · 양주시"))
        putAll(centered(37.5943 to 127.1295, "경기 · 구리시"))
        putAll(centered(37.8949 to 127.2003, "경기 · 포천시"))
        putAll(centered(37.2983 to 127.6374, "경기 · 여주시"))
        // 강원·충청
        putAll(centered(37.8228 to 128.1555, "강원"))
        putAll(centered(37.8813 to 127.7298, "강원 · 춘천시"))
        putAll(centered(37.3422 to 127.9202, "강원 · 원주시"))
        putAll(centered(37.7519 to 128.8761, "강원 · 강릉시"))
        putAll(centered(38.2070 to 128.5918, "강원 · 속초시"))
        putAll(centered(36.6357 to 127.4917, "충북"))
        putAll(centered(36.6424 to 127.4890, "충북 · 청주시"))
        putAll(centered(36.9910 to 127.9259, "충북 · 충주시"))
        putAll(centered(37.1326 to 128.1910, "충북 · 제천시"))
        putAll(centered(36.5184 to 126.8000, "충남"))
        putAll(centered(36.8151 to 127.1139, "충남 · 천안시"))
        putAll(centered(36.7898 to 127.0049, "충남 · 아산시"))
        putAll(centered(36.4465 to 127.1190, "충남 · 공주시"))
        putAll(centered(36.7845 to 126.4503, "충남 · 서산시"))
        putAll(centered(36.8898 to 126.6460, "충남 · 당진시"))
        // 전라
        putAll(centered(35.7175 to 127.1530, "전북"))
        putAll(centered(35.8242 to 127.1480, "전북 · 전주시"))
        putAll(centered(35.9676 to 126.7369, "전북 · 군산시"))
        putAll(centered(35.9483 to 126.9577, "전북 · 익산시"))
        putAll(centered(35.5699 to 126.8558, "전북 · 정읍시"))
        putAll(centered(35.4164 to 127.3904, "전북 · 남원시"))
        putAll(centered(34.8679 to 126.7270, "전남"))
        putAll(centered(34.8118 to 126.3922, "전남 · 목포시"))
        putAll(centered(34.7604 to 127.6622, "전남 · 여수시"))
        putAll(centered(34.9506 to 127.4875, "전남 · 순천시"))
        putAll(centered(35.0150 to 126.7108, "전남 · 나주시"))
        putAll(centered(34.9407 to 127.6959, "전남 · 광양시"))
        // 경상·제주
        putAll(centered(36.5760 to 128.5056, "경북"))
        putAll(centered(36.0190 to 129.3435, "경북 · 포항시"))
        putAll(centered(35.8562 to 129.2247, "경북 · 경주시"))
        putAll(centered(36.1195 to 128.3446, "경북 · 구미시"))
        putAll(centered(36.5684 to 128.7294, "경북 · 안동시"))
        putAll(centered(36.1398 to 128.1136, "경북 · 김천시"))
        putAll(centered(35.8251 to 128.7415, "경북 · 경산시"))
        putAll(centered(36.8057 to 128.6240, "경북 · 영주시"))
        putAll(centered(35.2279 to 128.6811, "경남", "창원", "경남 · 창원시"))
        putAll(centered(35.2285 to 128.8894, "경남 · 김해시"))
        putAll(centered(35.1800 to 128.1076, "경남 · 진주시"))
        putAll(centered(35.3350 to 129.0370, "경남 · 양산시"))
        putAll(centered(34.8806 to 128.6211, "경남 · 거제시"))
        putAll(centered(34.8544 to 128.4330, "경남 · 통영시"))
        putAll(centered(33.4996 to 126.5312, "제주", "제주 · 제주시"))
        putAll(centered(33.2541 to 126.5601, "제주 · 서귀포시"))
    }
    val interests = setOf("카페", "전시", "맛집", "산책", "러닝", "영화", "음악", "여행", "독서", "요리", "반려동물", "운동")
    val availability = setOf("평일 저녁", "금요일 밤", "토요일 낮", "토요일 저녁", "일요일 낮", "일요일 저녁")
}

