const STORAGE_KEY = "memo-place-items";
const RANGE_LABELS = {
  50: "50m",
  100: "100m",
  1000: "1km",
  10000: "10km",
};

const state = {
  memos: [],
  activeId: null,
  photo: null,
  sharedMemo: null,
  currentUser: null,
  ownerReactions: {
    memoId: null,
    likeCount: 0,
    comments: [],
    page: 0,
  },
};

const els = {
  appShell: document.querySelector("#appShell"),
  sharedView: document.querySelector("#sharedView"),
  form: document.querySelector("#memoForm"),
  title: document.querySelector("#titleInput"),
  body: document.querySelector("#bodyInput"),
  photoInput: document.querySelector("#photoInput"),
  attachButton: document.querySelector("#attachButton"),
  photoStatus: document.querySelector("#photoStatus"),
  photoPreview: document.querySelector("#photoPreview"),
  previewImage: document.querySelector("#previewImage"),
  gpsText: document.querySelector("#gpsText"),
  mapButton: document.querySelector("#mapButton"),
  rangeField: document.querySelector("#rangeField"),
  rangeSelect: document.querySelector("#rangeSelect"),
  removePhotoButton: document.querySelector("#removePhotoButton"),
  shareButton: document.querySelector("#shareButton"),
  deleteButton: document.querySelector("#deleteButton"),
  newMemoButton: document.querySelector("#newMemoButton"),
  search: document.querySelector("#searchInput"),
  list: document.querySelector("#memoList"),
  sharedImage: document.querySelector("#sharedImage"),
  sharedTitle: document.querySelector("#sharedTitle"),
  sharedLockMessage: document.querySelector("#sharedLockMessage"),
  revealButton: document.querySelector("#revealButton"),
  sharedBody: document.querySelector("#sharedBody"),
  ownerReactionPanel: document.querySelector("#ownerReactionPanel"),
  ownerLikeCount: document.querySelector("#ownerLikeCount"),
  ownerCommentCount: document.querySelector("#ownerCommentCount"),
  ownerCommentPage: document.querySelector("#ownerCommentPage"),
  ownerCommentList: document.querySelector("#ownerCommentList"),
  ownerCommentPrev: document.querySelector("#ownerCommentPrev"),
  ownerCommentNext: document.querySelector("#ownerCommentNext"),
};

els.attachButton.addEventListener("click", () => els.photoInput.click());
els.photoInput.addEventListener("change", handlePhotoSelect);
els.removePhotoButton.addEventListener("click", clearPhoto);
els.mapButton.addEventListener("click", openCurrentMemoMap);
els.form.addEventListener("submit", saveMemo);
els.shareButton.addEventListener("click", shareCurrentMemo);
els.deleteButton.addEventListener("click", deleteActiveMemo);
els.newMemoButton.addEventListener("click", startNewMemo);
els.search.addEventListener("input", renderList);
els.revealButton.addEventListener("click", revealSharedMemo);
els.ownerCommentPrev?.addEventListener("click", () => changeOwnerCommentPage(-1));
els.ownerCommentNext?.addEventListener("click", () => changeOwnerCommentPage(1));

initApp();

async function initApp() {
  state.currentUser = await fetchCurrentUser();
  const sharedId = new URLSearchParams(window.location.search).get("shared");

  if (sharedId) {
    await renderSharedMemo(sharedId);
    return;
  }

  state.memos = await fetchMemos();
  renderList();
}

async function fetchCurrentUser() {
  try {
    const response = await fetch("/api/auth/session", {
      headers: {
        Accept: "application/json",
      },
    });

    if (!response.ok) return null;

    const session = await response.json();
    return session?.user || null;
  } catch {
    return null;
  }
}

function loadMemos() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
  } catch {
    return [];
  }
}

function persistMemos() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state.memos));
}

async function fetchMemos() {
  try {
    const response = await fetch("/api/memos", {
      headers: {
        Accept: "application/json",
      },
    });

    if (!response.ok) return [];

    const data = await response.json();
    return (data.memos || []).map(normalizeMemoReactions);
  } catch {
    return loadMemos();
  }
}

