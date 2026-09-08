const API_URL = "https://aplicaciones-web-ia.vercel.app/api/chat";
const $ = (id) => document.getElementById(id);
const form = $("chatForm"),
  input = $("messageInput"),
  messages = $("messages"),
  thread = $("thread");
const storageKey = "nexo-chat-v1";
let entries = [],
  busy = false,
  controller = null,
  toastTimer;

// Render a deliberately limited Markdown subset using DOM nodes, never raw HTML.
function inline(text, parent) {
  const pattern =
    /(`[^`\n]+`|\*\*[^*\n]+\*\*|\*[^*\n]+\*|\[[^\]\n]+\]\(https?:\/\/[^\s)]+\))/g;
  let cursor = 0;
  for (const match of text.matchAll(pattern)) {
    parent.append(document.createTextNode(text.slice(cursor, match.index)));
    const value = match[0];
    let node;
    if (value.startsWith("`")) {
      node = document.createElement("code");
      node.textContent = value.slice(1, -1);
    } else if (value.startsWith("**")) {
      node = document.createElement("strong");
      node.textContent = value.slice(2, -2);
    } else if (value.startsWith("*")) {
      node = document.createElement("em");
      node.textContent = value.slice(1, -1);
    } else {
      const link = value.match(/^\[([^\]]+)\]\((.+)\)$/);
      node = document.createElement("a");
      node.textContent = link[1];
      node.href = link[2];
      node.target = "_blank";
      node.rel = "noopener noreferrer";
    }
    parent.append(node);
    cursor = match.index + value.length;
  }
  parent.append(document.createTextNode(text.slice(cursor)));
}
function element(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}
function notify(text) {
  $("toast").textContent = text;
  $("toast").hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    $("toast").hidden = true;
  }, 3000);
}
async function copy(text, button) {
  try {
    await navigator.clipboard.writeText(text);
    const previous = button.textContent;
    button.textContent = "Copiado ✓";
    setTimeout(() => {
      button.textContent = previous;
    }, 1800);
  } catch {
    notify("No se pudo copiar. Selecciona el texto y cópialo manualmente.");
  }
}
function formatMarkdown(text, parent) {
  const lines = text.replace(/\r\n?/g, "\n").split("\n");
  const cells = (line) =>
    line
      .trim()
      .replace(/^\|/, "")
      .replace(/\|$/, "")
      .split("|")
      .map((x) => x.trim());
  const isTableRule = (line) =>
    line.includes("|") && cells(line).every((x) => /^:?-{3,}:?$/.test(x));
  const isBlock = (line) =>
    /^(#{1,6}\s|```|\s*[-*+]\s|\s*\d+[.)]\s|>\s?|\s*$|---+$)/.test(line);
  for (let i = 0; i < lines.length;) {
    const line = lines[i];
    if (!line.trim()) {
      i++;
      continue;
    }
    if (line.startsWith("```")) {
      const language = line.slice(3).trim() || "Código",
        code = [];
      i++;
      while (i < lines.length && !lines[i].startsWith("```"))
        code.push(lines[i++]);
      if (i < lines.length) i++;
      const block = element("div", "code-block"),
        bar = element("div", "code-bar"),
        button = element("button", "", "Copiar código");
      button.type = "button";
      button.addEventListener("click", () => copy(code.join("\n"), button));
      bar.append(element("span", "", language), button);
      const pre = element("pre"),
        content = element("code", "", code.join("\n"));
      pre.append(content);
      block.append(bar, pre);
      parent.append(block);
      continue;
    }
    if (
      i + 1 < lines.length &&
      line.includes("|") &&
      isTableRule(lines[i + 1])
    ) {
      const wrap = element("div", "table-wrap"),
        table = element("table"),
        head = element("thead"),
        body = element("tbody"),
        row = element("tr");
      cells(line).forEach((value) => {
        const cell = element("th");
        cell.scope = "col";
        inline(value, cell);
        row.append(cell);
      });
      head.append(row);
      i += 2;
      while (i < lines.length && lines[i].includes("|") && lines[i].trim()) {
        const tr = element("tr");
        cells(lines[i++]).forEach((value) => {
          const td = element("td");
          inline(value, td);
          tr.append(td);
        });
        body.append(tr);
      }
      table.append(head, body);
      wrap.append(table);
      parent.append(wrap);
      continue;
    }
    const heading = line.match(/^(#{1,6})\s+(.*)/);
    if (heading) {
      const node = element("h" + Math.min(heading[1].length + 1, 4));
      inline(heading[2], node);
      parent.append(node);
      i++;
      continue;
    }
    if (/^\s*([-*_])\1{2,}\s*$/.test(line)) {
      parent.append(element("hr"));
      i++;
      continue;
    }
    const list = line.match(/^\s*(?:([-*+])|(\d+)[.)])\s+(.*)/);
    if (list) {
      const ordered = Boolean(list[2]),
        node = element(ordered ? "ol" : "ul");
      if (ordered) node.start = Number(list[2]);
      while (i < lines.length) {
        const item = lines[i].match(/^\s*(?:([-*+])|(\d+)[.)])\s+(.*)/);
        if (!item || Boolean(item[2]) !== ordered) break;
        const li = element("li");
        inline(item[3], li);
        node.append(li);
        i++;
      }
      parent.append(node);
      continue;
    }
    if (/^>\s?/.test(line)) {
      const quote = element("blockquote");
      inline(line.replace(/^>\s?/, ""), quote);
      parent.append(quote);
      i++;
      continue;
    }
    const paragraph = [line];
    i++;
    while (
      i < lines.length &&
      !isBlock(lines[i]) &&
      !(i + 1 < lines.length && isTableRule(lines[i + 1]))
    )
      paragraph.push(lines[i++]);
    const node = element("p");
    paragraph.forEach((value, index) => {
      if (index) node.append(element("br"));
      inline(value, node);
    });
    parent.append(node);
  }
}
function save() {
  try {
    sessionStorage.setItem(storageKey, JSON.stringify(entries));
  } catch {
    /* The chat remains usable when browser storage is unavailable. */
  }
  $("exportChat").disabled = !entries.length;
}
function renderEntry(entry) {
  $("welcome").hidden = true;
  const article = element(
    "article",
    "message " + entry.role + (entry.error ? " error" : ""),
  );
  const header = element("div", "message-header");
  header.append(
    element("span", "message-avatar", entry.role === "user" ? "T" : "✳"),
    element("span", "", entry.role === "user" ? "Tú" : "Nexo"),
  );
  const date = new Date(entry.time),
    time = element(
      "time",
      "",
      date.toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit" }),
    );
  time.dateTime = date.toISOString();
  header.append(time);
  const content = element("div", "message-content");
  if (entry.role === "assistant" && !entry.error)
    formatMarkdown(entry.text, content);
  else content.textContent = entry.text;
  article.append(header, content);
  if (entry.role === "assistant") {
    const actions = element("div", "message-actions"),
      button = element("button", "", "Copiar respuesta");
    button.type = "button";
    button.addEventListener("click", () => copy(entry.text, button));
    actions.append(button);
    if (entry.error && entry.prompt) {
      const retry = element("button", "", "Reintentar");
      retry.type = "button";
      retry.addEventListener("click", () => {
        if (!busy) send(entry.prompt, false);
      });
      actions.append(retry);
    }
    article.append(actions);
  }
  thread.append(article);
  return article;
}
function addEntry(role, text, extra = {}) {
  const entry = { role, text, time: new Date().toISOString(), ...extra };
  entries.push(entry);
  renderEntry(entry);
  save();
}
function scrollBottom() {
  messages.scrollTop = messages.scrollHeight;
  updateScroll();
}
function updateScroll() {
  $("scrollLatest").hidden =
    !entries.length ||
    messages.scrollHeight - messages.scrollTop - messages.clientHeight < 100;
}
function resizeInput() {
  input.style.height = "auto";
  input.style.height =
    Math.min(input.scrollHeight, window.innerWidth <= 760 ? 90 : 120) + "px";
  $("characterCount").textContent = `${input.value.length} / 1000`;
  $("sendButton").disabled = busy || !input.value.trim();
}
function setBusy(value) {
  busy = value;
  $("sendButton").hidden = value;
  $("stopButton").hidden = !value;
  thread.setAttribute("aria-busy", String(value));
  resizeInput();
}
async function send(prompt, addUser = true) {
  if (busy || !prompt.trim() || prompt.length > 1000) return;
  if (addUser) {
    addEntry("user", prompt);
    input.value = "";
  }
  setBusy(true);
  controller = new AbortController();
  const loading = element("div", "message"),
    indicator = element("div", "loading-indicator"),
    dots = element("span", "dots");
  dots.setAttribute("aria-hidden", "true");
  for (let i = 0; i < 3; i++) dots.append(element("i"));
  indicator.append(
    dots,
    element("span", "", "Organizando una respuesta para ti…"),
  );
  loading.append(indicator);
  thread.append(loading);
  scrollBottom();
  $("announcement").textContent = "Preparando respuesta.";
  let timedOut = false;
  const timeout = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, 60000);
  try {
    const response = await fetch(API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: prompt }),
      signal: controller.signal,
    });
    if (!response.headers.get("content-type")?.includes("application/json"))
      throw new Error(
        "El servidor no devolvió una respuesta válida. Inténtalo de nuevo en unos minutos.",
      );
    const data = await response.json();
    if (!response.ok)
      throw new Error(
        response.status === 429
          ? "Hay demasiadas consultas en este momento. Espera un poco y vuelve a intentarlo."
          : data.error ||
              "No pudimos completar la consulta. Inténtalo nuevamente.",
      );
    if (typeof data.reply !== "string" || !data.reply.trim())
      throw new Error(
        "La respuesta llegó vacía. Prueba reformulando tu pregunta.",
      );
    loading.remove();
    addEntry("assistant", data.reply);
    $("announcement").textContent = "Respuesta recibida. " + data.reply;
  } catch (error) {
    loading.remove();
    const text =
      error.name === "AbortError"
        ? timedOut
          ? "La consulta tardó más de lo esperado. Puedes volver a intentarlo."
          : "Detuviste la espera de esta respuesta. Puedes enviar otra pregunta."
        : error instanceof TypeError
          ? "No pudimos conectar con el servidor. Revisa tu conexión y vuelve a intentarlo."
          : error.message;
    addEntry("assistant", text, { error: true, prompt });
    $("announcement").textContent = text;
  } finally {
    clearTimeout(timeout);
    controller = null;
    setBusy(false);
    updateScroll();
    // Keep the reader's scroll position; offer a jump button when the answer is below.
    if (
      messages.scrollHeight - messages.scrollTop - messages.clientHeight <
      280
    )
      scrollBottom();
  }
}
form.addEventListener("submit", (event) => {
  event.preventDefault();
  send(input.value.trim());
});
input.addEventListener("input", resizeInput);
input.addEventListener("keydown", (event) => {
  if (
    event.key === "Enter" &&
    !event.shiftKey &&
    !event.isComposing &&
    !window.matchMedia("(pointer: coarse)").matches
  ) {
    event.preventDefault();
    if (!busy && input.value.trim()) form.requestSubmit();
  }
});
$("stopButton").addEventListener("click", () => controller?.abort());
$("scrollLatest").addEventListener("click", scrollBottom);
messages.addEventListener("scroll", updateScroll, { passive: true });
document.querySelectorAll(".suggestion").forEach((button) =>
  button.addEventListener("click", () => {
    input.value = button.dataset.prompt;
    resizeInput();
    input.focus();
  }),
);
function requestReset() {
  if (busy) {
    notify("Detén la consulta antes de empezar una conversación nueva.");
    return;
  }
  if (!entries.length) {
    input.focus();
    return;
  }
  $("resetDialog").showModal();
}
$("newChat").addEventListener("click", requestReset);
$("mobileNew").addEventListener("click", requestReset);
$("cancelReset").addEventListener("click", () => $("resetDialog").close());
$("confirmReset").addEventListener("click", () => {
  entries = [];
  thread.replaceChildren();
  $("welcome").hidden = false;
  input.value = "";
  save();
  resizeInput();
  $("resetDialog").close();
  messages.scrollTop = 0;
  updateScroll();
  input.focus();
});
$("exportChat").addEventListener("click", () => {
  const text =
    "# Conversación con Nexo\n\n" +
    entries
      .map(
        (entry) =>
          `## ${entry.role === "user" ? "Tú" : "Nexo"}\n\n${entry.text}`,
      )
      .join("\n\n---\n\n");
  const url = URL.createObjectURL(
    new Blob([text], { type: "text/markdown;charset=utf-8" }),
  );
  const link = element("a");
  link.href = url;
  link.download = `nexo-${new Date().toISOString().slice(0, 10)}.md`;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
});
try {
  const stored = JSON.parse(sessionStorage.getItem(storageKey) || "[]");
  if (Array.isArray(stored))
    entries = stored
      .filter(
        (x) =>
          x &&
          ["user", "assistant"].includes(x.role) &&
          typeof x.text === "string" &&
          x.text.length <= 100000 &&
          typeof x.time === "string" &&
          !Number.isNaN(Date.parse(x.time)),
      )
      .slice(-100);
} catch {
  entries = [];
}
entries.forEach(renderEntry);
save();
resizeInput();
if (entries.length) scrollBottom();
function resizeViewport() {
  document.documentElement.style.setProperty(
    "--viewport-height",
    `${window.visualViewport?.height || window.innerHeight}px`,
  );
  resizeInput();
  updateScroll();
}
window.visualViewport?.addEventListener("resize", resizeViewport);
window.addEventListener("resize", resizeViewport);
resizeViewport();
