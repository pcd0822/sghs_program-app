// Firestore 문서 모양. 화면과 서버가 같은 정의를 쓴다.

export type Category = '필수' | '선택';

/** courses/{courseId} — 시트의 행 하나 = 강좌 하나. */
export interface Course {
  id: string;
  /** 같은 프로그램인지 판단하는 값. 고유값이 아님. */
  code: string;
  category: Category;
  type: string;
  name: string;
  intro: string;
  /** YYYY-MM-DD */
  date: string;
  /** HH:MM */
  start: string;
  end: string;
  place: string;
  instructor: string;
  /** null 이면 정원 제한 없음(전교생). */
  capacity: number | null;
  /** 정원 있는 강좌의 신청 인원. 정원 없는 강좌는 shards 합계를 따로 센다. */
  count: number;
  selfPay: boolean;
  fixedSize: boolean;
  teacherIds: string[];
  thumbnailUrl: string | null;
  /** 강좌별 개별 마감(ms). null 이면 전체 기간만 따른다. */
  closeAt: number | null;
  order: number;
}

/** students/{학번} — 연락처는 studentSecrets 에 따로 둔다. */
export interface Student {
  sid: string;
  name: string;
  classNo: number;
  number: number;
  photoUrl: string | null;
}

/** teachers/{teacherId} — 코드는 teacherSecrets 에 따로 둔다. */
export interface Teacher {
  id: string;
  name: string;
  /** null: 담임 아님, 0: 전체 학급, 1~9: 해당 학급 담임 */
  homeroom: number | null;
  isAdmin: boolean;
  photoUrl: string | null;
}

/** 로그인 토큰에 담기는 권한 정보. */
export type Claims =
  | { role: 'student'; sid: string; classNo: number }
  | { role: 'teacher'; tid: string; homeroom: number | null; admin: boolean };

export interface FixedEvent {
  id: string;
  date: string;
  start: string;
  end: string;
  title: string;
  place: string;
  description: string;
}

export interface DayNote {
  id: string;
  /** 이 안내가 붙는 날짜들 */
  dates: string[];
  text: string;
}

/** config/timetable */
export interface TimetableConfig {
  fixedEvents: FixedEvent[];
  dayNotes: DayNote[];
}

/** config/period */
export interface PeriodConfig {
  /** ms. null 이면 미정 */
  openAt: number | null;
  closeAt: number | null;
  /** auto: 시각대로, open: 즉시 열기, closed: 즉시 닫기 */
  mode: 'auto' | 'open' | 'closed';
}
