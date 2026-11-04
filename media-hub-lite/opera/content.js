const api = typeof browser !== "undefined" ? browser : chrome; // Firefox expõe "browser"; Opera/Chromium expõem "chrome"
// Roda dentro de Letterboxd/Backloggd/Skoob: (1) descobre seu perfil sozinho, (2) preenche a review armada.
// Heurísticas escritas sem ver o HTML real dos sites; ajuste os blocos marcados se algo falhar.
const SITE = location.host.includes("letterboxd") ? "letterboxd"
  : location.host.includes("backloggd") ? "backloggd" : "skoob";

// ---- (1) detectar perfil logado ----
const PROFILE_RULE = {
  letterboxd: (a) => /^(profile|perfil)$/i.test(a.textContent.trim()) && /^\/[^/]+\/$/.test(a.pathname),
  backloggd: (a) => /^\/u\/[^/]+\/?$/.test(a.pathname),
  skoob: (a) => /\/user\/[0-9a-f]{24}/i.test(a.pathname),
};
async function detectProfile() {
  const scopes = [...document.querySelectorAll("header, nav, #header, .navbar, [class*=nav]")];
  for (const scope of scopes) {
    const a = [...scope.querySelectorAll("a[href]")].find(PROFILE_RULE[SITE]);
    if (a) {
      const url = new URL(a.href, location.href);
      const { profiles = {} } = await api.storage.local.get("profiles");
      const sid = SITE === "skoob" && url.pathname.match(/\/user\/([0-9a-f]{24})/i)?.[1];
      const clean = sid ? `${url.origin}/pt/user/${sid}` : url.origin + url.pathname;
      if (profiles[SITE] !== clean) { profiles[SITE] = clean; await api.storage.local.set({ profiles }); }
      return;
    }
  }
}
detectProfile();
setTimeout(detectProfile, 2500); // páginas que montam o menu depois

// ---- (2) preencher review ----
const OPEN_FORM_TEXT = /review or log|avaliar|escrever (uma )?resenha|write a review|review/i; // botão que abre o formulário

function setNativeValue(el, value) {
  const proto = el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
  Object.getOwnPropertyDescriptor(proto, "value").set.call(el, value); // funciona com campos React
  el.dispatchEvent(new Event("input", { bubbles: true }));
  el.dispatchEvent(new Event("change", { bubbles: true }));
}
const visibleTextarea = () => [...document.querySelectorAll("textarea")].find((t) => t.offsetParent !== null && !t.disabled);

async function updateReview(id, patch) {
  const { reviews = [] } = await api.storage.local.get("reviews");
  await api.storage.local.set({ reviews: reviews.map((r) => (r.id === id ? { ...r, ...patch } : r)) });
}

function banner(r) {
  const box = document.createElement("div");
  box.style.cssText = "position:fixed;top:12px;right:12px;z-index:2147483647;max-width:300px;padding:12px;border-radius:12px;" +
    "background:#111;color:#fff;font:13px system-ui;box-shadow:0 6px 24px #0008";
  const info = document.createElement("div");
  info.style.margin = "4px 0 8px";
  info.textContent = `${r.title} — nota ${r.rating}★ (marque você mesmo)`;
  const head = document.createElement("b"); head.textContent = "Media Hub";
  const row = document.createElement("div"); row.style.cssText = "display:flex;gap:6px;flex-wrap:wrap";
  const btn = (label, fn) => {
    const b = document.createElement("button"); b.textContent = label;
    b.style.cssText = "padding:4px 8px;border-radius:8px;border:0;cursor:pointer;background:#10b981;color:#fff";
    b.onclick = fn; row.append(b);
  };
  btn("Abrir formulário", () => [...document.querySelectorAll("button,a")]
    .find((e) => e.offsetParent !== null && OPEN_FORM_TEXT.test((e.textContent || "").trim()))?.click());
  btn("Preencher texto", () => { const t = visibleTextarea(); if (t) setNativeValue(t, r.text); });
  btn("Copiar texto", () => navigator.clipboard.writeText(r.text));
  btn("Marcar publicado", async () => { await updateReview(r.id, { status: "published" }); await api.storage.local.remove("armed"); box.remove(); });
  btn("✕", async () => { await api.storage.local.remove("armed"); box.remove(); });
  box.append(head, info, row);
  document.body.append(box);
}

(async function armed() {
  const { armed: id, reviews = [] } = await api.storage.local.get(["armed", "reviews"]);
  const r = reviews.find((x) => x.id === id);
  if (!r || r.platform !== SITE) return;
  banner(r);
  let tries = 0;
  const t = setInterval(() => {
    const ta = visibleTextarea();
    if (ta && !ta.value) { setNativeValue(ta, r.text); clearInterval(t); }
    else if (++tries > 30) clearInterval(t);
  }, 500);
})();


