// 입력창 위 띠 그리기: 질문 요약(최대 4줄) + 질문 시각·경과/소요 시간.
import type { AbovePromptRow, EngineInterface, RenderElement, RenderInput } from 'claude-code'

import type { Question } from '../../types'
import { formatClock, formatDuration } from './format'

const STATUS_MARK: Record<Question['status'], string> = {
  running: '⏳',
  done: '✓',
  aborted: '■',
  error: '✗',
}

/** "14:32:05 질문 · 1분 23초 경과" 같은 상태 줄. */
export function statusLine(question: Question, now: number, offsetMinutes: number): string {
  const asked = `${formatClock(question.askedAt, offsetMinutes)} 질문`
  const end = question.endedAt ?? now
  const took = formatDuration(end - question.askedAt)
  const tail: Record<Question['status'], string> = {
    running: `${took} 경과`,
    done: `${took} 걸림`,
    aborted: `중단됨 (${took})`,
    error: `오류로 종료 (${took})`,
  }
  return `${STATUS_MARK[question.status]} ${asked} · ${tail[question.status]}`
}

/** 다른 mod가 띠에 아무것도 그리지 않았는지. */
export function isBlank(tree: RenderElement | null | undefined): boolean {
  if (tree === null || tree === undefined) return true
  // 엔진 기본 그림({ type: 'engine' })은 core가 직접 그린 것 = 다른 mod가 안 그린 것.
  if (tree.type === 'engine') return true
  if (tree.type !== 'Box' && tree.type !== 'Text') return false
  // 엘리먼트는 children을 자기 자신에 둔다 ({ type, children, props? }).
  const node = tree as { children?: unknown; props?: { children?: unknown } }
  const children = node.children ?? node.props?.children
  const list = Array.isArray(children) ? children : children === undefined ? [] : [children]
  return list.every(child => {
    if (child === null || child === undefined || child === false) return true
    if (typeof child === 'string') return child.trim() === ''
    if (typeof child === 'object' && 'type' in (child as object)) return isBlank(child as RenderElement)
    return false
  })
}

/** 띠 맨 바깥 Box의 key: 같은 플러그인의 행이 우리 띠 하나뿐인지 알아보는 표시. */
export const BAND_KEY = 'question-band'

const isOnlyBand = (row: AbovePromptRow): boolean =>
  (row.tree as { props?: { key?: unknown } }).props?.key === BAND_KEY

/**
 * 다른 플러그인이 비어 있지 않은 행을 그렸으면 우리(self) 띠 행을 뺀 새 목록을, 아니면 받은 목록 그대로.
 * 평가 띠가 같은 플러그인 행에 우리 띠를 감싸 그렸다면(맨 바깥이 우리 Box가 아님) 행 하나를 통째로 빼면
 * 평가 띠까지 사라지므로 그대로 둔다.
 */
export function yieldRows(self: string, rows: readonly AbovePromptRow[]): readonly AbovePromptRow[] {
  const othersDrew = rows.some(row => row.plugin !== self && !isBlank(row.tree))
  return othersDrew ? rows.filter(row => row.plugin !== self || !isOnlyBand(row)) : rows
}

export function drawBand(
  $: EngineInterface,
  e: RenderInput,
  question: Question,
  now: number,
  offsetMinutes: number,
): RenderElement {
  const { Box, Text } = $.ui.resolve(e)
  const isRunning = question.status === 'running'
  return (
    <Box key={BAND_KEY} flexDirection="column">
      {question.summary.map((line, index) => (
        <Text key={String(index)} wrap="truncate-end" bold={index === 0}>
          {index === 0 ? '❯ ' : '  '}
          {line}
        </Text>
      ))}
      <Text dimColor={!isRunning} color={isRunning ? 'warning' : undefined}>
        {'  '}
        {statusLine(question, now, offsetMinutes)}
      </Text>
    </Box>
  )
}
