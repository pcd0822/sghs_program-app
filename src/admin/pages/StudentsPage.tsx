import { Backpack, Download, FilePenLine, Phone, Trash2, Upload } from 'lucide-react';
import { collection, query, where } from 'firebase/firestore';
import { useState } from 'react';
import { validateStudent, type StudentInput } from '@shared/admin';
import { normalizeName, parseSid, phoneDigits } from '@shared/text';
import type { SignupRequest } from '@shared/types';
import { useQueryDocs } from '@/data/live';
import { call } from '@/lib/call';
import { db } from '@/lib/firebase';
import { formatDateTime } from '@/lib/format';
import { downloadXlsx, readXlsx, stamp } from '@/lib/xlsx';
import { Button } from '@/ui/Button';
import { Modal } from '@/ui/Modal';
import { Sheet } from '@/ui/Sheet';
import { useToast } from '@/ui/Toast';
import { useAdmin, type StudentRow } from '../AdminData';
import { Card, DirtyDot, Field, PageHead, SmallButton, TableWrap, SearchBox, PillSelect } from '../ui';

const fmtPhone = (p: string) => p.replace(/^(\d{3})(\d{3,4})(\d{4})$/, '$1-$2-$3');

interface Preview {
  updates: StudentInput[];
  same: number;
  fresh: StudentInput[];
  errors: string[];
  nameWarn: string[];
}

