// 로그인 실패 잠금을 "기기 단위"로 하기 위한 기기 표시. 개인정보가 아닌 무작위 값이다.

const KEY = 'sghs.deviceId';

export function deviceId(): string {
  try {
    let id = localStorage.getItem(KEY);
    if (!id) {
      // randomUUID 는 https 에서만 되므로(휴대폰으로 내부망 시험 시 http) getRandomValues 로 만든다.
      id = Array.from(crypto.getRandomValues(new Uint8Array(16)), (b) => b.toString(16).padStart(2, '0')).join('');
      localStorage.setItem(KEY, id);
    }
    return id;
  } catch {
    // 사생활 보호 모드 등 저장이 막힌 경우 — 서버가 IP 로 대신한다.
    return '';
  }
}
