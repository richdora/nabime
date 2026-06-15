"use client";

import { signIn, signOut, useSession } from "next-auth/react";

export default function AuthControls() {
  const { data: session, status } = useSession();

  if (status === "loading") {
    return <div className="auth-status">확인 중</div>;
  }

  if (!session?.user) {
    return (
      <button className="auth-button" type="button" onClick={() => signIn("google")}>
        Google 로그인
      </button>
    );
  }

  return (
    <div className="auth-user">
      {session.user.image ? <img src={session.user.image} alt="" /> : null}
      <span>{session.user.name || session.user.email}</span>
      <button className="auth-button secondary" type="button" onClick={() => signOut()}>
        로그아웃
      </button>
    </div>
  );
}
