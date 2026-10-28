import type { SpecModel } from '../model'
import { SPEC } from '../spec.config'
import { escapeHtml } from './escape'
import { renderRequirementsView } from './requirements'
import { renderScreensView } from './screens'
import { SCRIPT } from './script'
import { STYLE } from './style'

function renderTop(model: SpecModel): string {
  const hasReqs = model.requirements.length > 0
  const tabs = hasReqs
    ? `<nav class="tabs"><button class="tab" data-view="screens">화면</button><button class="tab" data-view="reqs">요구사항</button></nav>`
    : ''
  const badge =
    hasReqs && model.draft ? '<span class="badge">요구사항 연결은 AI 초안 — 검토 필요</span>' : ''
  const generated = new Date(model.generatedAt).toLocaleString(SPEC.locale, { timeZone: SPEC.timezoneId })
  return `<header class="top"><h1>${escapeHtml(model.title)}</h1>${tabs}${badge}<span class="gen">생성 ${escapeHtml(generated)}</span></header>`
}

export function renderPage(model: SpecModel): string {
  const reqView = model.requirements.length
    ? `<section class="view" id="view-reqs" hidden>${renderRequirementsView(model)}</section>`
    : ''
  return `<!doctype html>
<html lang="ko">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(model.title)}</title>
<style>${STYLE}</style>
</head>
<body>
${renderTop(model)}
<main>
<section class="view" id="view-screens">${renderScreensView(model, model.requirements)}</section>
${reqView}
</main>
<div class="focusbar" hidden><span class="label"></span><span class="pos"></span><button type="button" class="prev">이전</button><button type="button" class="next">다음</button><button type="button" class="close">닫기</button></div>
<div class="lightbox" hidden><img alt=""></div>
<script>${SCRIPT}</script>
</body>
</html>
`
}
