import { prisma } from "../../../../../lib/prisma";

export async function GET(_request, { params }) {
  const { id } = await params;
  const memo = await prisma.memo.findUnique({
    where: { id },
    select: {
      photoDataUrl: true,
      photoType: true,
      hiddenAt: true,
    },
  });

  if (!memo?.photoDataUrl || memo.hiddenAt) {
    return new Response("Not found", { status: 404 });
  }

  const image = parseDataUrl(memo.photoDataUrl);

  if (!image) {
    return new Response("Invalid image", { status: 400 });
  }

  return new Response(image.bytes, {
    headers: {
      "Content-Type": memo.photoType || image.type,
      "Cache-Control": "public, max-age=31536000, immutable",
    },
  });
}

function parseDataUrl(dataUrl) {
  const match = dataUrl.match(/^data:([^;]+);base64,(.+)$/);

  if (!match) return null;

  return {
    type: match[1],
    bytes: Buffer.from(match[2], "base64"),
  };
}
