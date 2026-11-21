import { BookOpenCheck, ChevronLeft, ChevronRight, Inbox, QrCode } from 'lucide-react';
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
import { attendMarkOf, qrComplete, statusOf } from '@shared/attendance';
import { AttendControl, Avatar, QrMarks, toAttendanceMap, useAttendanceToggle, type AttendanceDoc } from './attendance';
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
        <ul className="mt-4 grid gap-2 md:grid-cols-2 lg:grid-cols-3">
          {myCourses.map((c) => (
            <li key={c.id}>
              <button
                type="button"
                onClick={() => setParams({ c: c.id })}
                className="glass flex w-full items-center gap-3 rounded-3xl p-3 text-left transition hover:bg-white/75 active:scale-[0.99]"
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
                <ChevronRight size={18} className="shrink-0 text-sub" aria-hidden />
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
  // 이 강좌 시작·종료 QR 을 다 찍어야 출석. 교사가 결과/출석 인정을 누르면 그 값이 먼저(shared/attendance.ts).
  const statusFor = (s: Enrollment) => statusOf(attendMarkOf(attMap.get(s.sid)), true, qrComplete(s));
  const absentCount = list.filter((s) => statusFor(s) === 'absent').length;
  const qrMissingCount = list.filter((s) => statusFor(s) === 'qr').length;
  // 일괄 결과 처리 대상: QR 을 다 찍지 않았고 교사가 아직 아무것도 고르지 않은 학생
  const bulkTargets = list.filter((s) => statusFor(s) === 'qr');
  // 담임(또는 이 강좌 담당이 아닌 교사)이 체크한 결석은 "결석 · 담임 체크"로 보여 준다.
  const byHomeroom = (s: Enrollment) => {
    const a = attMap.get(s.sid);
    return !!a?.absent && !!a.updatedBy && !c.teacherIds.includes(a.updatedBy);
  };
  const absentProps = (s: Enrollment) => (byHomeroom(s) ? { absentShownAs: '결석', absentCaption: '담임 결석 체크' } : {});
  const rowTone = (s: Enrollment) => {
    const st = statusFor(s);
    return st === 'absent' ? 'bg-rose-50/50' : st === 'qr' ? 'bg-amber-50/50' : 'hover:bg-soft/60';
  };
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
        <ChevronLeft size={18} aria-hidden /> 강좌 목록
      </button>
      <h1 className="mt-1 text-[22px] leading-snug font-extrabold">{c.name}</h1>
      <p className="mt-0.5 text-[14px] text-sub">
        {formatDate(c.date)} {timeRange(c)} · {c.place}
      </p>
      <button
        type="button"
        onClick={() => nav(`/t/qr/${c.id}`)}
        className="mt-3 flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl bg-ink px-4 text-[15px] font-bold text-white md:w-auto md:px-6"
      >
        <QrCode size={18} aria-hidden /> 출석 QR 띄우기
      </button>

      <div className="glass-bar sticky top-0 z-10 -mx-5 mt-3 flex flex-wrap gap-2 px-5 py-2 md:mx-0 md:rounded-[24px] md:px-4">
        <span className="rounded-full bg-soft px-3 py-1.5 text-[14px] font-bold">수강생 {list.length}명</span>
        <span className="rounded-full bg-emerald-50 px-3 py-1.5 text-[14px] font-bold text-emerald-700">출석 {list.length - absentCount - qrMissingCount}</span>
        <span className="rounded-full bg-amber-50 px-3 py-1.5 text-[14px] font-bold text-amber-700">QR 미완료 {qrMissingCount}</span>
        <span className="rounded-full bg-rose-50 px-3 py-1.5 text-[14px] font-bold text-rose-600">결석·결과 {absentCount}</span>
      </div>
      <p className="text-[13px] text-sub">시작·종료 QR을 둘 다 찍어야 "출석"이에요. QR을 못 찍은 사정이 있으면 "출석"을 눌러 인정해 주세요. 담임 선생님이 결석 체크한 학생은 여기서도 "결석"으로 보여요.</p>
      {roster && bulkTargets.length > 0 && (
        <button
          type="button"
          onClick={() => setAskBulk(true)}
          className="mt-2 flex min-h-11 w-full items-center justify-center gap-1.5 rounded-2xl bg-rose-50 md:w-auto md:px-6 px-4 text-[14px] font-bold text-rose-600 ring-1 ring-rose-200"
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
        <>
        {/* 넓은 화면: 칸을 나눈 표 */}
        <div className="glass mt-3 hidden overflow-hidden rounded-[28px] px-3 pb-2 md:block">
        <table className="w-full border-separate border-spacing-0 text-left">
          <thead className="text-[13px] text-sub">
            <tr>
              <th className="w-24 border-b border-line py-2.5 pl-2 font-semibold">학번</th>
              <th className="border-b border-line py-2.5 font-semibold">학생</th>
              <th className="w-24 border-b border-line py-2.5 font-semibold">학급</th>
              <th className="w-72 border-b border-line py-2.5 pr-3 font-semibold">출석 QR</th>
              <th className="w-44 border-b border-line py-2.5 pr-2 text-right font-semibold">출결</th>
            </tr>
          </thead>
          <tbody className="text-[15px]">
            {list.map((s) => {
              return (
                <tr key={s.sid} className={rowTone(s)}>
                  <td className="border-b border-line py-2 pl-2 font-semibold text-sub tabular-nums">{s.sid}</td>
                  <td className="border-b border-line py-2">
                    <span className="flex items-center gap-2.5">
                      <Avatar url={s.photoUrl} name={s.name} size={40} />
                      <span className="font-bold">{s.name}</span>
                    </span>
                  </td>
                  <td className="border-b border-line py-2 text-sub tabular-nums">
                    {s.classNo}반 {s.number}번
                  </td>
                  <td className="border-b border-line py-2 pr-3">
                    <QrMarks start={s.qrStartAt} end={s.qrEndAt} />
                  </td>
                  <td className="border-b border-line py-2 pr-2">
                    <AttendControl needsQr qrDone={qrComplete(s)} pending={pending[s.sid]} absentLabel="결과" {...absentProps(s)} meta={attMap.get(s.sid)} onChange={(v) => toggle(s.sid, v)} />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        </div>
        {/* 휴대폰: 한 학생씩 쌓은 목록 */}
        <ul className="glass mt-3 divide-y divide-line rounded-[28px] px-4 md:hidden">
          {list.map((s) => (
            <li key={s.sid} className={`-mx-4 flex items-center gap-3 px-4 py-2.5 ${statusFor(s) === 'qr' ? 'bg-amber-50/50' : statusFor(s) === 'absent' ? 'bg-rose-50/50' : ''}`}>
              <Avatar url={s.photoUrl} name={s.name} size={44} />
              <div className="min-w-0 flex-1">
                <p className="text-[16px] font-bold">{s.name}</p>
                <p className="text-[13px] text-sub tabular-nums">{s.sid}</p>
                <QrMarks start={s.qrStartAt} end={s.qrEndAt} />
              </div>
              <AttendControl needsQr qrDone={qrComplete(s)} pending={pending[s.sid]} absentLabel="결과" {...absentProps(s)} meta={attMap.get(s.sid)} onChange={(v) => toggle(s.sid, v)} />
            </li>
          ))}
        </ul>
        </>
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
        시작 QR과 종료 QR 중 하나라도 찍지 않았고, "출석 인정"도 받지 않은 학생이에요. 그날 출결 기록이 "결과"가 되고, 담임 선생님 학급출결에는 "결석"으로 보여요. 나중에 한 명씩 다시 고칠 수 있어요.
      </Modal>
    </main>
  );
}
