# 수능 이후 프로그램 수강신청 · 출결

고3 수능 이후(2026.11.30.~12.11.) 프로그램 수강신청과 출결을 위한 웹앱.
React + Vite + TypeScript + Tailwind / Firebase(Firestore · Functions · Auth · Storage · Hosting, 서울 지역).

> 진행 단계: **1단계(뼈대 · 로그인) · 2단계(학생 수강신청 · 시간표) · 3단계(교사 화면 · 출결) · 4단계(admin 대시보드) 완료.** 배포 방법과 운영 전 점검표는 6단계에서 이 문서에 채운다.

## 처음 한 번 준비
1. Node.js 22 이상, Java 21 (에뮬레이터용 — `winget install Microsoft.OpenJDK.21`)
2. 이 폴더에서 `npm install` 과 `npm --prefix functions install`
3. `.env.example` 을 복사해 `.env.local` 을 만든다. 내 컴퓨터에서 시험할 때는 `VITE_USE_EMULATORS=true` 한 줄이면 된다.
4. `seed/수강신청DB.xlsx` 를 넣는다(깃허브에 올라가지 않음).

## 내 컴퓨터에서 실행 (터미널 2개)
> Windows PowerShell 에서 `npm` 이 "스크립트를 실행할 수 없으므로…" 오류를 내면 `npm` 대신 **`npm.cmd`** 로 입력한다.
> (예: `npm.cmd run emu`) 명령 프롬프트(cmd)나 VS Code 의 Git Bash 터미널에서는 `npm` 그대로 된다.

```bash
# 터미널 1 — 파이어베이스 시험장(에뮬레이터)
npm run functions:build
npm run emu

# 터미널 2 — 자료 넣고 화면 켜기
npm run seed:emu        # 엑셀 → 시험장 (여러 번 실행해도 중복 없음)
npm run emu:phones      # 시험장 학생 연락처를 전부 010-1234-5678 로 (학생 로그인 시험용)
npm run dev             # http://localhost:5173
```
- 시험장 관리 화면: http://127.0.0.1:4000 (저장된 자료를 눈으로 볼 수 있음)
- 로그인 자동 시험: `npm run test:login`
- 수강신청 규칙 자동 시험: `npm run test:apply` (시험장의 신청 자료를 지우고 시작함)
- 교사 권한·출결 공유 자동 시험: `npm run test:teacher` (시험장의 신청·출결 자료를 지우고 시작함)
- admin 기능 자동 시험: `npm run test:admin` (바꾼 강좌·시간표는 끝나면 되돌림, 신청·출결 자료는 지움)
- admin 대시보드: admin 교사로 로그인 → 프로필 → "관리자 대시보드" (또는 /admin)
- 신청 기간 바꾸기(대시보드 전 임시): `npm run emu:period -- open` / `closed` / `soon`(1분 뒤 열림)
- 시험장은 끄면 자료가 사라진다. 다시 켜면 `seed:emu` 부터.

## 초기 자료 등록 스크립트
| 명령 | 하는 일 |
| --- | --- |
| `npm run seed -- --dry-run` | 엑셀만 읽고 무엇이 등록될지 보여줌(어디에도 쓰지 않음) |
| `npm run seed:emu` | 시험장에 등록 |
| `npm run seed -- --yes` | 실제 파이어베이스에 등록 (`seed/service-account.json` 필요) |
| `... --overwrite` | 이미 있는 학생·교사·강좌도 시트 내용으로 덮어씀(신청 인원·썸네일은 유지) |

- 강좌 ID는 `프로그램코드-월일`(같은 날 같은 코드가 여러 행이면 `-1`, `-2`). 예: `P13-1202-1`(A반), `P13-1202-2`(B반)
- P07 전공콘서트는 12.1.=P07, 12.2.(3-9)=P29, 12.2.(대강당)=P30 으로 나눠 등록
- 장소 칸의 `3-1` 처럼 날짜로 바뀌어 저장된 값도 화면에 보이는 글자 그대로 읽는다
- 연락처는 시트에 값이 있을 때만 기록 — 대시보드에서 등록한 연락처를 빈칸으로 지우지 않는다

## 폴더
```
src/        화면
functions/  서버 기능(Cloud Functions)
shared/     화면과 서버가 함께 쓰는 규칙·날짜 처리
scripts/    초기 자료 등록 · 시험 스크립트
seed/       엑셀 · 서비스 계정 키 (커밋 금지)
```
