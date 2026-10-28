import fs from 'node:fs/promises'
import path from 'node:path'
import type { z } from 'zod'
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
  readonly warnings: readonly string[]
}

interface Loaded<T> {
  readonly value: T
  readonly warning?: string
}

function formatIssues(error: z.ZodError): string {
  return error.issues
    .slice(0, 5)
    .map((issue) => `  - ${issue.path.join('.') || '(root)'}: ${issue.message}`)
    .join('\n')
}

/** 파일이 없으면 기본값과 경고를, 형식이 틀리면 파일 이름을 담은 오류를 낸다. */
async function loadJson<T>(file: string, schema: z.ZodType<T>, fallback: T): Promise<Loaded<T>> {
  let raw: string
  try {
    raw = await fs.readFile(file, 'utf8')
  } catch {
    return { value: fallback, warning: `${path.basename(file)} 없음 (${file}) — 기본값 사용` }
  }
  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch (error) {
    throw new Error(`${file}: JSON 형식 오류 — ${(error as Error).message}`)
  }
  const result = schema.safeParse(parsed)
  if (!result.success) throw new Error(`${file}: 스키마 오류\n${formatIssues(result.error)}`)
  return { value: result.data }
}

async function loadEntries(dataDir: string): Promise<readonly CaptureEntry[]> {
  const names = await fs.readdir(dataDir).catch(() => [] as string[])
  const files = names.filter((name) => name.endsWith('.json')).sort()
  const loaded = await Promise.all(
    files.map((name) => loadJson(path.join(dataDir, name), captureEntrySchema.nullable(), null)),
  )
  return loaded.map((item) => item.value).filter((entry): entry is CaptureEntry => entry !== null)
}

export async function loadSources(): Promise<Sources> {
  const dir = SPEC.sourceDir
  const [entries, requirements, mapping, overrides] = await Promise.all([
    loadEntries(path.join(SPEC.outDir, 'data')),
    loadJson(path.join(dir, 'requirements.json'), requirementSchema.array(), []),
    loadJson(path.join(dir, 'mapping.json'), mappingSchema, { draft: true, links: {} }),
    loadJson(path.join(dir, 'overrides.json'), overridesSchema, {}),
  ])
  const warnings = [requirements, mapping, overrides]
    .map((loaded) => loaded.warning)
    .filter((warning): warning is string => Boolean(warning))
  return {
    entries,
    requirements: requirements.value,
    mapping: mapping.value,
    overrides: overrides.value,
    warnings,
  }
}
