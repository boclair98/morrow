import { LegalLayout } from "@/components/LegalLayout";


export const metadata = { title: "개인정보 처리방침 — MORROW", description: "MORROW 개인정보 처리방침" };

export default function PrivacyPage() {
  return <LegalLayout eyebrow="PRIVACY POLICY" title="개인정보 처리방침" updated="2026년 8월 22일"><Section title="1. 처리하는 정보"><ul><li>계정 식별자와 로그인 제공자 정보</li><li>회원이 입력한 이름, 나이, 성별, 관심 대상, 활동 지역, 직업, 소개, 관심사와 가능 시간</li><li>프로필 사진, 좋아요·패스, 매치, 메시지, 약속 제안</li><li>신고·차단 내역, 접속 시각, 요청 식별자와 보안 로그</li><li>선택한 알림 및 마케팅 수신 설정</li></ul></Section><Section title="2. 이용 목적"><p>본인 식별, 프로필 추천과 매칭, 실시간 대화, 약속 기능, 신고 처리, 사기·오남용 방지, 고객 문의, 장애 대응과 법적 의무 이행을 위해 필요한 범위에서 처리합니다.</p></Section><Section title="3. 보관 기간"><p>계정 정보와 회원 콘텐츠는 탈퇴 시까지 보관합니다. 탈퇴하면 서비스 데이터는 삭제하며, 분쟁 처리·부정 이용 방지 또는 관계 법령에 따라 보존해야 하는 기록은 목적과 기간을 분리해 최소한으로 보관합니다.</p></Section><Section title="4. 공개 범위"><p>프로필을 켜둔 회원의 표시 이름, 나이, 활동 지역, 직업, 소개, 관심사, 가능 시간과 공개 사진은 추천 대상 회원에게 표시됩니다. 정확한 위치, 연락처와 로그인 식별자는 상대방에게 공개하지 않습니다.</p></Section><Section title="5. 처리 위탁과 국외 이전"><p>호스팅, 데이터베이스, 콘텐츠 검수, 본인 인증, 알림 또는 고객지원을 외부 사업자에 맡기는 경우 업체명, 처리 항목, 국가와 보관 기간을 실제 계약에 맞춰 이 방침에 고지합니다. 현재 연결되지 않은 업체를 사용한다고 표시하지 않습니다.</p></Section><Section title="6. 회원의 권리"><p>앱에서 프로필과 알림 설정을 변경하고, 내 데이터 내려받기와 계정 삭제를 직접 실행할 수 있습니다. 신고·차단 기록 또는 추가 문의는 안전센터에서 접수할 수 있습니다.</p></Section><Section title="7. 안전 조치"><p>회원별 접근 권한, 매치 소유권 확인, 요청 속도 제한, 메시지 중복 방지, 사진 형식·용량 검증, 암호화된 통신과 운영자 권한 분리를 적용합니다. 보안 사고가 확인되면 관계 법령에 따른 통지와 대응을 진행합니다.</p></Section><Section title="8. 개인정보 보호책임자"><p>개인정보 보호책임자와 실제 연락처는 운영 법인 및 담당자 확정 후 앱·스토어·본 문서에 동일하게 고지합니다. 현재 권리 행사는 로그인 후 내 프로필의 안전센터와 계정 설정에서 접수할 수 있습니다.</p></Section><Section title="9. 변경 안내"><p>중요한 변경은 시행 전에 서비스 내에서 알리고, 수집 목적이나 선택 동의가 달라지는 경우 필요한 동의를 다시 받습니다.</p></Section></LegalLayout>;
}

function Section({ title, children }: { title: string; children: React.ReactNode }) { return <section><h2>{title}</h2>{children}</section>; }
