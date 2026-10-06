// 담당교사 고르기: 이름을 입력하면 입력값과 일치하는 교사만 아래에 나오고, 입력이 바뀌면 목록도 바뀐다. 여러 명 고를 수 있다.

import { useId, useState } from 'react';
import type { TeacherRow } from './AdminData';

interface Props {
  teachers: TeacherRow[];
  value: string[];
  onChange(ids: string[]): void;
}

export function TeacherPicker({ teachers, value, onChange }: Props) {
  const [text, setText] = useState('');
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const listId = useId();
  const byId = new Map(teachers.map((t) => [t.id, t]));
  const q = text.replace(/\s/g, '');
  const matches = teachers.filter((t) => !value.includes(t.id) && t.name.replace(/\s/g, '').includes(q));

  const pick = (id: string) => {
    onChange([...value, id]);
    setText('');
    setActive(0);
  };

  return (
    <div>
      <span className="text-[13px] font-semibold text-sub">담당교사</span>
      <div className="mt-1 flex flex-wrap gap-1.5">
        {value.map((id) => (
          <span key={id} className="inline-flex items-center gap-1 rounded-full bg-brand-50 py-1 pr-1 pl-3 text-[14px] font-semibold text-brand-700">
            {byId.get(id)?.name ?? '(삭제된 교사)'}
            <button
              type="button"
              onClick={() => onChange(value.filter((x) => x !== id))}
              className="grid size-7 place-items-center rounded-full hover:bg-brand-100"
              aria-label={`${byId.get(id)?.name ?? ''} 빼기`}
            >
              ✕
            </button>
          </span>
        ))}
        {value.length === 0 && <span className="py-1 text-[14px] text-sub">아직 없음</span>}
      </div>
      <div className="relative mt-2">
        <input
          role="combobox"
          aria-expanded={open}
          aria-controls={listId}
          aria-autocomplete="list"
          placeholder="이름을 입력해 찾기"
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            setOpen(true);
            setActive(0);
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
          onKeyDown={(e) => {
            if (e.key === 'ArrowDown') setActive((i) => Math.min(i + 1, matches.length - 1));
            else if (e.key === 'ArrowUp') setActive((i) => Math.max(i - 1, 0));
            else if (e.key === 'Enter' && matches[active]) {
              e.preventDefault();
              pick(matches[active].id);
            } else if (e.key === 'Escape') setOpen(false);
          }}
          className="block h-11 w-full rounded-xl border border-line bg-soft px-3 text-[15px] outline-none focus:border-brand-500 focus:bg-white focus:ring-4 focus:ring-brand-100"
        />
        {open && (
          <ul id={listId} role="listbox" className="absolute inset-x-0 top-full z-10 mt-1 max-h-56 overflow-y-auto rounded-2xl bg-white p-1 shadow-xl ring-1 ring-line">
            {matches.length === 0 ? (
              <li className="px-3 py-2 text-[14px] text-sub">일치하는 교사가 없어요</li>
            ) : (
              matches.map((t, i) => (
                <li key={t.id} role="option" aria-selected={i === active}>
                  <button
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => pick(t.id)}
                    className={`flex min-h-10 w-full items-center gap-2 rounded-xl px-3 text-left text-[15px] ${i === active ? 'bg-soft' : ''}`}
                  >
                    <span className="font-semibold">{t.name}</span>
                    <span className="text-[12px] text-sub">{t.homeroom === null ? '교과' : t.homeroom === 0 ? '전체 담당' : `${t.homeroom}반 담임`}</span>
                  </button>
                </li>
              ))
            )}
          </ul>
        )}
      </div>
    </div>
  );
}
