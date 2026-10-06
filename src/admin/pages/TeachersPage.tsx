import { collection, doc } from 'firebase/firestore';
import { useState } from 'react';
import { validateTeacher, type TeacherInput } from '@shared/admin';
import { db } from '@/lib/firebase';
import { Button } from '@/ui/Button';
import { Modal } from '@/ui/Modal';
import { Pill } from '@/ui/Pill';
import { Sheet } from '@/ui/Sheet';
import { useToast } from '@/ui/Toast';
import { useAdmin, type TeacherRow } from '../AdminData';
import { Card, DirtyDot, Field, PageHead, Select, SmallButton, TableWrap, Toggle } from '../ui';

const roleText = (h: number | null) => (h === null ? '교과(담임 아님)' : h === 0 ? '전체 학급' : `${h}반 담임`);

export default function TeachersPage() {
  const a = useAdmin();
  const toast = useToast();
  const [edit, setEdit] = useState<{ t: TeacherInput; isNew: boolean } | null>(null);
  const [del, setDel] = useState<TeacherRow | null>(null);
  const [show, setShow] = useState<Set<string>>(new Set());

  const courseCount = (id: string) => a.courses.filter((c) => c.teacherIds.includes(id)).length;

  function save() {
    if (!edit) return;
    const t = { ...edit.t, name: edit.t.name.trim() };
    const err = validateTeacher(t);
    if (err) return toast(err, 'error');
    const dup = a.teachers.find((x) => x.code === t.code && x.id !== t.id);
    if (dup) return toast(`코드 ${t.code}는 ${dup.name} 선생님이 쓰고 있어요.`, 'error');
    a.setTeacher(t);
    setEdit(null);
  }

  return (
    <div className="space-y-4">
      <PageHead
        emoji="🧑‍🏫"
        title="교사 관리"
        desc="담당학급·관리권한·코드를 바꾸면 그 선생님은 다시 로그인해야 해요(자동으로 로그아웃돼요)."
        actions={
          <SmallButton tone="brand" onClick={() => setEdit({ t: { id: newId(), name: '', code: '', homeroom: null, isAdmin: false }, isNew: true })}>
            ＋ 교사 추가
          </SmallButton>
        }
      />
      <Card>
        <TableWrap>
          <thead>
            <tr>
              <th>이름</th>
              <th>코드</th>
              <th>담당학급</th>
              <th>권한</th>
              <th className="text-right">담당 강좌</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {a.teachers.map((t) => (
              <tr key={t.id} className={a.dirtyKeys.teachers.has(t.id) ? 'bg-orange-50/50' : ''}>
                <td className="font-bold whitespace-nowrap">
                  {t.name} {a.dirtyKeys.teachers.has(t.id) && <DirtyDot />}
                </td>
                <td>
                  <button
                    type="button"
                    onClick={() => setShow((s) => new Set(s.has(t.id) ? [...s].filter((x) => x !== t.id) : [...s, t.id]))}
                    className="min-h-9 rounded-full bg-soft px-3 font-mono text-[14px]"
                    aria-label={show.has(t.id) ? '코드 가리기' : '코드 보기'}
                  >
                    {show.has(t.id) ? t.code : '••••'}
                  </button>
                </td>
                <td className="whitespace-nowrap">{roleText(t.homeroom)}</td>
                <td>{t.isAdmin ? <Pill tone="purple">admin</Pill> : <span className="text-zinc-300">—</span>}</td>
                <td className="text-right tabular-nums">{courseCount(t.id)}</td>
                <td className="space-x-1 text-right whitespace-nowrap">
                  <SmallButton onClick={() => setEdit({ t: { id: t.id, name: t.name, code: t.code, homeroom: t.homeroom, isAdmin: t.isAdmin }, isNew: false })}>수정</SmallButton>
                  <SmallButton tone="danger" onClick={() => setDel(t)}>
                    삭제
                  </SmallButton>
                </td>
              </tr>
            ))}
          </tbody>
        </TableWrap>
      </Card>

      {edit && (
        <Sheet
          open
          onClose={() => setEdit(null)}
          title={edit.isNew ? '교사 추가' : '교사 수정'}
          footer={
            <Button variant="brand" onClick={save}>
              적용하기
            </Button>
          }
        >
          <div className="space-y-3 pb-4">
            <Field label="이름" value={edit.t.name} onChange={(e) => setEdit({ ...edit, t: { ...edit.t, name: e.target.value } })} />
            <Field
              label="로그인 코드(4자리 숫자)"
              inputMode="numeric"
              maxLength={4}
              value={edit.t.code}
              onChange={(e) => setEdit({ ...edit, t: { ...edit.t, code: e.target.value.replace(/\D/g, '').slice(0, 4) } })}
              hint="0으로 시작해도 돼요. 다른 선생님과 겹치면 안 돼요."
            />
            <Select
              label="담당학급"
              value={edit.t.homeroom === null ? '' : String(edit.t.homeroom)}
              onChange={(e) => setEdit({ ...edit, t: { ...edit.t, homeroom: e.target.value === '' ? null : Number(e.target.value) } })}
            >
              <option value="">담임 아님(교과)</option>
              <option value="0">0 · 전체 학급</option>
              {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => (
                <option key={n} value={n}>
                  {n}반 담임
                </option>
              ))}
            </Select>
            <Toggle label="admin(대시보드 전체 관리)" checked={edit.t.isAdmin} onChange={(v) => setEdit({ ...edit, t: { ...edit.t, isAdmin: v } })} />
          </div>
        </Sheet>
      )}

      <Modal
        open={!!del}
        onClose={() => setDel(null)}
        emoji="🗑️"
        title={`${del?.name ?? ''} 선생님을 삭제할까요?`}
        actions={
          <>
            <Button
              onClick={() => {
                a.removeTeacher(del!.id);
                setDel(null);
              }}
            >
              삭제(저장 시 반영)
            </Button>
            <Button variant="ghost" onClick={() => setDel(null)}>
              취소
            </Button>
          </>
        }
      >
        {del && courseCount(del.id) > 0 ? `담당 강좌 ${courseCount(del.id)}개에서도 빠져요.` : '저장 및 배포 전까지는 되돌릴 수 있어요.'}
      </Modal>
    </div>
  );
}

/** 새 교사 문서 ID(코드와 무관한 임의값) */
const newId = () => doc(collection(db, 'teachers')).id;
