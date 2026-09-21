# MORROW 출시 체크리스트

코드는 실제 데이터로 동작하는 웹 출시 기반까지 구현되어 있습니다. 아래 항목은 서비스 소유자의 계정·법적 정보·외부 API 키가 있어야 완료할 수 있으므로 가짜 값으로 대체하지 않습니다.

## 1. 배포 즉시 확인

- `/api/health/live`가 `200`을 반환하는지 확인
- `/api/health`가 PostgreSQL 연결 포함 `200`을 반환하는지 확인
- 새 계정에서 필수 동의 → 프로필 → 사진 → 추천 순서 확인
- 두 실제 테스트 계정으로 상호 관심 → 채팅 → 약속 수락 → 읽음 확인
- 신고 계정과 `ADMIN_CODERS_IDS` 운영자 계정으로 처리 전 과정을 확인
- 데이터 내보내기와 `MORROW 탈퇴` 확인 문구를 사용한 영구 삭제 확인

## 2. 사용자가 제공해야 할 값

### 사업·법적 정보

- 정식 서비스 운영 상호, 대표자, 사업자등록번호
- 통신판매업 신고 정보가 필요한 경우 해당 번호
- 실제 주소, 고객지원 이메일, 개인정보 보호책임자와 연락처
- 데이터 보유·파기 기간, 국외 이전·처리 위탁 업체 목록

이 값은 `/terms`, `/privacy`, 스토어 등록 정보에 동일하게 반영해야 합니다. 현재 페이지의 출시 전 확정 안내는 실제 정보로 교체해야 합니다.

### 인증 API

- Kakao: `KAKAO_CLIENT_ID`, `KAKAO_CLIENT_SECRET`, `KAKAO_REDIRECT_URI`
- Kakao Map: `KAKAO_MAP_REST_KEY`, `NEXT_PUBLIC_KAKAO_MAP_JS_KEY` (use keys from the app carrying the free-quota badge)
- Naver: `NAVER_CLIENT_ID`, `NAVER_CLIENT_SECRET`, `NAVER_REDIRECT_URI`
- Google: `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REDIRECT_URI`
- Apple: `APPLE_CLIENT_ID`, `APPLE_TEAM_ID`, `APPLE_KEY_ID`와 private key secret
- 본인·휴대폰·성인 인증 공급자의 client ID/secret과 webhook secret (대규모 공개 모집 전; 현재는 소셜 계정 기반 수동 검토 큐 사용)

웹 OAuth는 `state`, Google PKCE, 일회성 흐름, 계정 충돌 방지, 해시 세션과 로그아웃 폐기까지 구현되어 standalone identity로 전환합니다. Apple 심사 대상 iOS 앱에서 다른 소셜 로그인을 제공하면 Sign in with Apple 요구사항도 함께 확인합니다.
Cloudflare Turnstile은 스크립트 로드 완료 후 명시적으로 렌더링하며, 토큰 준비 전 OAuth 버튼을 비활성화하고 만료·실패 시 재시도합니다. 공개 전 `morrow.coders.kr` hostname 등록, 실제 위젯 site/secret key 쌍, 카카오·네이버·Google 각각의 redirect URI를 두 개의 실제 테스트 계정으로 검증합니다.

### 운영·메시징 API

- FCM/APNs 프로젝트·앱 식별자·서명 키: 앱이 백그라운드일 때 푸시
- 사진/텍스트 안전 검수 API: 현재 운영자 수동 검수 큐의 자동 선별 단계
- 관리형 객체 스토리지/CDN: `coders.yaml`에 연결 완료, 사진 원본은 DB가 아닌 버킷에 저장
- 오류 추적·로그·지표 서비스의 DSN/API 키
- `ADMIN_CODERS_IDS`: 운영 콘솔을 사용할 실제 coders.kr 사용자 UUID 목록

## 3. 모바일 스토어 제출 전

- Apple Developer 및 Google Play Console 조직 계정
- 고유 bundle ID/application ID, 배포 인증서, 서명 키의 안전한 보관
- 웹을 그대로 포장한 단순 셸이 아니라 네이티브 알림·사진 선택·딥링크·안전 신고 흐름 검증
- iOS/Android 개인정보 라벨과 Data safety 문항을 실제 수집 항목에 맞게 작성
- 스토어에서 접근 가능한 개인정보 처리방침 및 계정 삭제 URL 등록
- 만 20세 이상 제한, 부적절 콘텐츠 신고·차단·운영 대응 정책 고지
- 심사용 테스트 계정과 운영자 연락처 준비
- 실제 기기에서 카메라 권한, 사진 권한, 키보드, safe area, 저속·오프라인·재연결 검증

## 4. 트래픽 확장 순서

1. 정적 웹은 CDN 캐시, API는 수평 확장하고 Postgres 연결 풀·slow query를 관찰합니다.
2. 사진은 현재 관리형 객체 저장소를 사용합니다. 다음 단계는 썸네일 비동기 생성과 업로드 URL 분리입니다.
3. API rate limit은 Redis로 여러 인스턴스에 공유됩니다. 현재 WebSocket은 단일 API 인스턴스에서 동작하므로 수평 확장 전에 Redis Pub/Sub 같은 fan-out 브로커와 연결 드레이닝을 추가합니다. 매치·신고의 DB 제한은 최종 방어선으로 유지합니다.
4. 알림·사진 검수·탈퇴 정리는 durable queue로 분리하고 재시도와 dead-letter를 둡니다.
5. 가입→프로필 완성→첫 관심→매치→첫 대화→약속 수락 퍼널을 익명 집계해 병목만 개선합니다.

## 5. 출시 중단 기준

- 실제 사업자·개인정보 책임자·지원 연락처가 확정되지 않음
- 본인·성인 확인 없이 대규모 공개 모집을 진행하려 함
- 신고 운영자가 없거나 긴급 신고 처리 시간을 정하지 않음
- 백업·복구 시험, 개인정보 삭제 검증, 장애 알림이 없음
- OAuth redirect URI 또는 모바일 서명이 검증되지 않음
