_BASE_CSS = """
*,*::before,*::after{box-sizing:border-box}
:root{
  --bg:#000;--panel:#0a0a0c;--panel-2:#121214;
  --ink:#fafafa;--muted:#9b9ba4;--faint:#6b6b73;
  --line:#1f1f22;--line-2:#2a2a2f;--guide:rgba(255,255,255,.12);
  --accent-ink:#050506;--r:6px;
  --sans:'Inter',-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;
  --mono:ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,'Liberation Mono','Courier New',monospace;
}
html{scroll-behavior:smooth}
body{margin:0;background:var(--bg);color:var(--ink);font-family:var(--sans);font-size:15px;line-height:1.6;-webkit-font-smoothing:antialiased}
a{color:inherit;text-decoration:none}
::selection{background:color-mix(in srgb,var(--accent) 38%,transparent)}
*::-webkit-scrollbar{width:9px;height:9px}
*::-webkit-scrollbar-thumb{background:var(--line-2);border-radius:6px}

.topbar{position:sticky;top:0;z-index:50;height:54px;display:flex;align-items:center;gap:14px;padding:0 20px;
  background:color-mix(in srgb,var(--bg) 78%,transparent);backdrop-filter:blur(10px);border-bottom:1px solid var(--line)}
.brand{display:flex;align-items:center;gap:9px;font-family:var(--mono);font-weight:600;letter-spacing:-.01em;font-size:14.5px}
.brand .glyph{display:grid;place-items:center;width:24px;height:24px;border-radius:var(--r);background:var(--accent);color:var(--accent-ink);font-size:13px;font-weight:800;text-transform:uppercase}
.brand .glyph svg{width:15px;height:15px}
.brand .sub{color:var(--faint);font-weight:500}
.topnav{margin-left:auto;display:flex;align-items:center;gap:2px}
.topnav a{padding:6px 11px;border-radius:var(--r);color:var(--muted);font-size:13px;font-weight:500;transition:.15s}
.topnav a:hover{color:var(--ink);background:var(--panel-2)}
.topnav a.cta{color:var(--accent-ink);background:var(--accent);font-weight:600}
.topnav a.cta:hover{filter:brightness(1.08)}
.topnav a.icon{display:grid;place-items:center;width:32px;height:32px;padding:0;color:var(--muted);border:1px solid var(--line);border-radius:var(--r)}
.topnav a.icon:hover{color:var(--ink);background:var(--panel-2);border-color:var(--line-2)}
.topnav a.icon svg{width:16px;height:16px}
.topnav a.ct-link{display:inline-flex;align-items:center;gap:6px}.topnav a.ct-link svg{width:13px;height:13px;flex:none}

.wrap{display:grid;grid-template-columns:262px minmax(0,1fr) 224px;max-width:1480px;margin:0 auto}
aside.side{position:sticky;top:54px;align-self:start;height:calc(100vh - 54px);overflow:auto;padding:22px 14px 48px;border-right:1px solid var(--line)}
.search{display:flex;align-items:center;gap:8px;width:100%;padding:8px 10px;border:1px solid var(--line);border-radius:var(--r);background:var(--panel);color:var(--faint);font-size:13px;margin-bottom:20px}
.search svg{flex:none;opacity:.7}
.search input{border:0;background:transparent;color:var(--ink);font-family:var(--sans);font-size:13px;width:100%;outline:none}
.search kbd{font-family:var(--mono);font-size:11px;color:var(--faint);border:1px solid var(--line);border-radius:4px;padding:1px 5px}
.navgroup{margin-bottom:20px}
.navgroup h4{margin:0 0 6px;padding:0 8px;font-size:11px;font-weight:600;letter-spacing:.13em;text-transform:uppercase;color:var(--faint)}
.navgroup a{display:block;padding:6px 10px;border-radius:var(--r);color:var(--muted);font-size:13.5px;transition:.12s;outline:none;-webkit-tap-highlight-color:transparent}
.navgroup a:focus,.navgroup a:focus-visible{outline:none;box-shadow:none}
.navgroup a:hover{color:var(--ink);background:var(--panel-2)}
.navgroup a.active{color:var(--ink);background:color-mix(in srgb,var(--accent) 13%,transparent)}

main.doc{min-width:0;padding:42px 52px 96px}
.eyebrow{color:var(--accent);font-family:var(--mono);font-size:12px;letter-spacing:.15em;text-transform:uppercase;margin-bottom:13px}
h1.title{font-size:clamp(32px,4.4vw,46px);line-height:1.05;letter-spacing:-.025em;margin:0 0 16px;font-weight:700}
.lede{color:var(--muted);font-size:17px;line-height:1.7;max-width:660px;margin:0 0 4px}
.metarow{display:flex;flex-wrap:wrap;gap:7px;margin:22px 0 6px}
.chip{font-family:var(--mono);font-size:12px;color:var(--muted);border:1px solid var(--line);border-radius:var(--r);padding:4px 10px;background:var(--panel)}

.steps{position:relative;margin-top:10px;padding-left:34px;border-left:1px dashed var(--guide)}
.section{padding-top:48px;scroll-margin-top:78px}
.section-head{position:relative;display:flex;align-items:center;gap:13px;margin-bottom:14px}
.step{position:absolute;left:-49px;top:-2px;display:grid;place-items:center;width:30px;height:30px;border-radius:var(--r);
  background:var(--bg);border:1px solid var(--line-2);color:var(--ink);font-family:var(--mono);font-weight:600;font-size:13.5px}
.section-head h2{margin:0;font-size:21px;letter-spacing:-.02em;font-weight:650}
.section p{color:var(--muted);max-width:660px;margin:0 0 4px}
.section a.link{color:var(--accent);border-bottom:1px solid color-mix(in srgb,var(--accent) 45%,transparent)}

.code{position:relative;border:1px solid var(--line);border-radius:var(--r);background:var(--panel);overflow:hidden;margin:16px 0;max-width:740px}
.code::before{content:"";position:absolute;left:0;top:10px;bottom:10px;width:2px;border-radius:2px;background:var(--accent);z-index:1}
.code .cap{display:flex;align-items:center;gap:8px;padding:9px 13px;border-bottom:1px solid var(--line);font-family:var(--mono);font-size:12px;color:var(--muted)}
.code .cap .dot{width:8px;height:8px;border-radius:50%;background:var(--accent);opacity:.85}
.code .copy{margin-left:auto;cursor:pointer;color:var(--faint);font-size:11px;font-family:var(--mono);border:1px solid var(--line);border-radius:5px;padding:3px 8px;background:transparent}
.code .copy:hover{color:var(--ink);border-color:var(--line-2)}
.code pre{margin:0;padding:15px 16px;overflow:auto;font-family:var(--mono);font-size:13px;line-height:1.7;color:#d6d6dc}
.code.small pre{font-size:12.5px;max-height:360px}
.code .cmt{color:var(--faint)}

.callout{position:relative;display:flex;gap:11px;border:1px solid var(--line);border-radius:var(--r);background:color-mix(in srgb,var(--accent) 6%,var(--panel));padding:13px 15px 13px 18px;margin:16px 0;max-width:740px}
.callout::before{content:"";position:absolute;left:0;top:10px;bottom:10px;width:2px;border-radius:2px;background:var(--accent)}
.callout .ic{flex:none;color:var(--accent);font-weight:700;font-family:var(--mono)}
.callout .t{color:var(--accent);font-weight:600;font-size:13px}
.callout p{margin:3px 0 0;color:var(--muted);font-size:14px}
.callout b{color:var(--ink)}

.eps{display:grid;gap:8px;margin:16px 0;max-width:760px}
.ep{position:relative;border:1px solid var(--line);border-radius:var(--r);background:var(--panel);overflow:hidden;transition:border-color .15s}
.ep.open{border-color:color-mix(in srgb,var(--accent) 28%,var(--line))}
.ep.open::before{content:"";position:absolute;left:0;top:10px;bottom:10px;width:2px;border-radius:2px;background:var(--accent);z-index:3}
.ep-head{display:flex;align-items:center;gap:13px;width:100%;text-align:left;background:transparent;border:0;color:inherit;cursor:pointer;padding:12px 14px;font:inherit}
.ep-head:hover{background:var(--panel-2)}
.ep.open .ep-head{background:var(--panel-2)}
.ep .verb{font-family:var(--mono);font-weight:700;font-size:11px;letter-spacing:.04em;color:var(--accent-ink);background:var(--accent);border-radius:4px;padding:3px 8px}
.ep-path{font-family:var(--mono);font-size:13.5px;color:var(--ink)}
.ep-desc{margin-left:auto;color:var(--muted);font-size:13px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:42%}
.chev{flex:none;color:var(--faint);font-family:var(--mono);transition:.2s;transform:rotate(0)}
.ep.open .chev{transform:rotate(90deg);color:var(--accent)}
.ep-body{display:none;padding:2px 15px 16px;border-top:1px solid var(--line)}
.ep.open .ep-body{display:block}
.ep-sub{font-size:11px;text-transform:uppercase;letter-spacing:.12em;color:var(--faint);margin:15px 0 8px;font-weight:600}
.ep-note{color:var(--muted);font-size:13px;margin:4px 0}
.ptable{width:100%;border-collapse:collapse;font-size:13px}
.ptable th{text-align:left;color:var(--faint);font-weight:500;font-size:11px;text-transform:uppercase;letter-spacing:.07em;padding:6px 10px;border-bottom:1px solid var(--line)}
.ptable td{padding:8px 10px;border-bottom:1px solid var(--line);color:var(--muted);vertical-align:top}
.ptable tr:last-child td{border-bottom:0}
.ptable td code{font-family:var(--mono);color:var(--ink)}
.req{font-family:var(--mono);font-size:11px;color:var(--accent)}.opt{font-family:var(--mono);font-size:11px;color:var(--faint)}

code.ic{font-family:var(--mono);font-size:.86em;background:var(--panel-2);border:1px solid var(--line);border-radius:4px;padding:1px 5px;color:var(--ink)}

.foot{margin-top:56px;padding-top:22px;border-top:1px solid var(--line);display:flex;flex-wrap:wrap;gap:14px;justify-content:space-between;color:var(--faint);font-size:13px}
.foot a{color:var(--muted)}.foot a:hover{color:var(--ink)}

aside.toc{position:sticky;top:54px;align-self:start;height:calc(100vh - 54px);overflow:auto;padding:44px 22px}
.toc h5{margin:0 0 13px;font-size:11px;font-weight:600;letter-spacing:.13em;text-transform:uppercase;color:var(--faint)}
.toc a{display:block;padding:6px 0 6px 13px;border-left:1px solid var(--line);color:var(--faint);font-size:13px;transition:.12s}
.toc a:hover{color:var(--ink)}
.toc a.active{color:var(--accent);border-left-color:var(--accent)}

.menu-btn{display:none}
@media(max-width:1180px){.wrap{grid-template-columns:262px minmax(0,1fr)}aside.toc{display:none}}
@media(max-width:860px){
  .wrap{grid-template-columns:1fr}
  aside.side{position:fixed;left:0;top:54px;width:280px;background:var(--bg);z-index:40;transform:translateX(-102%);transition:.2s}
  aside.side.open{transform:none}
  main.doc{padding:30px 20px 80px}
  .steps{padding-left:0;border-left:0}
  .step{position:static;left:auto;top:auto}
  .menu-btn{display:inline-grid;place-items:center;width:32px;height:32px;border:1px solid var(--line);border-radius:var(--r);background:var(--panel);color:var(--ink);cursor:pointer;font-size:16px}
  h1.title{font-size:32px}
  .ep-desc{display:none}
}
"""

