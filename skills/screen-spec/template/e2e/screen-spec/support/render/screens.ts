import type { NumberedEntry, ScreenGroup, SectionGroup, SpecModel } from '../model'
import { KIND_LABELS, KINDS, type Requirement } from '../types'
import { escapeHtml } from './escape'
import { linkify } from './linkify'

interface Lookup {
  readonly titleOf: (id: string) => string | undefined
  readonly reqOf: (id: string) => Requirement | undefined
}

function renderChips(entry: NumberedEntry, lookup: Lookup): string {
  if (entry.links.length === 0) return ''
  const chips = entry.links.map((link) => {
    const req = lookup.reqOf(link.req)
    const label = req ? `${req.number ?? req.id} ${req.title}` : `${link.req} (없음)`
    const status = req?.status ?? 'unclassified'
    return `<a class="chip st-${status}" href="#req-${escapeHtml(link.req)}" title="${escapeHtml(link.rationale)}">${escapeHtml(label)}</a>`
  })
  return `<div class="chips">${chips.join('')}</div>`
}

function renderShot(entry: NumberedEntry): string {
  const dialog = entry.nativeDialog
  const cancel = dialog && dialog.type !== 'alert' ? '<span class="cancel">취소</span>' : ''
  const overlay = dialog
    ? `<div class="native"><div class="native-box"><p>${escapeHtml(dialog.message)}</p><span>확인</span>${cancel}</div></div>`
    : ''
  return `<figure class="shot"><button type="button" class="zoom" data-src="${escapeHtml(entry.image)}"><img loading="lazy" src="${escapeHtml(entry.image)}" alt="${escapeHtml(entry.title)}"></button>${overlay}</figure>`
}

function renderMeta(entry: NumberedEntry): string {
  const sources = (entry.source ?? []).map((file) => `<li><code>${escapeHtml(file)}</code></li>`)
  return `<details class="meta"><summary>ID · 소스</summary><p><code>${escapeHtml(entry.id)}</code></p>${
    sources.length ? `<ul>${sources.join('')}</ul>` : ''
  }</details>`
}

function renderCard(entry: NumberedEntry, lookup: Lookup): string {
  const search = [entry.title, entry.description ?? '', entry.id, entry.route ?? ''].join(' ').toLowerCase()
  const reqs = entry.links.map((link) => link.req).join(' ')
  const description = entry.description ? `<div class="desc">${linkify(entry.description, lookup.titleOf)}</div>` : ''
  return `<article class="card" id="cap-${entry.id}" data-kind="${entry.kind}" data-reqs="${escapeHtml(reqs)}" data-search="${escapeHtml(search)}">
<header><span class="num">${entry.number}</span><span class="kind k-${entry.kind}">${KIND_LABELS[entry.kind]}</span><h4>${escapeHtml(entry.title)}</h4></header>
${renderShot(entry)}${description}${renderChips(entry, lookup)}${renderMeta(entry)}
</article>`
}

function renderScreen(screen: ScreenGroup, lookup: Lookup): string {
  const route = screen.route ? `<code class="route">${escapeHtml(screen.route)}</code>` : ''
  return `<section class="screen" id="scr-${screen.number}"><h3><span class="num">${screen.number}</span> ${escapeHtml(screen.name)} ${route}</h3>
<div class="grid">${screen.entries.map((entry) => renderCard(entry, lookup)).join('\n')}</div></section>`
}

function renderSection(section: SectionGroup, lookup: Lookup): string {
  return `<section class="sec" id="sec-${escapeHtml(section.key)}"><h2><span class="num">${section.number}</span> ${escapeHtml(section.label)}</h2>
${section.screens.map((screen) => renderScreen(screen, lookup)).join('\n')}</section>`
}

function renderToc(sections: readonly SectionGroup[]): string {
  const items = sections.map((section) => {
    const screens = section.screens.map(
      (screen) =>
        `<li><a href="#scr-${screen.number}">${screen.number} ${escapeHtml(screen.name)}</a> <span class="count">${screen.entries.length}</span></li>`,
    )
    return `<li><a href="#sec-${escapeHtml(section.key)}">${section.number} ${escapeHtml(section.label)}</a><ul>${screens.join('')}</ul></li>`
  })
  return `<ol class="toc">${items.join('')}</ol>`
}

function renderFilters(model: SpecModel): string {
  const all = model.sections.flatMap((section) => section.screens.flatMap((screen) => screen.entries))
  const boxes = KINDS.map((kind) => {
    const count = all.filter((entry) => entry.kind === kind).length
    if (count === 0) return ''
    return `<label><input type="checkbox" class="kind-filter" value="${kind}" checked> ${KIND_LABELS[kind]} <span class="count">${count}</span></label>`
  })
  return `<input type="search" id="search" placeholder="검색 (제목·설명·ID·경로)"><div class="kinds">${boxes.join('')}</div>`
}

export function renderScreensView(model: SpecModel, requirements: readonly Requirement[]): string {
  const all = model.sections.flatMap((section) => section.screens.flatMap((screen) => screen.entries))
  const titles = new Map(all.map((entry) => [entry.id, entry.title]))
  const reqs = new Map(requirements.map((req) => [req.id, req]))
  const lookup: Lookup = { titleOf: (id) => titles.get(id), reqOf: (id) => reqs.get(id) }
  const screenCount = model.sections.reduce((sum, section) => sum + section.screens.length, 0)
  const summary = `화면 ${screenCount}개 · 캡처 ${model.entryCount}개${
    requirements.length ? ` · 요구사항 연결 캡처 ${model.linkedEntryCount}개` : ''
  }`
  return `<div class="layout"><aside class="side">${renderFilters(model)}${renderToc(model.sections)}</aside>
<div class="body"><p class="summary">${summary}</p><p class="empty-result" hidden>검색 결과가 없습니다.</p>
${model.sections.map((section) => renderSection(section, lookup)).join('\n')}</div></div>`
}
