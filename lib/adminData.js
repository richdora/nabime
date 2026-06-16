export function getUserDisplayName(user) {
  return user.name || user.email?.split("@")[0] || "이름 없음";
}

export function toUserKey(email) {
  return String(email || "").trim().toLowerCase();
}

export function formatMemoSerial(id) {
  const value = String(id || "").replace(/[^a-zA-Z0-9]/g, "").toUpperCase();

  if (!value) return "메모 #UNKNOWN";

  return `메모 #${value.slice(0, 4)}-${value.slice(4, 8) || "0000"}`;
}

export function addUserActivity(users, { email, name, joinedAt, activeAt, memoCount = 0, likeCount = 0, commentCount = 0 }) {
  const key = toUserKey(email);
  if (!key) return;

  const existing =
    users.get(key) ||
    {
      email: key,
      name: name || null,
      joinedAt,
      activeAt,
      memoCount: 0,
      likeCount: 0,
      commentCount: 0,
    };

  existing.name = existing.name || name || null;
  existing.joinedAt = getEarlierDate(existing.joinedAt, joinedAt);
  existing.activeAt = getLaterDate(existing.activeAt, activeAt);
  existing.memoCount += memoCount;
  existing.likeCount += likeCount;
  existing.commentCount += commentCount;
  users.set(key, existing);
}

export function sortUsers(users, sort) {
  const list = Array.from(users.values());

  if (sort === "joined") {
    return list.sort((a, b) => new Date(a.joinedAt || 0) - new Date(b.joinedAt || 0));
  }

  return list.sort((a, b) => new Date(b.activeAt || 0) - new Date(a.activeAt || 0));
}

function getEarlierDate(a, b) {
  if (!a) return b;
  if (!b) return a;
  return new Date(a) < new Date(b) ? a : b;
}

function getLaterDate(a, b) {
  if (!a) return b;
  if (!b) return a;
  return new Date(a) > new Date(b) ? a : b;
}
