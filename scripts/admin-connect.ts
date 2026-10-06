// 운영 스크립트 공용: --emulator 면 시험장, 아니면 실서버(--yes 필수, seed/service-account.json 사용)

import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { applicationDefault, cert, initializeApp } from 'firebase-admin/app';
import { getFirestore, type Firestore } from 'firebase-admin/firestore';

export function connect(purpose: string): { db: Firestore; emulator: boolean } {
  const emulator = process.argv.includes('--emulator');
  if (emulator) {
    process.env.FIRESTORE_EMULATOR_HOST ??= '127.0.0.1:8080';
    initializeApp({ projectId: 'demo-sghs' });
    console.log(`🧪 에뮬레이터(내 컴퓨터 시험장) · ${purpose}`);
  } else {
    const key = resolve('seed/service-account.json');
    initializeApp({ credential: existsSync(key) ? cert(key) : applicationDefault(), projectId: 'sghs-program-app' });
    console.log(`🔥 실서버(sghs-program-app) · ${purpose}`);
  }
  return { db: getFirestore(), emulator };
}