// ---- (3) Skoob (app novo em Next.js): a estante só existe depois de renderizada, então lemos a página aberta ----
// Progresso na estante: sem % = não iniciado · abaixo de 100% = lendo · 100% = lido
const SKOOB_SHELF = /\/user\/([0-9a-f]{24})\/bookshelf/i;
const isPortrait = (img) => { const r = img.getBoundingClientRect(); return r.width >= 40 && r.height > r.width * 1.15; };
const statusOf = (p) => (p == null || p <= 0 ? "nao_iniciado" : p >= 100 ? "lido" : "lendo");
const isCoverAlt = (t) => !t || /^(book cover|capa)$/i.test(t.trim());

// maior contêiner que ainda tem só UMA capa = o "cartão" do livro
function cardOf(img) {
  let best = img.parentElement, el = img.parentElement;
  for (let i = 0; i < 6 && el && el !== document.body; i++, el = el.parentElement) {
    if ([...el.querySelectorAll("img")].filter(isPortrait).length > 1) break;
    best = el;
  }
  return best;
}
function progressIn(card) {
  const pb = card.querySelector('[role="progressbar"]');
  const v = pb?.getAttribute("aria-valuenow");
  if (v != null && v !== "") return Math.min(100, Number(v));
  const m = (card.textContent || "").match(/(\d{1,3})\s*%/);
  return m ? Math.min(100, Number(m[1])) : null;
}
function skoobItems() {
  const seen = new Map();
  [...document.querySelectorAll("img")].filter((i) => isPortrait(i) && !i.closest("header,nav,footer")).forEach((img) => {
    const card = cardOf(img);
    const link = [...card.querySelectorAll("a[href]")].map((a) => a.href).find((h) => /\/book\/\d+/.test(h));
    const lines = (card.innerText || "").split("\n").map((s) => s.trim())
      .filter((s) => s && !/^\d{1,3}\s*%$/.test(s) && !isCoverAlt(s));
    const title = (!isCoverAlt(img.alt) ? img.alt : lines[0] || "").trim();
    if (!title) return;
    const key = link || title;
    if (seen.has(key)) return;
    const progress = progressIn(card);
    seen.set(key, { title, url: link || location.href, cover: img.currentSrc || img.src, progress, status: statusOf(progress) });
  });
  return [...seen.values()];
}
async function passiveSkoob() {
  const m = location.pathname.match(SKOOB_SHELF);
  if (SITE !== "skoob" || !m) return;
  const { profiles = {}, cache = {} } = await api.storage.local.get(["profiles", "cache"]);
  const mine = profiles.skoob?.match(/\/user\/([0-9a-f]{24})/i)?.[1];
  if (mine && mine.toLowerCase() !== m[1].toLowerCase()) return; // estante de outra pessoa
  const items = skoobItems().slice(0, 60);
  if (!items.length) return;
  const n = (s) => items.filter((i) => i.status === s).length;
  const next = { items, note: `${n("lido")} lidos · ${n("lendo")} lendo · ${n("nao_iniciado")} não iniciados (na estante aberta)` };
  if (JSON.stringify(cache.skoob) === JSON.stringify(next) && mine) return;
  cache.skoob = next;
  if (!mine) profiles.skoob = `${location.origin}/pt/user/${m[1]}`;
  await api.storage.local.set({ cache, profiles });
}
if (SITE === "skoob") {
  let runs = 0;
  const t = setInterval(() => { passiveSkoob(); if (++runs > 40) clearInterval(t); }, 3000);

  // botão de diagnóstico: copia dados da página para você colar no chat
  const b = document.createElement("button");
  b.textContent = "Media Hub: copiar diagnóstico";
  b.style.cssText = "position:fixed;left:8px;bottom:8px;z-index:2147483647;padding:4px 8px;font:11px system-ui;opacity:.7;cursor:pointer";
  b.onclick = async () => {
    const info = {
      url: location.href,
      detectados: skoobItems().slice(0, 12).map(({ title, status, progress, url }) => ({ title, status, progress, url })),
      capasRetrato: [...document.querySelectorAll("img")].filter(isPortrait).length,
      amostraCartao: (() => { const i = [...document.querySelectorAll("img")].find(isPortrait); return i ? { alt: i.alt, texto: (cardOf(i).innerText || "").slice(0, 200), html: cardOf(i).outerHTML.slice(0, 700) } : null; })(),
    };
    try { await navigator.clipboard.writeText(JSON.stringify(info, null, 1)); b.textContent = "Copiado! Cole no chat"; }
    catch { b.textContent = "Falhou ao copiar"; }
  };
  document.body.append(b);
}
