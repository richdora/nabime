import { getServerSession } from "next-auth";
import Link from "next/link";
import SharedMemoGate from "../../../components/SharedMemoGate";
import { authOptions } from "../../../lib/auth";
import { toClientMemo } from "../../../lib/memoMapper";
import { prisma } from "../../../lib/prisma";
import { getMemoReactions } from "../../../lib/reactions";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }) {
  const { id } = await params;
  const memo = await prisma.memo.findUnique({
    where: { id },
  });

  if (!memo) {
    return {
      title: "Nabime",
      description: "공유된 비밀메모를 찾을 수 없습니다.",
    };
  }

  const senderName = getSenderName(memo);
  const title = `${senderName}님이 보낸 비밀메모`;
  const description = `나만의 비밀메모 Nabime에서 ${senderName}님이 보낸 비밀메모를 확인하세요!`;
  const baseUrl = getBaseUrl();
  const url = `${baseUrl}/shared/${encodeURIComponent(id)}`;
  const imageUrl = `${baseUrl}/api/memos/${encodeURIComponent(id)}/image`;

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      url,
      siteName: "Nabime",
      images: memo.photoDataUrl
        ? [
            {
              url: imageUrl,
              width: 1200,
              height: 900,
              alt: "Nabime 비밀메모 사진",
            },
          ]
        : [],
      type: "article",
    },
    twitter: {
      card: memo.photoDataUrl ? "summary_large_image" : "summary",
      title,
      description,
      images: memo.photoDataUrl ? [imageUrl] : [],
    },
  };
}

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
  const reactions = await getMemoReactions(prisma, memo.id, session?.user);
  const senderName = getSenderName(memo);

  return (
    <main className="shared-view">
      <section className="shared-shell">
        <header className="shared-header">
          <h1>Nabime</h1>
        </header>

        <article className={`shared-card ${memo.photo?.dataUrl ? "" : "single"}`}>
          {memo.photo?.dataUrl ? (
            <img className="shared-image" src={memo.photo.dataUrl} alt="공유된 메모 사진" />
          ) : null}
          <div className="shared-content">
            <p className="shared-sender">{senderName}님이 보낸 비밀메모</p>
            <h2>{memo.title}</h2>
            <SharedMemoGate
              memo={publicMemo}
              isOwner={isOwner}
              isSignedIn={Boolean(session?.user)}
              initialReactions={reactions}
            />
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

function getSenderName(memo) {
  if (memo.ownerEmail) {
    return memo.ownerEmail.split("@")[0];
  }

  return memo.ownerName || "누군가";
}

function getBaseUrl() {
  return (process.env.NEXTAUTH_URL || "https://nabime.vercel.app").replace(/\/$/, "");
}
