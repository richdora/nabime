"use client";

import { useState } from "react";

const RANGE_LABELS = {
  50: "50m",
  100: "100m",
  1000: "1km",
  10000: "10km",
};

export default function SharedMemoGate({ memo, isOwner }) {
  const [body, setBody] = useState(isOwner ? memo.body || "내용 없음" : "");
  const [message, setMessage] = useState(getInitialMessage(memo, isOwner));
  const [isChecking, setIsChecking] = useState(false);
  const [isRevealed, setIsRevealed] = useState(isOwner);

  async function revealBody() {
    if (!memo.location || !memo.rangeMeters) {
      alert("위치 기반 열람 정보가 없습니다.");
      return;
    }

    if (!navigator.geolocation) {
      alert("이 브라우저에서는 현재 위치 확인을 사용할 수 없습니다.");
      return;
    }

    setIsChecking(true);

    try {
      const current = await getBrowserLocation();
      const response = await fetch(`/api/memos/${encodeURIComponent(memo.id)}/reveal`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(current),
      });
      const data = await response.json();

      if (!response.ok) {
        setMessage(
          data.distanceMeters
            ? `현재 위치는 사진이 표시된 위치에서 약 ${formatDistance(data.distanceMeters)} 떨어져 있습니다. 사진이 표시된 위치에서 ${getRangeLabel(memo)} 이내로 이동하셔야 메모의 내용을 볼 수 있습니다.`
            : data.error || "현재 위치에서는 메모 내용을 볼 수 없습니다.",
        );
        return;
      }

      setBody(data.body || "내용 없음");
      setMessage("열람 범위 안에 있어 메모 내용을 볼 수 있습니다.");
      setIsRevealed(true);
    } catch {
      alert("현재 위치를 확인하지 못했습니다. 브라우저 위치 권한을 허용해 주세요.");
    } finally {
      setIsChecking(false);
    }
  }

  return (
    <>
      <p className="lock-message">{message}</p>
      {!isRevealed ? (
        <button className="primary-button" type="button" onClick={revealBody} disabled={isChecking}>
          {isChecking ? "위치 확인 중" : "내용보기"}
        </button>
      ) : null}
      {isRevealed ? <div className="shared-body">{body}</div> : null}
    </>
  );
}

function getInitialMessage(memo, isOwner) {
  if (isOwner) {
    return "작성자 계정으로 로그인되어 있어 메모 내용을 바로 볼 수 있습니다.";
  }

  return `사진이 표시된 위치에서 ${getRangeLabel(memo)} 이내로 이동하셔야 메모의 내용을 볼 수 있습니다.`;
}

function getRangeLabel(memo) {
  return RANGE_LABELS[memo.rangeMeters] || memo.range?.label || "열람가능 범위";
}

function getBrowserLocation() {
  return new Promise((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(
      (position) => {
        resolve({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        });
      },
      reject,
    );
  });
}

function formatDistance(meters) {
  if (meters >= 1000) {
    return `${(meters / 1000).toFixed(1)}km`;
  }

  return `${Math.round(meters)}m`;
}
