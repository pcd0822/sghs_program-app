// 출석 QR: 주소 만들기 · 그림 그리기 · 이미지 파일로 저장. 교사 화면에서만 불러온다.

import QRCode from 'qrcode';
import type { Course, QrPhase } from '@shared/types';
import { formatDate, timeRange } from './format';

/** 학생 휴대폰 기본 카메라로 찍으면 열리는 주소. 그 브라우저에 로그인된 본인 계정으로 체크된다. */
export const qrUrl = (courseId: string, phase: QrPhase, key: string) => `${location.origin}/qr/${courseId}/${phase}/${key}`;

export const phaseLabel = (p: QrPhase) => (p === 'start' ? '시작' : '종료');
const PHASE_COLOR: Record<QrPhase, string> = { start: '#059669', end: '#7c3aed' };

/** 화면에 띄울 QR(SVG 문자열). 흰 여백 포함. */
export function qrSvg(url: string): Promise<string> {
  return QRCode.toString(url, { type: 'svg', errorCorrectionLevel: 'M', margin: 2, color: { dark: '#111111', light: '#ffffff' } });
}

const FONT = '"Pretendard Variable", Pretendard, system-ui, -apple-system, sans-serif';

/** 줄바꿈: 폭을 넘으면 다음 줄로(한글은 글자 단위로 끊어도 읽힌다). 최대 2줄 */
function wrap(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const lines: string[] = [];
  let line = '';
  for (const ch of text) {
    if (ctx.measureText(line + ch).width > maxWidth && line) {
      lines.push(line);
      line = ch.trimStart();
    } else line += ch;
  }
  if (line) lines.push(line);
  if (lines.length > 2) lines.splice(2, lines.length - 2, lines[1].slice(0, -1) + '…');
  return lines;
}

/** 인쇄·게시용 이미지(PNG)로 저장: 시작/종료 표시 · 강좌 이름 · 날짜·시간·장소 · QR · 안내 */
export async function downloadQrImage(c: Course, phase: QrPhase, url: string): Promise<void> {
  await document.fonts?.ready;
  const W = 1200;
  const H = 1600;
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, W, H);

  // 위 띠: 시작/종료를 멀리서도 구분되게 색으로
  ctx.fillStyle = PHASE_COLOR[phase];
  ctx.fillRect(0, 0, W, 190);
  ctx.fillStyle = '#ffffff';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = `800 96px ${FONT}`;
  ctx.fillText(`${phaseLabel(phase)} 출석 QR`, W / 2, 98);

  ctx.fillStyle = '#111111';
  ctx.font = `800 64px ${FONT}`;
  const title = wrap(ctx, c.name, W - 160);
  title.forEach((l, i) => ctx.fillText(l, W / 2, 280 + i * 80));
  const infoY = 280 + title.length * 80 + 10;
  ctx.fillStyle = '#6b6b76';
  ctx.font = `600 40px ${FONT}`;
  ctx.fillText(`${formatDate(c.date)} ${timeRange(c)} · ${c.place}`, W / 2, infoY);

  const qr = document.createElement('canvas');
  await QRCode.toCanvas(qr, url, { errorCorrectionLevel: 'M', margin: 2, width: 900 });
  ctx.drawImage(qr, (W - 900) / 2, infoY + 50, 900, 900);

  ctx.fillStyle = '#111111';
  ctx.font = `700 38px ${FONT}`;
  ctx.fillText('휴대폰 기본 카메라로 찍으세요', W / 2, H - 110);
  ctx.fillStyle = '#6b6b76';
  ctx.font = `500 30px ${FONT}`;
  ctx.fillText('선생님이 받기를 켠 동안만 출석이 인정돼요 · 시작과 종료를 모두 찍어야 완료', W / 2, H - 58);

  const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, 'image/png'));
  if (!blob) throw new Error('이미지를 만들지 못했어요.');
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `${c.name.replace(/[\\/:*?"<>|]/g, '')}_${formatDate(c.date).replace(/\s/g, '')}_${phaseLabel(phase)}QR.png`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 10_000);
}
