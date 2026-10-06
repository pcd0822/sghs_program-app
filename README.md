# 수능 이후 프로그램 수강신청 · 출결

고3 수능 이후(2026.11.30.~12.11.) 프로그램 수강신청과 출결을 위한 웹앱.
학생 약 216명 · 교사 13명 · 휴대폰 중심. 신청이 열리는 순간 200~300명이 몰려도 **정원 초과 0명**이 되도록 만들었다.

- 화면: React + Vite + TypeScript + Tailwind (`src/`)
- 서버: Firebase 하나만 — Firestore · Cloud Functions 2세대 · Auth(커스텀 토큰) · Storage · Hosting, 모두 서울(`asia-northeast3`)
- 규칙 로직은 `shared/` 한 곳(화면과 서버가 함께 씀). 작업 규칙은 `CLAUDE.md`.

---

## 1. 내 컴퓨터에서 시험하기

> Windows PowerShell 에서 `npm` 이 "스크립트를 실행할 수 없으므로…" 오류를 내면 **`npm` 대신 `npm.cmd`** 로 입력한다.

처음 한 번: Node.js 22 이상, Java 21(`winget install Microsoft.OpenJDK.21`), `npm install`, `npm --prefix functions install`,
`.env.local` 파일에 `VITE_USE_EMULATORS=true` 한 줄, `seed/수강신청DB.xlsx` 넣기.

```bash
# 터미널 1 — 파이어베이스 시험장(에뮬레이터)
npm run functions:build
npm run emu

# 터미널 2
npm run seed:emu            # 엑셀 → 시험장 (여러 번 실행해도 중복 없음)
npm run emu:phones          # 시험장 학생 연락처를 전부 010-1234-5678 로
npm run emu:period -- open  # 신청 기간 열기 (closed / soon 도 있음)
npm run dev                 # http://localhost:5173
```
- 시험장 관리 화면 http://127.0.0.1:4000 · 시험장은 끄면 자료가 사라진다(다시 켜면 seed:emu 부터).
- admin 대시보드: admin 교사로 로그인 → 프로필 → "관리자 대시보드"(또는 `/admin`)

### 자동 시험 (시험장이 켜져 있을 때)
| 명령 | 확인하는 것 |
| --- | --- |
| `npm run test:login` | 학생·교사 로그인, 5회 실패 잠금, IP 상한, 실패 기록 |
| `npm run test:apply` | 4장 수강신청 규칙 전부 + 40명 동시 신청 |
| `npm run test:teacher` | 보안 규칙(누가 무엇을 읽을 수 있나), 출결 공유 |
| `npm run test:admin` | 저장 및 배포, 수동 배정, 인원 수 점검 |
| `npm run test:board` | 문의 비밀글·공지 권한, 회원가입 승인, 프로필 |
| `npm run test:load` | **250명 동시 신청**: 정원 10명 강좌 → 정확히 10명, 정원 없는 필수 → 250명 모두, 연타 → 1번 |
| `npm run test:all` | 위 전부 |

> 시험 스크립트는 시험장의 신청·출결 자료를 지우고 시작한다(명단·강좌는 그대로).

최근 결과(에뮬레이터): 250명이 정원 10명 강좌에 동시 신청 → 성공 10 · 마감 240 · 기타 0 (약 3~7초),
정원 없는 필수 강좌 250명 → 250명 모두 성공, 인원 수 250 (약 1~2초). 실서버 결과는 배포 후 `test:load -- --prod --yes` 로 확인한다.

---

## 2. 실서버 준비 (선생님이 콘솔에서 한 번)

프로젝트: **sghs-program-app** (프로젝트 번호 688874637790)

