// 질문 띠에 쓰는 순수 함수: 시간 표기와 요약 줄 정리.

export const MAX_SUMMARY_LINES = 4
const MAX_LINE_CHARS = 120
const SHORT_PROMPT_CHARS = 160

const pad2 = (n: number): string => String(n).padStart(2, '0')

/** ms 시각을 로컬 "HH:MM:SS"로. offsetMinutes는 UTC 기준 로컬 오프셋(KST면 540). */
export function formatClock(ms: number, offsetMinutes: number): string {
  const local = new Date(ms + offsetMinutes * 60_000)
  return `${pad2(local.getUTCHours())}:${pad2(local.getUTCMinutes())}:${pad2(local.getUTCSeconds())}`
}

/** 걸린 시간을 "45초", "3분 12초", "1시간 4분"으로. */
export function formatDuration(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000))
  const hours = Math.floor(total / 3600)
  const minutes = Math.floor((total % 3600) / 60)
  const seconds = total % 60
  if (hours > 0) return `${hours}시간 ${minutes}분`
  if (minutes > 0) return `${minutes}분 ${seconds}초`
  return `${seconds}초`
}

const truncate = (line: string, max: number): string =>
  line.length > max ? `${line.slice(0, max - 1)}…` : line

/** 텍스트를 공백 정리된 비어있지 않은 줄 목록으로. */
const toLines = (text: string): string[] =>
  text
    .split('\n')
    .map(line => line.replace(/\s+/g, ' ').trim())
    .filter(line => line.length > 0)

/** 줄 목록을 최대 4줄, 줄당 길이 제한으로 자름. 잘렸으면 마지막 줄 끝에 "…". */
export function clampLines(lines: readonly string[]): string[] {
  const kept = lines.slice(0, MAX_SUMMARY_LINES).map(line => truncate(line, MAX_LINE_CHARS))
  const last = kept[kept.length - 1]
  if (lines.length <= MAX_SUMMARY_LINES || last === undefined) return kept
  return [...kept.slice(0, -1), last.endsWith('…') ? last : `${last} …`]
}

/** 모델 요약 전에 보여줄 원문 기반 요약. */
export function fallbackSummary(text: string): string[] {
  const lines = clampLines(toLines(text))
  return lines.length > 0 ? lines : ['(텍스트 없는 입력)']
}

/** 짧은 질문은 원문 그대로 보여주고 모델을 부르지 않음. */
export function needsModelSummary(text: string): boolean {
  const lines = toLines(text)
  const chars = lines.reduce((sum, line) => sum + line.length, 0)
  return lines.length > MAX_SUMMARY_LINES || chars > SHORT_PROMPT_CHARS
}

/** 모델 답을 줄 목록으로: 글머리표·번호 제거 후 4줄로 자름. */
export function parseSummary(answer: string): string[] {
  const lines = toLines(answer).map(line => line.replace(/^([-*•·]|\d+[.)])\s*/, ''))
  return clampLines(lines.filter(line => line.length > 0))
}

/** 프롬프트 비교용 정규화. */
export const normalizePrompt = (text: string): string => text.replace(/\s+/g, ' ').trim()
