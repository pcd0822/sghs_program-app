// 엑셀 내려받기·읽기. 엑셀 라이브러리는 크기가 커서 필요할 때만 불러온다.

export type Cell = string | number | boolean | null;

export async function downloadXlsx(filename: string, sheets: { name: string; rows: Cell[][] }[]): Promise<void> {
  const XLSX = await import('xlsx');
  const wb = XLSX.utils.book_new();
  for (const s of sheets) {
    const ws = XLSX.utils.aoa_to_sheet(s.rows);
    // 열 너비를 내용에 맞춰 대충 넓힌다(한글은 2칸)
    const widths = s.rows[0]?.map((_, i) =>
      Math.min(40, Math.max(6, ...s.rows.map((r) => [...String(r[i] ?? '')].reduce((w, ch) => w + (ch.charCodeAt(0) > 255 ? 2 : 1), 0)))),
    );
    ws['!cols'] = widths?.map((wch) => ({ wch: wch + 1 }));
    XLSX.utils.book_append_sheet(wb, ws, s.name.slice(0, 31));
  }
  XLSX.writeFile(wb, filename);
}

/** 첫 시트를 [{머리글: 값}] 으로 읽는다. 머리글의 공백은 지운다. 모든 값은 화면에 보이는 글자 그대로. */
export async function readXlsx(file: File): Promise<Record<string, string>[]> {
  const XLSX = await import('xlsx');
  const wb = XLSX.read(await file.arrayBuffer());
  const ws = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { raw: false, defval: '' });
  return rows.map((r) => Object.fromEntries(Object.entries(r).map(([k, v]) => [k.replace(/\s+/g, ''), String(v ?? '').trim()])));
}

/** 파일 이름에 붙이는 날짜: 20261211-1530 */
export function stamp(d = new Date()): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}`;
}
