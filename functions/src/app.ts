import { initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';
import { setGlobalOptions } from 'firebase-functions/v2';
import { HttpsError } from 'firebase-functions/v2/https';
import { REGION } from '../../shared/constants';

// 모든 함수는 서울 지역. 신청 기간용 최소 인스턴스·동시 처리 수는 6단계에서 함수별로 지정한다.
// 함수 정의보다 먼저 실행되도록 모든 함수 파일이 처음 불러오는 이 파일에 둔다.
setGlobalOptions({ region: REGION, memory: '256MiB', maxInstances: 20 });

initializeApp();

export const db = getFirestore();
export const auth = getAuth();

type FailCode = 'invalid-argument' | 'failed-precondition' | 'permission-denied' | 'not-found' | 'resource-exhausted' | 'already-exists' | 'unauthenticated';

/** 학생에게 그대로 보여줄 수 있는 쉬운 말 오류. reason 은 화면이 알맞은 안내(모달 등)를 고르는 데 쓴다. */
export function fail(message: string, code: FailCode = 'failed-precondition', reason?: string): never {
  throw new HttpsError(code, message, reason ? { reason } : undefined);
}
