// 강좌 추가·수정 창. 바꾼 내용은 임시 변경으로 들어가고 "저장 및 배포"를 눌러야 반영된다.

import { useEffect, useState } from 'react';
import { findOverlaps, overlapText, validateCourse, type CourseInput } from '@shared/admin';
import { checkPersonalRules } from '@shared/rules';
import { formatDate } from '@/lib/format';
import { uploadImage } from '@/lib/image';
import { Button } from '@/ui/Button';
import { CourseThumb } from '@/ui/CourseThumb';
import { Modal } from '@/ui/Modal';
import { Sheet } from '@/ui/Sheet';
import { useToast } from '@/ui/Toast';
import { useAdmin } from './AdminData';
import { TeacherPicker } from './TeacherPicker';
import { Area, Field, Select, SmallButton, Toggle } from './ui';

const TYPES = ['체험', '특강', '공연', '스포츠', '견학'];

export function newCourseInput(existingIds: Set<string>, order: number): CourseInput {
  let id = '';
  do id = `NEW-${Math.random().toString(36).slice(2, 8)}`;
  while (existingIds.has(id));
  return {
    id,
    code: '',
    category: '선택',
    type: '체험',
    name: '',
    intro: '',
    date: '2026-12-01',
    start: '10:00',
    end: '12:00',
    place: '',
    instructor: '',
    capacity: 25,
    selfPay: false,
    fixedSize: false,
    teacherIds: [],
    thumbnailUrl: null,
    closeAt: null,
    order,
  };
}

interface Props {
  initial: CourseInput | null;
  isNew: boolean;
  onClose(): void;
}

