import { getServerSession } from "next-auth";
import { authOptions } from "../../../../../../lib/auth";
import { isAdminUser } from "../../../../../../lib/admin";
import { prisma } from "../../../../../../lib/prisma";

export async function POST(request, { params }) {
  const session = await getServerSession(authOptions);

  if (!session?.user || !isAdminUser(session.user)) {
    return Response.json({ error: "관리자 권한이 필요합니다." }, { status: 403 });
  }

  const { id } = await params;
  const payload = await request.json();
  const shouldHide = Boolean(payload.hidden);

  const memo = await prisma.memo.findUnique({
    where: { id },
    select: { id: true },
  });

  if (!memo) {
    return Response.json({ error: "메모를 찾을 수 없습니다." }, { status: 404 });
  }

  const updated = await prisma.memo.update({
    where: { id },
    data: shouldHide
      ? {
          hiddenAt: new Date(),
          hiddenBy: session.user.email,
          hiddenReason: String(payload.reason || "관리자 숨김 처리").slice(0, 120),
        }
      : {
          hiddenAt: null,
          hiddenBy: null,
          hiddenReason: null,
        },
    select: {
      id: true,
      hiddenAt: true,
    },
  });

  return Response.json({
    ok: true,
    hidden: Boolean(updated.hiddenAt),
  });
}
