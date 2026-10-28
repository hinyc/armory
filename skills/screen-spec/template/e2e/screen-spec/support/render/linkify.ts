import { escapeHtml } from './escape'

const TOKEN = /\[\[([a-z0-9-]+)(?:\|([^\]]+))?\]\]/g

/**
 * 설명 문장을 HTML로 바꾼다.
 * - `[[capture-id]]`, `[[capture-id|보일 문구]]` → 해당 캡처로 가는 링크
 * - 빈 줄은 문단, 줄바꿈은 <br>
 */
export function linkify(text: string, titleOf: (id: string) => string | undefined): string {
  const withLinks = escapeHtml(text.replace(/\r\n?/g, '\n')).replace(TOKEN, (match, id: string, label?: string) => {
    const title = titleOf(id)
    if (!title) return match
    return `<a class="ref" href="#cap-${id}">${label ?? escapeHtml(title)}</a>`
  })
  return withLinks
    .split(/\n{2,}/)
    .map((paragraph) => `<p>${paragraph.replace(/\n/g, '<br>')}</p>`)
    .join('')
}
