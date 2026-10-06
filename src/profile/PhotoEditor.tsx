// 프로필 사진 바꾸기: 기기에서 긴 변 512px 이하로 줄여 올린 뒤 서버에 알린다(교사 화면 복사본까지 갱신).

import { useState } from 'react';
import { useSession } from '@/auth/AuthProvider';
import { call } from '@/lib/call';
import { uploadImage } from '@/lib/image';
import { Avatar } from '@/teacher/attendance';
import { useToast } from '@/ui/Toast';

export function PhotoEditor({ url, name }: { url: string | null | undefined; name: string }) {
  const { user } = useSession();
  const toast = useToast();
  const [busy, setBusy] = useState(false);

  async function upload(file: File) {
    setBusy(true);
    try {
      const path = `profiles/${user.uid}/${Date.now()}.webp`;
      const photoUrl = await uploadImage(path, file, 512);
      await call('updateProfile', { photoPath: path, photoUrl });
      toast('프로필 사진을 바꿨어요', 'success');
    } catch (e) {
      toast((e as Error).message || '사진을 올리지 못했어요.', 'error');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex items-center gap-4">
      <div className="relative">
        <Avatar url={url} name={name || '?'} size={88} />
        {busy && <span className="absolute inset-0 grid place-items-center rounded-full bg-white/70 text-[13px] font-bold">올리는 중…</span>}
      </div>
      <div className="flex flex-col gap-2">
        <label className="inline-flex min-h-11 cursor-pointer items-center justify-center rounded-full bg-soft px-4 text-[14px] font-semibold hover:bg-line">
          📷 사진 바꾸기
          <input
            type="file"
            accept="image/*"
            className="sr-only"
            disabled={busy}
            onChange={(e) => {
              const f = e.target.files?.[0];
              e.target.value = '';
              if (f) void upload(f);
            }}
          />
        </label>
        {url && (
          <button
            type="button"
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              try {
                await call('updateProfile', { removePhoto: true });
              } catch (e) {
                toast((e as Error).message, 'error');
              } finally {
                setBusy(false);
              }
            }}
            className="min-h-10 rounded-full px-4 text-[13px] font-semibold text-sub hover:bg-soft"
          >
            사진 지우기
          </button>
        )}
      </div>
    </div>
  );
}
