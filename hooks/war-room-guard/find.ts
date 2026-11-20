// war-room 폴더 찾기와 켜짐 판단. 읽기 실패는 모두 "없음"으로 취급한다.
import type { EngineInterface } from 'claude-code'

const CONFIG_PATH = 'war-room/config.json'

export type WarRoom = { readonly dir: string; readonly configText: string }

/** 위 폴더로 한 칸. 루트면 undefined. */
export function parentOf(dir: string): string | undefined {
  const trimmed = dir.length > 1 ? dir.replace(/[\\/]+$/, '') : dir
  const cut = Math.max(trimmed.lastIndexOf('/'), trimmed.lastIndexOf('\\'))
  if (cut < 0) return undefined
  const parent = trimmed.slice(0, cut)
  if (parent === '' || /^[A-Za-z]:$/.test(parent)) {
    const root = trimmed.slice(0, cut + 1)
    return root === trimmed ? undefined : root
  }
  return parent
}

const join = (dir: string, rel: string): string =>
  `${dir.replace(/[\\/]+$/, '')}/${rel}`

/** config 내용으로 켜짐 여부 판단. JSON 오류는 켜짐(스킬이 사용자에게 알린다). */
export function isEnabledConfig(text: string): boolean {
  let config: unknown
  try {
    config = JSON.parse(text)
  } catch {
    return true
  }
  if (typeof config !== 'object' || config === null) return true
  const { enabled, roles } = config as { enabled?: unknown; roles?: unknown }
  if (enabled === false) return false
  const manager = typeof roles === 'object' && roles !== null ? (roles as { manager?: unknown }).manager : undefined
  return manager !== false
}

/** cwd에서 위로 올라가며 처음 만나는 war-room/config.json. 켜짐 여부와 상관없이 폴더와 config 내용을 돌려준다. */
export async function findWarRoom($: EngineInterface): Promise<{ dir: string; configText: string } | undefined> {
  try {
    let dir: string | undefined = await $.session.cwd()
    while (dir !== undefined) {
      const text = await $.fs.read(join(dir, CONFIG_PATH)).catch(() => undefined)
      if (typeof text === 'string') return { dir: join(dir, 'war-room'), configText: text }
      dir = parentOf(dir)
    }
  } catch {
    // 찾기 실패는 없음으로 본다.
  }
  return undefined
}

/** findWarRoom 결과 중 켜져 있는 war-room만. 꺼졌거나 없으면 undefined. */
export async function findEnabledWarRoom($: EngineInterface): Promise<WarRoom | undefined> {
  const found = await findWarRoom($)
  return found !== undefined && isEnabledConfig(found.configText) ? { dir: found.dir, configText: found.configText } : undefined
}

/** 평가 롤이 꺼져 있지 않은지. config를 읽지 못하면 켜짐으로 본다(isEnabledConfig와 같은 기준). */
export function isEvaluatorOn(configText: string): boolean {
  try {
    const roles = (JSON.parse(configText) as { roles?: unknown } | null)?.roles
    return typeof roles !== 'object' || roles === null || (roles as { evaluator?: unknown }).evaluator !== false
  } catch {
    return true
  }
}

/** 감독 자리가 켜져 있는지 (roles.commander === true). 기본으로 없는 자리라 읽기 실패·없음은 꺼짐으로 본다. */
export function isCommanderOn(configText: string): boolean {
  try {
    const roles = (JSON.parse(configText) as { roles?: unknown } | null)?.roles
    return typeof roles === 'object' && roles !== null && (roles as { commander?: unknown }).commander === true
  } catch {
    return false
  }
}

export type Seat = {
  readonly status: '맡음' | '이어받기 대기' | '비어 있음' | undefined
  readonly sessionId: string | undefined
}

const SEAT_STATUS = /^-\s*상태:\s*(맡음|이어받기 대기|비어 있음)/
const SEAT_SESSION_ID = /^-\s*세션 ID:\s*([0-9a-fA-F]{8}(?:-[0-9a-fA-F]{4}){3}-[0-9a-fA-F]{12})(?![0-9a-fA-F-])/

