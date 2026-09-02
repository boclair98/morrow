import { LegalLayout } from "@/components/LegalLayout";


export const metadata = { title: "계정 삭제 안내 — MORROW", description: "MORROW 계정과 데이터 삭제 방법" };

export default function AccountDeletionPage() {
  return <LegalLayout eyebrow="ACCOUNT DELETION" title="계정 및 데이터 삭제" updated="2026년 8월 22일"><section><h2>앱에서 즉시 삭제하기</h2><ol><li>MORROW에 로그인합니다.</li><li><strong>내 프로필 → 개인정보와 계정</strong>으로 이동합니다.</li><li><strong>계정 영구 삭제</strong>를 누르고 확인 문구를 입력합니다.</li></ol><p>삭제가 완료되면 프로필, 사진, 좋아요·패스, 매치, 메시지, 약속, 알림과 앱 설정이 삭제됩니다.</p></section><section><h2>로그인할 수 없는 경우</h2><p>안전센터를 통해 계정 식별에 필요한 최소 정보와 삭제 요청을 접수해주세요. 본인 확인 후 처리하며, 타인의 계정은 삭제할 수 없습니다. 정식 고객지원 연락처는 운영자 정보 확정 후 본 페이지와 스토어 데이터 삭제 항목에 동일하게 등록됩니다.</p></section><section><h2>법적 보존 정보</h2><p>관계 법령 또는 분쟁·부정 이용 방지를 위해 반드시 보존해야 하는 최소 기록이 있다면 서비스 데이터와 분리해 정해진 기간 동안만 보호하고, 목적이 끝나면 삭제합니다.</p></section></LegalLayout>;
}
