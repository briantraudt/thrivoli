type ChatRole = "user" | "assistant";
type ChatMessage = { role: ChatRole; content: string; sources?: Array<{ title: string; url: string }> };

const starterPrompts = [
  "Which location is furthest below break-even?",
  "Why is Pool Location under target?",
  "Which clinics have the most open capacity?",
  "What are current pediatric therapy reimbursement trends?",
];

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
      .tv-ai-launch{width:58px;height:58px;border:0;border-radius:18px;background:#0B3B34;color:#fff;display:grid;place-items:center;cursor:pointer;box-shadow:0 14px 35px rgba(11,59,52,.3);transition:transform .18s ease,box-shadow .18s ease}
      .tv-ai-launch:hover{transform:translateY(-2px);box-shadow:0 18px 40px rgba(11,59,52,.36)}
      .tv-ai-launch svg{width:26px;height:26px}
      .tv-ai-panel{position:absolute;right:0;bottom:72px;width:min(390px,calc(100vw - 28px));height:min(620px,calc(100vh - 110px));background:#fff;border:1px solid #DED9D0;border-radius:20px;box-shadow:0 24px 70px rgba(28,43,51,.22);overflow:hidden;display:none;flex-direction:column}
      .tv-ai-panel.is-open{display:flex}
      .tv-ai-head{padding:16px 16px 14px;background:#0B3B34;color:#fff;display:flex;align-items:center;gap:11px}
      .tv-ai-mark{width:36px;height:36px;border-radius:11px;background:#E3F0ED;color:#0E6B5C;display:grid;place-items:center;font-weight:800}
      .tv-ai-title{font-size:15px;font-weight:800}.tv-ai-sub{font-size:11px;color:#BFD4CF;margin-top:2px}
      .tv-ai-close{margin-left:auto;border:0;background:transparent;color:#D9E8E4;min-height:34px;width:34px;border-radius:9px;cursor:pointer;font-size:22px}
      .tv-ai-messages{flex:1;overflow:auto;padding:15px;background:#F8F7F4;display:flex;flex-direction:column;gap:11px}
      .tv-ai-msg{max-width:88%;padding:10px 12px;border-radius:14px;font-size:13px;line-height:1.48;word-break:break-word}
      .tv-ai-msg.user{align-self:flex-end;background:#0E6B5C;color:#fff;border-bottom-right-radius:5px}
      .tv-ai-msg.assistant{align-self:flex-start;background:#fff;border:1px solid #E6E1D9;border-bottom-left-radius:5px}
      .tv-ai-sources{margin-top:9px;padding-top:8px;border-top:1px solid #EEEAE2;display:flex;flex-direction:column;gap:4px}
      .tv-ai-sources a{font-size:11px;color:#0E6B5C;text-decoration:none}.tv-ai-sources a:hover{text-decoration:underline}
      .tv-ai-thinking{display:flex;gap:4px;align-items:center}.tv-ai-thinking i{width:6px;height:6px;border-radius:50%;background:#8CA19C;animation:tvpulse 1.1s infinite}.tv-ai-thinking i:nth-child(2){animation-delay:.15s}.tv-ai-thinking i:nth-child(3){animation-delay:.3s}
      @keyframes tvpulse{0%,70%,100%{opacity:.3;transform:translateY(0)}35%{opacity:1;transform:translateY(-3px)}}
      .tv-ai-starters{padding:0 15px 12px;background:#F8F7F4;display:flex;gap:7px;overflow-x:auto}
      .tv-ai-chip{border:1px solid #DCD7CF;background:#fff;color:#405159;border-radius:999px;padding:7px 10px;white-space:nowrap;min-height:0;font:600 11px inherit;cursor:pointer}
      .tv-ai-chip:hover{border-color:#0E6B5C;color:#0E6B5C}
      .tv-ai-form{padding:12px;border-top:1px solid #E7E2DA;background:#fff;display:flex;gap:8px;align-items:flex-end}
      .tv-ai-input{flex:1;resize:none;border:1px solid #D8D2C8;border-radius:12px;padding:10px 11px;min-height:42px;max-height:110px;font:13px/1.4 inherit;outline:none}
      .tv-ai-input:focus{border-color:#0E6B5C;box-shadow:0 0 0 3px rgba(14,107,92,.12)}
      .tv-ai-send{width:42px;height:42px;min-height:42px;border:0;border-radius:12px;background:#E8674A;color:#fff;display:grid;place-items:center;cursor:pointer;font-size:18px}.tv-ai-send:disabled{opacity:.45;cursor:not-allowed}
      .tv-ai-note{font-size:10px;color:#738189;padding:0 14px 10px;background:#fff;text-align:center}
      @media(max-width:560px){#thrivoli-ai-root{right:12px;bottom:12px}.tv-ai-panel{position:fixed;inset:10px;width:auto;height:auto;border-radius:18px}.tv-ai-launch{width:54px;height:54px}}
    </style>
    <button class="tv-ai-launch" aria-label="Open Thrivoli AI assistant" aria-expanded="false">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a4 4 0 0 1-4 4H8l-5 3v-7a4 4 0 0 1-1-2.6V7a4 4 0 0 1 4-4h11a4 4 0 0 1 4 4z"/><path d="M8 9h8M8 13h5"/></svg>
    </button>
    <section class="tv-ai-panel" aria-label="Thrivoli AI assistant">
      <header class="tv-ai-head"><div class="tv-ai-mark">T</div><div><div class="tv-ai-title">Thrivoli Intelligence</div><div class="tv-ai-sub">Clinic data + current web research</div></div><button class="tv-ai-close" aria-label="Close assistant">×</button></header>
      <div class="tv-ai-messages"></div>
      <div class="tv-ai-starters"></div>
      <form class="tv-ai-form"><textarea class="tv-ai-input" rows="1" maxlength="1200" placeholder="Ask about performance, staffing, reimbursement…"></textarea><button class="tv-ai-send" type="submit" aria-label="Send message">➜</button></form>
      <div class="tv-ai-note">Demo data only. Verify clinical and financial decisions independently.</div>
    </section>`;

  document.body.appendChild(root);

  const launch = root.querySelector<HTMLButtonElement>(".tv-ai-launch")!;
  const panel = root.querySelector<HTMLElement>(".tv-ai-panel")!;
  const close = root.querySelector<HTMLButtonElement>(".tv-ai-close")!;
  const messagesEl = root.querySelector<HTMLElement>(".tv-ai-messages")!;
  const startersEl = root.querySelector<HTMLElement>(".tv-ai-starters")!;
  const form = root.querySelector<HTMLFormElement>(".tv-ai-form")!;
  const input = root.querySelector<HTMLTextAreaElement>(".tv-ai-input")!;
  const send = root.querySelector<HTMLButtonElement>(".tv-ai-send")!;

  const history: ChatMessage[] = [{ role: "assistant", content: "Hi Amy — I can analyze Thrivoli’s demo operating data and search the web for current market context. What would you like to know?" }];

  const render = () => {
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

  starterPrompts.forEach((prompt) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "tv-ai-chip";
    button.textContent = prompt;
    button.addEventListener("click", () => ask(prompt));
    startersEl.appendChild(button);
  });

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
