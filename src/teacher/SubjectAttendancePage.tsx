import { BookOpenCheck, Inbox, QrCode } from 'lucide-react';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { call } from '@/lib/call';
import { Button } from '@/ui/Button';
import { Modal } from '@/ui/Modal';
import { useToast } from '@/ui/Toast';
import { EmptyArt, Eyebrow } from '@/ui/Glyph';
import { collection, query, where } from 'firebase/firestore';
import { useSearchParams } from 'react-router-dom';
import type { Course } from '@shared/types';
import { useQueryDocs } from '@/data/live';
import { db } from '@/lib/firebase';
import { formatDate, timeRange } from '@/lib/format';
import { CourseThumb } from '@/ui/CourseThumb';
import { PinIcon } from '@/ui/Icons';
import { AttendCheck, Avatar, QrMarks, toAttendanceMap, useAttendanceToggle, type AttendanceDoc } from './attendance';
import { useTeacher } from './TeacherData';

interface Enrollment {
  courseId: string;
  sid: string;
  name: string;
  classNo: number;
  number: number;
  photoUrl: string | null;
  date: string;
  /** 출석 QR 찍은 시각 */
  qrStartAt?: number;
  qrEndAt?: number;
}

/** 교과수업출결: 내게 배정된 강좌 목록 → 강좌를 고르면 수강생 출석부 */
export default function SubjectAttendancePage() {
  const { myCourses, courses } = useTeacher();
  const [params, setParams] = useSearchParams();
  const selected = myCourses.find((c) => c.id === params.get('c')) ?? null;

  if (selected) return <Roster c={selected} onBack={() => setParams({})} />;

  return (
    <main className="px-5 pt-[max(env(safe-area-inset-top),16px)]">
      <Eyebrow icon={BookOpenCheck} tone="mint">교과수업출결</Eyebrow>
      <h1 className="text-[24px] font-extrabold tracking-tight">내 담당 강좌 출석부</h1>
      {!courses ? (
        <div className="mt-4 h-40 animate-pulse rounded-3xl bg-soft" />
      ) : myCourses.length === 0 ? (
        <div className="mt-16 text-center text-sub">
          <EmptyArt icon={Inbox} tone="slate" />
          <p className="mt-3">아직 배정된 강좌가 없어요.</p>
          <p className="text-[14px]">배정은 관리자가 대시보드에서 해요.</p>
        </div>
      ) : (
        <ul className="mt-4 space-y-2">
          {myCourses.map((c) => (
            <li key={c.id}>
              <button
                type="button"
                onClick={() => setParams({ c: c.id })}
                className="flex w-full items-center gap-3 rounded-3xl p-3 text-left ring-1 ring-line transition hover:bg-soft active:scale-[0.99]"
              >
                <CourseThumb type={c.type} name={c.name} url={c.thumbnailUrl} className="size-14 rounded-2xl" />
                <span className="min-w-0 flex-1">
                  <span className="block text-[13px] font-semibold text-sub">
                    {formatDate(c.date)} {timeRange(c)}
                  </span>
                  <span className="block truncate text-[16px] font-bold">{c.name}</span>
                  <span className="flex items-center gap-1 text-[13px] text-sub">
                    <PinIcon /> {c.place}
                  </span>
                </span>
                <span className="text-sub" aria-hidden>
                  ›
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}

function Roster({ c, onBack }: { c: Course; onBack(): void }) {
  const { tid } = useTeacher();
  // 규칙상 교과 교사는 "자기에게 배정된" 수강생·출결만 읽을 수 있으므로 쿼리에도 그 조건을 넣는다.
  const roster = useQueryDocs<Enrollment>(`enr-${c.id}-${tid}`, () =>
    query(collection(db, 'enrollments'), where('courseId', '==', c.id), where('teacherIds', 'array-contains', tid)),
  );
  const att = useQueryDocs<AttendanceDoc>(`att-${c.date}-${tid}`, () =>
    query(collection(db, 'attendance'), where('date', '==', c.date), where('viewerTeacherIds', 'array-contains', tid)),
  );
  const attMap = toAttendanceMap(att);
  const { pending, toggle } = useAttendanceToggle(c.date);
  const list = [...(roster ?? [])].sort((a, b) => a.sid.localeCompare(b.sid));
  const absentCount = list.filter((s) => attMap.get(s.sid)?.absent).length;
  const qrDone = (s: Enrollment) => typeof s.qrStartAt === 'number' && typeof s.qrEndAt === 'number';
  const qrDoneCount = list.filter(qrDone).length;
  // 일괄 결과 처리 대상: QR 을 다 찍지 않았고 아직 결과가 아닌 학생
  const bulkTargets = list.filter((s) => !qrDone(s) && !attMap.get(s.sid)?.absent);
  const [askBulk, setAskBulk] = useState(false);
  const [bulkBusy, setBulkBusy] = useState(false);
  const toast = useToast();
  const nav = useNavigate();

  async function runBulk() {
    setBulkBusy(true);
    try {
      const r = await call<{ courseId: string }, { changed: number }>('markQrIncomplete', { courseId: c.id });
      toast(`${r.changed}명을 결과로 바꿨어요.`, 'success');
      setAskBulk(false);
    } catch (e) {
      toast((e as Error).message, 'error');
    } finally {
      setBulkBusy(false);
    }
  }

  return (
    <main className="px-5 pt-[max(env(safe-area-inset-top),16px)]">
      <button type="button" onClick={onBack} className="-ml-3 flex min-h-11 items-center gap-1 rounded-full px-3 text-[15px] font-semibold text-sub hover:bg-soft">
        ‹ 강좌 목록
      </button>
      <h1 className="mt-1 text-[22px] leading-snug font-extrabold">{c.name}</h1>
      <p className="mt-0.5 text-[14px] text-sub">
        {formatDate(c.date)} {timeRange(c)} · {c.place}
      </p>
      <button
        type="button"
        onClick={() => nav(`/t/qr/${c.id}`)}
        className="mt-3 flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl bg-ink px-4 text-[15px] font-bold text-white"
      >
        <QrCode size={18} aria-hidden /> 출석 QR 띄우기
      </button>

      <div className="sticky top-0 z-10 -mx-5 mt-3 flex flex-wrap gap-2 bg-white/90 px-5 py-2 backdrop-blur">
        <span className="rounded-full bg-soft px-3 py-1.5 text-[14px] font-bold">수강생 {list.length}명</span>
        <span className="rounded-full bg-emerald-50 px-3 py-1.5 text-[14px] font-bold text-emerald-700">출석 {list.length - absentCount}</span>
        <span className="rounded-full bg-rose-50 px-3 py-1.5 text-[14px] font-bold text-rose-600">결과 {absentCount}</span>
        <span className="rounded-full bg-brand-50 px-3 py-1.5 text-[14px] font-bold text-brand-700">QR 완료 {qrDoneCount}</span>
      </div>
      <p className="text-[13px] text-sub">체크하면 "결과", 비워 두면 "출석"이에요. 담임 선생님의 학급출결과 같은 기록이에요.</p>
      {roster && bulkTargets.length > 0 && (
        <button
          type="button"
          onClick={() => setAskBulk(true)}
          className="mt-2 flex min-h-11 w-full items-center justify-center gap-1.5 rounded-2xl bg-rose-50 px-4 text-[14px] font-bold text-rose-600 ring-1 ring-rose-200"
        >
          QR 미완료 {bulkTargets.length}명 결과 처리
        </button>
      )}

      {!roster ? (
        <div className="mt-3 space-y-2">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="h-16 animate-pulse rounded-2xl bg-soft" />
          ))}
        </div>
      ) : list.length === 0 ? (
        <p className="mt-10 text-center text-sub">아직 신청한 학생이 없어요.</p>
      ) : (
        <ul className="mt-2 divide-y divide-line">
          {list.map((s) => (
            <li key={s.sid} className="flex items-center gap-3 py-2.5">
              <Avatar url={s.photoUrl} name={s.name} size={44} />
              <div className="min-w-0 flex-1">
                <p className="text-[16px] font-bold">{s.name}</p>
                <p className="text-[13px] text-sub tabular-nums">{s.sid}</p>
                <QrMarks start={s.qrStartAt} end={s.qrEndAt} />
              </div>
              <AttendCheck
                checked={!!attMap.get(s.sid)?.absent}
                pending={pending[s.sid]}
                onLabel="결과"
                offLabel="출석"
                meta={attMap.get(s.sid)}
                onChange={(v) => toggle(s.sid, v)}
              />
            </li>
          ))}
        </ul>
      )}

      <Modal
        open={askBulk}
        onClose={() => setAskBulk(false)}
        icon={QrCode}
        tone="rose"
        title={`QR 미완료 ${bulkTargets.length}명을 결과로 바꿀까요?`}
        actions={
          <>
            <Button loading={bulkBusy} onClick={runBulk}>
              결과로 바꾸기
            </Button>
            <Button variant="ghost" onClick={() => setAskBulk(false)}>
              취소
            </Button>
          </>
        }
      >
        시작 QR과 종료 QR 중 하나라도 찍지 않은 학생이에요. 그날 출결 기록이 "결과"가 되고, 담임 선생님 학급출결에는 "결석"으로 보여요. 나중에 한 명씩 다시 고칠 수 있어요.
      </Modal>
    </main>
  );
}
