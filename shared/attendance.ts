// 출결 상태 판정: 화면(학급출결·교과출결·admin)과 서버가 같은 기준을 쓴다.
// - 교사가 "결석/결과"로 체크했으면 결석.
// - 교사가 "출석 인정"을 눌렀으면 출석(휴대폰 고장 등 QR 을 못 찍은 사정).
// - 그날 신청한 프로그램이 있으면 시작·종료 QR 을 둘 다 찍어야 출석. 하나라도 빠지면 "QR 미완료"(출석 아님).
// - 그날 신청한 프로그램이 없으면 기록이 없을 때 출석(예전과 같음).

export type AttendStatus = 'absent' | 'present' | 'qr';
/** 교사가 고르는 값: 결석 · 출석 인정 · 자동(QR 기준) */
export type AttendMark = 'absent' | 'present' | 'auto';

export interface AttendRecord {
  absent?: boolean;
  /** 교사가 직접 출석으로 인정 */
  present?: boolean;
}

export interface QrRecord {
  qrStartAt?: number;
  qrEndAt?: number;
}

export const qrComplete = (e: QrRecord) => typeof e.qrStartAt === 'number' && typeof e.qrEndAt === 'number';

/** 그날 출결 상태. enrollments 는 그날 그 학생의 수강 기록(보는 화면에 따라 한 강좌만 넘기기도 한다). */
export function attendStatus(rec: AttendRecord | undefined, enrollments: QrRecord[]): AttendStatus {
  return statusOf(attendMarkOf(rec), enrollments.length > 0, enrollments.every(qrComplete));
}

/** 교사가 고른 값 + QR 상태로 판정. needsQr = 그날 신청 프로그램이 있음, qrDone = 그 QR 을 모두 찍음 */
export function statusOf(mark: AttendMark, needsQr: boolean, qrDone: boolean): AttendStatus {
  if (mark === 'absent') return 'absent';
  if (mark === 'present' || !needsQr || qrDone) return 'present';
  return 'qr';
}

/** 교사가 지금 고른 값 */
export const attendMarkOf = (rec: AttendRecord | undefined): AttendMark => (rec?.absent ? 'absent' : rec?.present ? 'present' : 'auto');

/** 엑셀·표에 쓰는 상태 이름 */
export function statusText(st: AttendStatus, mark: AttendMark): string {
  if (st === 'absent') return '결석(결과)';
  if (st === 'qr') return 'QR 미완료(출석 아님)';
  return mark === 'present' ? '출석(인정)' : '출석';
}