async function handlePhotoSelect(event) {
  const file = event.target.files?.[0];
  event.target.value = "";

  if (!file) return;

  try {
    const buffer = await file.arrayBuffer();
    const gps = extractGpsFromImage(buffer);

    if (!gps) {
      alert("위치 정보가 없습니다. 위치 정보가 있는 사진을 첨부하세요");
      clearPhoto();
      return;
    }

    const dataUrl = await fileToPreviewDataUrl(file);
    state.photo = {
      name: file.name,
      type: file.type,
      dataUrl,
      gps,
    };
    renderPhoto();
  } catch {
    alert("위치 정보가 없습니다. 위치 정보가 있는 사진을 첨부하세요");
    clearPhoto();
  }
}

function extractGpsFromImage(buffer) {
  const bytes = new Uint8Array(buffer);

  if (bytes[0] === 0xff && bytes[1] === 0xd8) {
    return extractGpsFromJpeg(bytes);
  }

  if (isPng(bytes)) {
    return extractGpsFromPng(bytes);
  }

  const header = readAscii(bytes, 0, 4);
  if (header === "II*\u0000" || header === "MM\u0000*") {
    return extractGpsFromTiff(bytes, 0);
  }

  return null;
}

function extractGpsFromJpeg(bytes) {
  let offset = 2;

  while (offset + 4 < bytes.length) {
    if (bytes[offset] !== 0xff) return null;

    const marker = bytes[offset + 1];
    const size = readUint16(bytes, offset + 2, false);

    if (marker === 0xe1 && readAscii(bytes, offset + 4, 6) === "Exif\u0000\u0000") {
      return extractGpsFromTiff(bytes, offset + 10);
    }

    offset += 2 + size;
  }

  return null;
}

function isPng(bytes) {
  return (
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47 &&
    bytes[4] === 0x0d &&
    bytes[5] === 0x0a &&
    bytes[6] === 0x1a &&
    bytes[7] === 0x0a
  );
}

function extractGpsFromPng(bytes) {
  let offset = 8;

  while (offset + 12 <= bytes.length) {
    const size = readUint32(bytes, offset, false);
    const type = readAscii(bytes, offset + 4, 4);
    const dataOffset = offset + 8;

    if (type === "eXIf") {
      return extractGpsFromTiff(bytes, dataOffset);
    }

    offset = dataOffset + size + 4;
  }

  return null;
}

function extractGpsFromTiff(bytes, tiffStart) {
  const byteOrder = readAscii(bytes, tiffStart, 2);
  const littleEndian = byteOrder === "II";

  if (!littleEndian && byteOrder !== "MM") return null;

  const firstIfdOffset = readUint32(bytes, tiffStart + 4, littleEndian);
  const firstIfd = readIfd(bytes, tiffStart, tiffStart + firstIfdOffset, littleEndian);
  const gpsPointer = firstIfd.get(0x8825);

  if (!gpsPointer) return null;

  const gpsIfd = readIfd(bytes, tiffStart, tiffStart + gpsPointer.value, littleEndian);
  const latRef = gpsIfd.get(0x0001);
  const latValue = gpsIfd.get(0x0002);
  const lonRef = gpsIfd.get(0x0003);
  const lonValue = gpsIfd.get(0x0004);

  if (!latRef || !latValue || !lonRef || !lonValue) return null;

  const latitude = coordinateToDecimal(latValue.value, latRef.value);
  const longitude = coordinateToDecimal(lonValue.value, lonRef.value);

  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;

  return { latitude, longitude };
}

function readIfd(bytes, tiffStart, offset, littleEndian) {
  const entries = new Map();
  const count = readUint16(bytes, offset, littleEndian);

  for (let index = 0; index < count; index += 1) {
    const entryOffset = offset + 2 + index * 12;
    const tag = readUint16(bytes, entryOffset, littleEndian);
    const type = readUint16(bytes, entryOffset + 2, littleEndian);
    const countValue = readUint32(bytes, entryOffset + 4, littleEndian);
    const rawValue = readUint32(bytes, entryOffset + 8, littleEndian);
    const valueOffset = valueFitsInEntry(type, countValue)
      ? entryOffset + 8
      : tiffStart + rawValue;

    entries.set(tag, {
      type,
      count: countValue,
      value: readTagValue(bytes, valueOffset, type, countValue, littleEndian),
    });
  }

  return entries;
}

