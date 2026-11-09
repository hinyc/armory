// 평가 진행 파일 파싱·표시 판정·포맷. 순수 함수만 둔다. 타입은 types/index.d.ts.
import type { EvalGroup, EvalItem, EvalMetric, EvalProgress, EvalRun, EvalStatus } from '../../types'

export type { EvalGroup, EvalItem, EvalMetric, EvalProgress, EvalRun, EvalStatus }

/** 이 시간 넘게 갱신 없는 진행 중 평가는 죽은 것으로 보고 숨긴다. */
export const STALE_MS = 30 * 60 * 1000
/** 변경 전보다 이 비율을 넘게 나빠지면 경고. */
export const WARN_RATIO = 0.1

export const GROUPS: readonly EvalGroup[] = ['criteria', 'history', 'side-effects', 'concepts', 'metrics']
const STATUSES: readonly EvalStatus[] = ['pass', 'fail', 'warn', 'running', 'pending', 'na']
const STATES: readonly string[] = ['planning', 'planned', 'running', 'done', 'aborted']

export const GROUP_LABEL: Record<EvalGroup, string> = {
  criteria: '기준',
  history: '히스토리',
  'side-effects': '부작용',
  concepts: '개념',
  metrics: '수치',
}

export const STATUS_MARK: Record<EvalStatus, string> = {
  pass: '✓',
  fail: '✗',
  warn: '⚠',
  running: '…',
  pending: '○',
  na: '–',
}

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v)
const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v)

function parseMetric(v: unknown): EvalMetric | undefined {
  if (!isRecord(v) || typeof v.name !== 'string' || !isNum(v.value) || typeof v.unit !== 'string') return undefined
  return {
    name: v.name,
    value: v.value,
    unit: v.unit,
    ...(isNum(v.limit) ? { limit: v.limit } : {}),
    ...(isNum(v.baseline) ? { baseline: v.baseline } : {}),
  }
}

/** 알 수 없는 group·status 항목은 그 항목만 버린다. */
function parseItem(v: unknown): EvalItem | undefined {
  if (!isRecord(v)) return undefined
  const group = GROUPS.find(g => g === v.group)
  const status = STATUSES.find(s => s === v.status)
  if (group === undefined || status === undefined) return undefined
  const metrics = Array.isArray(v.metrics)
    ? v.metrics.map(parseMetric).filter((m): m is EvalMetric => m !== undefined)
    : undefined
  return {
    group,
    status,
    ...(typeof v.summary === 'string' ? { summary: v.summary } : {}),
    ...(metrics !== undefined && metrics.length > 0 ? { metrics } : {}),
  }
}

function parseRun(v: unknown): EvalRun | undefined {
  if (!isRecord(v) || !isNum(v.attempt)) return undefined
  const items = Array.isArray(v.items) ? v.items.map(parseItem).filter((i): i is EvalItem => i !== undefined) : []
  return {
    attempt: v.attempt,
    items,
    ...(typeof v.state === 'string' && STATES.includes(v.state) ? { state: v.state as EvalRun['state'] } : {}),
    ...(v.verdict === 'pass' || v.verdict === 'fail' ? { verdict: v.verdict } : {}),
    ...(typeof v.focus === 'string' ? { focus: v.focus } : {}),
  }
}

/** 깨진 JSON·필수 칸 없음은 undefined. */
export function parseProgress(text: string): EvalProgress | undefined {
  let raw: unknown
  try {
    raw = JSON.parse(text)
  } catch {
    return undefined
  }
  if (!isRecord(raw) || typeof raw.task !== 'string' || typeof raw.role !== 'string') return undefined
  if (typeof raw.updatedAt !== 'string') return undefined
  const current = parseRun(raw.current)
  if (current === undefined) return undefined
  const previous = raw.previous === undefined ? undefined : parseRun(raw.previous)
  return {
    task: raw.task,
    role: raw.role,
    updatedAt: raw.updatedAt,
    current,
    ...(previous !== undefined ? { previous } : {}),
    ...(isNum(raw.maxAttempts) ? { maxAttempts: raw.maxAttempts } : {}),
  }
}

/** running·planning이고 30분 안에 갱신된 것만 보인다. */
export function isVisible(p: EvalProgress, nowMs: number): boolean {
  if (p.current.state !== 'running' && p.current.state !== 'planning') return false
  const updated = Date.parse(p.updatedAt)
  if (Number.isNaN(updated)) return false
  return nowMs - updated <= STALE_MS
}

const trim = (n: number): string => String(Number(n.toFixed(2)))

/** "응답 182ms/300 ⚠ (+62)": 한계 초과 ✗, 변경 전보다 10% 넘게 나빠짐 ⚠, 그 밖 ✓. 값이 작을수록 좋다고 본다. */
export function metricText(m: EvalMetric): string {
  const head = `${m.name} ${trim(m.value)}${m.unit}${m.limit !== undefined ? `/${trim(m.limit)}` : ''}`
  if (m.limit !== undefined && m.value > m.limit) return `${head} ${STATUS_MARK.fail}`
  const { baseline } = m
  if (baseline !== undefined && baseline > 0 && (m.value - baseline) / baseline > WARN_RATIO) {
    return `${head} ${STATUS_MARK.warn} (+${trim(m.value - baseline)})`
  }
  return `${head} ${STATUS_MARK.pass}`
}

function itemText(item: EvalItem, compact: boolean): string {
  const label = GROUP_LABEL[item.group]
  const mark = STATUS_MARK[item.status]
  if (compact) return `${label}${mark}`
  if (item.group === 'metrics' && item.metrics !== undefined) {
    return item.metrics.map(metricText).join(' · ')
  }
  return item.summary !== undefined && item.summary !== '' ? `${label} ${mark} ${item.summary}` : `${label} ${mark}`
}

/** 갈래 다섯을 정해진 순서로, 빠진 갈래는 · (아직)으로. 좁으면 기호만, 수치는 첫 항목만. */
export function runText(run: EvalRun, compact: boolean): string {
  return GROUPS.map(group => {
    const found = run.items.find(i => i.group === group)
    const item: EvalItem = found ?? { group, status: 'pending' }
    if (compact && group === 'metrics' && item.metrics?.[0] !== undefined) {
      return `${GROUP_LABEL[group]} ${metricText(item.metrics[0])}`
    }
    return itemText(item, compact)
  }).join(compact ? ' ' : ' · ')
}
