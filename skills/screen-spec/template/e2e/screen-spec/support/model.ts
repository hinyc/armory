import { SPEC } from './spec.config'
import type { Sources } from './sources'
import type { CaptureEntry, Requirement } from './types'

export interface Link {
  readonly req: string
  readonly rationale: string
}

export interface NumberedEntry extends CaptureEntry {
  readonly number: string
  readonly links: readonly Link[]
}

export interface ScreenGroup {
  readonly number: string
  readonly name: string
  readonly route?: string
  readonly entries: readonly NumberedEntry[]
}

export interface SectionGroup {
  readonly key: string
  readonly number: string
  readonly label: string
  readonly screens: readonly ScreenGroup[]
}

export interface RequirementNode extends Requirement {
  readonly depth: number
  readonly captures: readonly { readonly id: string; readonly rationale: string }[]
}

export interface SpecModel {
  readonly title: string
  readonly generatedAt: string
  readonly draft: boolean
  readonly sections: readonly SectionGroup[]
  readonly requirements: readonly RequirementNode[]
  readonly entryCount: number
  readonly linkedEntryCount: number
  readonly warnings: readonly string[]
}

const sectionOrder = new Map(SPEC.sections.map((section, index) => [section.key, index]))

function compareEntries(a: CaptureEntry, b: CaptureEntry): number {
  const bySection = (sectionOrder.get(a.section) ?? 999) - (sectionOrder.get(b.section) ?? 999)
  return bySection !== 0 ? bySection : a.sortKey.localeCompare(b.sortKey)
}

function groupBy<T>(items: readonly T[], keyOf: (item: T) => string): readonly (readonly T[])[] {
  const keys = [...new Set(items.map(keyOf))]
  return keys.map((key) => items.filter((item) => keyOf(item) === key))
}

function buildSections(entries: readonly CaptureEntry[], sources: Sources): readonly SectionGroup[] {
  const sorted = [...entries].sort(compareEntries)
  return groupBy(sorted, (entry) => entry.section).map((sectionEntries, si) => {
    const key = sectionEntries[0].section
    const label = SPEC.sections.find((section) => section.key === key)?.label ?? key
    const screens = groupBy(sectionEntries, (entry) => entry.screen).map((screenEntries, ci) => ({
      number: `${si + 1}.${ci + 1}`,
      name: screenEntries[0].screen,
      route: screenEntries.find((entry) => entry.route)?.route,
      entries: screenEntries.map((entry, ei) => ({
        ...entry,
        number: `${si + 1}.${ci + 1}.${ei + 1}`,
        links: sources.mapping.links[entry.id] ?? [],
      })),
    }))
    return { key, number: String(si + 1), label, screens }
  })
}

/** 부모를 따라 올라간 깊이. 순환(A→B→A)이면 -1. */
function depthOf(req: Requirement, byId: ReadonlyMap<string, Requirement>, seen: ReadonlySet<string> = new Set()): number {
  if (seen.has(req.id)) return -1
  const parent = req.parentId ? byId.get(req.parentId) : undefined
  if (!parent) return 0
  const parentDepth = depthOf(parent, byId, new Set([...seen, req.id]))
  return parentDepth < 0 ? -1 : parentDepth + 1
}

function buildRequirements(sources: Sources): readonly RequirementNode[] {
  const byId = new Map(sources.requirements.map((req) => [req.id, req]))
  const linkEntries = Object.entries(sources.mapping.links)
  return sources.requirements.map((req) => ({
    ...req,
    depth: Math.max(depthOf(req, byId), 0),
    captures: linkEntries.flatMap(([id, links]) =>
      links.filter((link) => link.req === req.id).map((link) => ({ id, rationale: link.rationale })),
    ),
  }))
}

function applyOverrides(sources: Sources): readonly CaptureEntry[] {
  return sources.entries.map((entry) => ({ ...entry, ...sources.overrides[entry.id] }))
}

function collectWarnings(sources: Sources): readonly string[] {
  const entryIds = new Set(sources.entries.map((entry) => entry.id))
  const reqIds = new Set(sources.requirements.map((req) => req.id))
  const unknownSections = [...new Set(sources.entries.map((entry) => entry.section))]
    .filter((key) => !sectionOrder.has(key))
    .map((key) => `spec.config.ts sections에 없는 section: ${key}`)
  const danglingCaptures = [
    ...Object.keys(sources.mapping.links),
    ...Object.keys(sources.overrides),
  ]
    .filter((id) => !entryIds.has(id))
    .map((id) => `mapping/overrides가 없는 캡처를 가리킴: ${id}`)
  const danglingReqs = Object.values(sources.mapping.links)
    .flat()
    .filter((link) => !reqIds.has(link.req))
    .map((link) => `mapping이 없는 요구사항을 가리킴: ${link.req}`)
  const byId = new Map(sources.requirements.map((req) => [req.id, req]))
  const danglingParents = sources.requirements
    .filter((req) => req.parentId && !reqIds.has(req.parentId))
    .map((req) => `요구사항 ${req.id}의 parentId ${req.parentId}가 없음`)
  const cycles = sources.requirements
    .filter((req) => depthOf(req, byId) < 0)
    .map((req) => `요구사항 ${req.id}의 parentId가 순환함`)
  const duplicateReqs = sources.requirements
    .filter((req, index, all) => all.findIndex((other) => other.id === req.id) !== index)
    .map((req) => `요구사항 id 중복: ${req.id}`)
  return [
    ...unknownSections,
    ...new Set(danglingCaptures),
    ...new Set(danglingReqs),
    ...danglingParents,
    ...cycles,
    ...duplicateReqs,
  ]
}

export function buildModel(sources: Sources): SpecModel {
  const entries = applyOverrides(sources)
  const sections = buildSections(entries, sources)
  return {
    title: SPEC.title,
    generatedAt: new Date().toISOString(),
    draft: sources.mapping.draft,
    sections,
    requirements: buildRequirements(sources),
    entryCount: entries.length,
    linkedEntryCount: entries.filter((entry) => (sources.mapping.links[entry.id] ?? []).length > 0)
      .length,
    warnings: collectWarnings(sources),
  }
}
