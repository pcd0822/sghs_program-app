// 배포용 빌드 전에 실행: 실서버 설정이 제대로 들어가는지 확인한다.
// .env.local 의 VITE_USE_EMULATORS=true 가 실서버 빌드에 섞이면 학생 휴대폰이 "내 컴퓨터 시험장"에 연결하려다 실패한다.
// 그래서 .env.production.local 에 실서버 값이 있어야만 빌드를 허락한다.

import { loadEnv } from 'vite';

const env = loadEnv('production', process.cwd(), 'VITE_');
const problems = [];
if (env.VITE_USE_EMULATORS === 'true') problems.push('VITE_USE_EMULATORS=false 로 적어 주세요(.env.production.local)');
for (const k of ['VITE_FIREBASE_API_KEY', 'VITE_FIREBASE_PROJECT_ID', 'VITE_FIREBASE_APP_ID', 'VITE_FIREBASE_STORAGE_BUCKET']) {
  if (!env[k]) problems.push(`${k} 값이 비어 있어요(.env.production.local)`);
}
if (env.VITE_FIREBASE_PROJECT_ID && env.VITE_FIREBASE_PROJECT_ID !== 'sghs-program-app') problems.push(`프로젝트 ID 가 sghs-program-app 이 아니에요: ${env.VITE_FIREBASE_PROJECT_ID}`);

if (problems.length) {
  console.error('\n❌ 배포용 설정이 아직 준비되지 않았어요:');
  for (const p of problems) console.error(`   - ${p}`);
  console.error('   README 의 "웹 앱 설정 값 넣기"를 참고해 주세요.\n');
  process.exit(1);
}
console.log('✅ 배포용 설정 확인 완료(실서버 sghs-program-app)');
