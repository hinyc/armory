// war-room/COMMAND.md 파서: 감독 띠에 쓸 숫자만 센다. 순수 함수. 절 이름은 skills/war-room-commander/template/COMMAND.md 기준.
import type { CommanderBand } from '../../types'

const IN_PROGRESS = new Set(['보냄', '보완 지시'])

/** `## <접두>`로 시작하는 헤딩 절의 줄들 (다음 `#`·`##` 헤딩 전까지). 없으면 빈 목록. */
function section(lines: readonly string[], prefix: string): readonly string[] {
  const start = lines.findIndex(line => line.startsWith(`## ${prefix}`))
  if (start < 0) return []
  const rest = lines.slice(start + 1)
  const end = rest.findIndex(line => /^#{1,2}\s/.test(line))
  return end < 0 ? rest : rest.slice(0, end)
}

/** 빈 칸 표시: `없음`, `없음 (…)`. `없음을 …`처럼 이어지는 실제 항목은 아니다. */
const isPlaceholder = (text: string): boolean => /^없음( · |\s*\(|$)/.test(text)

/** 절의 `- ` 항목 본문. 빈 칸 표시 줄은 뺀다. */
function items(lines: readonly string[]): readonly string[] {
  return lines
    .map(line => /^-\s+(.*\S)\s*$/.exec(line)?.[1])
    .filter((text): text is string => text !== undefined && !isPlaceholder(text))
}

/** 질문 줄의 `무엇` 칸: 첫 ` · ` 앞. ` · `가 없으면 줄 전체. */
const whatOf = (item: string): string => {
  const cut = item.indexOf(' · ')
  return (cut < 0 ? item : item.slice(0, cut)).trim()
}

function holderOf(seat: readonly string[]): string {
  const raw = seat.map(line => /^-\s*담당:\s*(.*)$/.exec(line)?.[1]).find(v => v !== undefined) ?? ''
  const cut = raw.indexOf(' · 위치')
  const name = (cut < 0 ? raw : raw.slice(0, cut)).trim()
  return name === '' || name.startsWith('없음') ? '–' : name
}

function updatedOf(lines: readonly string[]): string {
  const raw = lines.map(line => /^갱신:\s*(.*)$/.exec(line)?.[1]).find(v => v !== undefined)?.trim() ?? ''
  if (raw === '' || raw === '-') return '–'
  const m = /^\d{4}-(\d{2}-\d{2})[ T](\d{2}:\d{2})/.exec(raw)
  return m === null ? raw : `${m[1]} ${m[2]}`
}

/** 지시 줄의 상태 칸: ` · `로 쪼갠 뒤 뒤에서 둘째 칸 (요약에 ` · `가 있어도 맞는다). */
const directiveStatus = (item: string): string => item.split(' · ').at(-2)?.trim() ?? ''

/** 보드 내용에서 띠 값을 만든다. 빈 문서는 undefined. */
export function parseBoard(text: string): CommanderBand | undefined {
  if (text.trim() === '') return undefined
  const lines = text.split(/\r?\n/)
  const human = items(section(lines, '사람 확인 대기'))
  const statuses = items(section(lines, '지시')).map(directiveStatus)
  const gate = section(lines, '머지 관문').filter(line => /^-\s*\[[ xX]\]/.test(line))
  return {
    holder: holderOf(section(lines, '감독 자리')),
    sessions: items(section(lines, '작업 세션')).length,
    directives: statuses.filter(s => IN_PROGRESS.has(s)).length,
    reports: statuses.filter(s => s === '보고 옴').length,
    blocked: statuses.filter(s => s === '막힘').length,
    pending: items(section(lines, '대기 중인 교차 판정')).length,
    decisions: items(section(lines, '점검할 결정')).length,
    human: human.length,
    questions: human.map(whatOf),
    gateDone: gate.filter(line => /^-\s*\[[xX]\]/.test(line)).length,
    gateTotal: gate.length,
    updated: updatedOf(lines),
  }
}
