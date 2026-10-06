/**
 * 에뮬레이터 전용: 모든 학생의 연락처를 010-1234-5678 로 채운다(학생 로그인 시험용).
 *   npm run emu:phones
 * 실제 파이어베이스에는 연결하지 않는다(demo- 프로젝트 + 에뮬레이터 주소 고정).
 */

import { initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

process.env.FIRESTORE_EMULATOR_HOST = '127.0.0.1:8080';
initializeApp({ projectId: 'demo-sghs' });
const db = getFirestore();

const students = await db.collection('students').get();
const bw = db.bulkWriter();
for (const d of students.docs) {
  bw.set(db.collection('studentSecrets').doc(d.id), { phone: '01012345678', classNo: d.get('classNo') });
}
await bw.close();
console.log(`🧪 에뮬레이터 학생 ${students.size}명의 연락처를 010-1234-5678 로 채웠습니다.`);
