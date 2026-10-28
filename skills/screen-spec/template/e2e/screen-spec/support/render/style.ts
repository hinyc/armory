export const STYLE = `
:root{--bg:#f7f7f5;--panel:#fff;--text:#1d1d1b;--muted:#6b6b66;--line:#e2e1dc;--accent:#2f5bd3;
--ok:#1f8a4c;--warn:#b7791f;--plan:#6b5bd3;--na:#8a8a85;--hi:#fff4c2;font-family:system-ui,-apple-system,"Apple SD Gothic Neo","Noto Sans KR",sans-serif}
@media (prefers-color-scheme:dark){:root{--bg:#161615;--panel:#1f1f1d;--text:#ecebe6;--muted:#a3a29c;--line:#34342f;
--accent:#7c9cf5;--ok:#4cc483;--warn:#e0a84a;--plan:#a99cf5;--na:#8a8a85;--hi:#4a3f12}}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--text);font-size:14px;line-height:1.6}
a{color:var(--accent)}code{font-size:12px;background:var(--bg);padding:1px 5px;border-radius:4px}
.top{position:sticky;top:0;z-index:5;display:flex;flex-wrap:wrap;gap:12px;align-items:center;padding:10px 20px;background:var(--panel);border-bottom:1px solid var(--line)}
.top h1{font-size:17px;margin:0 12px 0 0}.tabs{display:flex;gap:4px}
.tab{border:1px solid var(--line);background:none;color:var(--text);padding:5px 14px;border-radius:6px;cursor:pointer;font:inherit}
.tab[aria-selected=true]{background:var(--accent);border-color:var(--accent);color:#fff}
.badge{background:var(--warn);color:#fff;border-radius:999px;padding:2px 10px;font-size:12px}
.gen{margin-left:auto;color:var(--muted);font-size:12px}
.layout{display:grid;grid-template-columns:260px 1fr;gap:20px;padding:20px}
.side{position:sticky;top:64px;align-self:start;max-height:calc(100vh - 84px);overflow:auto}
#search{width:100%;padding:7px 10px;border:1px solid var(--line);border-radius:6px;background:var(--panel);color:var(--text);font:inherit}
.kinds{display:flex;flex-wrap:wrap;gap:4px 12px;margin:10px 0;font-size:13px}
.count{color:var(--muted);font-size:12px}
.toc,.toc ul{list-style:none;padding-left:0;margin:0}.toc ul{padding-left:14px;margin-bottom:6px}
.toc a{text-decoration:none;color:var(--text)}.toc>li>a{font-weight:600}
.summary{color:var(--muted);margin-top:0}
.sec h2{font-size:20px;border-bottom:2px solid var(--line);padding-bottom:6px}
.screen h3{font-size:16px;margin:24px 0 10px}.route{margin-left:6px}
.num{color:var(--muted);font-variant-numeric:tabular-nums;margin-right:6px}
.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(520px,1fr));gap:16px}
.card{background:var(--panel);border:1px solid var(--line);border-radius:10px;padding:14px;transition:box-shadow .2s}
.card header{display:flex;gap:8px;align-items:baseline}.card h4{margin:0;font-size:15px}
.kind{font-size:11px;border-radius:4px;padding:1px 6px;background:var(--bg);border:1px solid var(--line)}
.shot{position:relative;margin:10px 0}.zoom{all:unset;cursor:zoom-in;display:block}
.shot img{display:block;width:100%;border:1px solid var(--line);border-radius:6px}
.native{position:absolute;inset:0;display:flex;align-items:flex-start;justify-content:center;padding-top:6%;pointer-events:none}
.native-box{background:#fff;color:#222;border-radius:8px;box-shadow:0 6px 24px rgba(0,0,0,.35);padding:12px 16px;min-width:40%;max-width:80%;font-size:13px}
.native-box p{margin:0 0 8px;white-space:pre-wrap}.native-box span{float:right;margin-left:6px;background:#2f5bd3;color:#fff;border-radius:4px;padding:2px 12px}
.native-box span.cancel{background:#e4e4e0;color:#222}
.desc p{margin:0 0 8px}.chips{display:flex;flex-wrap:wrap;gap:6px;margin:8px 0}
.chip,.pill{font-size:12px;border-radius:999px;padding:1px 9px;text-decoration:none;color:#fff;background:var(--na)}
.st-implemented{background:var(--ok)}.st-partial{background:var(--warn)}.st-planned{background:var(--plan)}
.st-notApplicable,.st-unclassified{background:var(--na)}
.meta{font-size:12px;color:var(--muted)}.meta ul{margin:4px 0;padding-left:18px}
.card.focus{box-shadow:0 0 0 3px var(--accent)}.card.flash,.req.flash{animation:flash 1.2s}
@keyframes flash{from{background:var(--hi)}}
.reqs-wrap{padding:20px;max-width:1100px}
.req{background:var(--panel);border:1px solid var(--line);border-radius:8px;padding:10px 14px;margin:0 0 8px calc(var(--depth) * 24px)}
.req-head{display:flex;gap:8px;align-items:baseline}.req-head .pill{margin-left:auto}
.req details p,.note{color:var(--muted);white-space:pre-wrap}.caps{margin:4px 0;padding-left:18px}
.why{color:var(--muted);font-size:12px}.no-cap{color:var(--muted);font-size:12px;margin:4px 0}
.focusbar{position:fixed;bottom:16px;left:50%;transform:translateX(-50%);z-index:6;display:flex;gap:10px;align-items:center;background:var(--panel);border:1px solid var(--line);border-radius:999px;padding:6px 14px;box-shadow:0 4px 16px rgba(0,0,0,.15)}
.focusbar button{font:inherit;border:1px solid var(--line);background:none;color:var(--text);border-radius:6px;cursor:pointer}
.lightbox{position:fixed;inset:0;z-index:9;background:rgba(0,0,0,.8);display:flex;align-items:center;justify-content:center;cursor:zoom-out}
.lightbox img{max-width:95vw;max-height:95vh}
[hidden]{display:none!important}
@media (max-width:900px){.layout{grid-template-columns:1fr}.side{position:static;max-height:none}.grid{grid-template-columns:1fr}}
@media print{.top,.side,.focusbar{display:none}.layout{display:block}.grid{grid-template-columns:1fr}.card{break-inside:avoid}}
`
