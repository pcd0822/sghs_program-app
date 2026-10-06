// 학생 화면 전체가 함께 쓰는 자료와 동작(신청·취소·제출).
// 실시간 수신은 여기 한 곳에서만 연다: 강좌 목록, 신청 기간, 시간표 설정, 내 신청 문서.

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import {
  checkPersonalRules,
  checkWindow,
  DUP_CODE_MESSAGE,
  isFull,
  missingText,
  periodState,
  progress,
  type Application,
  type PeriodState,
  type Progress,
} from '@shared/rules';
import type { Course, PeriodConfig, Student, TimetableConfig } from '@shared/types';
import { useSession } from '@/auth/AuthProvider';
import { CourseDetailSheet } from '@/courses/CourseParts';
import { useApplication, useCourses, useNow, usePeriod, useStudentDoc, useTimetable } from '@/data/live';
import { call, CallError } from '@/lib/call';
import { formatDate } from '@/lib/format';
import { Button } from '@/ui/Button';
import { Modal } from '@/ui/Modal';
import { useToast } from '@/ui/Toast';
import { MyListSheet } from './MyListSheet';

interface StudentValue {
  sid: string;
  me: Student | null | undefined;
  courses: Course[] | undefined;
  byId: Map<string, Course>;
  period: PeriodConfig | null | undefined;
  periodNow: PeriodState;
  timetable: TimetableConfig | null | undefined;
  app: Application | null | undefined;
  items: Application['items'];
  prog: Progress | undefined;
  now: number;
  busy: string | null;
  openCourse(c: Course): void;
  openMyList(): void;
  apply(c: Course): void;
  cancel(c: Course): void;
  submit(): void;
}

const Ctx = createContext<StudentValue | null>(null);

type Dialog =
  | { kind: 'dup' }
  | { kind: 'info'; title: string; text: string; emoji: string }
  | { kind: 'selfPay'; c: Course }
  | { kind: 'cancel'; c: Course }
  | { kind: 'missing'; lines: string[] }
  | { kind: 'submitted' };

const BUSY_MSG = '신청자가 몰리고 있어요. 다시 눌러 주세요.';

