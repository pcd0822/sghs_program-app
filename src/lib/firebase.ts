import { initializeApp } from 'firebase/app';
import { connectAuthEmulator, getAuth } from 'firebase/auth';
import { connectFirestoreEmulator, initializeFirestore } from 'firebase/firestore';
import { connectFunctionsEmulator, getFunctions } from 'firebase/functions';
import { REGION } from '@shared/constants';

export const USE_EMULATORS = import.meta.env.VITE_USE_EMULATORS === 'true';

const env = import.meta.env;
const app = initializeApp(
  USE_EMULATORS
    ? // 에뮬레이터는 가짜 값으로 충분하다. demo- 로 시작하는 프로젝트는 실제 서버에 절대 연결되지 않는다.
      { apiKey: 'demo-key', projectId: 'demo-sghs', storageBucket: 'demo-sghs.appspot.com', appId: 'demo' }
    : {
        apiKey: env.VITE_FIREBASE_API_KEY,
        authDomain: env.VITE_FIREBASE_AUTH_DOMAIN,
        projectId: env.VITE_FIREBASE_PROJECT_ID,
        storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET,
        messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID,
        appId: env.VITE_FIREBASE_APP_ID,
      },
);

export const auth = getAuth(app);
// 학교 와이파이·통신사 프록시에서 실시간 연결이 끊기는 경우를 대비해 연결 방식을 자동으로 고른다.
export const db = initializeFirestore(app, { experimentalAutoDetectLongPolling: true });
export const functions = getFunctions(app, REGION);

if (USE_EMULATORS) {
  const host = location.hostname; // 휴대폰으로 같은 와이파이에서 접속할 때도 동작하도록
  connectAuthEmulator(auth, `http://${host}:9099`, { disableWarnings: true });
  connectFirestoreEmulator(db, host, 8080);
  connectFunctionsEmulator(functions, host, 5001);
}

/** Storage(사진 올리기)는 쓸 때만 불러온다 — 첫 화면을 가볍게 */
let storagePromise: Promise<import('firebase/storage').FirebaseStorage> | null = null;
export function getStorageLazy() {
  storagePromise ??= import('firebase/storage').then(({ getStorage, connectStorageEmulator }) => {
    const st = getStorage(app);
    if (USE_EMULATORS) connectStorageEmulator(st, location.hostname, 9199);
    return st;
  });
  return storagePromise;
}
