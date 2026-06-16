import { getServerSession } from "next-auth";
import Link from "next/link";
import AdminMemoVisibilityButton from "../../../../components/AdminMemoVisibilityButton";
import { authOptions } from "../../../../lib/auth";
import { isAdminUser } from "../../../../lib/admin";
import { formatMemoSerial, getUserDisplayName } from "../../../../lib/adminData";
import { prisma } from "../../../../lib/prisma";

function formatDate(value) {
  if (!value) return "-";

  return new Intl.DateTimeFormat("ko-KR", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(value);
}

function formatRange(meters) {
  const labels = {
    20: "20m",
    50: "50m",
    100: "100m",
    300: "300m",
    1000: "1km",
    10000: "10km",
    100000: "100km",
    500000: "500km",
  };

  return labels[meters] || "범위 없음";
}

export default async function AdminUserDetailPage({ params }) {
  const session = await getServerSession(authOptions);
  const email = decodeURIComponent((await params).email).toLowerCase();

  if (!session?.user || !isAdminUser(session.user)) {
    return (
      <main className="admin-page">
        <section className="admin-card narrow">
          <img className="brand-icon small" src="/nabime-icon.svg" alt="" aria-hidden="true" />
          <h1>접근할 수 없습니다</h1>
          <p>관리자 계정으로 로그인해야 사용자 정보를 볼 수 있습니다.</p>
          <Link className="secondary-link" href="/admin">
            관리자 페이지로
          </Link>
        </section>
      </main>
    );
  }

  const [memos, likes, comments] = await Promise.all([
    prisma.memo.findMany({
      where: {
        ownerEmail: email,
      },
      orderBy: {
        createdAt: "desc",
      },
      select: {
        id: true,
        photoName: true,
        latitude: true,
        longitude: true,
        rangeMeters: true,
        ownerEmail: true,
        ownerName: true,
        hiddenAt: true,
        hiddenReason: true,
        createdAt: true,
        updatedAt: true,
        _count: {
          select: {
            likes: true,
            comments: true,
          },
        },
      },
    }),
    prisma.memoLike.count({
      where: {
        userEmail: email,
      },
    }),
    prisma.memoComment.count({
      where: {
        userEmail: email,
      },
    }),
  ]);

  const profile = {
    email,
    name: memos[0]?.ownerName || null,
  };

  return (
    <main className="admin-page">
      <header className="admin-header">
        <div className="brand-lockup">
          <img className="brand-icon" src="/nabime-icon.svg" alt="" aria-hidden="true" />
          <div>
            <p className="eyebrow">사용자 관리</p>
            <h1>{getUserDisplayName(profile)}</h1>
          </div>
        </div>
        <Link className="secondary-link" href="/admin/users">
          사용자 목록
        </Link>
      </header>

      <section className="admin-stats" aria-label="사용자 활동 요약">
        <article>
          <span>작성 메모</span>
          <strong>{memos.length}개</strong>
        </article>
        <article>
          <span>숨김 메모</span>
          <strong>{memos.filter((memo) => memo.hiddenAt).length}개</strong>
        </article>
        <article>
          <span>누른 하트</span>
          <strong>♥ {likes}개</strong>
        </article>
        <article>
          <span>작성 댓글</span>
          <strong>{comments}개</strong>
        </article>
      </section>

      <section className="admin-card">
        <div className="admin-section-title">
          <div>
            <h2>작성한 메모</h2>
            <p className="admin-note">관리자 화면에서는 비밀메모 제목과 본문을 표시하지 않습니다.</p>
          </div>
          <span>{email}</span>
        </div>

        <div className="admin-list">
          {memos.length ? (
            memos.map((memo) => (
              <article className={`admin-list-item memo-admin-item${memo.hiddenAt ? " is-hidden" : ""}`} key={memo.id}>
                <div>
                  <strong>{formatMemoSerial(memo.id)}</strong>
                  <p>
                    {memo.photoName ? "사진 있음" : "사진 없음"} ·{" "}
                    {memo.latitude !== null && memo.longitude !== null ? "위치 있음" : "위치 없음"} ·{" "}
                    {formatRange(memo.rangeMeters)}
                  </p>
                </div>
                <div className="admin-meta">
                  <span>♥ {memo._count.likes}</span>
                  <span>댓글 {memo._count.comments}</span>
                  <span>{memo.hiddenAt ? "숨김됨" : "공개중"}</span>
                  <time>작성 {formatDate(memo.createdAt)}</time>
                  <time>수정 {formatDate(memo.updatedAt)}</time>
                </div>
                {memo.hiddenAt ? <p className="admin-note">숨김 사유: {memo.hiddenReason || "관리자 숨김 처리"}</p> : null}
                <AdminMemoVisibilityButton memoId={memo.id} initiallyHidden={Boolean(memo.hiddenAt)} />
              </article>
            ))
          ) : (
            <p className="admin-empty">이 사용자가 작성한 메모가 없습니다.</p>
          )}
        </div>
      </section>
    </main>
  );
}
