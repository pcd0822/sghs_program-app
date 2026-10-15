// 로그인 전에 출석 QR 을 찍은 학생: 로그인 뒤 그 QR 주소로 돌아가 이어서 체크하도록 잠깐 기억해 둔다(이 탭에서만).

const PENDING = 'pendingQr';

/** 로그인 뒤 돌아갈 QR 주소(없으면 null) */
export function pendingQrPath(): string | null {
  try {
    const v = sessionStorage.getItem(PENDING);
    return v && v.startsWith('/qr/') ? v : null;
  } catch {
    return null;
  }
}

export function setPendingQr(v: string | null) {
  try {
    if (v) sessionStorage.setItem(PENDING, v);
    else sessionStorage.removeItem(PENDING);
  } catch {
    /* 저장이 막힌 브라우저: 로그인 후 QR 을 한 번 더 찍으면 된다 */
  }
}
