// 화면(web)과 서버(functions)가 함께 쓰는 고정값.

export const REGION = 'asia-northeast3';
export const PROGRAM_YEAR = 2026;
export const TIME_ZONE = 'Asia/Seoul';

/** 시간표 주차. 이 밖의 주는 "저장된 시간표 정보가 없습니다". */
export const WEEKS: { label: string; dates: string[] }[] = [
  {
    label: '1주차',
    dates: ['2026-11-30', '2026-12-01', '2026-12-02', '2026-12-03', '2026-12-04'],
  },
  {
    label: '2주차',
    dates: ['2026-12-07', '2026-12-08', '2026-12-09', '2026-12-10', '2026-12-11'],
  },
];

/** 운영 기간 평일 전체 — 학급출결 날짜 선택에 사용. */
export const OPERATING_DATES: string[] = WEEKS.flatMap((w) => w.dates);

/** 정원 제한이 없는 강좌의 인원 수를 나눠 세는 칸 수. */
export const COUNTER_SHARDS = 10;

/** 로그인 잠금 기준. */
export const LOGIN_GUARD = {
  teacher: { maxFails: 5, lockMs: 5 * 60_000 },
  student: { maxFails: 10, lockMs: 5 * 60_000 },
  /** 같은 IP에서 1시간 안에 관리자 로그인 실패가 30회를 넘으면(31번째) IP 전체 잠금. */
  teacherIp: { windowMs: 60 * 60_000, maxFails: 31, lockMs: 30 * 60_000 },
};
