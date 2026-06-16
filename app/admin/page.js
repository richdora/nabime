import { getServerSession } from "next-auth";
import Link from "next/link";
import { authOptions } from "../../lib/auth";
import { isAdminUser } from "../../lib/admin";
import { prisma } from "../../lib/prisma";

function formatDate(value) {
  if (!value) return "";

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

export default async function AdminPage() {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    return (
      <main className="admin-page">
        <section className="admin-card narrow">
          <img className="brand-icon small" src="/nabime-icon.svg" alt="" aria-hidden="true" />
          <h1>관리자 페이지</h1>
          <p>관리자 페이지를 보려면 Google 로그인이 필요합니다.</p>
          <Link className="primary-link" href="/api/auth/signin?callbackUrl=/admin">
            Google 로그인
          </Link>
        </section>
      </main>
    );
  }

  if (!isAdminUser(session.user)) {
    return (
      <main className="admin-page">
        <section className="admin-card narrow">
          <img className="brand-icon small" src="/nabime-icon.svg" alt="" aria-hidden="true" />
          <h1>접근할 수 없습니다</h1>
          <p>현재 로그인한 계정은 Nabime 관리자 계정으로 등록되어 있지 않습니다.</p>
          <p className="admin-current-user">현재 로그인: {session.user.email}</p>
          <Link className="secondary-link" href="/">
            Nabime으로 돌아가기
          </Link>
        </section>
      </main>
    );
  }

  const [memoCount, likeCount, commentCount, recentMemos, recentComments] = await Promise.all([
    prisma.memo.count(),
    prisma.memoLike.count(),
    prisma.memoComment.count(),
    prisma.memo.findMany({
      orderBy: { createdAt: "desc" },
      take: 10,
      select: {
        id: true,
        title: true,
        ownerEmail: true,
        ownerName: true,
        rangeMeters: true,
        createdAt: true,
        _count: {
          select: {
            likes: true,
            comments: true,
          },
        },
      },
    }),
    prisma.memoComment.findMany({
      orderBy: { createdAt: "desc" },
      take: 10,
      select: {
        id: true,
        body: true,
        userEmail: true,
        userName: true,
        createdAt: true,
        memo: {
          select: {
            title: true,
            ownerEmail: true,
          },
        },
      },
    }),
  ]);

  const ownerCount = new Set(recentMemos.map((memo) => memo.ownerEmail)).size;

  return (
    <main className="admin-page">
      <header className="admin-header">
        <div className="brand-lockup">
          <img className="brand-icon" src="/nabime-icon.svg" alt="" aria-hidden="true" />
          <div>
            <p className="eyebrow">Nabime 운영</p>
            <h1>관리자 페이지</h1>
          </div>
        </div>
        <div className="admin-header-actions">
          <Link className="secondary-link" href="/admin/users">
            사용자 목록
          </Link>
          <Link className="secondary-link" href="/">
            메모 화면으로
          </Link>
        </div>
      </header>

      <section className="admin-stats" aria-label="서비스 현황">
        <article>
          <span>전체 메모</span>
          <strong>{memoCount}개</strong>
        </article>
        <article>
          <span>받은 하트</span>
          <strong>♥ {likeCount}개</strong>
        </article>
        <article>
          <span>댓글</span>
          <strong>{commentCount}개</strong>
        </article>
        <article>
          <span>최근 작성자</span>
          <strong>{ownerCount}명</strong>
        </article>
      </section>

      <section className="admin-grid">
        <div className="admin-card">
          <div className="admin-section-title">
            <h2>최근 메모</h2>
            <span>최근 10개</span>
          </div>
          <div className="admin-list">
            {recentMemos.length ? (
              recentMemos.map((memo) => (
                <article className="admin-list-item" key={memo.id}>
                  <div>
                    <strong>{memo.title || "제목 없는 메모"}</strong>
                    <p>{memo.ownerName || memo.ownerEmail}</p>
                  </div>
                  <div className="admin-meta">
                    <span>{formatRange(memo.rangeMeters)}</span>
                    <span>♥ {memo._count.likes}</span>
                    <span>댓글 {memo._count.comments}</span>
                    <time>{formatDate(memo.createdAt)}</time>
                  </div>
                </article>
              ))
            ) : (
              <p className="admin-empty">아직 메모가 없습니다.</p>
            )}
          </div>
        </div>

        <div className="admin-card">
          <div className="admin-section-title">
            <h2>최근 댓글</h2>
            <span>최근 10개</span>
          </div>
          <div className="admin-list">
            {recentComments.length ? (
              recentComments.map((comment) => (
                <article className="admin-list-item" key={comment.id}>
                  <div>
                    <strong>{comment.userName || comment.userEmail}</strong>
                    <p>{comment.body}</p>
                  </div>
                  <div className="admin-meta">
                    <span>{comment.memo.title}</span>
                    <span>주인 {comment.memo.ownerEmail.split("@")[0]}</span>
                    <time>{formatDate(comment.createdAt)}</time>
                  </div>
                </article>
              ))
            ) : (
              <p className="admin-empty">아직 댓글이 없습니다.</p>
            )}
          </div>
        </div>
      </section>
    </main>
  );
}
