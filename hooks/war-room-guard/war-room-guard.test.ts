import { expect, test } from 'claude-code/testing'
import type { Engine } from 'claude-code/testing'
import type { On } from 'claude-code'
import { commanderText, guardText } from './find'

const SHARED = { id: 'base', text: '기본 프롬프트', scope: 'shared' } as const
const SESSION = { id: 'env', text: '환경', scope: 'session' } as const

/** 엔진 대신 아래에서 답하는 훅: 기본 섹션, 작업 폴더, 가짜 파일 시스템(경로 → 내용). */
function engineBeneath(on: On, cwd: string, files: Record<string, string>) {
  on('prompt.compose', () => ({ sections: [SHARED, SESSION] }))
  on('session.cwd', () => ({ value: cwd }))
  on('fs.read', (_, e) => {
    const text = files[e.path]
    if (text === undefined) throw new Error(`ENOENT: ${e.path}`)
    return { value: text }
  })
}

const INPUT = {
  model: 'm',
  promptModel: 'm',
  surfaces: ['terminal'],
  tools: [],
  outputStyle: null,
  traits: [],
} as const

const compose = async ($: Engine) => (await $.prompt.compose(INPUT)).sections

/** i번째 항목. 없으면 테스트를 실패시킨다 (noUncheckedIndexedAccess 대응). */
function at<T>(list: readonly T[], i: number): T {
  const item = list[i]
  if (item === undefined) throw new Error(`${i}번째 섹션이 없다`)
  return item
}

test('config가 켜져 있으면 섹션을 맨 뒤에 session으로 추가한다', async ($, on) => {
  engineBeneath(on, '/proj', { '/proj/war-room/config.json': '{"roles":{"manager":true}}' })
  const sections = await compose($)
  expect(sections.map(s => s.id)).toEqual(['base', 'env', 'armory:war-room'])
  const added = at(sections, 2)
  expect(added.scope).toBe('session')
  expect(added.text).toContain('# war-room')
  expect(added.text).toContain('/proj/war-room')
  expect(added.text).toContain('armory:war-room')
  expect(added.text).toContain('서브에이전트로 실행 중이면')
  expect(added.text).toContain('메인 세션만 따른다')
  expect(added.text).toContain('하 등급 일만 매니저가 직접')
  expect(added.text).toContain('등급 중')
  expect(added.text).toContain('세션에서 한 번만 부른다')
  expect(added.text).toContain('이미 불렀으면 다시 부르지 않고')
  expect(added.text).not.toContain('맞는 롤이 없으면 그렇다고 알리고 매니저가 직접 한다')
})

test('enabled가 false면 섹션을 넣지 않는다', async ($, on) => {
  engineBeneath(on, '/proj', { '/proj/war-room/config.json': '{"enabled":false}' })
  expect((await compose($)).map(s => s.id)).toEqual(['base', 'env'])
})

test('roles.manager가 false면 섹션을 넣지 않는다', async ($, on) => {
  engineBeneath(on, '/proj', { '/proj/war-room/config.json': '{"roles":{"manager":false}}' })
  expect((await compose($)).map(s => s.id)).toEqual(['base', 'env'])
})

test('war-room이 없으면 섹션을 넣지 않는다', async ($, on) => {
  engineBeneath(on, '/proj/sub', {})
  expect((await compose($)).map(s => s.id)).toEqual(['base', 'env'])
})

test('상위 폴더의 war-room을 찾는다', async ($, on) => {
  engineBeneath(on, '/proj/packages/app', { '/proj/war-room/config.json': '{}' })
  const sections = await compose($)
  expect(sections.map(s => s.id)).toEqual(['base', 'env', 'armory:war-room'])
  expect(at(sections, 2).text).toContain('/proj/war-room')
})

test('JSON 형식이 틀려도 섹션을 넣고 오류를 던지지 않는다', async ($, on) => {
  engineBeneath(on, '/proj', { '/proj/war-room/config.json': '{ 깨진 json' })
  expect((await compose($)).map(s => s.id)).toEqual(['base', 'env', 'armory:war-room'])
})

