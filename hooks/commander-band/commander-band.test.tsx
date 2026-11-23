import { expect, mock, test } from 'claude-code/testing'
import type { Engine } from 'claude-code/testing'
import type { On } from 'claude-code'

import { parseBoard } from './board'

const ID = '0f1e2d3c-4b5a-4968-8776-5a4b3c2d1e0f'
const OTHER = 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee'
const ON = '{"roles":{"manager":true,"commander":true}}'

const TEMPLATE = `# 지휘 보드

> 감독 롤 pm만 쓴다.

갱신: -

## 감독 자리

- 상태: 비어 있음
- 담당: 없음 (형식: \`<담당 표시> · 위치 <폴더 · 브랜치> · 맡은 시각 <YYYY-MM-DD HH:MM>\`)
- 세션 ID: 없음 (형식: \`<uuid>\`.)
- 위임받은 권한: 없음 (형식: \`위임됨: … · 위임 안 됨: …\`)

## 목표

- 없음 (이번 감독이 끝내려는 것 한 줄과 이슈 키)

## 작업 세션 (형식: \`세션 · 맡은 범위 · …\`)

- 없음

## 지시 (형식: \`지시 ID · 세션 · 요약 · 기준선 · 상태(보냄|보고 옴|보완 지시|통과|막힘) · 출처\`)

- 없음

## 대기 중인 교차 판정 (형식: \`때 · 대상 지시 ID · 상태\`)

- 없음

## 점검할 결정 (형식: \`결정 ID · 제목 · 대상 지시 ID\`)

- 없음

## 사람 확인 대기 (형식: \`멈춘 일 · 사용자에게 물은 것 · 관련 지시 ID\` …)

- 없음

## 머지 관문 (마지막 머지·push 전)

- [ ] 1 중 이상 위험 미해소 0
- [ ] 2 사용자 확인 대기 0
- [ ] 3 외부 확인 항목 처리
- [ ] 4 통합 검증이 최종 커밋 짝으로 통과
- [ ] 5 작업 세션마다 미커밋 변경 0
- [ ] 6 머지·push 사용자 승인

## 다시 시작하면 할 일

- 없음

## 자리 이력

- 없음`

