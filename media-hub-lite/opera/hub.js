const api = typeof browser !== "undefined" ? browser : chrome; // Firefox expõe "browser"; Opera/Chromium expõem "chrome"
// ===== Plataformas =====
// Seletores/URLs são heurísticos (feitos sem ver o HTML real). Se algo quebrar, ajuste só este bloco.
const enc = encodeURIComponent;
const KINDS = {
  movie: { platform: "letterboxd", label: "Letterboxd", emoji: "🎬", tab: "Filmes",
    search: (q) => `https://letterboxd.com/search/films/${enc(q)}/`, item: /^\/film\/[^/]+\/?$/ },
  game: { platform: "backloggd", label: "Backloggd", emoji: "🎮", tab: "Jogos",
    search: (q) => `https://backloggd.com/search/games/${enc(q)}/`, item: /^\/games\/[^/]+\/?$/ },
  book: { platform: "skoob", label: "Skoob", emoji: "📚", tab: "Livros",
    search: (q) => `https://www.skoob.com.br/livro/lista/busca:${enc(q)}`, item: /(\/book\/\d+|\/livro\/|\d+ed\d+)/i },
};
const BY_PLATFORM = Object.fromEntries(Object.values(KINDS).map((k) => [k.platform, k]));

// ===== Utilidades =====
const $app = document.getElementById("app");
const store = {
  get: async (k, d) => (await api.storage.local.get(k))[k] ?? d,
  set: (k, v) => api.storage.local.set({ [k]: v }),
};
function h(tag, props = {}, ...kids) {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(props)) {
    if (k.startsWith("on")) e.addEventListener(k.slice(2), v);
    else if (k === "class") e.className = v;
    else if (v !== undefined && v !== null) e.setAttribute(k, v);
  }
  for (const c of kids.flat()) if (c != null) e.append(c.nodeType ? c : document.createTextNode(c));
  return e;
}
const slugTitle = (path) =>
  path.split("/").filter(Boolean).pop().replace(/-\d+$/, "").replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

async function fetchText(url) {
  const r = await fetch(url, { credentials: "include" });
  if (!r.ok) throw new Error(`${r.status}`);
  return r.text();
}
async function fetchDoc(url) {
  return new DOMParser().parseFromString(await fetchText(url), "text/html");
}

