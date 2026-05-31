const STORAGE_KEY = "memo-place-items";
const RANGE_LABELS = {
  50: "50m",
  100: "100m",
  1000: "1km",
  10000: "10km",
};

const state = {
  memos: loadMemos(),
  activeId: null,
  photo: null,
};

const els = {
  form: document.querySelector("#memoForm"),
  title: document.querySelector("#titleInput"),
  body: document.querySelector("#bodyInput"),
  photoInput: document.querySelector("#photoInput"),
  attachButton: document.querySelector("#attachButton"),
  photoStatus: document.querySelector("#photoStatus"),
  photoPreview: document.querySelector("#photoPreview"),
  previewImage: document.querySelector("#previewImage"),
  gpsText: document.querySelector("#gpsText"),
  rangeField: document.querySelector("#rangeField"),
  rangeSelect: document.querySelector("#rangeSelect"),
  removePhotoButton: document.querySelector("#removePhotoButton"),
  deleteButton: document.querySelector("#deleteButton"),
  newMemoButton: document.querySelector("#newMemoButton"),
  search: document.querySelector("#searchInput"),
  list: document.querySelector("#memoList"),
};

els.attachButton.addEventListener("click", () => els.photoInput.click());
els.photoInput.addEventListener("change", handlePhotoSelect);
els.removePhotoButton.addEventListener("click", clearPhoto);
els.form.addEventListener("submit", saveMemo);
els.deleteButton.addEventListener("click", deleteActiveMemo);
els.newMemoButton.addEventListener("click", startNewMemo);
els.search.addEventListener("input", renderList);

renderList();

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

    const dataUrl = await fileToDataUrl(file);
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

function saveMemo(event) {
  event.preventDefault();

  const now = new Date().toISOString();
  const title = els.title.value.trim() || "제목 없는 메모";
  const body = els.body.value.trim();
  const existing = state.memos.find((memo) => memo.id === state.activeId);

  if (existing) {
    const selectedRange = state.photo ? getSelectedRange() : null;
    existing.title = title;
    existing.body = body;
    existing.photo = state.photo;
    existing.location = state.photo?.gps || null;
    existing.range = selectedRange;
    existing.rangeMeters = selectedRange?.meters || null;
    existing.updatedAt = now;
  } else {
    const selectedRange = state.photo ? getSelectedRange() : null;
    const memo = {
      id: crypto.randomUUID(),
      title,
      body,
      photo: state.photo,
      location: state.photo?.gps || null,
      range: selectedRange,
      rangeMeters: selectedRange?.meters || null,
      createdAt: now,
      updatedAt: now,
    };
    state.memos.unshift(memo);
    state.activeId = memo.id;
  }

  persistMemos();
  renderList();
  renderEditor();
}

function deleteActiveMemo() {
  if (!state.activeId) return;

  state.memos = state.memos.filter((memo) => memo.id !== state.activeId);
  persistMemos();
  startNewMemo();
  renderList();
}

function startNewMemo() {
  state.activeId = null;
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
  els.title.value = memo.title;
  els.body.value = memo.body;
  state.photo = memo.photo;
  els.rangeSelect.value = String(getMemoRangeMeters(memo) || 50);
  renderEditor();
  renderList();
}

function renderEditor() {
  els.deleteButton.hidden = !state.activeId;
  renderPhoto();
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

    els.list.append(item);
  });
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
