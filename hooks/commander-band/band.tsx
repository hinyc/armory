// 감독 띠 그리기: 1줄(굵게, 확인할 일이 있으면 warning)과 2줄(흐리게, 좁으면 생략), 아래 그림은 그 밑에 쌓는다.
import type { EngineInterface, RenderElement, RenderInput } from 'claude-code'

import type { CommanderBand } from '../../types'

const NARROW_COLUMNS = 70

export const needsAttention = (b: CommanderBand): boolean => b.reports > 0 || b.blocked > 0 || b.human > 0

export const headLine = (b: CommanderBand): string =>
  `◆ 감독 · ${b.holder} · 작업 세션 ${b.sessions} · 지시 진행 ${b.directives} · 보고 옴 ${b.reports} · 막힘 ${b.blocked}`

export const detailLine = (b: CommanderBand): string =>
  `  판정 대기 ${b.pending} · 점검할 결정 ${b.decisions} · 사람 확인 ${b.human} · 머지 관문 ${b.gateDone}/${b.gateTotal} · 갱신 ${b.updated}`

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
      {beneath === null ? null : beneath}
    </Box>
  )
}