const FILLED = (id = ID, updated = '2026-11-20 14:30') =>
  TEMPLATE.replace('갱신: -', `갱신: ${updated}`)
    .replace('- 상태: 비어 있음', '- 상태: 맡음')
    .replace(/- 담당: 없음.*/, '- 담당: 감독 A · 위치 repo · main · 맡은 시각 2026-11-20 10:00')
    .replace(/- 세션 ID: 없음.*/, `- 세션 ID: ${id}`)
    .replace('## 작업 세션 (형식: `세션 · 맡은 범위 · …`)\n\n- 없음', '## 작업 세션\n\n- s1 · 범위 · 위치 · d1 · abc · 진행\n- s2 · 범위 · 위치 · d2 · def · 진행')
    .replace(
      /(## 지시[^\n]*\n\n)- 없음/,
      '$1- d1 · s1 · 요약 · 가 · abc · 보냄 · 보고\n- d2 · s2 · 요약 · 나 · abc · 보완 지시 · 평가\n- d3 · s1 · 요약 · 다 · abc · 통과 · 보고\n- d4 · s2 · 요약 · 라 · abc · 보고 옴 · 보고\n- d5 · s2 · 요약 · 마 · abc · 막힘 · 보고',
    )
    .replace(/(## 대기 중인 교차 판정[^\n]*\n\n)- 없음/, '$1- 보안 · d1 · 대기')
    .replace(/(## 머지 관문[^\n]*\n\n)- \[ \] 1/, '$1- [x] 1')

test('parseBoard: 템플릿 그대로면 모두 0', () => {
  expect(parseBoard(TEMPLATE)).toEqual({
    holder: '–',
    sessions: 0,
    directives: 0,
    reports: 0,
    blocked: 0,
    pending: 0,
    decisions: 0,
    human: 0,
    waiting: [],
    gateDone: 0,
    gateTotal: 6,
    updated: '–',
  })
})

test('parseBoard: 지시 상태(요약에 ` · ` 포함)·작업 세션·판정·머지 관문·갱신', () => {
  const b = parseBoard(FILLED())
  expect(b).toMatchObject({
    holder: '감독 A',
    sessions: 2,
    directives: 2,
    reports: 1,
    blocked: 1,
    pending: 1,
    gateDone: 1,
    gateTotal: 6,
    updated: '11-20 14:30',
  })
})

test('parseBoard: 통과는 세지 않고 요약 칸의 ` · `에 속지 않는다', () => {
  const text = TEMPLATE.replace(/(## 지시[^\n]*\n\n)- 없음/, '$1- d1 · s1 · 보냄 · 막힘 · 요약 · 가 · abc · 통과 · 보고')
  expect(parseBoard(text)).toMatchObject({ directives: 0, reports: 0, blocked: 0 })
})

test('parseBoard: 점검할 결정·사람 확인', () => {
  const text = TEMPLATE.replace(/(## 점검할 결정[^\n]*\n\n)- 없음/, '$1- D1 · 제목 · d1\n- D2 · 제목 · d2').replace(/(## 사람 확인 대기[^\n]*\n\n)- 없음/, '$1- 무엇 · 왜 · d1')
  expect(parseBoard(text)).toMatchObject({ decisions: 2, human: 1 })
})

const withWaiting = (...lines: string[]) =>
  FILLED().replace(/(## 사람 확인 대기[^\n]*\n\n)- 없음/, `$1${lines.map(l => `- ${l}`).join('\n')}`)

const OLD_HEADER = '## 사람 확인 대기 (형식: `무엇 · 왜 사람이 답하나 · 관련 지시 ID`)'
const withOldHeader = (...lines: string[]) => withWaiting(...lines).replace(/## 사람 확인 대기[^\n]*/, OLD_HEADER)

test('parseBoard: 멈춘 일 — 첫 칸=멈춘 일, 가운데=물은 것, 칸 하나는 물은 것 비움, 없음 줄은 뺀다', () => {
  const text = withWaiting('A · 물음 · d1', 'B만 있는 줄', 'C · 앞 · 뒤 · d2', '없음', '없음 (형식 설명)')
  expect(parseBoard(text)).toMatchObject({
    human: 3,
    waiting: [
      { work: 'A', ask: '물음' },
      { work: 'B만 있는 줄', ask: '' },
      { work: 'C', ask: '앞 · 뒤' },
    ],
  })
})

test('parseBoard: 멈춘 일 — 없음으로 시작하는 실제 항목은 버리지 않는다', () => {
  expect(parseBoard(withWaiting('없음을 선택할지 · 왜 · –'))).toMatchObject({ human: 1, waiting: [{ work: '없음을 선택할지', ask: '왜' }] })
})

test('parseBoard: 멈춘 일 — 옛 헤더 보드는 첫 칸을 물은 것으로 읽는다', () => {
  const text = withOldHeader('A 승인 · 왜 · d1', 'B만 있는 줄')
  expect(parseBoard(text)?.waiting).toEqual([{ work: '', ask: 'A 승인' }, { work: '', ask: 'B만 있는 줄' }])
})

test('parseBoard: 멈춘 일 — 템플릿은 빈 배열', () => {
  expect(parseBoard(TEMPLATE)?.waiting).toEqual([])
})

test('parseBoard: 빈 문서는 undefined', () => {
  expect(parseBoard('  \n')).toBeUndefined()
})

// ---- 띠 ----
const BAND = {
  plugin: 'armory',
  component: 'AbovePrompt',
  surface: 'terminal',
  props: { hasSurvey: false, isCollapsed: false, isWorking: false, maxRows: 20, bodyColumns: 100, scroll: { offset: 0, bodyRows: 19 }, view: {} },
} as const
const NARROW = { ...BAND, props: { ...BAND.props, bodyColumns: 60 } } as const

type World = { files: Record<string, string>; id: string; agent?: boolean; reads: string[] }

function world(on: On, w: World, beneathText?: string) {
  on('session.cwd', () => ({ value: '/proj' }))
  on('fs.read', (_, e) => {
    w.reads.push(e.path)
    const text = w.files[e.path]
    if (text === undefined) throw new Error(`ENOENT: ${e.path}`)
    return { value: text }
  })
  on('session.id', () => ({ value: w.id }) as never)
  on('session.info', () => ({ value: { transcriptPath: '', ...(w.agent ? { agentType: 'mod-dev' } : {}) } }) as never)
  on('ui.render', ($, e) => {
    const { Box, Text } = $.ui.resolve(e)
    return beneathText === undefined ? <Box /> : <Text>{beneathText}</Text>
  })
}

const allText = async (ui: { findAll: (q: { type: 'Text' }) => Promise<{ text?: string }[]> }) =>
  (await ui.findAll({ type: 'Text' })).map(t => t.text ?? '').join('\n')

const files = (board: string | undefined, config = ON) => ({
  '/proj/war-room/config.json': config,
  ...(board === undefined ? {} : { '/proj/war-room/COMMAND.md': board }),
})
const NOW = Date.parse('2026-11-20T14:00:00+09:00')

test('띠: 담당 세션이면 두 줄이 아래 그림 위에 보이고 warning 조건이면 색이 있다', async ($, on) => {
  const clock = mock.clock(on, { now: NOW })
  world(on, { files: files(FILLED()), id: ID, reads: [] }, '아래 그림')
  const ui = await $.ui.mount(BAND)
  await clock.advance(2000)
  const text = await allText(ui)
  expect(text).toContain('◆ 감독 · 감독 A · 작업 세션 2 · 지시 진행 2 · 보고 옴 1 · 막힘 1')
  expect(text).toContain('판정 대기 1 · 점검할 결정 0 · 답 대기 0 · 머지 관문 1/6 · 갱신 11-20 14:30')
  expect(text.indexOf('◆ 감독')).toBeLessThan(text.indexOf('아래 그림'))
  expect((await ui.find({ type: 'Text', text: /◆ 감독/ }))?.props.color).toBe('warning')
  await ui.unmount()
})

test('띠: 보고 옴·막힘·답 대기가 모두 0이면 warning 색이 없다', async ($, on) => {
  const clock = mock.clock(on, { now: NOW })
  const calm = FILLED().replace(/\n- d4.*\n- d5.*/, '')
  world(on, { files: files(calm), id: ID, reads: [] })
  const ui = await $.ui.mount(BAND)
  await clock.advance(2000)
  const head = await ui.find({ type: 'Text', text: /◆ 감독/ })
  expect(head).toBeDefined()
  expect(head?.props.color).toBeUndefined()
  await ui.unmount()
})

test('띠: 폭 70 미만이면 2줄을 생략한다', async ($, on) => {
  const clock = mock.clock(on, { now: NOW })
  world(on, { files: files(FILLED()), id: ID, reads: [] })
  const ui = await $.ui.mount(NARROW)
  await clock.advance(2000)
  expect(await ui.find({ type: 'Text', text: /◆ 감독/ })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: /판정 대기/ })).toBeUndefined()
  await ui.unmount()
})

test('띠: 갱신 값이 없으면 갱신 –', async ($, on) => {
  const clock = mock.clock(on, { now: NOW })
  world(on, { files: files(FILLED(ID, '-')), id: ID, reads: [] })
  const ui = await $.ui.mount(BAND)
  await clock.advance(2000)
  expect(await allText(ui)).toContain('갱신 –')
  await ui.unmount()
})

async function shown(on: On, $: Engine, w: World): Promise<boolean> {
  const clock = mock.clock(on, { now: NOW })
  world(on, w)
  const ui = await $.ui.mount(BAND)
  await clock.advance(2000)
  const found = (await ui.find({ type: 'Text', text: /◆ 감독/ })) !== undefined
  await ui.unmount()
  return found
}

test('띠: 세션 id가 바뀌었거나(/clear) 같은 폴더 다른 id 세션이면 없다', async ($, on) => {
  expect(await shown(on, $, { files: files(FILLED()), id: OTHER, reads: [] })).toBe(false)
})

test('띠: 옛 보드(맡음, id 줄 없음)는 없다', async ($, on) => {
  expect(await shown(on, $, { files: files(FILLED().replace(`- 세션 ID: ${ID}\n`, '')), id: ID, reads: [] })).toBe(false)
})

test('띠: 서브에이전트(부모 id)는 없다', async ($, on) => {
  expect(await shown(on, $, { files: files(FILLED()), id: ID, agent: true, reads: [] })).toBe(false)
})

test('띠: COMMAND.md 읽기 실패는 없다', async ($, on) => {
  expect(await shown(on, $, { files: files(undefined), id: ID, reads: [] })).toBe(false)
})

test('띠: 해제 뒤(commander 꺼짐·비어 있음) 띠가 사라진다', async ($, on) => {
  const clock = mock.clock(on, { now: NOW })
  const w: World = { files: files(FILLED()), id: ID, reads: [] }
  world(on, w)
  const ui = await $.ui.mount(BAND)
  await clock.advance(2000)
  expect(await ui.find({ type: 'Text', text: /◆ 감독/ })).toBeDefined()
  w.files = files(FILLED().replace('- 상태: 맡음', '- 상태: 비어 있음'))
  await clock.advance(2000)
  expect(await ui.find({ type: 'Text', text: /◆ 감독/ })).toBeUndefined()
  w.files = files(FILLED())
  await clock.advance(2000)
  expect(await ui.find({ type: 'Text', text: /◆ 감독/ })).toBeDefined()
  w.files = files(FILLED(), '{"roles":{"manager":true,"commander":false}}')
  await clock.advance(2000)
  expect(await ui.find({ type: 'Text', text: /◆ 감독/ })).toBeUndefined()
  await ui.unmount()
})

test('폴링: war-room 없음·enabled false·commander 꺼짐에선 COMMAND.md를 읽지 않는다', async ($, on) => {
  const clock = mock.clock(on, { now: NOW })
  const w: World = { files: {}, id: ID, reads: [] }
  world(on, w)
  const ui = await $.ui.mount(BAND)
  await clock.advance(2000)
  w.files = files(FILLED(), '{"enabled":false,"roles":{"commander":true}}')
  await clock.advance(2000)
  w.files = files(FILLED(), '{"roles":{"manager":true}}')
  await clock.advance(2000)
  expect(w.reads.filter(p => p.endsWith('COMMAND.md'))).toEqual([])
  await ui.unmount()
})

test('띠: 질문(survey) 중이면 양보한다', async ($, on) => {
  const clock = mock.clock(on, { now: NOW })
  world(on, { files: files(FILLED()), id: ID, reads: [] }, '질문 화면')
  const ui = await $.ui.mount({ ...BAND, props: { ...BAND.props, hasSurvey: true } })
  await clock.advance(2000)
  expect(await ui.find({ type: 'Text', text: /◆ 감독/ })).toBeUndefined()
  expect(await ui.find({ type: 'Text', text: /질문 화면/ })).toBeDefined()
  await ui.unmount()
})

// ---- 멈춘 일 줄 ----
const waitingLines = (text: string) => text.split('\n').filter(line => line.startsWith('  ⏸ '))
const legacyLines = (text: string) => text.split('\n').filter(line => line.startsWith('  ? '))

async function drawn(on: On, $: Engine, board: string, base: typeof BAND | typeof NARROW = BAND): Promise<string> {
  const clock = mock.clock(on, { now: NOW })
  world(on, { files: files(board), id: ID, reads: [] })
  const ui = await $.ui.mount(base)
  await clock.advance(2000)
  const text = await allText(ui)
  await ui.unmount()
  return text
}

test('띠: 멈춘 일 0개면 ⏸·? 줄이 없다', async ($, on) => {
  const text = await drawn(on, $, FILLED())
  expect(waitingLines(text)).toEqual([])
  expect(legacyLines(text)).toEqual([])
  expect(text).not.toContain('… 외')
})

test('띠: 멈춘 일 2개는 `⏸ <멈춘 일> ← <물은 것>` 두 줄이고 관련 지시 칸은 안 보인다', async ($, on) => {
  const text = await drawn(on, $, withWaiting('이슈 생성 · 새로 만들까요 · d1', '배포 · 지금 할까요 · –'))
  expect(waitingLines(text)).toEqual(['  ⏸ 이슈 생성 ← 새로 만들까요', '  ⏸ 배포 ← 지금 할까요'])
  expect(text).not.toContain('d1 ')
})

test('띠: 멈춘 일 — 물은 것 칸에 ` · `가 있어도 전부 보인다', async ($, on) => {
  const text = await drawn(on, $, withWaiting('작업 · 앞 · 뒤 · d1'))
  expect(waitingLines(text)).toEqual(['  ⏸ 작업 ← 앞 · 뒤'])
})

test('띠: 멈춘 일 — 칸이 하나뿐인 줄은 `⏸ <그 칸>`', async ($, on) => {
  const text = await drawn(on, $, withWaiting('혼자 있는 줄'))
  expect(waitingLines(text)).toEqual(['  ⏸ 혼자 있는 줄'])
})

test('띠: 멈춘 일 — 같은 문구 두 항목도 중복 제거 없이 두 줄 모두 보인다', async ($, on) => {
  const text = await drawn(on, $, withWaiting('같은 일 · 같은 질문 · d1', '같은 일 · 같은 질문 · d2'))
  expect(waitingLines(text)).toEqual(['  ⏸ 같은 일 ← 같은 질문', '  ⏸ 같은 일 ← 같은 질문'])
})

test('띠: 멈춘 일 3개는 모두 보이고 외 n개 줄은 없다', async ($, on) => {
  const text = await drawn(on, $, withWaiting('W1 · Q · d1', 'W2 · Q · –', 'W3'))
  expect(waitingLines(text)).toEqual(['  ⏸ W1 ← Q', '  ⏸ W2 ← Q', '  ⏸ W3'])
  expect(text).not.toContain('… 외')
})

test('띠: 멈춘 일 5개는 3개만 보이고 … 외 2개', async ($, on) => {
  const text = await drawn(on, $, withWaiting('W1 · Q · d1', 'W2 · Q · d1', 'W3 · Q · d1', 'W4 · Q · d1', 'W5 · Q · d1'))
  expect(waitingLines(text)).toEqual(['  ⏸ W1 ← Q', '  ⏸ W2 ← Q', '  ⏸ W3 ← Q'])
  expect(text).toContain('  … 외 2개')
  expect(text).not.toContain('W4')
})

test('띠: 멈춘 일 — 좁은 화면(60칸)에서도 ⏸ 줄은 보이고 2줄은 생략된다', async ($, on) => {
  const text = await drawn(on, $, withWaiting('W1 · Q · d1', 'W2 · Q · d1'), NARROW)
  expect(text).not.toContain('판정 대기')
  expect(waitingLines(text).map(l => l.split(' ← ')[0])).toEqual(['  ⏸ W1', '  ⏸ W2'])
})

test('띠: 멈춘 일 — 옛 헤더 보드는 `  ? <첫 칸>` 줄로 그린다', async ($, on) => {
  const text = await drawn(on, $, withOldHeader('A 승인 · 왜 · d1', 'B 승인 · 왜 · d2'))
  expect(legacyLines(text)).toEqual(['  ? A 승인', '  ? B 승인'])
  expect(waitingLines(text)).toEqual([])
})

test('띠: 멈춘 일 — 2줄은 `답 대기 n`이고 `사람 확인` 문구가 없다', async ($, on) => {
  const text = await drawn(on, $, withWaiting('W1 · Q · d1', 'W2 · Q · d1'))
  expect(text).toContain('답 대기 2')
  expect(text).not.toContain('사람 확인')
})

test('띠: 멈춘 일 — 없음을 선택하자는 항목도 줄로 보인다', async ($, on) => {
  const text = await drawn(on, $, withWaiting('없음을 선택할지 · 왜 · –'))
  expect(waitingLines(text)).toEqual(['  ⏸ 없음을 선택할지 ← 왜'])
})