_PLAYGROUND_CSS = """
.pg-main{max-width:760px;margin:0 auto;padding:56px 24px 110px}
.pg-eyebrow{text-align:center;color:var(--accent);font-family:var(--mono);font-size:12px;letter-spacing:.15em;text-transform:uppercase;margin-bottom:14px;animation:pg-fade-up .5s ease both}
.pg-h1{text-align:center;font-family:var(--mono);font-size:clamp(26px,4vw,38px);letter-spacing:-.02em;margin:0 0 14px;animation:pg-fade-up .5s .05s ease both}
.pg-sub{text-align:center;color:var(--muted);font-size:15px;line-height:1.65;max-width:600px;margin:0 auto 36px;animation:pg-fade-up .5s .1s ease both}

@keyframes pg-fade-up{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:translateY(0)}}
@keyframes pg-spin{to{transform:rotate(360deg)}}
@keyframes pg-pulse-bar{0%,100%{opacity:1}50%{opacity:.3}}
@keyframes pg-shimmer{0%{background-position:-220px 0}100%{background-position:220px 0}}
@keyframes pg-shake{10%,90%{transform:translateX(-1px)}20%,80%{transform:translateX(2px)}30%,50%,70%{transform:translateX(-4px)}40%,60%{transform:translateX(4px)}}
@keyframes pg-ring{0%{box-shadow:0 0 0 0 color-mix(in srgb,var(--accent) 45%,transparent)}100%{box-shadow:0 0 0 9px transparent}}

.pg-bar{position:sticky;top:66px;z-index:10;background:color-mix(in srgb,var(--panel) 92%,transparent);backdrop-filter:blur(10px);border:1px solid var(--line);border-radius:12px;padding:18px 20px;margin-bottom:32px;animation:pg-fade-up .5s .15s ease both;transition:border-color .2s,box-shadow .2s}
.pg-bar:focus-within{border-color:color-mix(in srgb,var(--accent) 50%,var(--line));box-shadow:0 0 0 3px color-mix(in srgb,var(--accent) 12%,transparent)}
.pg-bar-row{display:flex;gap:10px;align-items:flex-start}
.pg-input-wrap{position:relative;flex:1;min-width:0}
.pg-input-icon{position:absolute;left:13px;top:50%;transform:translateY(-50%);color:var(--faint);display:flex;pointer-events:none;transition:color .15s}
.pg-input-wrap:focus-within .pg-input-icon{color:var(--accent)}
.pg-input{width:100%;background:var(--bg);border:1px solid var(--line-2);border-radius:var(--r);padding:11px 34px 11px 38px;color:var(--ink);font-family:var(--mono);font-size:14px;outline:none;transition:border-color .15s,box-shadow .15s}
.pg-input:focus{border-color:var(--accent);box-shadow:0 0 0 3px color-mix(in srgb,var(--accent) 16%,transparent)}
.pg-input.shake{animation:pg-shake .4s ease}
.pg-input-clear{position:absolute;right:6px;top:50%;transform:translateY(-50%);width:22px;height:22px;display:none;align-items:center;justify-content:center;border:0;border-radius:50%;background:transparent;color:var(--faint);font-size:16px;line-height:1;cursor:pointer;transition:.15s}
.pg-input-clear:hover{background:var(--line);color:var(--ink)}
.pg-input-wrap.has-value .pg-input-clear{display:flex}
.pg-btn{position:relative;display:flex;align-items:center;justify-content:center;gap:7px;background:var(--accent);color:var(--accent-ink);border:0;border-radius:var(--r);padding:0 18px;font-weight:700;font-family:var(--mono);cursor:pointer;font-size:14px;white-space:nowrap;transition:filter .15s,transform .08s}
.pg-btn:hover{filter:brightness(1.08)}
.pg-btn:active{transform:scale(.97)}
.pg-btn:disabled{opacity:.7;cursor:default;transform:none}
.pg-runall{flex:none;min-width:118px;height:42px}
.pg-hint{margin:12px 2px 0;color:var(--faint);font-size:12.5px;line-height:1.6}

.pg-progress{height:3px;border-radius:3px;background:var(--line);overflow:hidden;margin:14px 2px 0;max-height:0;opacity:0;transition:max-height .2s ease,opacity .2s ease,margin .2s ease}
.pg-progress.active{max-height:3px;opacity:1}
.pg-progress-bar{height:100%;width:0%;background:var(--accent);border-radius:3px;transition:width .3s ease}

.pg-recent{position:absolute;top:calc(100% + 8px);left:0;right:0;background:var(--panel-2);border:1px solid var(--line-2);border-radius:var(--r);padding:6px;z-index:20;max-height:230px;overflow:auto;box-shadow:0 12px 28px rgba(0,0,0,.45);opacity:0;transform:translateY(-6px) scale(.98);pointer-events:none;transition:opacity .15s ease,transform .15s ease}
.pg-recent.open{opacity:1;transform:translateY(0) scale(1);pointer-events:auto}
.pg-recent-head{display:flex;justify-content:space-between;align-items:center;padding:6px 8px;font-size:11px;text-transform:uppercase;letter-spacing:.1em;color:var(--faint)}
.pg-recent-head button{background:none;border:0;color:var(--faint);cursor:pointer;font-size:12px;font-family:var(--sans)}
.pg-recent-head button:hover{color:var(--ink)}
.pg-recent-item{display:block;width:100%;text-align:left;background:none;border:0;color:var(--muted);font-family:var(--mono);padding:8px;border-radius:6px;cursor:pointer;font-size:13.5px;transition:background .1s}
.pg-recent-item:hover{background:var(--line);color:var(--ink)}

.pg-group-label{display:flex;align-items:center;justify-content:space-between;gap:10px;margin:8px 0 12px;font-size:11px;font-weight:600;letter-spacing:.12em;text-transform:uppercase;color:var(--faint)}
.pg-legacy-toggle{display:flex;align-items:center;gap:6px;background:none;border:0;color:var(--faint);font-size:11px;font-weight:600;letter-spacing:.12em;text-transform:uppercase;cursor:pointer;padding:0;font-family:inherit}
.pg-legacy-toggle:hover{color:var(--ink)}
.pg-legacy-toggle .chev{position:static}
.pg-legacy-toggle[aria-expanded="true"] .chev{transform:rotate(90deg);color:var(--accent)}
.pg-legacy-list{display:none}
.pg-legacy-list.open{display:grid}

.pg-canonical-list{animation:pg-fade-up .4s .2s ease both}

.pg-row{flex-wrap:wrap}
.pg-status{flex:none;display:inline-flex;align-items:center;gap:5px;font-family:var(--mono);font-size:11px;color:var(--faint);border:1px solid var(--line);border-radius:5px;padding:3px 8px;white-space:nowrap;transition:color .15s,border-color .15s}
.pg-status.ok{color:#3fb950;border-color:color-mix(in srgb,#3fb950 45%,var(--line))}
.pg-status.err{color:#f85149;border-color:color-mix(in srgb,#f85149 45%,var(--line))}
.pg-status.busy{color:var(--accent);border-color:color-mix(in srgb,var(--accent) 35%,var(--line))}
.pg-run-btn{position:relative;flex:none;display:inline-flex;align-items:center;justify-content:center;gap:6px;min-width:46px;background:var(--accent);color:var(--accent-ink);border:0;border-radius:5px;padding:5px 12px;font-weight:700;font-family:var(--mono);font-size:12px;cursor:pointer;transition:filter .15s,transform .08s}
.pg-run-btn:hover{filter:brightness(1.08)}
.pg-run-btn:active{transform:scale(.95)}
.pg-run-btn:disabled{opacity:.7;cursor:default;transform:none}
.ep[data-path]{transition:border-color .15s,transform .15s,box-shadow .15s}
.ep[data-path]:hover{transform:translateY(-1px);box-shadow:0 6px 18px rgba(0,0,0,.28)}
.ep.ok::before{background:#3fb950}
.ep.err::before{background:#f85149}
.ep.busy::before{background:var(--accent);animation:pg-pulse-bar 1s ease-in-out infinite}
.ep.ok{animation:pg-ring .5s ease}

.pg-spinner{width:13px;height:13px;flex:none;border-radius:50%;border:2px solid color-mix(in srgb,currentColor 25%,transparent);border-top-color:currentColor;animation:pg-spin .7s linear infinite}
.pg-run-btn .pg-spinner{width:11px;height:11px}

.pg-placeholder{color:var(--faint)}
.pg-ep-loading{padding:4px 0 12px}
.pg-ep-loading .req{color:var(--faint);font-family:var(--mono);font-size:12px;margin:0 0 10px;display:flex;align-items:center;gap:7px}
.pg-skel{height:11px;border-radius:4px;margin:8px 0;background:linear-gradient(90deg,var(--line) 25%,var(--line-2) 50%,var(--line) 75%);background-size:440px 100%;animation:pg-shimmer 1.3s linear infinite}
.pg-skel.w90{width:90%}.pg-skel.w70{width:70%}.pg-skel.w50{width:50%}.pg-skel.w35{width:35%}
.pg-ep-meta{display:flex;align-items:center;gap:8px;margin:10px 0 8px;animation:pg-fade-up .3s ease both}
.pg-ep-meta .url{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;flex:1;font-family:var(--mono);font-size:11.5px;color:var(--muted)}
.pg-copy{flex:none;cursor:pointer;color:var(--faint);font-size:11px;font-family:var(--mono);border:1px solid var(--line);border-radius:5px;padding:3px 8px;background:transparent;transition:.15s}
.pg-copy:hover{color:var(--ink);border-color:var(--line-2)}
.pg-ep-resp{margin:0;padding:12px 14px;overflow:auto;max-height:420px;font-family:var(--mono);font-size:12.5px;line-height:1.7;color:#d6d6dc;background:var(--bg);border:1px solid var(--line);border-radius:var(--r)}

.pg-tabs{display:flex;gap:6px;margin:2px 0 14px;animation:pg-fade-up .3s ease both}
.pg-tab-btn{background:none;border:1px solid var(--line);color:var(--muted);font-family:var(--mono);font-size:11.5px;padding:5px 12px;border-radius:5px;cursor:pointer;transition:.15s}
.pg-tab-btn:hover{color:var(--ink)}
.pg-tab-btn.active{background:var(--panel-2);color:var(--ink);border-color:var(--line-2)}
.pg-view[hidden]{display:none}
.pg-view{animation:pg-fade-up .25s ease both}

.pg-cards{display:grid;grid-template-columns:repeat(auto-fill,minmax(130px,1fr));gap:10px;margin:2px 0}
.pg-card{background:var(--bg);border:1px solid var(--line);border-radius:var(--r);padding:11px 13px}
.pg-card-lbl{font-size:10px;letter-spacing:.08em;text-transform:uppercase;color:var(--faint);margin-bottom:6px;font-family:var(--mono)}
.pg-card-val{font-size:14px;font-weight:600;color:var(--ink);font-family:var(--mono);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}

.pg-section{margin:18px 0 4px}
.pg-section-lbl{font-size:11px;text-transform:uppercase;letter-spacing:.1em;color:var(--faint);font-family:var(--mono);margin:0 0 8px}

.pg-table-wrap{overflow:auto;border:1px solid var(--line);border-radius:var(--r);max-height:360px}
.pg-table{width:100%;border-collapse:collapse;font-size:12.5px}
.pg-table th{position:sticky;top:0;text-align:left;color:var(--faint);font-weight:500;font-size:10.5px;text-transform:uppercase;letter-spacing:.05em;padding:8px 10px;border-bottom:1px solid var(--line);background:var(--panel-2);white-space:nowrap}
.pg-table td{padding:7px 10px;border-bottom:1px solid var(--line);color:var(--muted);font-family:var(--mono);white-space:nowrap;max-width:240px;overflow:hidden;text-overflow:ellipsis}
.pg-table tr:last-child td{border-bottom:0}
.pg-table-note{color:var(--faint);font-size:11.5px;margin:6px 2px 0}

.pg-chips{display:flex;flex-wrap:wrap;gap:6px}
.pg-chip{font-family:var(--mono);font-size:12px;color:var(--muted);border:1px solid var(--line);border-radius:5px;padding:3px 9px;background:var(--bg)}
.pg-empty{color:var(--faint);font-size:12.5px;margin:4px 0}

.pg-foot-note{text-align:center;color:var(--faint);font-size:13px;margin-top:40px}

@media(max-width:640px){
  .pg-bar-row{flex-direction:column}
  .pg-runall{width:100%;justify-content:center}
  .pg-svg-controls{flex-direction:column;align-items:stretch}
  .pg-svg-controls .pg-btn{width:100%;justify-content:center}
}

.pg-svg-controls{display:flex;flex-wrap:wrap;gap:10px;align-items:flex-end;margin-bottom:14px}
.pg-svg-field{display:flex;flex-direction:column;gap:5px;min-width:120px;flex:1}
.pg-svg-field label{font-size:10.5px;letter-spacing:.08em;text-transform:uppercase;color:var(--faint);font-family:var(--mono)}
.pg-svg-field input,.pg-svg-field select{background:var(--bg);border:1px solid var(--line-2);border-radius:var(--r);padding:9px 11px;color:var(--ink);font-family:var(--mono);font-size:13px;outline:none}
.pg-svg-field input:focus,.pg-svg-field select:focus{border-color:var(--accent);box-shadow:0 0 0 3px color-mix(in srgb,var(--accent) 16%,transparent)}
.pg-ep-svg{display:flex;justify-content:center;padding:12px;background:var(--bg);border:1px solid var(--line);border-radius:var(--r)}
.pg-ep-svg img{max-width:100%;height:auto}
.pg-ep-qparams{margin:0 0 12px;padding:12px;border:1px solid var(--line);border-radius:var(--r);background:var(--panel-2)}
.pg-ep-qparams-lbl{font-size:10.5px;letter-spacing:.1em;text-transform:uppercase;color:var(--faint);font-family:var(--mono);margin:0 0 10px}
.pg-ep-qhint{margin:10px 0 0;color:var(--faint);font-size:12px;line-height:1.55}
.pg-ep-qhint .ic{font-size:11px}

"""

