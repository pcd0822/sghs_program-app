// 서버 함수 호출. 몰림·일시 오류는 자동으로 다시 시도하고, 최종 실패는 쉬운 말로 바꿔 준다.

import { FunctionsError, httpsCallable } from 'firebase/functions';
import { functions } from './firebase';

/** 다시 시도해 볼 만한 오류(서버가 일시적으로 바쁜 경우). */
const RETRYABLE = new Set(['functions/unavailable', 'functions/deadline-exceeded', 'functions/aborted', 'functions/internal']);

export class CallError extends Error {
  /** 서버가 붙인 이유 코드(DUP_CODE, FULL 등). 화면이 알맞은 안내를 고르는 데 쓴다. */
  readonly reason?: string;
  constructor(message: string, readonly code: string, reason?: string) {
    super(message);
    this.reason = reason;
  }
}

export interface CallOptions {
  /** 여러 번 시도해도 실패했을 때 보여줄 말 */
  busyMessage?: string;
  retries?: number;
}

export async function call<Req, Res>(name: string, data: Req, opts: CallOptions = {}): Promise<Res> {
  const fn = httpsCallable<Req, Res>(functions, name, { timeout: 20_000 });
  const retries = opts.retries ?? 3;
  for (let attempt = 0; ; attempt++) {
    try {
      return (await fn(data)).data;
    } catch (e) {
      const code = e instanceof FunctionsError ? e.code : 'functions/unknown';
      if (RETRYABLE.has(code) && attempt < retries) {
        // 0.3초, 0.6초, 1.2초 … + 흔들기(동시에 다시 몰리지 않도록)
        await sleep(300 * 2 ** attempt + Math.random() * 300);
        continue;
      }
      if (RETRYABLE.has(code) || !navigator.onLine) {
        throw new CallError(
          navigator.onLine ? (opts.busyMessage ?? '접속이 몰리고 있어요. 잠시 후 다시 눌러 주세요.') : '인터넷 연결을 확인해 주세요.',
          code,
        );
      }
      // 서버가 보낸 안내 문구(한국어)는 그대로 보여준다.
      const reason = e instanceof FunctionsError ? (e.details as { reason?: string } | undefined)?.reason : undefined;
      throw new CallError(e instanceof Error ? e.message : '알 수 없는 오류가 났어요.', code, reason);
    }
  }
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
