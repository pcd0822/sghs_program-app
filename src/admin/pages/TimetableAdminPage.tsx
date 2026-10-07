import { CalendarDays, Megaphone } from 'lucide-react';
import { useState } from 'react';
import { findOverlaps, overlapText } from '@shared/admin';
import { OPERATING_DATES } from '@shared/constants';
import type { DayNote, FixedEvent } from '@shared/types';
import { formatDate, timeRange } from '@/lib/format';
import { eventIcon } from '@/timetable/WeekView';
import { Button } from '@/ui/Button';
import { Sheet } from '@/ui/Sheet';
import { useToast } from '@/ui/Toast';
import { useAdmin } from '../AdminData';
import { Area, Card, DirtyDot, Field, PageHead, SmallButton } from '../ui';

const rid = () => Math.random().toString(36).slice(2, 10);

export default function TimetableAdminPage() {
  const a = useAdmin();
  const toast = useToast();
  const tt = a.timetable;
  const [ev, setEv] = useState<{ e: FixedEvent; isNew: boolean } | null>(null);
  const [note, setNote] = useState<{ n: DayNote; isNew: boolean } | null>(null);

  function saveEvent() {
    if (!ev) return;
    const e = { ...ev.e, title: ev.e.title.trim() };
    if (!e.title) return toast('일정 이름을 입력해 주세요.', 'error');
    if (!(e.start < e.end)) return toast('끝나는 시각이 시작보다 늦어야 해요.', 'error');
    // 같은 날짜 강좌 운영 시간과 겹치면 막고 이유를 알려준다
    const ov = findOverlaps(a.courses, [e]);
    if (ov.length) return toast(`저장할 수 없어요. ${overlapText(ov[0])}${ov.length > 1 ? ` 외 ${ov.length - 1}개 강좌` : ''}`, 'error');
    const list = ev.isNew ? [...tt.fixedEvents, e] : tt.fixedEvents.map((x) => (x.id === e.id ? e : x));
    a.setTimetable({ ...tt, fixedEvents: list });
    setEv(null);
  }

  function saveNote() {
    if (!note) return;
    const n = { ...note.n, text: note.n.text.trim() };
    if (!n.text) return toast('안내 문구를 입력해 주세요.', 'error');
    if (!n.dates.length) return toast('안내를 보일 날짜를 하나 이상 골라 주세요.', 'error');
    const list = note.isNew ? [...tt.dayNotes, n] : tt.dayNotes.map((x) => (x.id === n.id ? n : x));
    a.setTimetable({ ...tt, dayNotes: list });
    setNote(null);
  }

  return (
    <div className="space-y-5">
      <PageHead icon={CalendarDays} tone="amber" title="시간표 관리" desc='학교 고정 일정과 날짜별 안내 문구. 강좌 시간과 겹치는 고정 일정은 저장할 수 없어요.' />
      {a.dirtyKeys.timetable && (
        <p className="text-[14px] font-semibold text-orange-600">
          <DirtyDot /> 저장하지 않은 시간표 변경이 있어요
        </p>
      )}

      <Card>
        <div className="flex items-center">
          <h2 className="flex flex-1 items-center gap-1.5 text-[17px] font-extrabold"><Megaphone size={18} className="text-brand-600" aria-hidden /> 날짜별 안내 문구</h2>
          <SmallButton tone="brand" onClick={() => setNote({ n: { id: rid(), dates: [], text: '' }, isNew: true })}>
            ＋ 안내 추가
          </SmallButton>
        </div>
        <ul className="mt-2 space-y-2">
          {tt.dayNotes.map((n) => (
            <li key={n.id} className="flex items-center gap-2 rounded-2xl bg-sky-50 px-3 py-2">
              <span className="min-w-0 flex-1">
                <span className="block font-semibold text-sky-900">{n.text}</span>
                <span className="block text-[12px] text-sky-700">{n.dates.map(formatDate).join(', ')}</span>
              </span>
              <SmallButton onClick={() => setNote({ n, isNew: false })}>수정</SmallButton>
              <SmallButton tone="danger" onClick={() => a.setTimetable({ ...tt, dayNotes: tt.dayNotes.filter((x) => x.id !== n.id) })}>
                삭제
              </SmallButton>
            </li>
          ))}
        </ul>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        {OPERATING_DATES.map((d) => {
          const events = tt.fixedEvents.filter((e) => e.date === d).sort((x, y) => x.start.localeCompare(y.start));
          const courses = a.courses.filter((c) => c.date === d);
          const slots = [...new Set(courses.map((c) => `${c.start}~${c.end}`))];
          return (
            <Card key={d}>
              <div className="flex items-center">
                <h2 className="flex-1 text-[17px] font-extrabold">{formatDate(d)}</h2>
                <SmallButton onClick={() => setEv({ e: { id: rid(), date: d, start: '08:30', end: '09:30', title: '', place: '', description: '' }, isNew: true })}>＋ 고정 일정</SmallButton>
              </div>
              {slots.length > 0 && <p className="mt-1 text-[12px] text-sub">강좌 운영 시간: {slots.join(', ')} ({courses.length}개)</p>}
              <ul className="mt-2 space-y-1.5">
                {events.length === 0 && <li className="text-[14px] text-sub">고정 일정 없음</li>}
                {events.map((e) => (
                  <li key={e.id} className="flex items-center gap-2 rounded-2xl bg-soft px-3 py-2">
                    <span className="w-24 shrink-0 text-[13px] font-semibold text-sub tabular-nums">{timeRange(e)}</span>
                    <span className="min-w-0 flex-1 truncate font-semibold">
                      <EventGlyph title={e.title} /> {e.title} <span className="font-normal text-sub">{e.place}</span>
                    </span>
                    <SmallButton onClick={() => setEv({ e, isNew: false })}>수정</SmallButton>
                    <SmallButton tone="danger" onClick={() => a.setTimetable({ ...tt, fixedEvents: tt.fixedEvents.filter((x) => x.id !== e.id) })}>
                      삭제
                    </SmallButton>
                  </li>
                ))}
              </ul>
            </Card>
          );
        })}
      </div>

      {ev && (
        <Sheet
          open
          onClose={() => setEv(null)}
          title={`${formatDate(ev.e.date)} 고정 일정`}
          footer={
            <Button variant="brand" onClick={saveEvent}>
              적용하기
            </Button>
          }
        >
          <div className="space-y-3 pb-4">
            <Field label="일정 이름" value={ev.e.title} onChange={(x) => setEv({ ...ev, e: { ...ev.e, title: x.target.value } })} placeholder="예: 독서" />
            <div className="grid grid-cols-2 gap-3">
              <Field label="시작" type="time" value={ev.e.start} onChange={(x) => setEv({ ...ev, e: { ...ev.e, start: x.target.value } })} />
              <Field label="끝" type="time" value={ev.e.end} onChange={(x) => setEv({ ...ev, e: { ...ev.e, end: x.target.value } })} />
            </div>
            <Field label="장소" value={ev.e.place} onChange={(x) => setEv({ ...ev, e: { ...ev.e, place: x.target.value } })} />
            <Area label="설명(선택)" value={ev.e.description} onChange={(x) => setEv({ ...ev, e: { ...ev.e, description: x.target.value } })} />
          </div>
        </Sheet>
      )}

      {note && (
        <Sheet
          open
          onClose={() => setNote(null)}
          title="날짜별 안내 문구"
          footer={
            <Button variant="brand" onClick={saveNote}>
              적용하기
            </Button>
          }
        >
          <div className="space-y-3 pb-4">
            <Area label="안내 문구" value={note.n.text} onChange={(x) => setNote({ ...note, n: { ...note.n, text: x.target.value } })} />
            <div>
              <span className="text-[13px] font-semibold text-sub">보일 날짜</span>
              <div className="mt-1 flex flex-wrap gap-1.5">
                {OPERATING_DATES.map((d) => {
                  const on = note.n.dates.includes(d);
                  return (
                    <button
                      key={d}
                      type="button"
                      aria-pressed={on}
                      onClick={() => setNote({ ...note, n: { ...note.n, dates: on ? note.n.dates.filter((x) => x !== d) : [...note.n.dates, d].sort() } })}
                      className={`min-h-10 rounded-full px-3 text-[14px] font-bold ${on ? 'bg-brand-600 text-white' : 'bg-soft text-sub'}`}
                    >
                      {formatDate(d)}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </Sheet>
      )}
    </div>
  );
}

function EventGlyph({ title }: { title: string }) {
  const Icon = eventIcon(title);
  return <Icon size={15} className="mr-0.5 inline -mt-0.5 text-brand-600" aria-hidden />;
}