test('작업 폴더를 읽지 못해도 기본 섹션을 그대로 돌려준다', async ($, on) => {
  on('prompt.compose', () => ({ sections: [SHARED, SESSION] }))
  on('session.cwd', () => {
    throw new Error('boom')
  })
  expect((await compose($)).map(s => s.id)).toEqual(['base', 'env'])
})

const guardOf = (dir: string) => guardText(dir)

test('guardText: 배정 줄에 에이전트 수 예정과 초과 이유를 적게 한다', () => {
  const text = guardOf('/proj/war-room')
  expect(text).toContain('에이전트 n개 예정')
  expect(text).toContain('이유 한 줄')
})

test('guardText: 끝난 에이전트를 SendMessage로 깨우지 않는다', () => {
  const text = guardOf('/proj/war-room')
  expect(text).toContain('SendMessage')
  expect(text).toContain('새 에이전트에 맡긴다')
})

test('guardText: 요청에 없던 새 기능·명령·화면을 만들지 않고 결함 수정은 범위 안이다', () => {
  const text = guardOf('/proj/war-room')
  expect(text).toContain('새 기능·명령·화면은 만들지 않고')
  expect(text).toContain('다음 할 일')
  expect(text).toContain('결함 수정은 범위 안')
})

test('guardText: 스크린샷·브라우저 확인·긴 출력은 매니저가 직접 보지 않는다', () => {
  const text = guardOf('/proj/war-room')
  expect(text).toContain('스크린샷')
  expect(text).toContain('결론만 받는다')
})

test('guardText: 중·상 일을 끝내면 /clear를 권한다', () => {
  expect(guardOf('/proj/war-room')).toContain('/clear')
})

test('guardText: 컨텍스트가 부족하면 managerCompactAt 상향을 제안하되 승인 전에는 config를 고치지 않는다', () => {
  const text = guardOf('/proj/war-room')
  expect(text).toContain('managerCompactAt')
  expect(text).toContain('승인')
})

test('guardText는 1900바이트 이하다', () => {
  expect(new TextEncoder().encode(guardOf('/proj/war-room')).length).toBeLessThanOrEqual(1900)
})

test('roles.commander가 true여도 compose에는 감독 지침을 넣지 않는다(제출 context로 옮김)', async ($, on) => {
  engineBeneath(on, '/proj', { '/proj/war-room/config.json': '{"roles":{"manager":true,"commander":true}}' })
  const sections = await compose($)
  expect(sections.map(s => s.id)).toEqual(['base', 'env', 'armory:war-room'])
  const text = at(sections, 2).text
  expect(text).toBe(guardText('/proj/war-room'))
  expect(text).not.toContain(commanderText('/proj/war-room'))
  expect(text).not.toContain('COMMAND.md')
})

test('roles.commander가 없거나 false면 감독 자리 지침을 넣지 않는다', async ($, on) => {
  engineBeneath(on, '/proj', { '/proj/war-room/config.json': '{"roles":{"manager":true,"commander":false}}' })
  expect(at(await compose($), 2).text).not.toContain('COMMAND.md')
})

test('config JSON이 깨지면 감독 자리 지침을 넣지 않는다', async ($, on) => {
  engineBeneath(on, '/proj', { '/proj/war-room/config.json': '{ 깨진 json' })
  expect(at(await compose($), 2).text).not.toContain('COMMAND.md')
})

test('commanderText는 담당이면 배정 규칙보다 먼저이고 하 등급도 감독 롤에 맡긴다고 적는다', () => {
  const text = commanderText('/proj/war-room')
  expect(text).toContain('/proj/war-room/COMMAND.md')
  expect(text).toContain('세션 ID')
  expect(text).toContain('배정 규칙보다 이 지침이 먼저')
  expect(text).toContain('하 등급도 직접 하지 않고')
  expect(text).toContain('war-room/commander/ 감독 롤에 맡기며')
  expect(text).toContain('war-room/roles/ 롤은 쓰지 않는다')
  expect(text).toContain('armory:war-room-commander')
  expect(text).toContain('서브에이전트면 따르지 않는다')
})

test('commanderText는 400바이트 이하다', () => {
  expect(new TextEncoder().encode(commanderText('/proj/war-room')).length).toBeLessThanOrEqual(400)
})
