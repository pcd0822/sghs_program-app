// 강좌 썸네일. 이미지가 없으면 유형별 이모지 + 옅은 그라데이션으로 자동 생성한다.

const BY_TYPE: Record<string, { emoji: string; from: string; to: string }> = {
  체험: { emoji: '🎨', from: '#fde68a', to: '#fbcfe8' },
  특강: { emoji: '🎤', from: '#c7d2fe', to: '#ddd6fe' },
  공연: { emoji: '🎵', from: '#fbcfe8', to: '#fed7aa' },
  스포츠: { emoji: '🏅', from: '#bbf7d0', to: '#bae6fd' },
  견학: { emoji: '🚌', from: '#bae6fd', to: '#c7d2fe' },
};
const FALLBACK = { emoji: '✨', from: '#e9d5ff', to: '#fecdd3' };

/** 체험 강좌가 대부분이라 유형만 보면 전부 🎨 가 된다. 이름에 든 낱말로 먼저 고르고, 없으면 유형으로. */
const BY_KEYWORD: [RegExp, string][] = [
  [/클라이밍/, '🧗'],
  [/볼링/, '🎳'],
  [/요가/, '🧘'],
  [/체육|스포츠대회/, '🏸'],
  [/e\s?스포츠|PC/i, '🎮'],
  [/만화|웹툰/, '📚'],
  [/도서관|미니북|책/, '📖'],
  [/카페|커피/, '☕'],
  [/향수|조향|디퓨저|트리트먼트/, '🌸'],
  [/화과자|과자|푸딩|베이킹/, '🍪'],
  [/목공/, '🪵'],
  [/도자기/, '🏺'],
  [/가죽/, '👜'],
  [/팔찌|매듭/, '📿'],
  [/레진|선캐처/, '💎'],
  [/지갑|스티치/, '🧶'],
  [/MBTI|성격/i, '🧠'],
  [/금융|돈/, '💰'],
  [/저널|언론/, '📰'],
  [/전공|대학/, '🎓'],
  [/공연|콘서트|음악/, '🎵'],
];

/** 같은 유형이어도 강좌마다 살짝 다른 색이 나오도록 이름으로 각도를 정한다. */
function angle(seed: string): number {
  let h = 0;
  for (const ch of seed) h = (h * 31 + ch.charCodeAt(0)) | 0;
  return 100 + (Math.abs(h) % 140);
}

interface Props {
  type: string;
  name: string;
  url?: string | null;
  className?: string;
  /** 이모지 크기 */
  emojiClass?: string;
}

export function CourseThumb({ type, name, url, className = '', emojiClass = 'text-3xl' }: Props) {
  if (url) {
    return <img src={url} alt="" loading="lazy" className={`object-cover ${className}`} />;
  }
  const t = BY_TYPE[type] ?? FALLBACK;
  const emoji = BY_KEYWORD.find(([re]) => re.test(name))?.[1] ?? t.emoji;
  return (
    <div
      className={`grid place-items-center ${className}`}
      style={{ backgroundImage: `linear-gradient(${angle(name)}deg, ${t.from}, ${t.to})` }}
      aria-hidden
    >
      <span className={emojiClass}>{emoji}</span>
    </div>
  );
}
