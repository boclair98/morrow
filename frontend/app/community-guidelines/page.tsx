import { LegalLayout } from "@/components/LegalLayout";


export const metadata = { title: "커뮤니티 가이드 — MORROW", description: "MORROW 안전 커뮤니티 가이드" };

export default function CommunityGuidelinesPage() {
  return <LegalLayout eyebrow="COMMUNITY SAFETY" title="커뮤니티 가이드" updated="2026년 8월 22일"><Section title="서로의 동의를 먼저 확인합니다"><p>대화, 연락처 교환, 사진 요청과 실제 만남은 언제나 상대방의 명확한 동의를 전제로 합니다. 거절하거나 답하지 않는 선택을 존중해주세요.</p></Section><Section title="실제 나와 정확한 정보를 사용합니다"><p>본인의 최근 사진과 사실에 맞는 프로필을 사용해야 합니다. 타인 사칭, 연애·혼인 상태 은폐, 나이 허위 입력과 과도하게 왜곡된 사진은 제재 대상입니다.</p></Section><Section title="금전과 거래를 요구하지 않습니다"><p>송금, 투자, 코인, 상품 구매, 대출, 인증번호 또는 계정 정보를 요구하면 즉시 대화를 중단하고 신고해주세요.</p></Section><Section title="괴롭힘과 불법 콘텐츠를 허용하지 않습니다"><p>혐오·협박·스토킹·성희롱, 동의 없는 성적 콘텐츠, 불법 촬영물, 미성년자 관련 성적 콘텐츠는 즉시 제한되며 필요한 경우 관계 기관에 신고될 수 있습니다.</p></Section><Section title="첫 만남은 안전하게 진행합니다"><p>사람이 많은 공개 장소에서 만나고 지인에게 시간과 장소를 공유하세요. 이동 수단과 귀가 계획을 스스로 통제하고 술이나 음료를 방치하지 마세요.</p></Section><Section title="신고 처리"><p>추천 프로필과 매치 대화에서 신고할 수 있습니다. 신고자는 상대방에게 공개되지 않으며 운영자는 맥락과 반복 여부를 확인해 기각, 경고, 일시 정지, 영구 제한 또는 콘텐츠 비공개 조치를 할 수 있습니다.</p></Section></LegalLayout>;
}

function Section({ title, children }: { title: string; children: React.ReactNode }) { return <section><h2>{title}</h2>{children}</section>; }
