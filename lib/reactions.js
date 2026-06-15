export function toClientComment(comment) {
  return {
    id: comment.id,
    body: comment.body,
    userName: comment.userName || comment.userEmail || "익명",
    createdAt: comment.createdAt.toISOString(),
  };
}

export async function getMemoReactions(prisma, memoId, user) {
  const userId = user?.id || user?.email || null;
  const [likeCount, comments, viewerLike] = await Promise.all([
    prisma.memoLike.count({
      where: { memoId },
    }),
    prisma.memoComment.findMany({
      where: { memoId },
      orderBy: { createdAt: "desc" },
      take: 20,
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
    likedByViewer: Boolean(viewerLike),
    comments: comments.map(toClientComment),
  };
}
