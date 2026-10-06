/**
 * 에뮬레이터 전용: 신청 기간을 바꾼다(대시보드가 생기기 전 시험용).
 *   npm run emu:period -- open      즉시 열기
 *   npm run emu:period -- closed    즉시 닫기
 *   npm run emu:period -- soon      1분 뒤 열림(카운트다운 시험)
 */

import { initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import type { PeriodConfig } from '../shared/types';

process.env.FIRESTORE_EMULATOR_HOST = '127.0.0.1:8080';
initializeApp({ projectId: 'demo-sghs' });

const arg = process.argv[2] ?? 'open';
const now = Date.now();
const presets: Record<string, PeriodConfig> = {
  open: { mode: 'open', openAt: null, closeAt: null },
  closed: { mode: 'closed', openAt: null, closeAt: null },
  soon: { mode: 'auto', openAt: now + 60_000, closeAt: now + 3 * 86_400_000 },
};
const p = presets[arg];
if (!p) throw new Error(`open / closed / soon 중 하나를 주세요 (받은 값: ${arg})`);
await getFirestore().doc('config/period').set(p);
console.log(`🧪 신청 기간 → ${arg}`);