export default function StudentsPage() {
  const a = useAdmin();
  const toast = useToast();
  const [q, setQ] = useState('');
  const [cls, setCls] = useState<number | 'all'>('all');
  const [edit, setEdit] = useState<{ s: StudentInput; isNew: boolean } | null>(null);
  const [del, setDel] = useState<StudentRow | null>(null);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [addFresh, setAddFresh] = useState(false);

  const rows = a.students.filter((s) => (cls === 'all' || s.classNo === cls) && (!q.trim() || s.sid.includes(q.trim()) || s.name.includes(q.trim())));
  const noPhone = a.students.filter((s) => !s.phone).length;

  async function downloadRoster() {
    await downloadXlsx(`학생명단_${stamp()}.xlsx`, [{ name: '학생명단', rows: [['학번', '이름', '연락처'], ...a.students.map((s) => [s.sid, s.name, s.phone ? fmtPhone(s.phone) : ''])] }]);
  }

  async function upload(file: File) {
    try {
      const rows = await readXlsx(file);
      if (!rows.length || !('학번' in rows[0])) return toast('첫 줄에 "학번, 이름, 연락처" 머리글이 있는 엑셀을 올려 주세요.', 'error');
      const cur = new Map(a.students.map((s) => [s.sid, s]));
      const p: Preview = { updates: [], same: 0, fresh: [], errors: [], nameWarn: [] };
      const seen = new Set<string>();
      rows.forEach((r, i) => {
        const line = `${i + 2}행`;
        const sid = parseSid(r['학번'])?.sid;
        const phone = phoneDigits(r['연락처']);
        const name = normalizeName(r['이름']);
        if (!sid) return void p.errors.push(`${line}: 학번 "${r['학번']}"이 올바르지 않아요`);
        if (seen.has(sid)) return void p.errors.push(`${line}: 학번 ${sid}이 두 번 나와요`);
        seen.add(sid);
        if (phone && (phone.length < 9 || phone.length > 11)) return void p.errors.push(`${line}: ${sid} 연락처 "${r['연락처']}" 자릿수가 이상해요`);
        const s = cur.get(sid);
        if (!s) {
          if (!name) return void p.errors.push(`${line}: 새 학번 ${sid}의 이름이 비어 있어요`);
          p.fresh.push({ sid, name, phone });
          return;
        }
        if (name && name !== normalizeName(s.name)) p.nameWarn.push(`${sid}: 명단 "${s.name}" ↔ 파일 "${name}" (연락처만 바꾸고 이름은 그대로 둬요)`);
        if (!phone || phone === s.phone) return void p.same++;
        p.updates.push({ sid, name: s.name, phone });
      });
      setAddFresh(false);
      setPreview(p);
    } catch (e) {
      toast(`엑셀을 읽지 못했어요: ${(e as Error).message}`, 'error');
    }
  }

  function applyPreview() {
    if (!preview) return;
    const list = [...preview.updates, ...(addFresh ? preview.fresh : [])];
    a.setStudents(list);
    toast(`${list.length}명을 임시로 반영했어요. "저장 및 배포"를 눌러야 저장돼요.`, 'info');
    setPreview(null);
  }

  function saveEdit() {
    if (!edit) return;
    const s = { ...edit.s, name: normalizeName(edit.s.name), phone: phoneDigits(edit.s.phone) };
    const err = validateStudent(s);
    if (err) return toast(err, 'error');
    if (edit.isNew && a.students.some((x) => x.sid === s.sid)) return toast('이미 있는 학번이에요.', 'error');
    a.setStudents([s]);
    setEdit(null);
  }

  return (
    <div className="space-y-4">
      <PageHead
        icon={Backpack} tone="coral"
        title="학생 관리"
        desc={`${a.students.length}명 · 연락처 없음 ${noPhone}명 (연락처가 없으면 로그인할 수 없어요)`}
        actions={
          <>
            <SmallButton onClick={downloadRoster}><Download size={16} aria-hidden /> 명단 내려받기</SmallButton>
            <label className="inline-flex min-h-10 cursor-pointer items-center gap-1.5 rounded-full bg-soft px-4 text-[14px] font-semibold hover:bg-line">
              <Upload size={16} aria-hidden /> 연락처 올리기
              <input
                type="file"
                accept=".xlsx,.xls,.csv"
                className="sr-only"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  e.target.value = '';
                  if (f) void upload(f);
                }}
              />
            </label>
            <SmallButton tone="brand" onClick={() => setEdit({ s: { sid: '', name: '', phone: '' }, isNew: true })}>
              ＋ 학생 추가
            </SmallButton>
          </>
        }
      />
      <SignupRequests />
      <p className="flex items-start gap-2 rounded-2xl bg-sky-50 px-4 py-3 text-[14px] text-sky-800">
        <Phone size={16} className="mt-0.5 shrink-0" aria-hidden /> <span>연락처 일괄 등록: <b>명단 내려받기</b> → 엑셀의 연락처 칸 채우기 → <b>연락처 올리기</b> → 바뀔 내용 확인 → <b>저장 및 배포</b></span>
      </p>

      <div className="flex flex-wrap items-center gap-2">
        <SearchBox placeholder="학번 또는 이름" value={q} onChange={(e) => setQ(e.target.value)} />
        <PillSelect value={cls} onChange={(e) => setCls(e.target.value === 'all' ? 'all' : Number(e.target.value))} className="w-36" aria-label="학급 선택">
          <option value="all">전체 반</option>
          {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => (
            <option key={n} value={n}>
              {n}반
            </option>
          ))}
        </PillSelect>
      </div>

      <Card>
        <TableWrap>
          <thead>
            <tr>
              <th>학번</th>
              <th>이름</th>
              <th>연락처</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {rows.map((s) => (
              <tr key={s.sid} className={a.dirtyKeys.students.has(s.sid) ? 'bg-orange-50/50' : ''}>
                <td className="tabular-nums">{s.sid}</td>
                <td className="font-bold">
                  {s.name} {a.dirtyKeys.students.has(s.sid) && <DirtyDot />}
                </td>
                <td className="tabular-nums">{s.phone ? fmtPhone(s.phone) : <span className="font-semibold text-rose-500">없음</span>}</td>
                <td className="space-x-1 text-right whitespace-nowrap">
                  <SmallButton onClick={() => setEdit({ s: { sid: s.sid, name: s.name, phone: s.phone }, isNew: false })}>수정</SmallButton>
                  <SmallButton tone="danger" onClick={() => setDel(s)}>
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
          title={edit.isNew ? '학생 추가' : '학생 수정'}
          footer={
            <Button variant="brand" onClick={saveEdit}>
              적용하기
            </Button>
          }
        >
          <div className="space-y-3 pb-4">
            <Field
              label="학번(5자리)"
              inputMode="numeric"
              maxLength={5}
              disabled={!edit.isNew}
              value={edit.s.sid}
              onChange={(e) => setEdit({ ...edit, s: { ...edit.s, sid: e.target.value.replace(/\D/g, '') } })}
              hint={edit.isNew ? '' : '학번을 바꾸려면 삭제 후 새로 추가해 주세요'}
            />
            <Field label="이름" value={edit.s.name} onChange={(e) => setEdit({ ...edit, s: { ...edit.s, name: e.target.value } })} />
            <Field label="연락처" type="tel" value={edit.s.phone} onChange={(e) => setEdit({ ...edit, s: { ...edit.s, phone: e.target.value } })} />
          </div>
        </Sheet>
      )}

      <Modal
        open={!!del}
        onClose={() => setDel(null)}
        icon={Trash2} tone="rose"
        title={`${del?.name ?? ''} 학생을 삭제할까요?`}
        actions={
          <>
            <Button
              onClick={() => {
                a.removeStudent(del!.sid);
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
        {del && Object.keys(a.applications.get(del.sid)?.items ?? {}).length > 0
          ? `이 학생의 신청 ${Object.keys(a.applications.get(del.sid)!.items).length}건도 함께 취소돼요.`
          : '저장 및 배포 전까지는 되돌릴 수 있어요.'}
      </Modal>

      {preview && (
        <Sheet
          open
          onClose={() => setPreview(null)}
          title="올린 파일 확인"
          footer={
            <Button variant="brand" disabled={!preview.updates.length && !(addFresh && preview.fresh.length)} onClick={applyPreview}>
              {preview.updates.length + (addFresh ? preview.fresh.length : 0)}명 반영하기
            </Button>
          }
        >
          <div className="space-y-3 pb-4 text-[14px]">
            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="rounded-2xl bg-emerald-50 p-3">
                <p className="text-[24px] font-extrabold text-emerald-700">{preview.updates.length}</p>
                <p className="text-sub">연락처 수정</p>
              </div>
              <div className="rounded-2xl bg-brand-50 p-3">
                <p className="text-[24px] font-extrabold text-brand-700">{preview.fresh.length}</p>
                <p className="text-sub">명단에 없는 학번</p>
              </div>
              <div className="rounded-2xl bg-rose-50 p-3">
                <p className="text-[24px] font-extrabold text-rose-600">{preview.errors.length}</p>
                <p className="text-sub">오류 행</p>
              </div>
            </div>
            <p className="text-sub">바뀌지 않음 {preview.same}명</p>
            {preview.fresh.length > 0 && (
              <label className="flex items-start gap-2 rounded-2xl bg-brand-50 p-3">
                <input type="checkbox" checked={addFresh} onChange={(e) => setAddFresh(e.target.checked)} className="mt-1 size-5" />
                <span>
                  <b>명단에 없는 학번 {preview.fresh.length}명을 새 학생으로 추가할까요?</b>
                  <span className="mt-1 block text-[13px] text-sub">{preview.fresh.slice(0, 8).map((s) => `${s.sid} ${s.name}`).join(', ')}{preview.fresh.length > 8 ? ' …' : ''}</span>
                </span>
              </label>
            )}
            {preview.errors.length > 0 && (
              <div className="rounded-2xl bg-rose-50 p-3">
                <p className="font-bold text-rose-600">반영하지 않는 오류 행</p>
                <ul className="mt-1 list-disc pl-5 text-[13px]">
                  {preview.errors.map((e) => (
                    <li key={e}>{e}</li>
                  ))}
                </ul>
              </div>
            )}
            {preview.nameWarn.length > 0 && (
              <div className="rounded-2xl bg-orange-50 p-3">
                <p className="font-bold text-orange-700">이름이 명단과 다른 행</p>
                <ul className="mt-1 list-disc pl-5 text-[13px]">
                  {preview.nameWarn.map((e) => (
                    <li key={e}>{e}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </Sheet>
      )}
    </div>
  );
}

/** 가입 신청 승인·거절(누르는 즉시 반영) */
function SignupRequests() {
  const toast = useToast();
  const list = useQueryDocs<SignupRequest>('signup-pending', () => query(collection(db, 'signupRequests'), where('status', '==', 'pending')));
  const [busy, setBusy] = useState<string | null>(null);
  if (!list?.length) return null;

  async function review(sid: string, approve: boolean) {
    setBusy(sid);
    try {
      await call('reviewSignup', { sid, approve });
      toast(approve ? `${sid} 승인 — 이제 로그인할 수 있어요` : `${sid} 거절했어요`, approve ? 'success' : 'info');
    } catch (e) {
      toast((e as Error).message, 'error');
    } finally {
      setBusy(null);
    }
  }

  return (
    <Card className="ring-2 ring-brand-300">
      <h2 className="flex items-center gap-1.5 text-[17px] font-extrabold"><FilePenLine size={18} className="text-brand-600" aria-hidden /> 가입 신청 {list.length}건</h2>
      <p className="text-[13px] text-sub">명단에 없는 학생이 보낸 신청이에요. 승인하면 바로 학생 명단에 등록돼요.</p>
      <ul className="mt-2 divide-y divide-line">
        {[...list]
          .sort((a, b) => a.createdAt - b.createdAt)
          .map((r) => (
            <li key={r.sid} className="flex flex-wrap items-center gap-2 py-2.5">
              <span className="min-w-0 flex-1">
                <b className="tabular-nums">{r.sid}</b> {r.name} <span className="text-sub tabular-nums">{fmtPhone(r.phone)}</span>
                <span className="block text-[12px] text-sub">{formatDateTime(r.createdAt)} 신청</span>
              </span>
              <SmallButton tone="brand" disabled={busy === r.sid} onClick={() => review(r.sid, true)}>
                승인
              </SmallButton>
              <SmallButton tone="danger" disabled={busy === r.sid} onClick={() => review(r.sid, false)}>
                거절
              </SmallButton>
            </li>
          ))}
      </ul>
    </Card>
  );
}
