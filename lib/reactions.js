export function toClientComment(comment) {
  return {
    id: comment.id,
    body: comment.body,
    userName: comment.userName || comment.userEmail || "익명",
    createdAt: comment.createdAt.toISOString(),
  };
}

export function toClientLike(like) {
  return {
    id: like.id,
    userName: like.userName || like.userEmail || "익명",
    userEmail: like.userEmail,
    createdAt: like.createdAt.toISOString(),
  };
}

export async function getMemoReactions(prisma, memoId, user) {
  const userId = user?.id || user?.email || null;
  const [likeCount, likes, comments, viewerLike] = await Promise.all([
    prisma.memoLike.count({
      where: { memoId },
    }),
    prisma.memoLike.findMany({
      where: { memoId },
      orderBy: { createdAt: "desc" },
      take: 100,
    }),
    prisma.memoComment.findMany({
      where: { memoId },
      orderBy: { createdAt: "desc" },
      take: 100,
    }),
    userId
      ? prisma.memoLike.findUnique({
          where: {
            memoId_userId: {
              memoId,
              userId,
            },
          },
        })
      : null,
  ]);

  return {
    likeCount,
    likes: likes.map(toClientLike),
    likedByViewer: Boolean(viewerLike),
    comments: comments.map(toClientComment),
  };
}
