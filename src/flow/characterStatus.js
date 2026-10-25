// Pure helpers over the stored character records ({ key, selectedFile, approved, generations })

export function characterImageUrl(videoId, key, file) {
  return `mecatube-media://character/${encodeURIComponent(videoId)}/${encodeURIComponent(key)}/${encodeURIComponent(file)}`;
}

// True when every key has a record with a selected image (and there is at least one key)
export function allSelected(records, keys) {
  return keys.length > 0 && keys.every((key) => Boolean(records?.[key]?.selectedFile));
}

// Characters stage is done when the video has characters and all are approved with an image
export function charactersDone(list) {
  return Array.isArray(list) && list.length > 0 && list.every((item) => item?.approved === true && Boolean(item.selectedFile));
}