_JS = """
document.querySelectorAll('[data-origin]').forEach(function(el){var o=location.origin;el.textContent=(o&&o!=='null')?o:'https://your-host'});
document.querySelectorAll('.copy').forEach(function(b){b.addEventListener('click',function(e){
  e.stopPropagation();
  var pre=b.closest('.code').querySelector('pre');
  navigator.clipboard.writeText(pre.innerText).then(function(){var t=b.textContent;b.textContent='Copied';setTimeout(function(){b.textContent=t},1200)});
})});
document.querySelectorAll('.ep-head').forEach(function(h){h.addEventListener('click',function(){
  var ep=h.parentElement,open=ep.classList.toggle('open');
  h.setAttribute('aria-expanded',open?'true':'false');
})});
var mb=document.querySelector('.menu-btn'),sb=document.querySelector('.side');
if(mb)mb.addEventListener('click',function(){sb.classList.toggle('open')});
var toc={},nav={};
document.querySelectorAll('[data-toc]').forEach(function(a){toc[a.getAttribute('href').slice(1)]=a});
document.querySelectorAll('[data-nav]').forEach(function(a){nav[a.getAttribute('href').slice(1)]=a});
var io=new IntersectionObserver(function(es){es.forEach(function(e){if(e.isIntersecting){
  var id=e.target.id;
  Object.keys(toc).forEach(function(k){toc[k].classList.remove('active')});
  Object.keys(nav).forEach(function(k){nav[k].classList.remove('active')});
  if(toc[id])toc[id].classList.add('active');
  if(nav[id])nav[id].classList.add('active');
}})},{rootMargin:'-12% 0px -75% 0px'});
document.querySelectorAll('.section').forEach(function(s){io.observe(s)});
var si=document.querySelector('.search input');
if(si)si.addEventListener('input',function(){var q=si.value.toLowerCase();
  document.querySelectorAll('.navgroup a').forEach(function(a){a.style.display=a.textContent.toLowerCase().indexOf(q)>-1?'':'none'});
});
function playgroundPath(){
  var base = window.location.pathname.replace(new RegExp('/(docs|redoc)/?$'), '').replace(new RegExp('/$'), '');
  return (base || '') + '/playground';
}
document.querySelectorAll('a[href="/playground"]').forEach(function(a){
  var href = playgroundPath();
  a.setAttribute('href', href);
  a.addEventListener('click', function(e){ e.preventDefault(); window.location.assign(href); });
});
"""
