// 에뮬레이터 시험 스크립트 공용 도구. 실제 파이어베이스에는 연결하지 않는다.

import { initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';

process.env.FIRESTORE_EMULATOR_HOST = '127.0.0.1:8080';
process.env.FIREBASE_AUTH_EMULATOR_HOST = '127.0.0.1:9099';
initializeApp({ projectId: 'demo-sghs' });

export const db = getFirestore();
const auth = getAuth();
const FN = 'http://127.0.0.1:5001/demo-sghs/asia-northeast3';

/** 학생으로 로그인한 ID 토큰(로그인 함수를 거치지 않고 같은 claims 로 바로 만든다) */
export async function studentToken(sid: string): Promise<string> {
  const custom = await auth.createCustomToken(`s_${sid}`, { role: 'student', sid, classNo: Number(sid.slice(1, 3)) });
  const res = await fetch('http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key=demo', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ token: custom, returnSecureToken: true }),
  });
  const body = (await res.json()) as { idToken: string };
  return body.idToken;
}

export interface FnResult {
  result?: { ok?: boolean; already?: boolean };
  error?: { status: string; message: string; details?: { reason?: string } };
}

export async function callAs(token: string, name: string, data: unknown): Promise<FnResult> {
  const res = await fetch(`${FN}/${name}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
    body: JSON.stringify({ data }),
  });
  return (await res.json()) as FnResult;
}

/** 신청 자료 전부 지우고 인원 수를 0으로(시험 시작 전 초기화) */
export async function resetApplications(): Promise<void> {
  const bw = db.bulkWriter();
  for (const name of ['applications', 'enrollments']) {
    for (const d of (await db.collection(name).get()).docs) bw.delete(d.ref);
  }
  for (const d of (await db.collectionGroup('shards').get()).docs) bw.delete(d.ref);
  for (const d of (await db.collection('courses').get()).docs) bw.update(d.ref, { count: 0 });
  await bw.close();
}

export async function setPeriod(mode: 'open' | 'closed'): Promise<void> {
  await db.doc('config/period').set({ mode, openAt: null, closeAt: null });
}

let failed = 0;
export function check(label: string, ok: boolean, detail = ''): void {
  console.log(`${ok ? '✅' : '❌'} ${label}${detail ? ` — ${detail}` : ''}`);
  if (!ok) failed++;
}
export function finish(title: string): never {
  console.log(failed ? `\n❌ ${failed}개 실패` : `\n🎉 ${title} 모두 통과`);
  process.exit(failed ? 1 : 0);
}
