import { ImagePlus, Link2 } from 'lucide-react';
// 공지 작성 도구: 굵게·기울임·제목·목록·링크·글꼴·글자 색·이미지 올리기 버튼 + 미리보기.
// 마크다운으로 저장하고, 글꼴·색은 <span style> 로 넣는다(보여줄 때 DOMPurify 로 거름).

import { useRef, useState } from 'react';
import { uploadImage } from '@/lib/image';
import { COLORS, FONTS } from '@/lib/markdown';
import { useToast } from '@/ui/Toast';
import { Markdown } from './Markdown';

interface Props {
  value: string;
  onChange(v: string): void;
}

export function NoticeEditor({ value, onChange }: Props) {
  const ta = useRef<HTMLTextAreaElement>(null);
  const toast = useToast();
  const [tab, setTab] = useState<'write' | 'preview'>('write');
  const [uploading, setUploading] = useState(false);

  /** 선택한 글자를 앞뒤로 감싼다(선택이 없으면 예시 글자를 넣는다) */
  function wrap(before: string, after = before, sample = '글자') {
    const el = ta.current;
    if (!el) return;
    const { selectionStart: s, selectionEnd: e } = el;
    const sel = value.slice(s, e) || sample;
    const next = value.slice(0, s) + before + sel + after + value.slice(e);
    onChange(next);
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(s + before.length, s + before.length + sel.length);
    });
  }

  /** 선택한 줄들 맨 앞에 붙인다(제목·목록) */
  function prefixLines(prefix: string) {
    const el = ta.current;
    if (!el) return;
    const s = value.lastIndexOf('\n', el.selectionStart - 1) + 1;
    const eIdx = value.indexOf('\n', el.selectionEnd);
    const e = eIdx === -1 ? value.length : eIdx;
    const block = value
      .slice(s, e)
      .split('\n')
      .map((l) => prefix + l.replace(/^(#{1,3} |- )/, ''))
      .join('\n');
    onChange(value.slice(0, s) + block + value.slice(e));
    requestAnimationFrame(() => el.focus());
  }

  function insert(text: string) {
    const el = ta.current;
    const pos = el?.selectionStart ?? value.length;
    onChange(value.slice(0, pos) + text + value.slice(pos));
  }

  async function addImage(file: File) {
    setUploading(true);
    try {
      const url = await uploadImage(`notices/${Date.now()}-${Math.random().toString(36).slice(2, 6)}.webp`, file, 1280);
      insert(`\n![이미지](${url})\n`);
    } catch (e) {
      toast((e as Error).message || '이미지를 올리지 못했어요.', 'error');
    } finally {
      setUploading(false);
    }
  }

  const btn = 'min-h-10 min-w-10 rounded-xl px-2.5 text-[14px] font-semibold hover:bg-white';
  return (
    <div className="rounded-2xl ring-1 ring-line">
      <div className="flex flex-wrap items-center gap-1 rounded-t-2xl bg-soft p-1.5" role="toolbar" aria-label="글 꾸미기">
        <button type="button" className={`${btn} font-extrabold`} onClick={() => wrap('**')} title="굵게">
          B
        </button>
        <button type="button" className={`${btn} italic`} onClick={() => wrap('*')} title="기울임">
          I
        </button>
        <button type="button" className={btn} onClick={() => prefixLines('## ')} title="제목">
          제목
        </button>
        <button type="button" className={btn} onClick={() => prefixLines('- ')} title="목록">
          • 목록
        </button>
        <button type="button" className={btn} onClick={() => wrap('[', '](https://)', '링크 글자')} title="링크">
          <Link2 size={15} className="mr-1 inline -mt-0.5" aria-hidden />링크
        </button>
        <select
          aria-label="글꼴"
          className="h-10 rounded-xl bg-white px-2 text-[14px]"
          value=""
          onChange={(e) => {
            const f = FONTS.find((x) => x.label === e.target.value);
            if (f?.value) wrap(`<span style="font-family: ${f.value}">`, '</span>');
          }}
        >
          <option value="" disabled>
            글꼴
          </option>
          {FONTS.filter((f) => f.value).map((f) => (
            <option key={f.label} value={f.label}>
              {f.label}
            </option>
          ))}
        </select>
        <span className="flex items-center gap-0.5 px-1" aria-label="글자 색">
          {COLORS.map((c) => (
            <button key={c} type="button" onClick={() => wrap(`<span style="color: ${c}">`, '</span>')} className="grid size-9 place-items-center rounded-lg hover:bg-white" title={`글자 색 ${c}`}>
              <span className="size-5 rounded-full ring-1 ring-black/10" style={{ background: c }} />
            </button>
          ))}
        </span>
        <label className={`${btn} inline-flex cursor-pointer items-center`}>
          {uploading ? '올리는 중…' : <><ImagePlus size={15} className="mr-1" aria-hidden />이미지</>}
          <input type="file" accept="image/*" className="sr-only" disabled={uploading} onChange={(e) => e.target.files?.[0] && addImage(e.target.files[0])} />
        </label>
        <span className="ml-auto flex rounded-xl bg-white p-0.5">
          {(['write', 'preview'] as const).map((k) => (
            <button key={k} type="button" onClick={() => setTab(k)} className={`min-h-9 rounded-lg px-3 text-[13px] font-bold ${tab === k ? 'bg-ink text-white' : 'text-sub'}`}>
              {k === 'write' ? '작성' : '미리보기'}
            </button>
          ))}
        </span>
      </div>
      {tab === 'write' ? (
        <textarea
          ref={ta}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="공지 내용을 입력해 주세요."
          className="block min-h-64 w-full resize-y rounded-b-2xl p-3 font-mono text-[14px] leading-relaxed outline-none"
        />
      ) : (
        <div className="min-h-64 p-4">{value.trim() ? <Markdown text={value} /> : <p className="text-sub">미리볼 내용이 없어요.</p>}</div>
      )}
    </div>
  );
}
