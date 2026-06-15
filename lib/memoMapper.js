export function toClientMemo(memo) {
  return {
    id: memo.id,
    title: memo.title,
    body: memo.body,
    photo: memo.photoDataUrl
      ? {
          name: memo.photoName || "photo",
          type: memo.photoType || "image/jpeg",
          dataUrl: memo.photoDataUrl,
          gps:
            memo.latitude !== null && memo.longitude !== null
              ? {
                  latitude: memo.latitude,
                  longitude: memo.longitude,
                }
              : null,
        }
      : null,
    location:
      memo.latitude !== null && memo.longitude !== null
        ? {
            latitude: memo.latitude,
            longitude: memo.longitude,
          }
        : null,
    range: memo.rangeMeters
      ? {
          label: memo.rangeLabel,
          meters: memo.rangeMeters,
        }
      : null,
    rangeMeters: memo.rangeMeters,
    ownerId: memo.ownerId,
    ownerEmail: memo.ownerEmail,
    ownerName: memo.ownerName,
    createdAt: memo.createdAt.toISOString(),
    updatedAt: memo.updatedAt.toISOString(),
  };
}

export function memoPayloadToData(payload, user) {
  return {
    title: payload.title || "제목 없는 메모",
    body: payload.body || "",
    photoName: payload.photo?.name || null,
    photoType: payload.photo?.type || null,
    photoDataUrl: payload.photo?.dataUrl || null,
    latitude: payload.location?.latitude ?? payload.photo?.gps?.latitude ?? null,
    longitude: payload.location?.longitude ?? payload.photo?.gps?.longitude ?? null,
    rangeLabel: payload.range?.label || null,
    rangeMeters: payload.rangeMeters ?? payload.range?.meters ?? null,
    ownerId: user.id || user.email,
    ownerEmail: user.email,
    ownerName: user.name || null,
  };
}
