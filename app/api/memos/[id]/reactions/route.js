import { getServerSession } from "next-auth";
import { authOptions } from "../../../../../lib/auth";
import { getMemoReactions, toClientComment } from "../../../../../lib/reactions";
import { prisma } from "../../../../../lib/prisma";

export async function GET(_request, { params }) {
  const { id } = await params;
  const memo = await prisma.memo.findUnique({
    where: { id },
    select: { id: true },
  });

  if (!memo) {
    return Response.json({ error: "메모를 찾을 수 없습니다." }, { status: 404 });
  }

  const session = await getServerSession(authOptions);
  const reactions = await getMemoReactions(prisma, id, session?.user);

  return Response.json(reactions);
}

export async function POST(request, { params }) {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    return Response.json({ error: "로그인이 필요합니다." }, { status: 401 });
  }

  const { id } = await params;
  const memo = await prisma.memo.findUnique({
    where: { id },
    select: { id: true },
  });

  if (!memo) {
    return Response.json({ error: "메모를 찾을 수 없습니다." }, { status: 404 });
  }

  const payload = await request.json();
  const userId = session.user.id || session.user.email;

  if (payload.type === "like") {
    const existing = await prisma.memoLike.findUnique({
      where: {
        memoId_userId: {
          memoId: id,
          userId,
        },
      },
    });

    if (existing) {
      await prisma.memoLike.delete({
        where: { id: existing.id },
      });
    } else {
      await prisma.memoLike.create({
        data: {
          memoId: id,
          userId,
          userEmail: session.user.email,
          userName: session.user.name || null,
        },
      });
    }

    return Response.json(await getMemoReactions(prisma, id, session.user));
  }

  if (payload.type === "comment") {
    const body = String(payload.body || "").trim();

    if (!body) {
      return Response.json({ error: "댓글 내용을 입력해 주세요." }, { status: 400 });
    }

    if (body.length > 160) {
      return Response.json({ error: "댓글은 160자 이하로 입력해 주세요." }, { status: 400 });
    }

    const comment = await prisma.memoComment.create({
      data: {
        memoId: id,
        body,
        userId,
        userEmail: session.user.email,
        userName: session.user.name || null,
      },
    });

    const reactions = await getMemoReactions(prisma, id, session.user);
    return Response.json({
      ...reactions,
      comment: toClientComment(comment),
    });
  }

  return Response.json({ error: "지원하지 않는 요청입니다." }, { status: 400 });
}