function readTagValue(bytes, offset, type, count, littleEndian) {
  if (type === 2) {
    return readAscii(bytes, offset, count).replace(/\u0000+$/, "");
  }

  if (type === 3 && count === 1) {
    return readUint16(bytes, offset, littleEndian);
  }

  if (type === 4 && count === 1) {
    return readUint32(bytes, offset, littleEndian);
  }

  if (type === 5) {
    return Array.from({ length: count }, (_, index) => {
      const rationalOffset = offset + index * 8;
      const numerator = readUint32(bytes, rationalOffset, littleEndian);
      const denominator = readUint32(bytes, rationalOffset + 4, littleEndian);
      return denominator === 0 ? Number.NaN : numerator / denominator;
    });
  }

  return null;
}

function valueFitsInEntry(type, count) {
  const bytesByType = { 1: 1, 2: 1, 3: 2, 4: 4, 5: 8 };
  return (bytesByType[type] || 0) * count <= 4;
}

function coordinateToDecimal(parts, ref) {
  if (!Array.isArray(parts) || parts.length < 3) return Number.NaN;

  const decimal = parts[0] + parts[1] / 60 + parts[2] / 3600;
  return ref === "S" || ref === "W" ? -decimal : decimal;
}

function readAscii(bytes, offset, length) {
  return Array.from(bytes.slice(offset, offset + length), (byte) => String.fromCharCode(byte)).join("");
}

function readUint16(bytes, offset, littleEndian) {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  return view.getUint16(offset, littleEndian);
}

function readUint32(bytes, offset, littleEndian) {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  return view.getUint32(offset, littleEndian);
}

function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

async function fileToPreviewDataUrl(file) {
  const objectUrl = URL.createObjectURL(file);

  try {
    const image = await loadImage(objectUrl);
    const maxSize = 1200;
    const scale = Math.min(1, maxSize / Math.max(image.width, image.height));
    const width = Math.max(1, Math.round(image.width * scale));
    const height = Math.max(1, Math.round(image.height * scale));
    const canvas = document.createElement("canvas");
    const context = canvas.getContext("2d");

    canvas.width = width;
    canvas.height = height;
    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, width, height);
    context.drawImage(image, 0, 0, width, height);

    return canvas.toDataURL("image/jpeg", 0.82);
  } catch {
    return fileToDataUrl(file);
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = reject;
    image.src = src;
  });
}

async function saveMemo(event) {
  event.preventDefault();

  if (!state.currentUser) {
    alert("메모를 저장하려면 Google 로그인이 필요합니다.");
    return;
  }

  const now = new Date().toISOString();
  const title = els.title.value.trim() || "제목 없는 메모";
  const body = els.body.value.trim();
  const existing = state.memos.find((memo) => memo.id === state.activeId);
  const previousMemos = JSON.stringify(state.memos);

  try {
    const selectedRange = state.photo ? getSelectedRange() : null;
    const payload = {
      title,
      body,
      photo: state.photo,
      location: state.photo?.gps || null,
      range: selectedRange,
      rangeMeters: selectedRange?.meters || null,
    };

    if (existing) {
      if (hasOwner(existing) && !isMemoOwner(existing)) {
        alert("작성자만 이 메모를 수정할 수 있습니다.");
        return;
      }

      const savedMemo = await sendMemoRequest(`/api/memos/${encodeURIComponent(existing.id)}`, "PUT", payload);
      Object.assign(existing, normalizeMemoReactions(savedMemo));
    } else {
      const memo = await sendMemoRequest("/api/memos", "POST", payload);
      state.memos.unshift(normalizeMemoReactions(memo));
      state.activeId = memo.id;
    }

    persistMemos();
    renderList();
    renderEditor();
    if (state.activeId) {
      loadOwnerReactions(state.activeId);
    }
  } catch (error) {
    state.memos = JSON.parse(previousMemos);
    alert(error.message || "메모를 저장하지 못했습니다. 사진 용량을 줄이거나 다시 시도해 주세요.");
  }
}

