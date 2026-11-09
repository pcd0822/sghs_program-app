// 학생이 직접 입력하는 학번·이름·연락처 형식 검사와 인라인 오류 상태.
// 형식만 화면에서 미리 본다. "명단과 맞는지"는 서버가 판단하고, 어느 칸이 틀렸는지는 알려주지 않는다(명단 캐내기 방지).

import { useCallback, useRef, useState } from 'react';
import { parseSid } from '@shared/text';

/** 3학년 반 수 */
const CLASS_MAX = 9;

export function sidError(v: string): string | null {
  const s = v.trim();
  if (!s) return '학번을 입력해 주세요.';
  if (!/^\d+$/.test(s)) return '학번은 숫자만 입력해 주세요.';
  if (s.length !== 5) return `학번은 5자리예요. 지금 ${s.length}자리예요. (예: 30501)`;
  if (s[0] !== '3') return '3학년 학번은 3으로 시작해요. (예: 30501)';
  const p = parseSid(s);
  if (!p || p.classNo > CLASS_MAX) return `반은 01~0${CLASS_MAX}, 번호는 01부터예요. (예: 3반 5번 → 30305)`;
  return null;
}

/** final=false: 입력 중(한글 조합 중일 수 있음) — 덜 된 글자는 아직 탓하지 않는다 */
export function nameError(v: string, final = true): string | null {
  const s = v.trim();
  if (!s) return '이름을 입력해 주세요.';
  if (/\d/.test(s)) return '이름에 숫자는 넣을 수 없어요.';
  if (/[^가-힣ㄱ-ㅎㅏ-ㅣa-zA-Z\s·]/.test(s)) return '이름은 한글이나 영문으로만 입력해 주세요.';
  if (final && /[ㄱ-ㅎㅏ-ㅣ]/.test(s)) return '이름 글자가 덜 완성됐어요. 다시 확인해 주세요.';
  return null;
}

export function phoneError(v: string): string | null {
  const s = v.trim();
  if (!s) return '연락처를 입력해 주세요.';
  if (/[^\d\s-]/.test(s)) return '숫자와 - 만 입력해 주세요.';
  const d = s.replace(/\D/g, '');
  if (!d.startsWith('01')) return '휴대폰 번호는 010으로 시작해요.';
  if (d.length < 10 || d.length > 11) return `휴대폰 번호 자리 수를 확인해 주세요. 지금 ${d.length}자리예요. (010-1234-5678)`;
  return null;
}

type Check = (v: string, final?: boolean) => string | null;

/**
 * 칸별 인라인 오류.
 * - 칸을 떠날 때(blur) 또는 제출할 때 검사해서 보여 준다.
 * - 오류가 보이는 칸은 고치는 동안 바로바로 다시 검사(맞으면 즉시 사라짐).
 * - 제출 때 틀린 칸이 있으면 첫 칸으로 커서를 옮긴다.
 */
export function useInlineErrors<K extends string>(checks: Record<K, Check>) {
  const [errors, setErrors] = useState<Partial<Record<K, string | null>>>({});
  const refs = useRef<Partial<Record<K, HTMLInputElement | null>>>({});

  const onBlur = useCallback((k: K, v: string) => setErrors((e) => ({ ...e, [k]: checks[k](v, true) })), [checks]);

  const onEdit = useCallback(
    (k: K, v: string) => setErrors((e) => (e[k] ? { ...e, [k]: checks[k](v, false) } : e)),
    [checks],
  );

  /** 모두 검사. 통과하면 true */
  const validateAll = useCallback(
    (values: Record<K, string>): boolean => {
      const next = {} as Record<K, string | null>;
      let first: K | null = null;
      for (const k of Object.keys(checks) as K[]) {
        next[k] = checks[k](values[k], true);
        if (next[k] && first === null) first = k;
      }
      setErrors(next);
      if (first !== null) refs.current[first]?.focus();
      return first === null;
    },
    [checks],
  );

  const bind = (k: K) => ({ ref: (el: HTMLInputElement | null) => void (refs.current[k] = el), error: errors[k] ?? null });

  return { errors, onBlur, onEdit, validateAll, bind };
}
