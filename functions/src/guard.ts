// 로그인 실패 횟수 세기와 잠금.
// - 기기 기준: 같은 기기에서 연속 실패하면 잠깐 잠근다.
// - IP 상한(관리자 로그인만): 학교 와이파이는 모든 기기가 같은 IP라서 IP만으로 잠그면 교내 전체가 잠긴다.
//   그래서 IP는 1시간에 많이 틀릴 때만 잠그는 "상한"으로 쓴다.

import { createHash } from 'node:crypto';
import type { CallableRequest } from 'firebase-functions/v2/https';
import { db, fail } from './app';

interface GuardDoc {
  fails: number;
  lockedUntil: number;
  windowStart: number;
}

export interface Caller {
  ip: string;
  deviceKey: string;
  userAgent: string;
}

export function readCaller(req: CallableRequest, deviceId: unknown): Caller {
  const raw = req.rawRequest;
  const fwd = String(raw.headers['x-forwarded-for'] ?? '').split(',')[0].trim();
  const ip = fwd || raw.ip || 'unknown';
  const id = typeof deviceId === 'string' && /^[A-Za-z0-9-]{8,64}$/.test(deviceId) ? deviceId : '';
  // 기기 표시가 없으면 IP로 대신한다.
  const deviceKey = id ? `d_${id}` : `dip_${hash(ip)}`;
  return { ip, deviceKey, userAgent: String(raw.headers['user-agent'] ?? '').slice(0, 200) };
}

export function hash(v: string): string {
  return createHash('sha256').update(v).digest('hex').slice(0, 32);
}

const ref = (scope: string, key: string) => db.collection('loginGuards').doc(`${scope}_${key}`);

/** 잠겨 있으면 오류를 던진다. */
export async function assertNotLocked(keys: { scope: string; key: string }[]): Promise<void> {
  const snaps = await db.getAll(...keys.map((k) => ref(k.scope, k.key)));
  const now = Date.now();
  for (const s of snaps) {
    const g = s.data() as GuardDoc | undefined;
    if (g && g.lockedUntil > now) {
      const min = Math.ceil((g.lockedUntil - now) / 60_000);
      fail(`로그인 시도가 너무 많아요. ${min}분 뒤에 다시 시도해 주세요.`, 'resource-exhausted');
    }
  }
}

/**
 * 실패 1회 기록. windowMs 안에서 maxFails 에 닿으면 lockMs 만큼 잠근다.
 * 연속 실패(기기)는 windowMs 를 길게 주고 성공 시 reset 한다.
 */
export async function recordFail(scope: string, key: string, rule: { maxFails: number; lockMs: number; windowMs?: number }): Promise<boolean> {
  const r = ref(scope, key);
  return db.runTransaction(async (tx) => {
    const now = Date.now();
    const g = ((await tx.get(r)).data() as GuardDoc | undefined) ?? { fails: 0, lockedUntil: 0, windowStart: now };
    const windowMs = rule.windowMs ?? Number.MAX_SAFE_INTEGER;
    const lockExpired = g.lockedUntil !== 0 && g.lockedUntil <= now;
    if (now - g.windowStart > windowMs || lockExpired) {
      g.fails = 0;
      g.windowStart = now;
      g.lockedUntil = 0;
    }
    g.fails += 1;
    let locked = false;
    if (g.fails >= rule.maxFails) {
      g.lockedUntil = now + rule.lockMs;
      locked = true;
    }
    tx.set(r, g);
    return locked;
  });
}

export async function resetGuard(scope: string, key: string): Promise<void> {
  await ref(scope, key).delete();
}