async function sendMemoRequest(url, method, payload) {
  const response = await fetch(url, {
    method,
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify(payload),
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(data.error || "요청을 처리하지 못했습니다.");
  }

  return data.memo;
}

async function deleteActiveMemo() {
  if (!state.activeId) return;

  try {
    const response = await fetch(`/api/memos/${encodeURIComponent(state.activeId)}`, {
      method: "DELETE",
      headers: {
        Accept: "application/json",
      },
    });
    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      throw new Error(data.error || "메모를 삭제하지 못했습니다.");
    }

    state.memos = state.memos.filter((memo) => memo.id !== state.activeId);
    persistMemos();
    startNewMemo();
    renderList();
  } catch (error) {
    alert(error.message || "메모를 삭제하지 못했습니다.");
  }
}

async function shareCurrentMemo() {
  const memo = state.memos.find((item) => item.id === state.activeId);

  if (!memo) {
    alert("공유하려면 먼저 메모를 저장해 주세요.");
    return;
  }

  const shareUrl = getShareUrl(memo.id);
  const shareData = {
    title: memo.title || "Nabime 공유 메모",
    url: shareUrl,
  };

  try {
    if (navigator.share) {
      await navigator.share(shareData);
      return;
    }

    await navigator.clipboard.writeText(shareUrl);
    alert("공유 링크를 클립보드에 복사했습니다.");
  } catch (error) {
    if (error?.name === "AbortError") return;

    try {
      await navigator.clipboard.writeText(shareUrl);
      alert("공유 링크를 클립보드에 복사했습니다.");
    } catch {
      alert("공유를 완료하지 못했습니다. 브라우저 권한을 확인해 주세요.");
    }
  }
}

function getShareUrl(id) {
  return new URL(`/shared/${encodeURIComponent(id)}`, window.location.origin).toString();
}

function openCurrentMemoMap() {
  const location = getCurrentLocation();

  if (!location) {
    alert("저장된 위치 정보가 없습니다.");
    return;
  }

  const latitude = encodeURIComponent(location.latitude);
  const longitude = encodeURIComponent(location.longitude);
  const url = `https://www.google.com/maps/search/?api=1&query=${latitude},${longitude}`;
  window.open(url, "_blank", "noopener");
}

function getCurrentLocation() {
  if (state.photo?.gps) return state.photo.gps;

  const memo = state.memos.find((item) => item.id === state.activeId);
  return memo?.location || memo?.photo?.gps || null;
}

async function renderSharedMemo(id) {
  els.appShell.hidden = true;
  els.sharedView.hidden = false;

  const memo = await fetchSharedMemo(id);

  if (!memo) {
    state.sharedMemo = null;
    els.sharedImage.hidden = true;
    els.sharedTitle.textContent = "메모를 찾을 수 없습니다";
    els.sharedLockMessage.textContent =
      "이 공유 링크는 아직 이 브라우저에서만 확인할 수 있습니다. 서버 저장 기능이 붙으면 다른 사람도 같은 링크로 볼 수 있습니다.";
    els.revealButton.hidden = true;
    els.sharedBody.hidden = true;
    return;
  }

  state.sharedMemo = memo;
  els.sharedImage.hidden = !memo.photo?.dataUrl;
  els.sharedImage.src = memo.photo?.dataUrl || "";
  els.sharedTitle.textContent = memo.title;
  els.sharedBody.textContent = memo.body || "내용 없음";

  if (isMemoOwner(memo)) {
    els.sharedBody.hidden = false;
    els.revealButton.hidden = true;
    els.sharedLockMessage.textContent = "작성자 계정으로 로그인되어 있어 메모 내용을 바로 볼 수 있습니다.";
    return;
  }

  els.sharedBody.hidden = true;
  els.revealButton.hidden = false;
  updateSharedLockMessage();
}

async function fetchSharedMemo(id) {
  try {
    const response = await fetch(`/api/memos/${encodeURIComponent(id)}`, {
      headers: {
        Accept: "application/json",
      },
    });

    if (!response.ok) return null;

    const data = await response.json();
    return data.memo || null;
  } catch {
    return state.memos.find((item) => item.id === id) || loadMemos().find((item) => item.id === id) || null;
  }
}

