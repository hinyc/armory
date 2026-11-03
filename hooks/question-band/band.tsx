// 입력창 위 띠 그리기: 질문 요약(최대 4줄) + 질문 시각·경과/소요 시간.
import type { EngineInterface, RenderElement, RenderInput } from 'claude-code'

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
    <Box flexDirection="column">
      {question.summary.map((line, index) => (
        <Text wrap="truncate-end" bold={index === 0}>
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
