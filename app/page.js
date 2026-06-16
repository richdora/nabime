import Script from "next/script";
import AuthControls from "../components/AuthControls";

export default function Home() {
  return (
    <>
      <main id="appShell" className="app-shell">
        <section className="memo-panel" aria-label="메모 작성">
          <header className="topbar">
            <div className="brand-lockup">
              <img className="brand-icon" src="/nabime-icon.svg" alt="" aria-hidden="true" />
              <div>
                <p className="eyebrow">나만의 비밀메모</p>
                <h1>Nabime</h1>
              </div>
            </div>
            <div className="topbar-actions">
              <AuthControls />
              <button className="ghost-button" id="newMemoButton" type="button">
                새 메모
              </button>
            </div>
          </header>

          <form id="memoForm" className="editor">
            <label className="field">
              <span>제목</span>
              <input id="titleInput" name="title" type="text" placeholder="비밀메모 제목" autoComplete="off" />
            </label>

            <label className="field body-field">
              <span>내용</span>
              <textarea id="bodyInput" name="body" placeholder="비밀스럽게 전달할 생각을 적어두세요" />
            </label>

            <div className="attachment-row">
              <input id="photoInput" type="file" accept="image/jpeg,image/png,image/tiff" hidden />
              <button className="attach-button" id="attachButton" type="button" title="위치 정보가 있는 사진 첨부">
                <span aria-hidden="true">+</span>
                사진 첨부
              </button>
              <div id="photoStatus" className="photo-status">
                첨부된 사진 없음 · 위치 정보가 있는 사진을 첨부하세요!
              </div>
            </div>

            <div id="photoPreview" className="photo-preview" hidden>
              <img id="previewImage" alt="첨부된 사진 미리보기" />
              <div>
                <strong>위치 정보 저장됨</strong>
                <span id="gpsText" />
                <button id="mapButton" className="map-button" type="button">
                  위치확인
                </button>
              </div>
              <button id="removePhotoButton" className="icon-button" type="button" title="사진 제거">
                x
              </button>
            </div>

            <label id="rangeField" className="field range-field" hidden>
              <span>열람가능 범위(range)</span>
              <select id="rangeSelect" name="range">
                <option value="50">50m</option>
                <option value="100">100m</option>
                <option value="1000">1km</option>
                <option value="10000">10km</option>
              </select>
            </label>

            <div className="actions">
              <button className="primary-button" type="submit">
                저장
              </button>
              <button className="share-button" id="shareButton" type="button">
                공유
              </button>
              <button className="danger-button" id="deleteButton" type="button" hidden>
                삭제
              </button>
            </div>

            <section id="ownerReactionPanel" className="owner-reaction-panel" hidden>
              <div className="owner-reaction-summary">
                <div>
                  <span>받은 하트</span>
                  <strong id="ownerLikeCount">0개</strong>
                </div>
                <div>
                  <span>댓글</span>
                  <strong id="ownerCommentCount">0개</strong>
                </div>
              </div>

              <div className="owner-comments-header">
                <h2>댓글 리스트</h2>
                <span id="ownerCommentPage">1 / 1</span>
              </div>

              <div id="ownerCommentList" className="owner-comment-list" />

              <div className="owner-comment-nav">
                <button id="ownerCommentPrev" className="comment-button" type="button">
                  이전
                </button>
                <button id="ownerCommentNext" className="comment-button" type="button">
                  다음
                </button>
              </div>
            </section>
          </form>
        </section>

        <aside className="list-panel" aria-label="메모 목록">
          <div className="search-wrap">
            <input id="searchInput" type="search" placeholder="메모 검색" />
          </div>
          <h2 className="list-title">내 메모</h2>
          <div id="memoList" className="memo-list" />
        </aside>
      </main>

      <main id="sharedView" className="shared-view" hidden>
        <section className="shared-shell">
          <header className="shared-header">
            <p className="eyebrow">Shared memo</p>
            <h1>Nabime</h1>
          </header>

          <article className="shared-card">
            <img id="sharedImage" className="shared-image" alt="공유된 메모 사진" />
            <div className="shared-content">
              <h2 id="sharedTitle" />
              <p id="sharedLockMessage" className="lock-message" />
              <button id="revealButton" className="primary-button" type="button">
                내용보기
              </button>
              <div id="sharedBody" className="shared-body" hidden />
            </div>
          </article>
        </section>
      </main>

      <Script src="/nabime.js" strategy="afterInteractive" />
    </>
  );
}
