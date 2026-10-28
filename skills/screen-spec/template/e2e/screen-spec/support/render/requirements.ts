import type { RequirementNode, SpecModel } from '../model'
import { REQUIREMENT_STATUSES, STATUS_LABELS } from '../types'
import { escapeHtml } from './escape'

function renderCaptures(req: RequirementNode, titleOf: (id: string) => string | undefined): string {
  if (req.captures.length === 0) return '<p class="no-cap">연결된 화면 없음</p>'
  const items = req.captures.map(
    (capture) =>
      `<li><a href="#cap-${escapeHtml(capture.id)}">${escapeHtml(titleOf(capture.id) ?? capture.id)}</a> <span class="why">${escapeHtml(capture.rationale)}</span></li>`,
  )
  return `<p><a class="impl" href="#impl:${escapeHtml(req.id)}">구현 화면 ${req.captures.length}개 모아 보기</a></p><ul class="caps">${items.join('')}</ul>`
}

function renderRequirement(req: RequirementNode, titleOf: (id: string) => string | undefined): string {
  const text = req.text ? `<details><summary>원문</summary><p>${escapeHtml(req.text)}</p></details>` : ''
  const note = req.note ? `<p class="note">${escapeHtml(req.note)}</p>` : ''
  return `<div class="req" id="req-${escapeHtml(req.id)}" data-status="${req.status}" data-linked="${req.captures.length > 0}" style="--depth:${req.depth}">
<div class="req-head"><span class="num">${escapeHtml(req.number ?? req.id)}</span><strong>${escapeHtml(req.title)}</strong><span class="pill st-${req.status}">${STATUS_LABELS[req.status]}</span></div>
${text}${note}${renderCaptures(req, titleOf)}</div>`
}

function renderStatusFilters(requirements: readonly RequirementNode[]): string {
  const boxes = REQUIREMENT_STATUSES.map((status) => {
    const count = requirements.filter((req) => req.status === status).length
    if (count === 0) return ''
    return `<label><input type="checkbox" class="status-filter" value="${status}" checked> ${STATUS_LABELS[status]} <span class="count">${count}</span></label>`
  })
  return `<div class="kinds">${boxes.join('')}<label><input type="checkbox" id="linked-only"> 화면 연결된 것만</label></div>`
}

export function renderRequirementsView(model: SpecModel): string {
  const titles = new Map(
    model.sections.flatMap((section) =>
      section.screens.flatMap((screen) => screen.entries.map((entry) => [entry.id, entry.title] as const)),
    ),
  )
  const titleOf = (id: string): string | undefined => titles.get(id)
  const linked = model.requirements.filter((req) => req.captures.length > 0).length
  const implemented = model.requirements.filter((req) => req.status === 'implemented').length
  const summary = `요구사항 ${model.requirements.length}개 · 구현 ${implemented}개 · 화면 연결 ${linked}개`
  return `<div class="reqs-wrap">${renderStatusFilters(model.requirements)}<p class="summary">${summary}</p>
${model.requirements.map((req) => renderRequirement(req, titleOf)).join('\n')}</div>`
}
