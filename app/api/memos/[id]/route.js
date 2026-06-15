import { getServerSession } from "next-auth";
import { authOptions } from "../../../../lib/auth";
import { memoPayloadToData, toClientMemo } from "../../../../lib/memoMapper";
import { prisma } from "../../../../lib/prisma";

export async function GET(_request, { params }) {
  const { id } = await params;
  const memo = await prisma.memo.findUnique({
    where: { id },
  });

  if (!memo) {
    return Response.json({ error: "메모를 찾을 수 없습니다." }, { status: 404 });
  }

  return Response.json({ memo: toClientMemo(memo) });
}

export async function PUT(request, { params }) {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    return Response.json({ error: "로그인이 필요합니다." }, { status: 401 });
  }

  const { id } = await params;
  const existing = await prisma.memo.findUnique({
    where: { id },
  });

  if (!existing) {
    return Response.json({ error: "메모를 찾을 수 없습니다." }, { status: 404 });
  }

  if (!isOwner(existing, session.user)) {
    return Response.json({ error: "작성자만 수정할 수 있습니다." }, { status: 403 });
  }

  const payload = await request.json();
  const memo = await prisma.memo.update({
    where: { id },
    data: memoPayloadToData(payload, session.user),
  });

  return Response.json({ memo: toClientMemo(memo) });
}

export async function DELETE(_request, { params }) {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    return Response.json({ error: "로그인이 필요합니다." }, { status: 401 });
  }

  const { id } = await params;
  const existing = await prisma.memo.findUnique({
    where: { id },
  });

  if (!existing) {
    return Response.json({ ok: true });
  }

  if (!isOwner(existing, session.user)) {
    return Response.json({ error: "작성자만 삭제할 수 있습니다." }, { status: 403 });
  }

  await prisma.memo.delete({
    where: { id },
  });

  return Response.json({ ok: true });
}

function isOwner(memo, user) {
  const userId = user.id || user.email;
  return memo.ownerId === userId || memo.ownerEmail === user.email;
}