1. **요금제 확인** — [Firebase 콘솔](https://console.firebase.google.com/project/sghs-program-app/usage/details) → 왼쪽 아래 요금제가 **Blaze** 인지 확인
2. **Firestore 만들기** — 빌드 → Firestore Database → 데이터베이스 만들기 → 위치 **asia-northeast3 (서울)** → **프로덕션 모드**
3. **Authentication 시작** — 빌드 → Authentication → 시작하기 (로그인 방법은 켜지 않아도 됨. 이 앱은 서버가 만든 토큰으로 로그인)
4. **Storage 시작** — 빌드 → Storage → 시작하기 → 위치 **asia-northeast3** → 프로덕션 모드
5. **로그인 토큰 발급 권한** — [Google Cloud IAM](https://console.cloud.google.com/iam-admin/iam?project=sghs-program-app) →
   `688874637790-compute@developer.gserviceaccount.com`(Default compute service account) 연필 → 역할 추가 → **서비스 계정 토큰 생성자** → 저장.
   그리고 [IAM Service Account Credentials API](https://console.cloud.google.com/apis/library/iamcredentials.googleapis.com?project=sghs-program-app) **사용** 클릭.
   (이걸 안 하면 배포 후 로그인 때 토큰 발급 권한 오류가 난다)
   ※ IAM 목록에 이 계정이 **없으면** 아직 만들어지지 않은 것이다. [Compute Engine API](https://console.cloud.google.com/apis/library/compute.googleapis.com?project=sghs-program-app)
   에서 **사용**을 누르고 1~2분 뒤 IAM 페이지를 새로고침하면 생긴다(서버 기능을 처음 배포할 때도 자동으로 생긴다).
6. **서비스 계정 키(초기 자료 등록용)** — 프로젝트 설정 → 서비스 계정 → 새 비공개 키 생성 → 받은 파일을 `seed/service-account.json` 으로 저장.
   이 파일은 관리자 열쇠와 같으므로 **절대 다른 곳에 올리지 않는다**(seed/ 는 깃허브에 안 올라감). 운영이 끝나면 콘솔에서 키를 삭제한다.
7. **예산 알림** — [Google Cloud 결제 → 예산 및 알림](https://console.cloud.google.com/billing/budgets) → 예산 만들기 →
   프로젝트 sghs-program-app → 금액(예: 30,000원) → 알림 50% · 90% · 100% → 이메일 받기.
   ※ 예산 알림은 **알려만 주고 사용을 멈추지는 않는다**.

### 웹 앱 설정 값 넣기
프로젝트 설정 → 일반 → 내 앱 → 웹 앱(</>) 추가 → 나오는 값을 `.env.production.local` 에 적는다(깃허브에 안 올라감):
```
VITE_USE_EMULATORS=false
VITE_FIREBASE_API_KEY=...
VITE_FIREBASE_AUTH_DOMAIN=sghs-program-app.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=sghs-program-app
VITE_FIREBASE_STORAGE_BUCKET=...
VITE_FIREBASE_MESSAGING_SENDER_ID=...
VITE_FIREBASE_APP_ID=...
```
`npm run build:prod` 가 이 값을 먼저 확인하고, 비어 있거나 시험장 설정이면 빌드를 멈춘다.

---

## 3. 배포

```bash
npx firebase login          # 처음 한 번
npm run deploy              # 보안 규칙 · 색인 · 서버 기능 · 화면 전부 (화면 빌드는 자동)
npm run seed -- --yes       # 엑셀 → 실서버 (처음 한 번)
```
- 주소: https://sghs-program-app.web.app
- 일부만: `npm run deploy:functions` (서버 기능) · `npm run deploy:rules` (보안 규칙)
- 첫 서버 기능 배포는 필요한 구글 클라우드 기능을 켜느라 5~10분 걸릴 수 있다.

### 신청 여는 날: 서버 미리 켜 두기
`functions/.env` 의 `HOT_MIN_INSTANCES=0` 을 **1**(많이 몰리면 2)로 바꾸고 `npm run deploy:functions`.
로그인·신청·취소·제출 4개 기능이 미리 켜져 있어 첫 요청도 기다림 없이 처리된다. 신청이 끝나면 다시 **0** 으로 바꿔 배포.
- 설정: 서버 한 대가 동시에 80건 처리(concurrency 80), 기능마다 최대 30대.
- 예상 비용(추정): 미리 켜 둔 서버는 쉬고 있어도 요금이 붙는다. 서울 지역 1 vCPU · 512MiB 한 대가 하루 약 0.4~0.5달러로,
  4개 기능 × 1대면 **하루 약 2달러(약 2~3천 원)** 수준으로 추정한다. 여는 날 하루~이틀만 켜면 몇천 원이다.
  정확한 값은 [Cloud Run 가격표](https://cloud.google.com/run/pricing)(Tier 2, 최소 인스턴스 유휴 요금)로 확인한다.
- 나머지(Firestore 읽기·쓰기, 서버 실행 시간, 호스팅)는 이 규모(학생 216명, 2주)면 무료 사용량 안팎이다.

---

## 4. 운영 전 점검표

| 순서 | 할 일 | 어디서 |
| --- | --- | --- |
| 1 | **초기 자료 등록** — `npm run seed -- --yes` 후 대시보드에서 학생 216명 · 교사 13명 · 강좌 41개 확인 | 터미널 → 대시보드 |
| 2 | **연락처 일괄 등록** — 학생 관리 → 명단 내려받기 → 연락처 채우기 → 연락처 올리기 → 확인 → 저장 및 배포. 제목 옆 "연락처 없음 0명" 확인 | 대시보드 |
| 3 | **담당교사 배정** — 프로그램·담당교사 → 담당교사 배정 모드 → 강좌마다 지정 → 저장 및 배포 | 대시보드 |
| 4 | **신청 기간 설정** — 신청 일정 → "정한 시각대로" + 시작·마감 일시 → 저장 및 배포 | 대시보드 |
| 5 | **시험 신청** — (a) `npm run test:load -- --prod --yes` 로 실서버 250명 동시 시험 (b) 선생님 휴대폰으로 학생 1명 로그인 → 신청 → 제출 → 시간표 → 교사 출석부 확인 | 터미널 · 휴대폰 |
| 6 | **시험 자료 삭제** — `npm run purge` 로 지울 내용 확인 → `npm run purge -- --yes` → 현황판 "인원 수 점검" | 터미널 → 대시보드 |
| 7 | 여는 날 아침 `HOT_MIN_INSTANCES=1` 배포 · 공지 올리기 · 학생에게 주소(https://sghs-program-app.web.app) 안내 | 터미널 · 대시보드 |

시험 신청(5)은 신청 기간을 잠깐 열기 때문에 **학생에게 주소를 알리기 전에** 한다. 끝나면 신청 기간은 원래대로 돌아간다.

---

## 5. 수강신청 종료 후 자료 보관

- 대시보드 → 수강신청 내역 → **xlsx 내려받기** (학생별 신청 · 강좌별 명단 · 강좌별 인원)
- 대시보드 → 출결 조회 → **전체 출결 xlsx**
- 한 번에 전부: `npm run export -- --yes` → `seed/backup/전체자료_날짜.xlsx`
  (학생 · 학생별 신청 · 강좌별 명단 · 강좌 · 출결 · 문의·공지. 연락처가 들어 있으니 학교 보관 규정에 맞게 관리)
- 운영이 끝나면: `HOT_MIN_INSTANCES=0` 확인, 서비스 계정 키 삭제(콘솔), 필요하면 대시보드에서 신청 기간 닫기.

---

## 6. 초기 자료 등록 스크립트

| 명령 | 하는 일 |
| --- | --- |
| `npm run seed -- --dry-run` | 엑셀만 읽고 무엇이 등록될지 보여줌 |
| `npm run seed:emu` | 시험장에 등록 |
| `npm run seed -- --yes` | 실서버에 등록 (`seed/service-account.json` 필요) |
| `... --overwrite` | 이미 있는 학생·교사·강좌도 시트 내용으로 덮어씀(신청 인원·썸네일은 유지) |

- 강좌 ID는 `프로그램코드-월일`(같은 날 같은 코드가 여러 행이면 `-1`, `-2`). 예: `P13-1202-1`(A반), `P13-1202-2`(B반)
- P07 전공콘서트는 12.1.=P07, 12.2.(3-9)=P29, 12.2.(대강당)=P30 으로 나눠 등록
- 장소 칸의 `3-1` 처럼 날짜로 바뀌어 저장된 값도 화면에 보이는 글자 그대로 읽는다
- 연락처는 시트에 값이 있을 때만 기록 — 대시보드에서 등록한 연락처를 빈칸으로 지우지 않는다

## 7. 폴더
```
src/        화면 (student/ teacher/ admin/ board/ courses/ timetable/ ui/ lib/)
functions/  서버 기능 (login apply attendance admin board profile)
shared/     화면과 서버가 함께 쓰는 규칙·날짜 처리·자료 모양
scripts/    초기 자료 등록 · 시험 · 운영(purge/export) 스크립트
seed/       엑셀 · 서비스 계정 키 · 백업 (커밋 금지)
```