export function StudentDataProvider({ children }: { children: ReactNode }) {
  const { claims } = useSession();
  const sid = claims.role === 'student' ? claims.sid : '';
  const toast = useToast();
  const courses = useCourses();
  const period = usePeriod();
  const timetable = useTimetable();
  const app = useApplication(sid);
  const me = useStudentDoc(sid);
  const now = useNow(1000);

  const [selected, setSelected] = useState<string | null>(null);
  const [listOpen, setListOpen] = useState(false);
  const [dialog, setDialog] = useState<Dialog | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const items = useMemo(() => app?.items ?? {}, [app]);
  const byId = useMemo(() => new Map((courses ?? []).map((c) => [c.id, c])), [courses]);
  const prog = useMemo(() => (courses ? progress(courses, items) : undefined), [courses, items]);
  const periodNow = periodState(period, now);

  const run = useCallback(
    async (key: string, fn: () => Promise<void>) => {
      if (busy) return; // 처리 중에는 다른 버튼도 잠근다
      setBusy(key);
      try {
        await fn();
      } catch (e) {
        const err = e as CallError;
        if (err.reason === 'DUP_CODE') setDialog({ kind: 'dup' });
        else if (err.reason === 'FULL') setDialog({ kind: 'info', emoji: '😢', title: '정원이 다 찼어요', text: '방금 다른 친구가 마지막 자리를 신청했어요. 다른 강좌를 골라 주세요.' });
        else toast(err.message || BUSY_MSG, 'error');
      } finally {
        setBusy(null);
      }
    },
    [busy, toast],
  );

  const doApply = useCallback(
    (c: Course, confirmSelfPay: boolean) =>
      run(c.id, async () => {
        await call('applyCourse', { courseId: c.id, confirmSelfPay }, { busyMessage: BUSY_MSG });
        toast(`「${c.name}」 신청 완료!`, 'success');
      }),
    [run, toast],
  );

  const apply = useCallback(
    (c: Course) => {
      // 화면에서 먼저 막는다(최종 판정은 서버).
      const win = checkWindow(period, c, Date.now());
      if (win) return toast(win.message, 'error');
      const rule = checkPersonalRules(c, items);
      if (rule?.code === 'DUP_CODE') return setDialog({ kind: 'dup' });
      if (rule?.code === 'SAME_DATE') return setDialog({ kind: 'info', emoji: '📅', title: '같은 날 선택 강좌는 1개만', text: rule.message });
      if (rule) return toast(rule.message, 'info');
      if (isFull(c)) return setDialog({ kind: 'info', emoji: '😢', title: '정원이 다 찼어요', text: '다른 강좌를 골라 주세요.' });
      if (c.selfPay) return setDialog({ kind: 'selfPay', c });
      void doApply(c, false);
    },
    [period, items, toast, doApply],
  );

  const cancel = useCallback(
    (c: Course) => {
      const win = checkWindow(period, c, Date.now());
      if (win) return toast(win.message.replace('신청이', '신청·취소가'), 'error');
      setDialog({ kind: 'cancel', c });
    },
    [period, toast],
  );

  const submit = useCallback(() => {
    if (!prog) return;
    const win = checkWindow(period, null, Date.now());
    if (win) return toast(win.message, 'error');
    if (!prog.complete) return setDialog({ kind: 'missing', lines: prog.missing.map((m) => missingText(m, formatDate)) });
    void run('submit', async () => {
      await call('submitApplication', {}, { busyMessage: BUSY_MSG });
      setDialog({ kind: 'submitted' });
    });
  }, [prog, period, run, toast]);

  const value: StudentValue = {
    sid,
    me,
    courses,
    byId,
    period,
    periodNow,
    timetable,
    app,
    items,
    prog,
    now,
    busy,
    openCourse: (c) => setSelected(c.id),
    openMyList: () => setListOpen(true),
    apply,
    cancel,
    submit,
  };

  // 상세 창은 실시간 자료로 다시 그린다(남은 자리가 바로 바뀌도록).
  const sel = selected ? byId.get(selected) ?? null : null;
  const close = () => setDialog(null);

  return (
    <Ctx.Provider value={value}>
      {children}

      {/* 목록에서 강좌를 누르면 상세가 목록 위에 떠야 하므로 상세를 나중에 그린다 */}
      <MyListSheet open={listOpen} onClose={() => setListOpen(false)} />
      <CourseDetailSheet c={sel} onClose={() => setSelected(null)} footer={sel && <DetailAction c={sel} />} notice={sel && <DetailNotice c={sel} />} />

      <Modal open={dialog?.kind === 'dup'} onClose={close} emoji="🙅" title={DUP_CODE_MESSAGE}>
        같은 프로그램을 이미 신청했어요.
        <br />
        날짜나 반이 달라도 한 번만 신청할 수 있어요.
      </Modal>
      {dialog?.kind === 'info' && (
        <Modal open onClose={close} emoji={dialog.emoji} title={dialog.title}>
          {dialog.text}
        </Modal>
      )}
      {dialog?.kind === 'selfPay' && (
        <Modal
          open
          onClose={close}
          emoji="💸"
          title="자부담 강좌예요"
          actions={
            <>
              <Button
                variant="brand"
                onClick={() => {
                  close();
                  void doApply(dialog.c, true);
                }}
              >
                확인했어요, 신청할게요
              </Button>
              <Button variant="ghost" onClick={close}>
                다시 생각할게요
              </Button>
            </>
          }
        >
          「{dialog.c.name}」은(는) 참가 비용을 <b className="text-orange-600">직접 부담</b>해야 해요. 보호자와 상의했나요?
        </Modal>
      )}
      {dialog?.kind === 'cancel' && (
        <Modal
          open
          onClose={close}
          emoji="↩️"
          title="신청을 취소할까요?"
          actions={
            <>
              <Button
                onClick={() => {
                  const c = dialog.c;
                  close();
                  void run(c.id, async () => {
                    await call('cancelCourse', { courseId: c.id }, { busyMessage: BUSY_MSG });
                    toast(`「${c.name}」 신청을 취소했어요`, 'info');
                  });
                }}
              >
                취소할게요
              </Button>
              <Button variant="ghost" onClick={close}>
                그대로 둘게요
              </Button>
            </>
          }
        >
          「{dialog.c.name}」
          <br />
          취소하면 그 자리는 다른 친구가 신청할 수 있어요.
          {app?.submitted && (
            <>
              <br />
              <b className="text-rose-600">제출한 신청이 "미제출"로 바뀌어 다시 제출해야 해요.</b>
            </>
          )}
        </Modal>
      )}
      {dialog?.kind === 'missing' && (
        <Modal open onClose={close} emoji="🧩" title="아직 빠진 강좌가 있어요">
          <ul className="mt-1 space-y-1 text-left">
            {dialog.lines.map((l) => (
              <li key={l} className="rounded-xl bg-soft px-3 py-2 font-semibold text-ink">
                {l}
              </li>
            ))}
          </ul>
        </Modal>
      )}
      <Modal open={dialog?.kind === 'submitted'} onClose={close} emoji="🎉" title="수강신청을 제출했어요">
        신청 기간 안에는 바꿀 수 있어요. 바꾸면 다시 제출해 주세요.
      </Modal>
    </Ctx.Provider>
  );
}

export function useStudent(): StudentValue {
  const v = useContext(Ctx);
  if (!v) throw new Error('StudentDataProvider 밖');
  return v;
}

/** 상세 창 맨 아래 버튼 */
function DetailAction({ c }: { c: Course }) {
  const { items, period, busy, apply, cancel } = useStudent();
  const applied = !!items[c.id];
  const win = checkWindow(period, c, Date.now());
  const loading = busy === c.id;

  if (applied) {
    return (
      <div className="flex items-center gap-3">
        <span className="flex-1 text-[15px] font-bold text-emerald-600">✅ 신청 완료</span>
        <Button variant="ghost" className="w-auto! px-6" loading={loading} disabled={!!busy || !!win} onClick={() => cancel(c)}>
          신청 취소
        </Button>
      </div>
    );
  }
  if (win) return <Button disabled>{win.code === 'NOT_OPEN' ? '아직 신청 기간이 아니에요' : '신청 마감'}</Button>;
  if (isFull(c)) return <Button disabled>정원 마감</Button>;
  const rule = checkPersonalRules(c, items);
  if (rule) {
    return (
      <Button variant="ghost" onClick={() => apply(c)}>
        {rule.code === 'DUP_CODE' ? '🙅 중복 신청 불가' : '📅 이 날짜는 이미 신청했어요'}
      </Button>
    );
  }
  return (
    <Button variant="brand" loading={loading} disabled={!!busy} onClick={() => apply(c)}>
      {c.selfPay ? '💸 자부담 확인 후 신청하기' : '신청하기'}
    </Button>
  );
}

function DetailNotice({ c }: { c: Course }) {
  const { items } = useStudent();
  const rule = items[c.id] ? null : checkPersonalRules(c, items);
  if (!rule) return null;
  return <p className="mt-3 rounded-2xl bg-orange-50 px-4 py-3 text-[14px] font-semibold text-orange-700">{rule.message}</p>;
}
