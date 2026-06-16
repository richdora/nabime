"use client";

import { useState } from "react";

export default function AdminMemoVisibilityButton({ memoId, initiallyHidden }) {
  const [isHidden, setIsHidden] = useState(initiallyHidden);
  const [isSaving, setIsSaving] = useState(false);

  async function toggleVisibility() {
    setIsSaving(true);

    try {
      const response = await fetch(`/api/admin/memos/${encodeURIComponent(memoId)}/visibility`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({
          hidden: !isHidden,
          reason: !isHidden ? "관리자 숨김 처리" : "",
        }),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => null);
        alert(data?.error || "처리하지 못했습니다.");
        return;
      }

      const data = await response.json();
      setIsHidden(Boolean(data.hidden));
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <button className={isHidden ? "admin-action-button restore" : "admin-action-button"} type="button" onClick={toggleVisibility} disabled={isSaving}>
      {isSaving ? "처리 중" : isHidden ? "숨김 해제" : "메모 숨김"}
    </button>
  );
}
