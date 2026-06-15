"use client";

import { signIn } from "next-auth/react";
import { useEffect, useState } from "react";

const RANGE_LABELS = {
  50: "50m",
  100: "100m",
  1000: "1km",
  10000: "10km",
};

export default function SharedMemoGate({ memo, isOwner, isSignedIn, initialReactions }) {
  const [body, setBody] = useState(isOwner ? memo.body || "내용 없음" : "");
  const [message, setMessage] = useState(getInitialMessage(memo, isOwner));
  const [isChecking, setIsChecking] = useState(false);
  const [isRevealed, setIsRevealed] = useState(isOwner);
  const [commentText, setCommentText] = useState("");
  const [isSavingReaction, setIsSavingReaction] = useState(false);
  const [loginPrompt, setLoginPrompt] = useState("");
  const [distanceInfo, setDistanceInfo] = useState(null);
  const [isCheckingDistance, setIsCheckingDistance] = useState(false);
  const [reactions, setReactions] = useState(
    initialReactions || {
      likeCount: 0,
      likedByViewer: false,
      comments: [],
    },
  );

  useEffect(() => {
    if (!isOwner && !isRevealed) {
      checkDistance();
    }
  }, [isOwner, isRevealed]);

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
      await refreshReactions();
    } catch {
      alert("현재 위치를 확인하지 못했습니다. 브라우저 위치 권한을 허용해 주세요.");
    } finally {
      setIsChecking(false);
    }
  }

  async function toggleLike() {
    if (!isSignedIn) {
      setLoginPrompt("좋아요는 Google 로그인 후 사용할 수 있습니다.");
      return;
    }

    await saveReaction({ type: "like" });
  }

  async function submitComment(event) {
    event.preventDefault();

    if (!isSignedIn) {
      setLoginPrompt("댓글은 Google 로그인 후 사용할 수 있습니다.");
      return;
    }

    const body = commentText.trim();

    if (!body) {
      alert("댓글 내용을 입력해 주세요.");
      return;
    }

    await saveReaction({ type: "comment", body });
    setCommentText("");
  }

  async function refreshReactions() {
    try {
      const response = await fetch(`/api/memos/${encodeURIComponent(memo.id)}/reactions`);
      if (!response.ok) return;

      setReactions(await response.json());
    } catch {
      // Reactions are helpful, but the memo itself should remain usable without them.
    }
  }

  async function saveReaction(payload) {
    setIsSavingReaction(true);

    try {
      const response = await fetch(`/api/memos/${encodeURIComponent(memo.id)}/reactions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });
      const data = await response.json();

      if (response.status === 401) {
        setLoginPrompt("Google 로그인 후 사용할 수 있습니다.");
        return;
      }

      if (!response.ok) {
        alert(data.error || "저장하지 못했습니다.");
        return;
      }

      setReactions(data);
    } catch {
      alert("저장하지 못했습니다. 잠시 후 다시 시도해 주세요.");
    } finally {
      setIsSavingReaction(false);
    }
  }

  async function checkDistance() {
    if (!memo.location) {
      setDistanceInfo({
        status: "error",
        message: "사진 위치정보가 없습니다.",
      });
      return;
    }

    if (!navigator.geolocation) {
      setDistanceInfo({
        status: "error",
        message: "이 브라우저에서는 현재 위치 확인을 사용할 수 없습니다.",
      });
      return;
    }

    setIsCheckingDistance(true);

    try {
      const current = await getBrowserLocation();
      const distance = getDistanceMeters(current, memo.location);

      setDistanceInfo({
        status: "ready",
        current,
        target: memo.location,
        distance,
      });
    } catch {
      setDistanceInfo({
        status: "error",
        message: "현재 위치를 확인하지 못했습니다. 브라우저 위치 권한을 허용한 뒤 다시 눌러주세요.",
      });
    } finally {
      setIsCheckingDistance(false);
    }
  }

  return (
    <>
      <p className="lock-message">{message}</p>
      {!isRevealed ? (
        <>
          <section className="distance-panel" aria-label="사진과의 거리">
            {distanceInfo?.status === "ready" ? (
              <>
                <dl>
                  <div>
                    <dt>현재 위치</dt>
                    <dd>{formatCoordinate(distanceInfo.current)}</dd>
                  </div>
                  <div>
                    <dt>사진 위치</dt>
                    <dd>{formatCoordinate(distanceInfo.target)}</dd>
                  </div>
                  <div>
                    <dt>사진과의 거리</dt>
                    <dd>{formatDistance(distanceInfo.distance)}</dd>
                  </div>
                </dl>
              </>
            ) : (
              <p>{isCheckingDistance ? "현재 위치를 확인하고 있습니다." : distanceInfo?.message || "현재 위치를 확인하면 사진과의 거리를 볼 수 있습니다."}</p>
            )}
            <button className="distance-button" type="button" onClick={checkDistance} disabled={isCheckingDistance}>
              {isCheckingDistance ? "거리 확인 중" : "사진과의 거리확인"}
            </button>
          </section>
          <button className="primary-button" type="button" onClick={revealBody} disabled={isChecking}>
            {isChecking ? "위치 확인 중" : "비밀 메모 보기"}
          </button>
          <aside className="location-help" aria-label="위치정보 설정 안내">
            <p>비밀메모를 확인하려면 브라우저의 위치정보 사용을 허용해야 합니다.</p>
            <ul>
              <li>iPhone Safari: 주소창의 가가 또는 페이지 설정에서 위치를 허용해 주세요.</li>
              <li>Mac Safari: Safari 설정의 웹사이트, 위치에서 Nabime를 허용해 주세요.</li>
              <li>Chrome: 주소창 왼쪽 설정 아이콘에서 위치 권한을 허용해 주세요.</li>
            </ul>
          </aside>
        </>
      ) : null}
      {isRevealed ? <div className="shared-body">{body}</div> : null}
      {isRevealed ? (
        <section className="reaction-panel" aria-label="공유 메모 반응">
          <button
            className={`heart-button ${reactions.likedByViewer ? "active" : ""}`}
            type="button"
            onClick={toggleLike}
            disabled={isSavingReaction}
            aria-pressed={reactions.likedByViewer}
          >
            <span aria-hidden="true">{reactions.likedByViewer ? "♥" : "♡"}</span>
            좋아요 {reactions.likeCount}
          </button>

          <form className="comment-form" onSubmit={submitComment}>
            <input
              type="text"
              value={commentText}
              onChange={(event) => setCommentText(event.target.value)}
              onFocus={() => {
                if (!isSignedIn) setLoginPrompt("댓글은 Google 로그인 후 사용할 수 있습니다.");
              }}
              placeholder="짧은 댓글 남기기"
              maxLength={160}
            />
            <button className="comment-button" type="submit" disabled={isSavingReaction}>
              등록
            </button>
          </form>

          <div className="comment-list">
            {reactions.comments.length ? (
              reactions.comments.map((comment) => (
                <article className="comment-item" key={comment.id}>
                  <strong>{comment.userName}</strong>
                  <p>{comment.body}</p>
                </article>
              ))
            ) : (
              <p className="empty-comments">아직 댓글이 없습니다.</p>
            )}
          </div>
        </section>
      ) : null}

      {loginPrompt ? (
        <div className="login-modal" role="dialog" aria-modal="true" aria-label="로그인 안내">
          <div className="login-modal-card">
            <button className="modal-close" type="button" onClick={() => setLoginPrompt("")}>
              x
            </button>
            <h3>로그인이 필요합니다</h3>
            <p>{loginPrompt}</p>
            <button className="primary-button" type="button" onClick={() => signIn("google")}>
              Google 로그인
            </button>
          </div>
        </div>
      ) : null}
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

function formatCoordinate(location) {
  return `${location.latitude.toFixed(6)}, ${location.longitude.toFixed(6)}`;
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
