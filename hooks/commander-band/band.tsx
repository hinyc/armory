// 감독 띠 그리기: 1줄(굵게, 확인할 일이 있으면 warning)과 2줄(흐리게, 좁으면 생략), 답 대기 줄(좁아도 보임), 아래 그림은 그 밑에 쌓는다.
import type { EngineInterface, RenderElement, RenderInput } from 'claude-code'

import type { CommanderBand, WaitingItem } from '../../types'

const NARROW_COLUMNS = 70
const MAX_WAITING = 3

export const needsAttention = (b: CommanderBand): boolean => b.reports > 0 || b.blocked > 0 || b.human > 0

export const headLine = (b: CommanderBand): string =>
  `◆ 감독 · ${b.holder} · 작업 세션 ${b.sessions} · 지시 진행 ${b.directives} · 보고 옴 ${b.reports} · 막힘 ${b.blocked}`

export const detailLine = (b: CommanderBand): string =>
  `  판정 대기 ${b.pending} · 점검할 결정 ${b.decisions} · 답 대기 ${b.human} · 머지 관문 ${b.gateDone}/${b.gateTotal} · 갱신 ${b.updated}`

/** 한 줄: `  ⏸ <멈춘 일> ← <물은 것>`, 물은 것이 없으면 `  ⏸ <멈춘 일>`, 옛 헤더(멈춘 일 없음)는 `  ? <첫 칸>`. */
export const waitingLine = (w: WaitingItem): string =>
  w.work === '' ? `  ? ${w.ask}` : w.ask === '' ? `  ⏸ ${w.work}` : `  ⏸ ${w.work} ← ${w.ask}`

/** 답 대기 줄: 앞 3개, 더 있으면 `  … 외 n개`. */
export function waitingLines(b: CommanderBand): readonly string[] {
  const shown = b.waiting.slice(0, MAX_WAITING).map(waitingLine)
  const rest = b.waiting.length - MAX_WAITING
  return rest > 0 ? [...shown, `  … 외 ${rest}개`] : shown
}

export function drawCommanderBand(
  $: EngineInterface,
  e: RenderInput<'AbovePrompt'>,
  band: CommanderBand,
  beneath: RenderElement | null,
): RenderElement {
  const { Box, Text } = $.ui.resolve(e)
  const wide = e.props.bodyColumns >= NARROW_COLUMNS
  return (
    <Box flexDirection="column">
      <Text wrap="truncate-end" bold {...(needsAttention(band) ? { color: 'warning' } : {})}>
        {headLine(band)}
      </Text>
      {wide ? (
        <Text wrap="truncate-end" dimColor>
          {detailLine(band)}
        </Text>
      ) : null}
      {waitingLines(band).map((line, i) => (
        <Text key={`q${i}`} wrap="truncate-end">
          {line}
        </Text>
      ))}
      {beneath === null ? null : beneath}
    </Box>
  )
}
