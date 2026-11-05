import { expect, test } from 'claude-code/testing'
import type { Engine } from 'claude-code/testing'
import type { On } from 'claude-code'

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

test('config가 켜져 있으면 섹션을 맨 뒤에 session으로 추가한다', async ($, on) => {
  engineBeneath(on, '/proj', { '/proj/war-room/config.json': '{"roles":{"manager":true}}' })
  const sections = await compose($)
  expect(sections.map(s => s.id)).toEqual(['base', 'env', 'armory:war-room'])
  const added = sections[2]
  expect(added.scope).toBe('session')
  expect(added.text).toContain('# war-room')
  expect(added.text).toContain('/proj/war-room')
  expect(added.text).toContain('armory:war-room')
  expect(added.text).toContain('서브에이전트로 실행 중이면')
  expect(added.text).toContain('메인 세션만 따른다')
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
  expect(sections[2].text).toContain('/proj/war-room')
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