async function revealSharedMemo() {
  const memo = state.sharedMemo;
  const target = memo ? memo.location || memo.photo?.gps : null;
  const rangeMeters = memo ? getMemoRangeMeters(memo) : null;

  if (!target || !rangeMeters) {
    alert("위치 기반 열람 정보가 없습니다.");
    return;
  }

  if (!navigator.geolocation) {
    alert("이 브라우저에서는 현재 위치 확인을 사용할 수 없습니다.");
    return;
  }

  els.revealButton.disabled = true;
  els.revealButton.textContent = "위치 확인 중";

  try {
    const current = await getBrowserLocation();
    const distance = getDistanceMeters(current, target);

    if (distance <= rangeMeters) {
      els.sharedBody.hidden = false;
      els.sharedLockMessage.textContent = "열람 범위 안에 있어 메모 내용을 볼 수 있습니다.";
      els.revealButton.hidden = true;
      return;
    }

    els.sharedLockMessage.textContent =
      `현재 위치는 사진이 표시된 위치에서 약 ${formatDistance(distance)} 떨어져 있습니다. ` +
      `사진이 표시된 위치에서 ${RANGE_LABELS[rangeMeters]} 이내로 이동하셔야 메모의 내용을 볼 수 있습니다.`;
  } catch {
    alert("현재 위치를 확인하지 못했습니다. 브라우저 위치 권한을 허용해 주세요.");
  } finally {
    els.revealButton.disabled = false;
    els.revealButton.textContent = "내용보기";
  }
}

function updateSharedLockMessage() {
  const rangeMeters = getMemoRangeMeters(state.sharedMemo);
  const rangeLabel = RANGE_LABELS[rangeMeters] || "열람가능 범위";

  els.sharedLockMessage.textContent =
    `사진이 표시된 위치에서 ${rangeLabel} 이내로 이동하셔야 메모의 내용을 볼 수 있습니다.`;
}

function hasOwner(memo) {
  return Boolean(memo?.ownerId || memo?.ownerEmail);
}

function isMemoOwner(memo) {
  if (!memo || !state.currentUser) return false;

  const currentId = state.currentUser.id || state.currentUser.email;
  return Boolean(
    (memo.ownerId && memo.ownerId === currentId) ||
      (memo.ownerEmail && memo.ownerEmail === state.currentUser.email),
  );
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
      {
        enableHighAccuracy: true,
        timeout: 12000,
        maximumAge: 0,
      },
    );
  });
}

