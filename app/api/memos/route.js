import { getServerSession } from "next-auth";
import { authOptions } from "../../../lib/auth";
import { memoPayloadToData, toClientMemo } from "../../../lib/memoMapper";
import { prisma } from "../../../lib/prisma";
import { getMemoReactions } from "../../../lib/reactions";

export async function GET() {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    return Response.json({ memos: [] });
  }

  const ownerId = session.user.id || session.user.email;
  const memos = await prisma.memo.findMany({
    where: {
      OR: [{ ownerId }, { ownerEmail: session.user.email }],
    },
    orderBy: {
      updatedAt: "desc",
    },
  });

  const clientMemos = await Promise.all(
    memos.map(async (memo) => ({
      ...toClientMemo(memo),
      reactions: await getMemoReactions(prisma, memo.id, session.user),
    })),
  );

  return Response.json({ memos: clientMemos });
}

export async function POST(request) {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    return Response.json({ error: "로그인이 필요합니다." }, { status: 401 });
  }

  const payload = await request.json();
  const memo = await prisma.memo.create({
    data: memoPayloadToData(payload, session.user),
  });

  return Response.json({ memo: toClientMemo(memo) }, { status: 201 });
}
