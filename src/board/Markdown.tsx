import { useMemo } from 'react';
import { renderMarkdown } from '@/lib/markdown';

/** 걸러낸 HTML 만 그린다(renderMarkdown 이 DOMPurify 로 정리) */
export function Markdown({ text, className = '' }: { text: string; className?: string }) {
  const html = useMemo(() => renderMarkdown(text), [text]);
  return (
    <div
      className={`prose-board text-[15px] leading-relaxed break-words [&_a]:font-semibold [&_a]:text-brand-600 [&_a]:underline [&_blockquote]:border-l-4 [&_blockquote]:border-line [&_blockquote]:pl-3 [&_blockquote]:text-sub [&_h1]:mt-3 [&_h1]:text-[22px] [&_h1]:font-extrabold [&_h2]:mt-3 [&_h2]:text-[19px] [&_h2]:font-extrabold [&_h3]:mt-2 [&_h3]:text-[17px] [&_h3]:font-bold [&_img]:my-2 [&_img]:max-w-full [&_img]:rounded-2xl [&_li]:my-0.5 [&_ol]:list-decimal [&_ol]:pl-5 [&_p]:my-1.5 [&_ul]:list-disc [&_ul]:pl-5 ${className}`}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
