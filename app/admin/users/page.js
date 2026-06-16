import { getServerSession } from "next-auth";
import Link from "next/link";
import { authOptions } from "../../../lib/auth";
import { isAdminUser } from "../../../lib/admin";
import { addUserActivity, getUserDisplayName, sortUsers } from "../../../lib/adminData";
import { prisma } from "../../../lib/prisma";

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

export default async function AdminUsersPage({ searchParams }) {
  const session = await getServerSession(authOptions);
  const sort = (await searchParams)?.sort === "joined" ? "joined" : "recent";

  if (!session?.user || !isAdminUser(session.user)) {
    return (
      <main className="admin-page">
        <section className="admin-card narrow">
          <img className="brand-icon small" src="/nabime-icon.svg" alt="" aria-hidden="true" />
          <h1>접근할 수 없습니다</h1>
          <p>관리자 계정으로 로그인해야 사용자 목록을 볼 수 있습니다.</p>
          <Link className="secondary-link" href="/admin">
            관리자 페이지로
          </Link>
        </section>
      </main>
    );
  }

  const [memos, likes, comments] = await Promise.all([
    prisma.memo.findMany({
      select: {
        ownerEmail: true,
        ownerName: true,
        createdAt: true,
        updatedAt: true,
      },
    }),
    prisma.memoLike.findMany({
      select: {
        userEmail: true,
        userName: true,
        createdAt: true,
      },
    }),
    prisma.memoComment.findMany({
      select: {
        userEmail: true,
        userName: true,
        createdAt: true,
      },
    }),
  ]);

  const users = new Map();

  memos.forEach((memo) => {
    addUserActivity(users, {
      email: memo.ownerEmail,
      name: memo.ownerName,
      joinedAt: memo.createdAt,
      activeAt: memo.updatedAt,
      memoCount: 1,
    });
  });

  likes.forEach((like) => {
    addUserActivity(users, {
      email: like.userEmail,
      name: like.userName,
      joinedAt: like.createdAt,
      activeAt: like.createdAt,
      likeCount: 1,
    });
  });

  comments.forEach((comment) => {
    addUserActivity(users, {
      email: comment.userEmail,
      name: comment.userName,
      joinedAt: comment.createdAt,
      activeAt: comment.createdAt,
      commentCount: 1,
    });
  });

  const userList = sortUsers(users, sort);

  return (
    <main className="admin-page">
      <header className="admin-header">
        <div className="brand-lockup">
          <img className="brand-icon" src="/nabime-icon.svg" alt="" aria-hidden="true" />
          <div>
            <p className="eyebrow">Nabime 운영</p>
            <h1>사용자 목록</h1>
          </div>
        </div>
        <Link className="secondary-link" href="/admin">
          관리자 홈
        </Link>
      </header>

      <section className="admin-card">
        <div className="admin-section-title">
          <h2>전체 사용자</h2>
          <div className="admin-tabs" aria-label="사용자 정렬">
            <Link className={sort === "recent" ? "active" : ""} href="/admin/users?sort=recent">
              최근 활동순
            </Link>
            <Link className={sort === "joined" ? "active" : ""} href="/admin/users?sort=joined">
              가입 시간순
            </Link>
          </div>
        </div>

        <div className="admin-table">
          <div className="admin-table-head">
            <span>사용자</span>
            <span>메모</span>
            <span>하트</span>
            <span>댓글</span>
            <span>가입 추정</span>
            <span>최근 활동</span>
          </div>
          {userList.length ? (
            userList.map((user) => (
              <Link className="admin-table-row" href={`/admin/users/${encodeURIComponent(user.email)}`} key={user.email}>
                <span>
                  <strong>{getUserDisplayName({ name: user.name, email: user.email })}</strong>
                  <small>{user.email}</small>
                </span>
                <span>{user.memoCount}</span>
                <span>{user.likeCount}</span>
                <span>{user.commentCount}</span>
                <span>{formatDate(user.joinedAt)}</span>
                <span>{formatDate(user.activeAt)}</span>
              </Link>
            ))
          ) : (
            <p className="admin-empty">아직 사용자가 없습니다.</p>
          )}
        </div>
      </section>
    </main>
  );
}