function getDistanceMeters(from, to) {
  const earthRadiusMeters = 6371000;
  const lat1 = degreesToRadians(from.latitude);
  const lat2 = degreesToRadians(to.latitude);
  const latDelta = degreesToRadians(to.latitude - from.latitude);
  const lonDelta = degreesToRadians(to.longitude - from.longitude);
  const a =
    Math.sin(latDelta / 2) * Math.sin(latDelta / 2) +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(lonDelta / 2) * Math.sin(lonDelta / 2);

  return earthRadiusMeters * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function degreesToRadians(degrees) {
  return (degrees * Math.PI) / 180;
}

function formatDistance(meters) {
  if (meters >= 1000) return `${(meters / 1000).toFixed(1)}km`;
  return `${Math.round(meters)}m`;
}

function buildShareText(memo) {
  const lines = [];
  const title = memo?.title || els.title.value.trim() || "제목 없는 메모";
  const location = memo?.location || memo?.photo?.gps || state.photo?.gps;
  const rangeMeters = memo ? getMemoRangeMeters(memo) : Number(els.rangeSelect.value);
  const rangeLabel = RANGE_LABELS[rangeMeters] || "열람가능 범위";

  lines.push(title);
  lines.push("", "이 메모의 내용은 사진이 표시된 위치 근처에서만 볼 수 있습니다.");

  if (location) {
    lines.push(
      "",
      `위치: ${location.latitude.toFixed(6)}, ${location.longitude.toFixed(6)}`,
      `열람가능 범위: ${rangeLabel}`,
    );
  }

  return lines.join("\n");
}

function startNewMemo() {
  state.activeId = null;
  resetOwnerReactions();
  els.title.value = "";
  els.body.value = "";
  els.rangeSelect.value = "50";
  clearPhoto();
  renderEditor();
  renderList();
}

function selectMemo(id) {
  const memo = state.memos.find((item) => item.id === id);
  if (!memo) return;

  state.activeId = id;
  applyMemoReactions(memo);
  els.title.value = memo.title;
  els.body.value = memo.body;
  state.photo = memo.photo;
  els.rangeSelect.value = String(getMemoRangeMeters(memo) || 50);
  renderEditor();
  renderList();
  loadOwnerReactions(id);
}

function renderEditor() {
  els.deleteButton.hidden = !state.activeId;
  renderPhoto();
  renderOwnerReactions();
}

function clearPhoto() {
  state.photo = null;
  renderPhoto();
}

function renderPhoto() {
  if (!state.photo) {
    els.photoStatus.textContent = "첨부된 사진 없음";
    els.photoPreview.hidden = true;
    els.rangeField.hidden = true;
    els.rangeSelect.value = "50";
    els.previewImage.removeAttribute("src");
    els.gpsText.textContent = "";
    return;
  }

  els.photoStatus.textContent = state.photo.name;
  els.photoPreview.hidden = false;
  els.rangeField.hidden = false;
  els.previewImage.src = state.photo.dataUrl;
  els.gpsText.textContent = `위도 ${state.photo.gps.latitude.toFixed(6)}, 경도 ${state.photo.gps.longitude.toFixed(6)}`;
}

function renderList() {
  const keyword = els.search.value.trim().toLowerCase();
  const visibleMemos = state.memos.filter((memo) => {
    return `${memo.title} ${memo.body}`.toLowerCase().includes(keyword);
  });

  els.list.innerHTML = "";

  if (visibleMemos.length === 0) {
    const empty = document.createElement("div");
    empty.className = "empty-state";
    empty.textContent = keyword ? "검색 결과가 없습니다" : "아직 저장된 메모가 없습니다";
    els.list.append(empty);
    return;
  }

  visibleMemos.forEach((memo) => {
    const item = document.createElement("button");
    item.type = "button";
    item.className = `memo-item${memo.id === state.activeId ? " is-active" : ""}`;
    item.addEventListener("click", () => selectMemo(memo.id));

    const title = document.createElement("strong");
    title.textContent = memo.title;

    const body = document.createElement("span");
    body.textContent = memo.body || "내용 없음";

    item.append(title, body);

    const location = memo.location || memo.photo?.gps;

    if (location) {
      const gps = document.createElement("small");
      const rangeMeters = getMemoRangeMeters(memo);
      const rangeLabel = rangeMeters ? RANGE_LABELS[rangeMeters] : "";
      gps.textContent = `GPS ${location.latitude.toFixed(4)}, ${location.longitude.toFixed(4)}${rangeLabel ? ` · ${rangeLabel}` : ""}`;
      item.append(gps);
    }

    if (memo.ownerEmail) {
      const owner = document.createElement("small");
      owner.textContent = isMemoOwner(memo) ? "내 메모" : `작성자 ${memo.ownerName || memo.ownerEmail}`;
      item.append(owner);
    }

    els.list.append(item);
  });
}

async function loadOwnerReactions(memoId) {
  resetOwnerReactions(memoId);
  applyMemoReactions(state.memos.find((memo) => memo.id === memoId));
  renderOwnerReactions();

  try {
    const response = await fetch(`/api/memos/${encodeURIComponent(memoId)}/reactions`, {
      headers: {
        Accept: "application/json",
      },
    });

    if (!response.ok) return;

    const data = await response.json();

    if (state.activeId !== memoId) return;

    state.ownerReactions = {
      memoId,
      likeCount: data.likeCount || 0,
      comments: data.comments || [],
      page: 0,
    };
    const memo = state.memos.find((item) => item.id === memoId);
    if (memo) {
      memo.reactions = {
        likeCount: state.ownerReactions.likeCount,
        comments: state.ownerReactions.comments,
      };
    }
    renderOwnerReactions();
  } catch {
    renderOwnerReactions();
  }
}

function normalizeMemoReactions(memo) {
  return {
    ...memo,
    reactions: {
      likeCount: memo.reactions?.likeCount || 0,
      likedByViewer: Boolean(memo.reactions?.likedByViewer),
      comments: memo.reactions?.comments || [],
    },
  };
}

function applyMemoReactions(memo) {
  if (!memo || !state.activeId) return;

  state.ownerReactions = {
    memoId: memo.id,
    likeCount: memo.reactions?.likeCount || 0,
    comments: memo.reactions?.comments || [],
    page: 0,
  };
}

function resetOwnerReactions(memoId = null) {
  state.ownerReactions = {
    memoId,
    likeCount: 0,
    comments: [],
    page: 0,
  };
}

function renderOwnerReactions() {
  if (!els.ownerReactionPanel) return;

  if (!state.activeId || state.ownerReactions.memoId !== state.activeId) {
    els.ownerReactionPanel.hidden = !state.activeId;
    els.ownerLikeCount.textContent = "0개";
    els.ownerCommentCount.textContent = "0개";
    els.ownerCommentPage.textContent = "1 / 1";
    els.ownerCommentList.innerHTML = "";
    els.ownerCommentList.append(createOwnerEmptyComment());
    els.ownerCommentPrev.disabled = true;
    els.ownerCommentNext.disabled = true;
    return;
  }

  const reactions = state.ownerReactions;
  const pageSize = 5;
  const totalPages = Math.max(1, Math.ceil(reactions.comments.length / pageSize));
  reactions.page = Math.min(reactions.page, totalPages - 1);
  const start = reactions.page * pageSize;
  const visibleComments = reactions.comments.slice(start, start + pageSize);

  els.ownerReactionPanel.hidden = false;
  els.ownerLikeCount.textContent = `${reactions.likeCount}개`;
  els.ownerCommentCount.textContent = `${reactions.comments.length}개`;
  els.ownerCommentPage.textContent = `${reactions.page + 1} / ${totalPages}`;
  els.ownerCommentList.innerHTML = "";

  if (visibleComments.length === 0) {
    els.ownerCommentList.append(createOwnerEmptyComment());
  } else {
    visibleComments.forEach((comment) => {
      const item = document.createElement("article");
      item.className = "owner-comment-item";

      const header = document.createElement("div");
      header.className = "owner-comment-meta";

      const name = document.createElement("strong");
      name.textContent = comment.userName || "익명";

      const date = document.createElement("span");
      date.textContent = formatCommentDate(comment.createdAt);

      const body = document.createElement("p");
      body.textContent = comment.body;

      header.append(name, date);
      item.append(header, body);
      els.ownerCommentList.append(item);
    });
  }

  els.ownerCommentPrev.disabled = reactions.page <= 0;
  els.ownerCommentNext.disabled = reactions.page >= totalPages - 1;
}

function createOwnerEmptyComment() {
  const empty = document.createElement("p");
  empty.className = "owner-empty-comments";
  empty.textContent = "아직 댓글이 없습니다.";
  return empty;
}

function changeOwnerCommentPage(delta) {
  if (!state.activeId || state.ownerReactions.memoId !== state.activeId) return;

  const totalPages = Math.max(1, Math.ceil(state.ownerReactions.comments.length / 5));
  state.ownerReactions.page = Math.min(
    totalPages - 1,
    Math.max(0, state.ownerReactions.page + delta),
  );
  renderOwnerReactions();
}

function formatCommentDate(value) {
  if (!value) return "";

  try {
    return new Intl.DateTimeFormat("ko-KR", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(value));
  } catch {
    return "";
  }
}

function getSelectedRange() {
  const meters = Number(els.rangeSelect.value);

  return {
    label: RANGE_LABELS[meters],
    meters,
  };
}

function getMemoRangeMeters(memo) {
  if (Number.isFinite(memo.rangeMeters)) return memo.rangeMeters;
  if (Number.isFinite(memo.range?.meters)) return memo.range.meters;

  const legacyRanges = {
    "50m": 50,
    "100m": 100,
    "1km": 1000,
    "10km": 10000,
  };

  return legacyRanges[memo.range] || null;
}
