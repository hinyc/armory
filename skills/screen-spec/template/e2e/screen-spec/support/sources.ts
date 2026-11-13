import fs from 'node:fs/promises'
import path from 'node:path'
import { SPEC } from './spec.config'
import {
  captureEntrySchema,
  mappingSchema,
  overridesSchema,
  requirementSchema,
  type CaptureEntry,
  type Mapping,
  type Overrides,
  type Requirement,
} from './types'

export interface Sources {
  readonly entries: readonly CaptureEntry[]
  readonly requirements: readonly Requirement[]
  readonly mapping: Mapping
  readonly overrides: Overrides
}

interface Issue {
  readonly path: readonly PropertyKey[]
  readonly message: string
}

/**
 * zod 스키마의 safeParse만 쓴다. zod 3과 4는 ZodType 제네릭 의미가 달라서,
 * 구조만 맞추는 이 타입으로 받아야 두 버전 모두 tsc를 통과한다.
 */
interface Parser<T> {
  safeParse(
    data: unknown,
  ):
    | { readonly success: true; readonly data: T }
    | { readonly success: false; readonly error: { readonly issues: readonly Issue[] } }
}

function formatIssues(issues: readonly Issue[]): string {
  return issues
    .slice(0, 5)
    .map((issue) => `  - ${issue.path.map(String).join('.') || '(root)'}: ${issue.message}`)
    .join('\n')
}

/**
 * 파일이 없으면(ENOENT) 조용히 기본값을 쓴다 (요구사항 기능을 안 쓰는 프로젝트가 많다).
 * 다른 읽기 오류나 형식이 틀리면 파일 경로를 담은 오류로 생성을 중단한다.
 */
async function loadJson<T>(file: string, schema: Parser<T>, fallback: T): Promise<T> {
  let raw: string
  try {
    raw = await fs.readFile(file, 'utf8')
  } catch (error) {
    // 파일이 없을 때만 기본값. 권한·디렉터리 등 나머지 읽기 오류는 숨기지 않는다.
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return fallback
    throw new Error(`${file}: 읽을 수 없음 — ${(error as Error).message}`)
  }
  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch (error) {
    throw new Error(`${file}: JSON 형식 오류 — ${(error as Error).message}`)
  }
  const result = schema.safeParse(parsed)
  if (!result.success) throw new Error(`${file}: 스키마 오류\n${formatIssues(result.error.issues)}`)
  return result.data
}

async function loadEntries(dataDir: string): Promise<readonly CaptureEntry[]> {
  const names = await fs.readdir(dataDir).catch(() => [] as string[])
  const files = names.filter((name) => name.endsWith('.json')).sort()
  const loaded = await Promise.all(
    files.map((name) =>
      loadJson<CaptureEntry | null>(path.join(dataDir, name), captureEntrySchema, null),
    ),
  )
  return loaded.filter((entry): entry is CaptureEntry => entry !== null)
}

export async function loadSources(): Promise<Sources> {
  const dir = SPEC.sourceDir
  const [entries, requirements, mapping, overrides] = await Promise.all([
    loadEntries(path.join(SPEC.outDir, 'data')),
    loadJson<Requirement[]>(path.join(dir, 'requirements.json'), requirementSchema.array(), []),
    loadJson<Mapping>(path.join(dir, 'mapping.json'), mappingSchema, { draft: true, links: {} }),
    loadJson<Overrides>(path.join(dir, 'overrides.json'), overridesSchema, {}),
  ])
  return { entries, requirements, mapping, overrides }
}
