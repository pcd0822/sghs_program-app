// 이미지를 올리기 전에 기기에서 작게 줄인다(긴 변 maxSide 이하, webp).

import { getStorageLazy } from './firebase';

export async function resizeImage(file: File, maxSide: number, quality = 0.85): Promise<Blob> {
  if (!file.type.startsWith('image/')) throw new Error('이미지 파일만 올릴 수 있어요.');
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
  const w = Math.round(bitmap.width * scale);
  const h = Math.round(bitmap.height * scale);
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  canvas.getContext('2d')!.drawImage(bitmap, 0, 0, w, h);
  bitmap.close();
  const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, 'image/webp', quality));
  if (!blob) throw new Error('이미지를 줄이지 못했어요. 다른 사진으로 해 주세요.');
  return blob;
}

/** 줄인 뒤 Storage 에 올리고 주소를 돌려준다. */
export async function uploadImage(path: string, file: File, maxSide: number): Promise<string> {
  const blob = await resizeImage(file, maxSide);
  const [storage, { ref, uploadBytes, getDownloadURL }] = await Promise.all([getStorageLazy(), import('firebase/storage')]);
  const r = ref(storage, path);
  await uploadBytes(r, blob, { contentType: 'image/webp', cacheControl: 'public, max-age=31536000' });
  return getDownloadURL(r);
}
