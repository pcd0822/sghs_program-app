import { initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';
import { defineInt } from 'firebase-functions/params';
import { setGlobalOptions } from 'firebase-functions/v2';
import type { CallableOptions } from 'firebase-functions/v2/https';
import { HttpsError } from 'firebase-functions/v2/https';
import { REGION } from '../../shared/constants';

// 모든 함수는 서울 지역. 신청 기간에 몰리는 함수는 아래 HOT 설정을 따로 쓴다.
// 함수 정의보다 먼저 실행되도록 모든 함수 파일이 처음 불러오는 이 파일에 둔다.
// invoker public: 브라우저에서 바로 부를 수 있게(로그인·권한 검사는 각 함수 안에서 한다)
setGlobalOptions({ region: REGION, memory: '256MiB', maxInstances: 20, invoker: 'public' });

/**
 * 신청 기간에 몰리는 함수(로그인·신청·취소·제출) 설정.
 * - HOT_MIN_INSTANCES: 미리 켜 둘 서버 수. 평소 0(비용 없음), 신청 여는 날만 1~2로 올려 배포한다(functions/.env).
 * - concurrency 80: 서버 한 대가 동시에 80건까지 처리 → 최대 30대면 2,400건 동시 처리.
 */
const HOT_MIN_INSTANCES = defineInt('HOT_MIN_INSTANCES', { default: 0 });
export const HOT: CallableOptions = { minInstances: HOT_MIN_INSTANCES, concurrency: 80, cpu: 1, memory: '512MiB', maxInstances: 30, timeoutSeconds: 30 };

initializeApp();

export const db = getFirestore();
export const auth = getAuth();

type FailCode = 'invalid-argument' | 'failed-precondition' | 'permission-denied' | 'not-found' | 'resource-exhausted' | 'already-exists' | 'unauthenticated';

/** 학생에게 그대로 보여줄 수 있는 쉬운 말 오류. reason 은 화면이 알맞은 안내(모달 등)를 고르는 데 쓴다. */
export function fail(message: string, code: FailCode = 'failed-precondition', reason?: string): never {
  throw new HttpsError(code, message, reason ? { reason } : undefined);
}
