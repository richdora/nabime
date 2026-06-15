import { getServerSession } from "next-auth";
import Link from "next/link";
import SharedMemoGate from "../../../components/SharedMemoGate";
import { authOptions } from "../../../lib/auth";
import { toClientMemo } from "../../../lib/memoMapper";
import { prisma } from "../../../lib/prisma";

export const dynamic = "force-dynamic";

export default async function SharedMemoPage({ params }) {
  const { id } = await params;
  const session = await getServerSession(authOptions);
  const memoRecord = await prisma.memo.findUnique({
    where: { id },
  });

  if (!memoRecord) {
    return (
      <main className="shared-view">
        <section className="shared-shell">
          <header className="shared-header">
            <p className="eyebrow">Shared memo</p>
            <h1>Nabime</h1>
          </header>
          <article className="shared-card single">
            <div className="shared-content">
              <h2>메모를 찾을 수 없습니다</h2>
              <p className="lock-message">공유 링크가 잘못되었거나 메모가 삭제되었습니다.</p>
              <Link className="primary-link" href="/">
                Nabime로 돌아가기
              </Link>
            </div>
          </article>
        </section>
      </main>
    );
  }

  const isOwner = isMemoOwner(memoRecord, session?.user);
  const memo = toClientMemo(memoRecord);
  const publicMemo = isOwner ? memo : { ...memo, body: "" };

  return (
    <main className="shared-view">
      <section className="shared-shell">
        <header className="shared-header">
          <p className="eyebrow">Shared memo</p>
          <h1>Nabime</h1>
        </header>

        <article className={`shared-card ${memo.photo?.dataUrl ? "" : "single"}`}>
          {memo.photo?.dataUrl ? (
            <img className="shared-image" src={memo.photo.dataUrl} alt="공유된 메모 사진" />
          ) : null}
          <div className="shared-content">
            <h2>{memo.title}</h2>
            <SharedMemoGate memo={publicMemo} isOwner={isOwner} />
          </div>
        </article>
      </section>
    </main>
  );
}

function isMemoOwner(memo, user) {
  if (!memo || !user) return false;

  const userId = user.id || user.email;
  return memo.ownerId === userId || memo.ownerEmail === user.email;
}
