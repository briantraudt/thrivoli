type ChatRole = "user" | "assistant";
type ChatMessage = { role: ChatRole; content: string; sources?: Array<{ title: string; url: string }> };

const escapeHtml = (value: string) =>
  value.replace(/[&<>'"]/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[char] ?? char);

const formatText = (value: string) => escapeHtml(value).replace(/\n/g, "<br>");

function mountChat() {
  if (document.getElementById("thrivoli-ai-root")) return;

  const root = document.createElement("div");
  root.id = "thrivoli-ai-root";
  root.innerHTML = `
    <style>
      #thrivoli-ai-root{position:fixed;right:22px;bottom:22px;z-index:5000;font-family:'Schibsted Grotesk',system-ui,sans-serif;color:#1C2B33}
      .tv-ai-launch{width:56px;height:56px;border:0;border-radius:17px;background:#0B3B34;color:#fff;display:grid;place-items:center;cursor:pointer;box-shadow:0 12px 30px rgba(11,59,52,.28);transition:transform .18s ease,box-shadow .18s ease}
      .tv-ai-launch:hover{transform:translateY(-2px);box-shadow:0 16px 36px rgba(11,59,52,.34)}
      .tv-ai-launch svg{width:25px;height:25px}
      .tv-ai-panel{position:absolute;right:0;bottom:70px;width:min(370px,calc(100vw - 28px));height:min(530px,calc(100vh - 100px));background:#fff;border:1px solid #DDD8D0;border-radius:18px;box-shadow:0 22px 64px rgba(28,43,51,.2);overflow:hidden;display:none;flex-direction:column}
      .tv-ai-panel.is-open{display:flex}
      .tv-ai-head{min-height:64px;padding:0 18px;background:#0B3B34;color:#fff;display:flex;align-items:center}
      .tv-ai-title{font-size:17px;font-weight:800;letter-spacing:-.2px}
      .tv-ai-close{margin-left:auto;border:0;background:transparent;color:#D9E8E4;min-height:34px;width:34px;border-radius:9px;cursor:pointer;font-size:24px;line-height:1}
      .tv-ai-close:hover{background:rgba(255,255,255,.08)}
      .tv-ai-messages{flex:1;overflow:auto;padding:18px;background:#FAF9F7;display:flex;flex-direction:column;gap:10px}
      .tv-ai-empty{margin:auto;text-align:center;color:#7A878D;font-size:13px;line-height:1.45;max-width:220px}
      .tv-ai-msg{max-width:88%;padding:10px 12px;border-radius:13px;font-size:13px;line-height:1.48;word-break:break-word}
      .tv-ai-msg.user{align-self:flex-end;background:#0E6B5C;color:#fff;border-bottom-right-radius:5px}
      .tv-ai-msg.assistant{align-self:flex-start;background:#fff;border:1px solid #E5E0D8;border-bottom-left-radius:5px}
      .tv-ai-sources{margin-top:9px;padding-top:8px;border-top:1px solid #EEEAE2;display:flex;flex-direction:column;gap:4px}
      .tv-ai-sources a{font-size:11px;color:#0E6B5C;text-decoration:none}.tv-ai-sources a:hover{text-decoration:underline}
      .tv-ai-thinking{display:flex;gap:4px;align-items:center}.tv-ai-thinking i{width:6px;height:6px;border-radius:50%;background:#8CA19C;animation:tvpulse 1.1s infinite}.tv-ai-thinking i:nth-child(2){animation-delay:.15s}.tv-ai-thinking i:nth-child(3){animation-delay:.3s}
      @keyframes tvpulse{0%,70%,100%{opacity:.3;transform:translateY(0)}35%{opacity:1;transform:translateY(-3px)}}
      .tv-ai-form{padding:12px;background:#fff;border-top:1px solid #E7E2DA;display:flex;gap:8px;align-items:center}
      .tv-ai-input{flex:1;resize:none;border:1px solid #D8D2C8;border-radius:11px;padding:10px 12px;min-height:42px;max-height:96px;font:13px/1.4 inherit;outline:none;background:#fff}
      .tv-ai-input:focus{border-color:#0E6B5C;box-shadow:0 0 0 3px rgba(14,107,92,.11)}
      .tv-ai-send{width:42px;height:42px;min-height:42px;border:0;border-radius:11px;background:#0E6B5C;color:#fff;display:grid;place-items:center;cursor:pointer}
      .tv-ai-send svg{width:18px;height:18px}.tv-ai-send:disabled{opacity:.45;cursor:not-allowed}
      @media(max-width:560px){#thrivoli-ai-root{right:12px;bottom:12px}.tv-ai-panel{position:fixed;inset:10px;width:auto;height:auto;border-radius:17px}.tv-ai-launch{width:54px;height:54px}}
    </style>
    <button class="tv-ai-launch" aria-label="Open Thrivoli AI assistant" aria-expanded="false">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a4 4 0 0 1-4 4H8l-5 3v-7a4 4 0 0 1-1-2.6V7a4 4 0 0 1 4-4h11a4 4 0 0 1 4 4z"/><path d="M8 9h8M8 13h5"/></svg>
    </button>
    <section class="tv-ai-panel" aria-label="Thrivoli AI assistant">
      <header class="tv-ai-head"><div class="tv-ai-title">Thrivoli Intelligence</div><button class="tv-ai-close" aria-label="Close assistant">×</button></header>
      <div class="tv-ai-messages"></div>
      <form class="tv-ai-form"><textarea class="tv-ai-input" rows="1" maxlength="1200" placeholder="Ask a question…"></textarea><button class="tv-ai-send" type="submit" aria-label="Send message"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m22 2-7 20-4-9-9-4Z"/><path d="M22 2 11 13"/></svg></button></form>
    </section>`;

  document.body.appendChild(root);

  const launch = root.querySelector<HTMLButtonElement>(".tv-ai-launch")!;
  const panel = root.querySelector<HTMLElement>(".tv-ai-panel")!;
  const close = root.querySelector<HTMLButtonElement>(".tv-ai-close")!;
  const messagesEl = root.querySelector<HTMLElement>(".tv-ai-messages")!;
  const form = root.querySelector<HTMLFormElement>(".tv-ai-form")!;
  const input = root.querySelector<HTMLTextAreaElement>(".tv-ai-input")!;
  const send = root.querySelector<HTMLButtonElement>(".tv-ai-send")!;

  const history: ChatMessage[] = [];

  const render = () => {
    if (!history.length) {
      messagesEl.innerHTML = '<div class="tv-ai-empty">Ask about performance, staffing, revenue, scheduling, or current market context.</div>';
      return;
    }
    messagesEl.innerHTML = history.map((message) => {
      const sourceHtml = message.sources?.length
        ? `<div class="tv-ai-sources">${message.sources.slice(0, 5).map((source) => `<a href="${escapeHtml(source.url)}" target="_blank" rel="noopener noreferrer">↗ ${escapeHtml(source.title)}</a>`).join("")}</div>`
        : "";
      return `<div class="tv-ai-msg ${message.role}">${formatText(message.content)}${sourceHtml}</div>`;
    }).join("");
    messagesEl.scrollTop = messagesEl.scrollHeight;
  };

  const setOpen = (open: boolean) => {
    panel.classList.toggle("is-open", open);
    launch.setAttribute("aria-expanded", String(open));
    if (open) setTimeout(() => input.focus(), 50);
  };

  const ask = async (question: string) => {
    const clean = question.trim();
    if (!clean) return;
    history.push({ role: "user", content: clean });
    render();
    input.value = "";
    send.disabled = true;
    const thinking = document.createElement("div");
    thinking.className = "tv-ai-msg assistant tv-ai-thinking";
    thinking.innerHTML = "<i></i><i></i><i></i>";
    messagesEl.appendChild(thinking);
    messagesEl.scrollTop = messagesEl.scrollHeight;

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: history.slice(-10).map(({ role, content }) => ({ role, content })) }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload?.error || "The assistant is unavailable.");
      history.push({ role: "assistant", content: payload.answer, sources: payload.sources });
    } catch (error) {
      history.push({ role: "assistant", content: error instanceof Error ? error.message : "The assistant is unavailable right now." });
    } finally {
      thinking.remove();
      send.disabled = false;
      render();
    }
  };

  launch.addEventListener("click", () => setOpen(!panel.classList.contains("is-open")));
  close.addEventListener("click", () => setOpen(false));
  form.addEventListener("submit", (event) => { event.preventDefault(); void ask(input.value); });
  input.addEventListener("keydown", (event) => {
    if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); void ask(input.value); }
  });
  render();
}

if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", mountChat);
else mountChat();