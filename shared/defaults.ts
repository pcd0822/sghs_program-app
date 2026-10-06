// 시간표 고정 일정과 날짜별 안내 문구의 초기값. 초기 자료 등록 때 한 번만 넣고, 이후는 admin이 수정한다.

import type { DayNote, FixedEvent, PeriodConfig } from './types';

const ev = (id: string, date: string, start: string, end: string, title: string, place = ''): FixedEvent => ({
  id,
  date,
  start,
  end,
  title,
  place,
  description: '',
});

export const DEFAULT_FIXED_EVENTS: FixedEvent[] = [
  ev('f1130a', '2026-11-30', '08:30', '10:30', '독서', '교실'),
  ev('f1130b', '2026-11-30', '12:30', '13:30', '점심식사 후 종례'),
  ...['2026-12-01', '2026-12-02', '2026-12-03'].flatMap((d) => {
    const k = d.slice(5).replace('-', '');
    return [
      ev(`f${k}a`, d, '08:30', '10:00', '독서', '교실'),
      ev(`f${k}b`, d, '12:00', '12:30', '교실정리', '교실'),
      ev(`f${k}c`, d, '12:30', '13:30', '점심식사 후 종례'),
    ];
  }),
  ev('f1204a', '2026-12-04', '08:30', '12:30', '진로캠프', '각 반 교실'),
  ev('f1204b', '2026-12-04', '12:30', '13:30', '점심식사 후 종례'),
  ev('f1207a', '2026-12-07', '09:30', '12:30', '영화관람', '메가박스'),
  ev('f1208a', '2026-12-08', '09:00', '12:00', '청초호 줍깅 활동', '엑스포공원'),
  ev('f1211a', '2026-12-11', '08:30', '12:30', '수능성적표통지', '각 반 교실'),
];

export const DEFAULT_DAY_NOTES: DayNote[] = [
  {
    id: 'n-week2',
    dates: ['2026-12-07', '2026-12-08', '2026-12-09', '2026-12-10', '2026-12-11'],
    text: '점심식사 없이 프로그램 종료 후 귀가합니다.',
  },
  {
    id: 'n-offsite',
    dates: ['2026-12-09', '2026-12-10'],
    text: '신청한 프로그램 운영 장소로 직접 이동합니다.',
  },
];

/** 신청 기간은 admin이 정하기 전까지 닫혀 있다. */
export const DEFAULT_PERIOD: PeriodConfig = { openAt: null, closeAt: null, mode: 'closed' };
