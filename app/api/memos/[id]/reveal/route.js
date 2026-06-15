import { getServerSession } from "next-auth";
import { authOptions } from "../../../../../lib/auth";
import { prisma } from "../../../../../lib/prisma";

export async function POST(request, { params }) {
  const { id } = await params;
  const memo = await prisma.memo.findUnique({
    where: { id },
  });

  if (!memo) {
    return Response.json({ error: "메모를 찾을 수 없습니다." }, { status: 404 });
  }

  const session = await getServerSession(authOptions);

  if (isMemoOwner(memo, session?.user)) {
    return Response.json({ body: memo.body || "" });
  }

  if (memo.latitude === null || memo.longitude === null || !memo.rangeMeters) {
    return Response.json({ error: "위치 기반 열람 정보가 없습니다." }, { status: 400 });
  }

  const payload = await request.json();
  const current = {
    latitude: Number(payload.latitude),
    longitude: Number(payload.longitude),
  };

  if (!Number.isFinite(current.latitude) || !Number.isFinite(current.longitude)) {
    return Response.json({ error: "현재 위치를 확인할 수 없습니다." }, { status: 400 });
  }

  const distanceMeters = getDistanceMeters(current, {
    latitude: memo.latitude,
    longitude: memo.longitude,
  });

  if (distanceMeters > memo.rangeMeters) {
    return Response.json(
      {
        error: "열람 범위 밖에 있습니다.",
        distanceMeters,
      },
      { status: 403 },
    );
  }

  return Response.json({ body: memo.body || "", distanceMeters });
}

function isMemoOwner(memo, user) {
  if (!memo || !user) return false;

  const userId = user.id || user.email;
  return memo.ownerId === userId || memo.ownerEmail === user.email;
}

function getDistanceMeters(from, to) {
  const radius = 6371000;
  const lat1 = toRadians(from.latitude);
  const lat2 = toRadians(to.latitude);
  const deltaLat = toRadians(to.latitude - from.latitude);
  const deltaLon = toRadians(to.longitude - from.longitude);

  const a =
    Math.sin(deltaLat / 2) * Math.sin(deltaLat / 2) +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(deltaLon / 2) * Math.sin(deltaLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return radius * c;
}

function toRadians(degrees) {
  return (degrees * Math.PI) / 180;
}
