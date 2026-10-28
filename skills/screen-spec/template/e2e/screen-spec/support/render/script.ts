/** 브라우저에서 실행되는 스크립트. 외부 라이브러리 없이 동작한다. */
export const SCRIPT = `
(() => {
  const $ = (s, root = document) => root.querySelector(s);
  const $$ = (s, root = document) => [...root.querySelectorAll(s)];
  const cards = $$('.card');
  let focusList = [];
  let focusIndex = 0;

  function showView(name) {
    $$('.view').forEach((v) => { v.hidden = v.id !== 'view-' + name; });
    $$('.tab').forEach((t) => t.setAttribute('aria-selected', String(t.dataset.view === name)));
  }

  function applyFilters() {
    const q = ($('#search')?.value || '').trim().toLowerCase();
    const kinds = new Set($$('.kind-filter:checked').map((b) => b.value));
    cards.forEach((c) => { c.hidden = !kinds.has(c.dataset.kind) || (q && !c.dataset.search.includes(q)); });
    $$('.screen').forEach((s) => { s.hidden = $$('.card', s).every((c) => c.hidden); });
    $$('.sec').forEach((s) => { s.hidden = $$('.screen', s).every((c) => c.hidden); });
    const empty = $('.empty-result');
    if (empty) empty.hidden = cards.some((c) => !c.hidden);
  }

  function applyReqFilters() {
    const statuses = new Set($$('.status-filter:checked').map((b) => b.value));
    const linkedOnly = $('#linked-only')?.checked;
    $$('.req').forEach((r) => {
      r.hidden = !statuses.has(r.dataset.status) || (linkedOnly && r.dataset.linked !== 'true');
    });
  }

  function resetFilters() {
    const search = $('#search');
    if (search) search.value = '';
    $$('.kind-filter, .status-filter').forEach((b) => { b.checked = true; });
    const linked = $('#linked-only');
    if (linked) linked.checked = false;
    applyFilters();
    applyReqFilters();
  }

  function reveal(el) {
    if (el.closest('[hidden]') || el.hidden) resetFilters();
    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    el.classList.remove('flash');
    void el.offsetWidth;
    el.classList.add('flash');
  }

  function clearFocus() {
    cards.forEach((c) => c.classList.remove('focus'));
    focusList = [];
    $('.focusbar').hidden = true;
  }

  function moveFocus(step) {
    if (focusList.length === 0) return;
    focusIndex = (focusIndex + step + focusList.length) % focusList.length;
    $('.focusbar .pos').textContent = (focusIndex + 1) + ' / ' + focusList.length;
    reveal(focusList[focusIndex]);
  }

  function focusRequirement(reqId) {
    showView('screens');
    resetFilters();
    clearFocus();
    focusList = cards.filter((c) => c.dataset.reqs.split(' ').includes(reqId));
    focusList.forEach((c) => c.classList.add('focus'));
    const head = document.getElementById('req-' + reqId)?.querySelector('strong');
    $('.focusbar .label').textContent = head ? head.textContent : reqId;
    $('.focusbar').hidden = focusList.length === 0;
    focusIndex = -1;
    moveFocus(1);
  }

  function route() {
    let hash = location.hash.slice(1);
    try { hash = decodeURIComponent(hash); } catch (e) { /* 잘못된 인코딩은 그대로 쓴다 */ }
    if (hash.startsWith('impl:')) return focusRequirement(hash.slice(5));
    const target = hash && document.getElementById(hash);
    if (!target) return;
    const view = target.closest('.view');
    if (view) showView(view.id.replace('view-', ''));
    reveal(target);
  }

  $$('.tab').forEach((t) => t.addEventListener('click', () => { showView(t.dataset.view); history.replaceState(null, '', ' '); }));
  $('#search')?.addEventListener('input', applyFilters);
  $$('.kind-filter').forEach((b) => b.addEventListener('change', applyFilters));
  $$('.status-filter').forEach((b) => b.addEventListener('change', applyReqFilters));
  $('#linked-only')?.addEventListener('change', applyReqFilters);
  $('.focusbar .prev').addEventListener('click', () => moveFocus(-1));
  $('.focusbar .next').addEventListener('click', () => moveFocus(1));
  $('.focusbar .close').addEventListener('click', clearFocus);

  const box = $('.lightbox');
  $$('.zoom').forEach((z) => z.addEventListener('click', () => { $('img', box).src = z.dataset.src; box.hidden = false; }));
  box.addEventListener('click', () => { box.hidden = true; });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') { box.hidden = true; clearFocus(); } });

  window.addEventListener('hashchange', route);
  showView('screens');
  route();
})();
`
