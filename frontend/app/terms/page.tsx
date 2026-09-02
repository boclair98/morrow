import { LegalLayout } from "@/components/LegalLayout";


export const metadata = { title: "이용약관 — MORROW", description: "MORROW 서비스 이용약관" };

export default function TermsPage() {
  return <LegalLayout eyebrow="TERMS OF SERVICE" title="MORROW 이용약관" updated="2026년 8월 22일"><Section title="1. 목적과 적용"><p>이 약관은 MORROW가 제공하는 프로필 추천, 상호 관심 매칭, 대화, 약속 제안 및 안전 기능의 이용 조건을 정합니다. 회원은 가입 및 약관 동의 후 서비스를 이용할 수 있습니다.</p></Section><Section title="2. 이용 자격"><p>MORROW는 만 20세 이상만 이용할 수 있습니다. 회원은 정확한 나이와 본인 정보를 사용해야 하며 타인의 신원·사진을 도용하거나 혼인 여부 등 중요한 정보를 속여서는 안 됩니다.</p></Section><Section title="3. 계정과 보안"><p>회원은 자신의 로그인 수단을 안전하게 관리해야 합니다. 비정상 접근, 자동화 도구, 계정 양도·판매, 다중 계정을 이용한 제재 회피는 제한될 수 있습니다.</p></Section><Section title="4. 금지 행위"><ul><li>괴롭힘, 혐오, 협박, 성적 착취 또는 동의 없는 성적 콘텐츠</li><li>사칭, 허위 프로필, 불법 촬영물, 타인의 사진 무단 게시</li><li>송금·투자·가상자산·인증번호 요구, 상업적 권유와 사기</li><li>개인정보 수집, 스팸, 시스템 침해 또는 과도한 자동 요청</li><li>미성년자의 가입·접촉을 시도하는 행위</li></ul></Section><Section title="5. 콘텐츠와 안전 조치"><p>회원은 자신이 게시한 프로필, 사진과 메시지에 필요한 권리를 보유해야 합니다. MORROW는 신고 검토, 노출 제한, 콘텐츠 삭제, 일시 정지 또는 영구 제한 조치를 할 수 있으며 긴급한 안전 위험에는 관련 기관과 협조할 수 있습니다.</p></Section><Section title="6. 매칭과 만남"><p>추천 점수와 매칭은 만남의 성사, 상대방의 신원 또는 관계의 결과를 보증하지 않습니다. 첫 만남은 공개 장소를 이용하고 금전·연락처 공유는 충분한 대화 후 신중히 결정해야 합니다.</p></Section><Section title="7. 탈퇴와 데이터"><p>회원은 앱의 내 프로필·계정 설정에서 언제든 탈퇴할 수 있습니다. 탈퇴 시 계정과 프로필, 사진, 매치 및 메시지는 삭제되며 법령상 보존 의무가 있는 최소 기록은 해당 기간 동안 별도로 보호될 수 있습니다.</p></Section><Section title="8. 서비스 변경"><p>보안, 법령, 운영상 필요에 따라 기능이나 약관이 변경될 수 있습니다. 중요한 변경은 서비스 내 알림으로 안내하고 필요한 경우 다시 동의를 받습니다.</p></Section><Section title="9. 운영자 정보"><p>MORROW의 정식 사업자 상호·대표자·주소·연락처는 사업자 정보 확정 후 앱과 스토어 정보에 동일하게 고지됩니다. 출시 제출 전 반드시 실제 정보로 확정해야 합니다.</p></Section></LegalLayout>;
}

function Section({ title, children }: { title: string; children: React.ReactNode }) { return <section><h2>{title}</h2>{children}</section>; }
