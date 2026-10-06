// 마크다운 → 안전한 HTML.
// 공지의 글꼴·글자 색은 마크다운에 없어서 <span style="color:…; font-family:…"> 만 허용하고,
// 나머지 위험한 코드(script, onerror, javascript: 링크, 다른 style 속성 등)는 DOMPurify 로 걸러낸다.

import DOMPurify from 'dompurify';
import { marked } from 'marked';

export const FONTS = [
  { label: '기본', value: '' },
  { label: '명조', value: "'Nanum Myeongjo', serif" },
  { label: '손글씨', value: "'Gaegu', cursive" },
  { label: '고정폭', value: 'monospace' },
];
export const COLORS = ['#111114', '#e11d48', '#ea580c', '#16a34a', '#2563eb', '#7c3aed'];

const ALLOWED_STYLE = /^(color|font-family)$/;
const SAFE_VALUE = /^[#\w\s,'"().-]+$/;

let hooked = false;
function setup() {
  if (hooked) return;
  hooked = true;
  DOMPurify.addHook('uponSanitizeAttribute', (node, data) => {
    if (data.attrName !== 'style') return;
    // style 안에서 color, font-family 만 남긴다
    const kept = data.attrValue
      .split(';')
      .map((d) => d.split(':').map((x) => x.trim()))
      .filter(([k, v]) => k && v && ALLOWED_STYLE.test(k.toLowerCase()) && SAFE_VALUE.test(v))
      .map(([k, v]) => `${k.toLowerCase()}: ${v}`)
      .join('; ');
    if (!kept || node.nodeName !== 'SPAN') data.keepAttr = false;
    else data.attrValue = kept;
  });
  DOMPurify.addHook('afterSanitizeAttributes', (node) => {
    if (node.nodeName === 'A') {
      node.setAttribute('target', '_blank');
      node.setAttribute('rel', 'noopener noreferrer');
    }
    if (node.nodeName === 'IMG') node.setAttribute('loading', 'lazy');
  });
}

export function renderMarkdown(md: string): string {
  setup();
  const html = marked.parse(md, { async: false, breaks: true, gfm: true });
  return DOMPurify.sanitize(html, {
    ALLOWED_TAGS: ['p', 'br', 'strong', 'em', 'b', 'i', 'u', 's', 'del', 'h1', 'h2', 'h3', 'h4', 'ul', 'ol', 'li', 'blockquote', 'a', 'img', 'span', 'code', 'pre', 'hr', 'table', 'thead', 'tbody', 'tr', 'th', 'td'],
    ALLOWED_ATTR: ['href', 'src', 'alt', 'title', 'style'],
    ALLOWED_URI_REGEXP: /^(?:https?:|mailto:|tel:)/i,
  });
}
