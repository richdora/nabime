export function getAdminEmails() {
  return (process.env.ADMIN_EMAILS || "")
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);
}

export function isAdminUser(user) {
  if (!user?.email) return false;

  return getAdminEmails().includes(user.email.toLowerCase());
}
