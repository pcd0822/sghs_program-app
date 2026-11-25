// 출결 상태 판정(2026-11-25 사용자 결정). 기본값은 "출석"이 아니라 "미체크"다.
// 출석이 되는 길은 둘: ① 학생이 그날 신청한 프로그램 시작·종료 QR 을 다 찍음 ② 교사가 "출석" 체크.
// - 결석/결과 체크가 가장 먼저. 담임 결석은 같은 기록이라 교과(프로그램) 화면에서도 "결석".
// - 학급출결: 결석 > 출석 체크 > 그날 QR 을 다 찍음 → 출석 > 미체크.
// - 교과수업출결(프로그램): 결석 > 그 강좌 담당 교사의 "출석 인정" > 그 강좌 QR 다 찍음 → 출석 > QR 미완료.
//   담임이 학급출결에서 누른 "출석"은 프로그램 화면에서 출석으로 치지 않는다(프로그램에 빠진 학생이 가려지지 않게).

/** absent 결석 · present 출석 · qr 프로그램 QR 미완료 · none 미체크(학급출결) */
export type AttendStatus = 'absent' | 'present' | 'qr' | 'none';
/** 교사가 고르는 값: 결석 · 출석 · 자동(체크 없음 → QR 기준) */
export type AttendMark = 'absent' | 'present' | 'auto';

export interface AttendRecord {
  absent?: boolean;
  /** 교사가 직접 출석 체크 */
  present?: boolean;
  /** 마지막으로 바꾼 교사 ID */
  updatedBy?: string;
}

export interface QrRecord {
  qrStartAt?: number;
  qrEndAt?: number;
}

export const qrComplete = (e: QrRecord) => typeof e.qrStartAt === 'number' && typeof e.qrEndAt === 'number';

/** 교사가 지금 고른 값 */
export const attendMarkOf = (rec: AttendRecord | undefined): AttendMark => (rec?.absent ? 'absent' : rec?.present ? 'present' : 'auto');

/** 프로그램 화면에서 쓰는 값: 그 강좌 담당 교사가 아닌 사람(담임 등)의 "출석"은 자동으로 본다. */
export const programMarkOf = (rec: AttendRecord | undefined, courseTeacherIds: readonly string[]): AttendMark => {
  const m = attendMarkOf(rec);
  return m === 'present' && !(rec?.updatedBy && courseTeacherIds.includes(rec.updatedBy)) ? 'auto' : m;
};

/** 학급출결 상태. hasProgram = 그날 신청 프로그램이 있음, qrDone = 그 QR 을 모두 찍음 */
export function classStatusOf(mark: AttendMark, hasProgram: boolean, qrDone: boolean): AttendStatus {
  if (mark === 'absent') return 'absent';
  if (mark === 'present' || (hasProgram && qrDone)) return 'present';
  return 'none';
}

/** 프로그램(교과수업출결) 상태. qrDone = 그 강좌 시작·종료 QR 을 다 찍음 */
export function programStatusOf(mark: AttendMark, qrDone: boolean): AttendStatus {
  if (mark === 'absent') return 'absent';
  if (mark === 'present' || qrDone) return 'present';
  return 'qr';
}

/** 학급출결 상태(기록 + 그날 그 학생의 수강 기록 전부) */
export function classStatus(rec: AttendRecord | undefined, enrollments: QrRecord[]): AttendStatus {
  return classStatusOf(attendMarkOf(rec), enrollments.length > 0, enrollments.length > 0 && enrollments.every(qrComplete));
}