export function CourseEditor({ initial, isNew, onClose }: Props) {
  const a = useAdmin();
  const toast = useToast();
  const [c, setC] = useState<CourseInput | null>(initial);
  const [uploading, setUploading] = useState(false);
  const [confirm, setConfirm] = useState<{ title: string; lines: string[]; onOk(): void } | null>(null);
  useEffect(() => setC(initial), [initial]);
  if (!c) return null;

  const set = (patch: Partial<CourseInput>) => setC({ ...c, ...patch });
  const enrolledN = a.enrolledCount.get(c.id) ?? 0;
  const dateLabel = (() => {
    try {
      return formatDate(c.date);
    } catch {
      return '';
    }
  })();

  /** 이 강좌를 신청한 학생 중 바뀐 내용 때문에 규칙(코드 중복·같은 날 선택)에 걸리는 학생 */
  function conflicts(next: CourseInput): string[] {
    const out: string[] = [];
    for (const app of a.applications.values()) {
      if (!app.items?.[next.id]) continue;
      const { [next.id]: _self, ...others } = app.items;
      const rule = checkPersonalRules({ ...next, count: 0 }, others);
      if (rule) out.push(`${app.sid} ${app.name}: ${rule.code === 'DUP_CODE' ? '같은 코드 강좌를 이미 신청' : '같은 날 선택 강좌를 이미 신청'}`);
    }
    return out;
  }

  function apply() {
    if (!c) return;
    const next = { ...c, name: c.name.trim(), code: c.code.trim() };
    const err = validateCourse(next);
    if (err) return toast(err, 'error');
    const others = a.courses.filter((x) => x.id !== next.id);
    const ov = findOverlaps([next], a.timetable.fixedEvents);
    if (ov.length) return toast(`시간표 고정 일정과 겹쳐서 적용할 수 없어요. ${overlapText(ov[0])}`, 'error');

    const warn: string[] = [];
    const cf = conflicts(next);
    if (cf.length) warn.push(`규칙에 걸리게 되는 신청 학생 ${cf.length}명:`, ...cf.slice(0, 10), ...(cf.length > 10 ? [`… 외 ${cf.length - 10}명`] : []));
    if (next.capacity !== null && enrolledN > next.capacity) warn.push(`현재 신청 ${enrolledN}명이 새 정원 ${next.capacity}명보다 많아요(신청은 취소되지 않고 정원 초과로 표시돼요).`);
    if (others.some((x) => x.code === next.code && x.date === next.date && x.category !== next.category))
      warn.push('같은 날 같은 코드 강좌와 분류(필수/선택)가 달라요.');

    const commit = () => {
      a.setCourse(next);
      toast('임시로 반영했어요. "저장 및 배포"를 눌러야 저장돼요.', 'info');
      onClose();
    };
    if (warn.length) setConfirm({ title: '이대로 바꿀까요?', lines: warn, onOk: commit });
    else commit();
  }

  function remove() {
    if (!c) return;
    const doRemove = () => {
      a.removeCourse(c.id);
      toast('삭제를 임시로 반영했어요. "저장 및 배포"를 눌러야 실제로 지워져요.', 'info');
      onClose();
    };
    setConfirm({
      title: enrolledN ? `신청자 ${enrolledN}명이 있어요` : '이 강좌를 삭제할까요?',
      lines: enrolledN ? [`삭제하면 이 강좌를 신청한 학생 ${enrolledN}명의 신청이 취소되고 "미제출"로 바뀌어요.`] : ['저장 및 배포 전까지는 되돌릴 수 있어요.'],
      onOk: doRemove,
    });
  }

  async function upload(file: File) {
    if (!c) return;
    setUploading(true);
    try {
      const url = await uploadImage(`thumbnails/${c.id}/${Date.now()}.webp`, file, 800);
      set({ thumbnailUrl: url });
    } catch (e) {
      toast((e as Error).message || '이미지를 올리지 못했어요.', 'error');
    } finally {
      setUploading(false);
    }
  }

  return (
    <>
      <Sheet
        open
        onClose={onClose}
        title={isNew ? '강좌 추가' : '강좌 수정'}
        footer={
          <div className="flex gap-2">
            {!isNew && (
              <Button variant="ghost" className="w-auto! shrink-0 px-5 text-rose-600" onClick={remove}>
                삭제
              </Button>
            )}
            <Button variant="brand" onClick={apply} disabled={uploading}>
              {isNew ? '추가하기' : '적용하기'}
            </Button>
          </div>
        }
      >
        <div className="space-y-4 pb-4">
          <div className="flex items-center gap-4">
            <CourseThumb type={c.type} name={c.name} url={c.thumbnailUrl} className="size-24 shrink-0 rounded-3xl" emojiClass="text-4xl" />
            <div className="flex flex-col gap-2">
              <label className="inline-flex min-h-10 cursor-pointer items-center justify-center rounded-full bg-soft px-4 text-[14px] font-semibold hover:bg-line">
                {uploading ? '올리는 중…' : '🖼️ 썸네일 올리기'}
                <input type="file" accept="image/*" className="sr-only" disabled={uploading} onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])} />
              </label>
              {c.thumbnailUrl && <SmallButton onClick={() => set({ thumbnailUrl: null })}>기본 이미지로</SmallButton>}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Select label="분류" value={c.category} onChange={(e) => set({ category: e.target.value as CourseInput['category'] })}>
              <option value="필수">필수</option>
              <option value="선택">선택</option>
            </Select>
            <Field label="유형" list="course-types" value={c.type} onChange={(e) => set({ type: e.target.value })} />
            <datalist id="course-types">
              {TYPES.map((t) => (
                <option key={t} value={t} />
              ))}
            </datalist>
            <Field label="프로그램코드" value={c.code} onChange={(e) => set({ code: e.target.value.toUpperCase() })} hint="같은 코드끼리는 중복 신청 불가" />
            <Field
              label="날짜"
              type="date"
              min="2026-11-30"
              max="2026-12-11"
              value={c.date}
              onChange={(e) => set({ date: e.target.value })}
              hint={dateLabel}
            />
          </div>
          <Field label="프로그램명" value={c.name} onChange={(e) => set({ name: e.target.value })} />
          <Area label="프로그램 소개" value={c.intro} onChange={(e) => set({ intro: e.target.value })} />
          <div className="grid grid-cols-2 gap-3">
            <Field label="시작" type="time" value={c.start} onChange={(e) => set({ start: e.target.value })} />
            <Field label="끝" type="time" value={c.end} onChange={(e) => set({ end: e.target.value })} />
            <Field label="장소" value={c.place} onChange={(e) => set({ place: e.target.value })} />
            <Field label="강사(주최)" value={c.instructor} onChange={(e) => set({ instructor: e.target.value })} />
          </div>

          <div>
            <span className="text-[13px] font-semibold text-sub">정원 {!isNew && `· 현재 신청 ${enrolledN}명`}</span>
            <div className="mt-1 flex flex-wrap items-center gap-2">
              <Toggle label="정원 제한 없음(전교생)" checked={c.capacity === null} onChange={(v) => set({ capacity: v ? null : Math.max(enrolledN, 25) })} />
              {c.capacity !== null && (
                <div className="flex items-center gap-1">
                  <SmallButton onClick={() => set({ capacity: Math.max(1, (c.capacity ?? 1) - 1) })} aria-label="정원 1 줄이기">
                    −
                  </SmallButton>
                  <input
                    type="number"
                    min={1}
                    aria-label="정원"
                    value={c.capacity}
                    onChange={(e) => set({ capacity: Math.max(1, Number(e.target.value) || 1) })}
                    className="h-10 w-20 rounded-xl border border-line bg-soft text-center text-[16px] font-bold"
                  />
                  <SmallButton onClick={() => set({ capacity: (c.capacity ?? 0) + 1 })} aria-label="정원 1 늘리기">
                    ＋
                  </SmallButton>
                </div>
              )}
            </div>
          </div>
          <div className="grid gap-1 sm:grid-cols-2">
            <Toggle label="💸 비용부담(자부담)" desc="학생 화면에 경고 표시 + 신청 시 한 번 더 확인" checked={c.selfPay} onChange={(v) => set({ selfPay: v })} />
            <Toggle label="📌 인원고정" desc="정원 미달이면 현황판에서 강조" checked={c.fixedSize} onChange={(v) => set({ fixedSize: v })} />
          </div>
          <TeacherPicker teachers={a.teachers} value={c.teacherIds} onChange={(ids) => set({ teacherIds: ids })} />
          <p className="text-[12px] text-sub">강좌 ID: {c.id}</p>
        </div>
      </Sheet>

      <Modal
        open={!!confirm}
        onClose={() => setConfirm(null)}
        emoji="⚠️"
        title={confirm?.title ?? ''}
        actions={
          <>
            <Button
              onClick={() => {
                confirm?.onOk();
                setConfirm(null);
              }}
            >
              그래도 진행
            </Button>
            <Button variant="ghost" onClick={() => setConfirm(null)}>
              취소
            </Button>
          </>
        }
      >
        <ul className="space-y-1 text-left text-[14px]">
          {confirm?.lines.map((l) => (
            <li key={l}>{l}</li>
          ))}
        </ul>
      </Modal>
    </>
  );
}