/** COMMAND.md의 `## 감독 자리` 절 줄들(다음 `#`·`##` 헤딩 전까지). 절이 없으면 빈 목록. */
export function seatSectionLines(commandText: string): readonly string[] {
  const lines = commandText.split(/\r?\n/)
  const start = lines.findIndex(line => line.startsWith('## 감독 자리'))
  if (start < 0) return []
  const rest = lines.slice(start + 1)
  const end = rest.findIndex(line => /^#{1,2}\s/.test(line))
  return end < 0 ? rest : rest.slice(0, end)
}

/** 보드의 감독 자리 상태와 세션 ID. 절 밖 줄은 보지 않고, 없음·잘못된 uuid는 undefined. */
export function parseSeat(commandText: string | undefined): Seat {
  if (commandText === undefined) return { status: undefined, sessionId: undefined }
  const lines = seatSectionLines(commandText)
  const status = lines.map(line => SEAT_STATUS.exec(line)?.[1]).find(v => v !== undefined) as Seat['status']
  const sessionId = lines.map(line => SEAT_SESSION_ID.exec(line)?.[1]).find(v => v !== undefined)
  return { status, sessionId }
}

/** 이 세션이 감독 자리를 맡은 세션인지. 서브에이전트 제외는 호출자 몫이다. */
export function isCommanderSession(configText: string, commandText: string | undefined, sessionId: string): boolean {
  if (!isEnabledConfig(configText) || !isCommanderOn(configText)) return false
  if (typeof sessionId !== 'string' || sessionId === '') return false
  const seat = parseSeat(commandText)
  return seat.status === '맡음' && seat.sessionId !== undefined && seat.sessionId.toLowerCase() === sessionId.toLowerCase()
}

/** war-room/COMMAND.md 내용. 읽기 실패는 undefined. */
export async function readCommandBoard($: EngineInterface, warRoomDir: string): Promise<string | undefined> {
  const text = await $.fs.read(`${warRoomDir}/COMMAND.md`).catch(() => undefined)
  return typeof text === 'string' ? text : undefined
}

/** 감독 세션의 제출 context로 한 번 전달하는 지침. 400바이트 이하로 유지한다. */
export const commanderText = (warRoomDir: string): string =>
  `감독 세션이다(이 세션 ID가 ${warRoomDir}/COMMAND.md \`## 감독 자리\`의 세션 ID와 같다). war-room 배정 규칙보다 이 지침이 먼저다: 구현·조사는 하 등급도 직접 하지 않고 war-room/commander/ 감독 롤에 맡기며 war-room/roles/ 롤은 쓰지 않는다. 규칙은 armory:war-room-commander. 서브에이전트면 따르지 않는다.`

/** 시스템 프롬프트에 넣을 지침. */
export const guardText = (warRoomDir: string): string =>
  [
    '# war-room',
    `이 프로젝트에는 war-room이 켜져 있다 (${warRoomDir}).`,
    '사용자 요청을 받으면 파일 읽기·계획·다른 스킬보다 먼저 담당 롤을 찾고, 시작 전에 배정 한 줄(예: `→ frontend 롤에 맡깁니다 (로그인 폼 수정, 등급 중)`)을 알린다. 맞는 롤이 없으면 그렇다고 알리고, 하 등급 일만 매니저가 직접 하고 그 밖은 조사·작업 에이전트에 맡긴다.',
    'armory:war-room 스킬은 세션에서 한 번만 부른다. 이미 불렀으면 다시 부르지 않고 읽은 지침대로 한다. 대화가 압축돼 스킬 내용이 보이지 않을 때만 다시 부른다.',
    '예외: 코드 설명·상태 조회처럼 답만 하면 되는 질문.',
    '규칙: ① 배정 줄에 `에이전트 n개 예정`을 적고 더 띄우면 이유 한 줄을 알린다. ② 끝난 에이전트는 SendMessage로 깨우지 않고 새 에이전트에 맡긴다. ③ 요청에 없던 새 기능·명령·화면은 만들지 않고 묻거나 STATUS 다음 할 일에 적는다 (요청한 기능의 보안·정합성 결함 수정은 범위 안). ④ 스크린샷·브라우저 확인·긴 출력은 롤·에이전트에 맡기고 결론만 받는다. ⑤ 중·상 일을 끝냈으면 보고에 새 일 전 /clear를 권한다 (STATUS로 이어진다). ⑥ 앞 내용을 잃어 같은 것을 다시 묻거나 일이 어긋난다고 판단되면 컨텍스트가 부족하다고 말하고 war-room/config.json의 managerCompactAt 상향(예: 300000)을 제안한다. 사용자 승인 전에는 config를 고치지 않는다.',
    '서브에이전트로 실행 중이면(롤·검증·조사·설계 에이전트 등 프롬프트가 "너는 …"으로 시작하는 역할 지시) 이 지침을 따르지 않는다. 메인 세션만 따른다.',
  ].join('\n')