// ---- capas: procura em vários atributos (lazy-load), background-image e no contêiner do item ----
function imgUrl(img, base) {
  if (!img) return;
  const cands = [];
  for (const at of img.attributes) {
    if (at.name === "src" || at.name === "srcset" || at.name.startsWith("data-"))
      for (const part of at.value.split(",")) cands.push(part.trim().split(/\s+/)[0]);
  }
  const ok = cands.find((c) => c && !c.startsWith("data:") && /\.(jpe?g|png|webp|avif|gif)(\?|$)|image|cover|poster|upload|capa/i.test(c));
  try { return ok ? new URL(ok, base).href : undefined; } catch {}
}
function coverFor(a, base, pattern) {
  const direct = imgUrl(a.querySelector("img"), base);
  if (direct) return direct;
  const bgEl = [a, ...a.querySelectorAll("[style]")].find((e) => /url\(/.test(e.getAttribute("style") || ""));
  const m = bgEl?.getAttribute("style").match(/url\((['"]?)(.*?)\1\)/);
  if (m) { try { return new URL(m[2], base).href; } catch {} }
  // sobe até 4 níveis, enquanto o contêiner tiver só este item
  let el = a.parentElement;
  for (let i = 0; i < 4 && el; i++, el = el.parentElement) {
    const paths = new Set([...el.querySelectorAll("a[href]")].map((x) => {
      try { return new URL(x.getAttribute("href"), base).pathname; } catch { return ""; }
    }).filter((pth) => pattern.test(pth)));
    if (paths.size > 1) break;
    const u = imgUrl(el.querySelector("img"), base);
    if (u) return u;
  }
}

// extrai itens (links de títulos) de um documento HTML
function parseItems(doc, baseUrl, pattern, anchors) {
  const out = new Map();
  (anchors || doc.querySelectorAll("a[href]")).forEach((a) => {
    let u;
    try { u = new URL(a.getAttribute("href"), baseUrl); } catch { return; }
    if (!pattern.test(u.pathname) || /^\/(usuario|estante|perfil|login)/i.test(u.pathname)) return;
    const img = a.querySelector("img");
    const text = (a.textContent || "").trim();
    const alt = (img?.getAttribute("alt") || img?.getAttribute("title") || "").replace(/^(Poster for|Pôster de|Capa de)\s+/i, "").trim();
    const cover = coverFor(a, baseUrl, pattern);
    const title = text || alt || slugTitle(u.pathname);
    const prev = out.get(u.pathname);
    if (!prev) out.set(u.pathname, { title, url: u.href, cover });
    else {
      if (text && (!prev.title || prev.title === slugTitle(u.pathname))) prev.title = text;
      prev.cover ||= cover;
    }
  });
  return [...out.values()];
}

// itens de UMA seção da página (ex.: "Recently Played"), do título até o próximo título
function parseSection(doc, base, pattern, headingRe, stopRe) {
  const all = [...doc.body.querySelectorAll("*")];
  const isLabel = (e, re) => !e.querySelector("a[href]") && re.test((e.textContent || "").trim());
  const start = all.findIndex((e) => isLabel(e, headingRe));
  if (start < 0) return null;
  const heading = all[start];
  const anchors = [];
  for (const e of all.slice(start + 1)) {
    if (heading.contains(e)) continue;
    if (isLabel(e, stopRe)) break;
    if (e.tagName !== "A") continue;
    let path = "";
    try { path = new URL(e.getAttribute("href"), base).pathname; } catch {}
    if (pattern.test(path)) anchors.push(e);
  }
  return parseItems(doc, base, pattern, anchors);
}

// ===== Dados das plataformas =====
async function loadLetterboxd(profile) {
  const user = new URL(profile).pathname.split("/").filter(Boolean)[0];
  const xml = new DOMParser().parseFromString(await fetchText(`https://letterboxd.com/${user}/rss/`), "text/xml");
  const tag = (it, n) => it.getElementsByTagName(n)[0]?.textContent;
  const items = [...xml.getElementsByTagName("item")]
    .filter((it) => tag(it, "letterboxd:filmTitle"))
    .map((it) => ({
      title: `${tag(it, "letterboxd:filmTitle")}${tag(it, "letterboxd:filmYear") ? ` (${tag(it, "letterboxd:filmYear")})` : ""}`,
      url: tag(it, "link"),
      cover: (tag(it, "description") || "").match(/<img[^>]+src=["']([^"']+)["']/i)?.[1],
      rating: tag(it, "letterboxd:memberRating") ? Number(tag(it, "letterboxd:memberRating")) : null,
    }));
  const rated = items.filter((i) => i.rating);
  const avg = rated.length ? rated.reduce((s, i) => s + i.rating, 0) / rated.length : null;
  return { items, note: `${items.length} entradas recentes · média ${avg ? avg.toFixed(2) : "—"} ★` };
}
async function loadFromProfile(kind, profile) {
  const doc = await fetchDoc(profile);
  if (kind.platform === "backloggd") {
    // só a seção "Recently Played" (e não os Favorite Games / reviews)
    const items = parseSection(doc, profile, kind.item, /^Recently Played$/i,
      /^(Recently Reviewed|Recent Reviews|Recent Activity|Recent Lists|Journal|Lists)$/i);
    if (items === null) throw new Error('seção "Recently Played" não encontrada');
    return { items: items.slice(0, 10), note: `${items.length} jogados recentemente` };
  }
  const items = parseItems(doc, profile, kind.item);
  return { items, note: `${items.length} itens encontrados no perfil` };
}

async function loadSkoob(profile) {
  const id = new URL(profile).pathname.match(/\/usuario\/(\d+)/)?.[1];
  const urls = [...(id ? [`https://www.skoob.com.br/estante/livros/todos/${id}`] : []), profile];
  for (const u of urls) {
    try {
      const items = parseItems(await fetchDoc(u), u, KINDS.book.item);
      if (items.length) return { items, note: `${items.length} livros encontrados` };
    } catch {}
  }
  throw new Error("o HTML da página não traz os livros");
}

// ===== Dashboard =====
const STATUS_ORDER = { lendo: 0, lido: 1, nao_iniciado: 2 };
const sortedItems = (data) =>
  data.items[0]?.status ? [...data.items].sort((a, b) => STATUS_ORDER[a.status] - STATUS_ORDER[b.status]) : data.items;
const badge = (i) =>
  i.rating ? `${i.rating}★` : i.status === "lido" ? "✓ lido" : i.status === "lendo" ? `${i.progress}%`
  : i.status === "nao_iniciado" ? "não iniciado" : "";

function platformCard(kind) {
  const body = h("div", {}, h("p", { class: "muted" }, "Carregando…"));
  const card = h("section", { class: "card" }, h("h2", {}, `${kind.emoji} ${kind.label}`), body);

  const draw = (data, stale) => {
    body.replaceChildren(
      h("p", { class: "muted" }, data.note + (stale ? " · (cache)" : "")),
      h("ul", {}, sortedItems(data).slice(0, 7).map((i) =>
        h("li", { class: "row" },
          i.cover ? h("img", { src: i.cover, alt: "" }) : h("div", { class: "ph" }),
          h("a", { class: "t", href: i.url, target: "_blank" }, i.title),
          badge(i) ? h("span", { class: "muted" }, badge(i)) : null))));
  };
  const needProfile = (msg) => {
    const input = h("input", { type: "text", placeholder: `Link do seu perfil no ${kind.label}` });
    body.replaceChildren(
      h("p", { class: "muted" }, msg),
      input,
      h("p", {}, h("button", { class: "ghost", onclick: async () => {
        let link = input.value.trim();
        if (!link.startsWith("http")) return;
        if (kind.platform === "skoob") {
          const m = link.match(/\/user\/([0-9a-f]{24})/i);
          if (!m) return;
          link = `https://www.skoob.com.br/pt/user/${m[1]}`;
        }
        const profiles = await store.get("profiles", {});
        profiles[kind.platform] = link;
        await store.set("profiles", profiles);
        render();
      } }, "Usar este link")));
  };

  (async () => {
    const profile = (await store.get("profiles", {}))[kind.platform];
    if (!profile) return needProfile(`Perfil não detectado ainda. Entre no ${kind.label} nesta janela do navegador — a extensão encontra sozinha. Ou cole o link:`);
    const cache = (await store.get("cache", {}))[kind.platform];
    if (kind.platform === "skoob") {
      if (cache) return draw(cache, false);
      const id = profile.match(/\/user\/([0-9a-f]{24})/i)?.[1];
      const link = id ? `https://www.skoob.com.br/pt/user/${id}/bookshelf` : "https://www.skoob.com.br/";
      body.replaceChildren(
        h("p", { class: "muted" }, "O Skoob novo exige login e monta a estante por JavaScript, então o hub lê a página já aberta. Abra sua estante uma vez (e role a página) e volte aqui:"),
        h("p", {}, h("a", { href: link, target: "_blank" }, "Abrir minha estante no Skoob")));
      return;
    }
    if (cache) draw(cache, true);
    try {
      const data = kind.platform === "letterboxd" ? await loadLetterboxd(profile)
        : kind.platform === "skoob" ? await loadSkoob(profile) : await loadFromProfile(kind, profile);
      if (!data.items.length) throw new Error("nenhum item");
      draw(data, false);
      const c = await store.get("cache", {}); c[kind.platform] = data; await store.set("cache", c);
    } catch (e) {
      if (!cache) needProfile(kind.platform === "skoob"
        ? "Não consegui ler seus livros por aqui. Abra sua estante no Skoob (avatar → estante) em uma aba: o Media Hub registra os livros sozinho e eles aparecem aqui. Link do perfil, se precisar trocar:"
        : `Não consegui ler seu perfil (${e.message}). Confira se está logado e se o link está certo:`);
    }
  })();
  return card;
}

async function reviewsCard() {
  const reviews = await store.get("reviews", []);
  const save = async (list) => { await store.set("reviews", list); render(); };
  const rows = reviews.slice(0, 10).map((r) =>
    h("li", { class: "row" },
      h("span", { class: "t" }, `${r.title} `, h("span", { class: "muted" }, `· ${BY_PLATFORM[r.platform].label} · ${r.rating}★`)),
      h("span", { class: `status-${r.status}` }, r.status === "published" ? "publicado" : "pendente"),
      r.status !== "published" ? h("button", { class: "ghost", onclick: () => openReview(r) }, "Abrir") : null,
      h("button", { class: "ghost", onclick: () => save(reviews.filter((x) => x.id !== r.id)) }, "✕")));
  return h("section", { class: "card", style: "margin-top:16px" },
    h("h2", {}, "📝 Suas reviews"),
    rows.length ? h("ul", {}, rows) : h("p", { class: "muted" }, "Nenhuma ainda. Use “Nova review”."));
}

async function renderDashboard() {
  $app.replaceChildren(
    h("div", { class: "grid" }, Object.values(KINDS).map(platformCard)),
    await reviewsCard());
}

// ===== Nova review =====
async function openReview(r) {
  await store.set("armed", r.id);
  api.tabs.create({ url: r.url });
}

function renderCompose() {
  let kindKey = "movie", timer, selected = null;
  const wrap = h("div", { class: "compose stack" });
  const input = h("input", { type: "text", placeholder: "Digite o nome do título…", autofocus: "" });
  const results = h("ul", {});
  const status = h("p", { class: "muted" });
  const tabs = h("div", { class: "tabs" });
  const form = h("div", { class: "stack" });

  const drawTabs = () => tabs.replaceChildren(...Object.entries(KINDS).map(([k, v]) =>
    h("button", { class: k === kindKey ? "on" : "", onclick: () => { kindKey = k; drawTabs(); results.replaceChildren(); doSearch(); } }, `${v.emoji} ${v.tab}`)));

  async function doSearch() {
    const q = input.value.trim();
    if (q.length < 2) { results.replaceChildren(); status.textContent = ""; return; }
    const kind = KINDS[kindKey], mine = kindKey + q;
    status.textContent = "Buscando…";
    let items = [];
    try { items = parseItems(await fetchDoc(kind.search(q)), kind.search(q), kind.item); } catch {}
    // Skoob: se a busca do site não devolver nada, usa Google Books só para listar candidatos
    if (!items.length && kindKey === "book") {
      try {
        const j = JSON.parse(await fetchText(`https://www.googleapis.com/books/v1/volumes?maxResults=8&q=${enc(q)}`));
        items = (j.items ?? []).map((b) => ({
          title: b.volumeInfo.title, sub: b.volumeInfo.authors?.join(", "),
          cover: b.volumeInfo.imageLinks?.thumbnail?.replace("http://", "https://"), url: kind.search(b.volumeInfo.title),
        }));
      } catch {}
    }
    if (mine !== kindKey + input.value.trim()) return; // resposta antiga
    status.textContent = items.length ? "" : "Nada encontrado (ou site fora do ar / sem login).";
    results.replaceChildren(...items.slice(0, 8).map((i) =>
      h("li", { class: "row" },
        i.cover ? h("img", { src: i.cover, alt: "" }) : h("div", { class: "ph" }),
        h("div", { class: "t" }, i.title, i.sub ? h("div", { class: "muted" }, i.sub) : null),
        h("button", { class: "ghost", onclick: () => { selected = i; drawForm(); } }, "Escolher"))));
  }

  function drawForm() {
    const kind = KINDS[kindKey];
    const rating = h("input", { type: "range", min: "0.5", max: "5", step: "0.5", value: "3", style: "width:100%" });
    const label = h("strong", {}, "3.0");
    rating.addEventListener("input", () => (label.textContent = Number(rating.value).toFixed(1)));
    const text = h("textarea", { placeholder: "Escreva sua review…" });
    const go = h("button", { class: "btn", onclick: async () => {
      if (!text.value.trim()) return;
      const review = { id: Date.now(), kind: kindKey, platform: kind.platform, title: selected.title, url: selected.url,
        rating: Number(rating.value), text: text.value, status: "pending" };
      await store.set("reviews", [review, ...(await store.get("reviews", []))]);
      await openReview(review);
      selected = null; render();
    } }, `Salvar e abrir no ${kind.label}`);
    wrap.replaceChildren(
      h("div", {}, h("strong", {}, selected.title), " ", h("button", { class: "ghost", onclick: () => { selected = null; render(); } }, "trocar")),
      h("label", {}, "Nota: ", label, " ★", rating), text, go,
      h("p", { class: "muted" }, "Você só confirma no site: o texto é preenchido para você e a nota aparece no painel."));
  }

  input.addEventListener("input", () => { clearTimeout(timer); timer = setTimeout(doSearch, 400); });
  drawTabs();
  wrap.append(tabs, input, status, results, form);
  $app.replaceChildren(wrap);
}

// ===== Navegação =====
let view = "dash";
function render() {
  document.getElementById("nav-dash").className = view === "dash" ? "on" : "";
  document.getElementById("nav-new").className = view === "new" ? "on" : "";
  view === "dash" ? renderDashboard() : renderCompose();
}
document.getElementById("nav-dash").onclick = () => { view = "dash"; render(); };
document.getElementById("nav-new").onclick = () => { view = "new"; render(); };
api.storage.onChanged.addListener((c) => { if (view === "dash" && (c.profiles || c.reviews || (c.cache && JSON.stringify(c.cache.newValue?.skoob) !== JSON.stringify(c.cache.oldValue?.skoob)))) render(); });
render();
