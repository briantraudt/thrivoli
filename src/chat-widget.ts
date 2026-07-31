type ChatRole = "user" | "assistant";
type Evidence = { label: string; value?: string; source: string; status: string; period: string };
type ChartPoint = { label: string; value: number; display: string };
type ChatMeta = {
  interactionId: string;
  answerType: string;
  card?: { label: string; value: string; period: string } | null;
  chart?: ChartPoint[] | null;
  evidence: Evidence[];
  dataAsOf: string;
  dataStatus: string;
  roleScope: string;
  unsupportedPeriod?: string | null;
};
type ChatMessage = { role: ChatRole; content: string; meta?: ChatMeta; feedback?: number; actionStatus?: string; actionId?: string };

const escapeHtml = (value: string) =>
  value.replace(/[&<>'"]/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[char] ?? char);
const formatText = (value: string) => escapeHtml(value).replace(/\n/g, "<br>");
const normalizeAssistantText = (value: string) => value.replace(/\*\*/g, "").replace(/[\u00a0\u202f]/g, " ").trim();
const formatFreshness = (value: string) => {
  const date = new Date(value);
  return Number.isNaN(date.valueOf()) ? value : date.toLocaleString([], { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
};

function mountChat() {
  if (document.getElementById("thrivoli-ai-root")) return;
  const root = document.createElement("div");
  root.id = "thrivoli-ai-root";
  root.innerHTML = `
    <style>
      #thrivoli-ai-root{position:fixed;right:22px;bottom:22px;z-index:5000;font-family:'Schibsted Grotesk',system-ui,sans-serif;color:#1C2B33}
      .tv-ai-launch{width:56px;height:56px;border:0;border-radius:17px;background:#0B3B34;color:#fff;display:grid;place-items:center;cursor:pointer;box-shadow:0 12px 30px rgba(11,59,52,.28)}
      .tv-ai-panel{position:absolute;right:0;bottom:70px;width:min(430px,calc(100vw - 28px));height:min(640px,calc(100vh - 100px));background:#fff;border:1px solid #DDD8D0;border-radius:20px;box-shadow:0 22px 64px rgba(28,43,51,.2);overflow:hidden;display:none;flex-direction:column}.tv-ai-panel.is-open{display:flex}
      .tv-ai-head{min-height:68px;padding:0 19px;background:#0B3B34;color:#fff;display:flex;align-items:center}.tv-ai-title{font-size:18px;font-weight:800}.tv-ai-subtitle{font-size:10px;color:#A9C9C1;margin-top:2px}
      .tv-ai-close{margin-left:auto;border:0;background:transparent;color:#D9E8E4;width:34px;height:34px;border-radius:9px;cursor:pointer;font-size:24px}
      .tv-ai-messages{flex:1;overflow:auto;padding:16px;background:#FAF9F7;display:flex;flex-direction:column;gap:11px}.tv-ai-empty{display:flex;flex-direction:column;gap:12px;margin:auto 0}
      .tv-ai-welcome{font-weight:800;font-size:15px}.tv-ai-welcome span{display:block;color:#66767D;font-weight:500;font-size:12px;line-height:1.45;margin-top:4px}
      .tv-ai-insight{border:1px solid #E4DED5;background:#fff;border-radius:12px;padding:10px 11px;text-align:left;cursor:pointer;color:#1C2B33}.tv-ai-insight:hover{border-color:#82B9AF}.tv-ai-insight b{font-size:12px;display:block}.tv-ai-insight small{color:#718087;font-size:10.5px}
      .tv-ai-prompts{display:flex;gap:6px;flex-wrap:wrap}.tv-ai-prompt{border:1px solid #DCD7CE;background:#fff;color:#0E6B5C;border-radius:99px;padding:6px 9px;font:600 10.5px inherit;cursor:pointer}
      .tv-ai-msg{max-width:91%;padding:11px 13px;border-radius:14px;font-size:13px;line-height:1.48;word-break:break-word}.tv-ai-msg.user{align-self:flex-end;background:#0E6B5C;color:#fff;border-bottom-right-radius:5px}.tv-ai-msg.assistant{align-self:flex-start;background:#fff;border:1px solid #E5E0D8;border-bottom-left-radius:5px;width:100%}
      .tv-ai-card{margin-bottom:10px;background:#F1F7F5;border:1px solid #CFE2DD;border-radius:11px;padding:10px}.tv-ai-card-label{font-size:10px;color:#61736F;text-transform:uppercase;font-weight:800;letter-spacing:.5px}.tv-ai-card-value{font-size:23px;font-weight:850;color:#0B3B34;margin:2px 0}.tv-ai-card-period{font-size:10.5px;color:#718087}
      .tv-ai-chart{display:flex;flex-direction:column;gap:6px;margin:10px 0}.tv-ai-chart-row{display:grid;grid-template-columns:88px 1fr 55px;gap:6px;align-items:center;font-size:10px}.tv-ai-chart-track{height:7px;border-radius:99px;background:#EEEAE4;overflow:hidden}.tv-ai-chart-bar{height:100%;background:#0E6B5C;border-radius:99px}.tv-ai-chart-value{text-align:right;font-weight:700}
      .tv-ai-proof{margin-top:10px;border-top:1px solid #EEEAE2;padding-top:8px}.tv-ai-proof summary{cursor:pointer;color:#0E6B5C;font-size:10.5px;font-weight:750}.tv-ai-proof-body{font-size:10px;color:#66767D;margin-top:7px;line-height:1.5}.tv-ai-proof-row{margin-bottom:5px}.tv-ai-badge{display:inline-block;border-radius:99px;padding:2px 6px;background:#E7F1EE;color:#0E6B5C;font-weight:750;margin-left:4px}
      .tv-ai-actions{display:flex;gap:6px;margin-top:9px}.tv-ai-mini{border:1px solid #DDD8D0;background:#fff;border-radius:7px;padding:5px 7px;font:650 10px inherit;color:#53636A;cursor:pointer}.tv-ai-mini:hover{border-color:#82B9AF;color:#0E6B5C}.tv-ai-mini.active{background:#E7F1EE;color:#0E6B5C}.tv-ai-action-note{margin-top:7px;font-size:10px;color:#0E6B5C;font-weight:700}
      .tv-ai-thinking{display:flex;gap:4px;align-items:center;width:auto}.tv-ai-thinking i{width:6px;height:6px;border-radius:50%;background:#8CA19C;animation:tvpulse 1.1s infinite}.tv-ai-thinking i:nth-child(2){animation-delay:.15s}.tv-ai-thinking i:nth-child(3){animation-delay:.3s}@keyframes tvpulse{0%,70%,100%{opacity:.3;transform:translateY(0)}35%{opacity:1;transform:translateY(-3px)}}
      .tv-ai-form{padding:12px;background:#fff;border-top:1px solid #E7E2DA;display:flex;gap:8px;align-items:center}.tv-ai-input{flex:1;resize:none;border:1px solid #D8D2C8;border-radius:11px;padding:10px 12px;min-height:42px;max-height:96px;font:13px/1.4 inherit;outline:none}.tv-ai-input:focus{border-color:#0E6B5C;box-shadow:0 0 0 3px rgba(14,107,92,.11)}.tv-ai-send{width:42px;height:42px;border:0;border-radius:11px;background:#0E6B5C;color:#fff;display:grid;place-items:center;cursor:pointer}.tv-ai-send:disabled{opacity:.45}.tv-ai-send svg{width:18px;height:18px}
      @media(max-width:560px){#thrivoli-ai-root{right:12px;bottom:12px}.tv-ai-panel{position:fixed;inset:10px;width:auto;height:auto}.tv-ai-launch{width:54px;height:54px}}
    </style>
    <button class="tv-ai-launch" aria-label="Open Thrivoli AI assistant" aria-expanded="false"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"><path d="M21 15a4 4 0 0 1-4 4H8l-5 3v-7a4 4 0 0 1-1-2.6V7a4 4 0 0 1 4-4h11a4 4 0 0 1 4 4z"/><path d="M8 9h8M8 13h5"/></svg></button>
    <section class="tv-ai-panel" aria-label="Thrivoli AI assistant"><header class="tv-ai-head"><div><div class="tv-ai-title">Thrivoli Intelligence</div><div class="tv-ai-subtitle">Evidence-backed operations analyst</div></div><button class="tv-ai-close" aria-label="Close assistant">×</button></header><div class="tv-ai-messages"></div><form class="tv-ai-form"><textarea class="tv-ai-input" rows="1" maxlength="1200" placeholder="Ask a question…"></textarea><button class="tv-ai-send" type="submit" aria-label="Send message"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m22 2-7 20-4-9-9-4Z"/><path d="M22 2 11 13"/></svg></button></form></section>`;
  document.body.appendChild(root);

  const launch = root.querySelector<HTMLButtonElement>(".tv-ai-launch")!;
  const panel = root.querySelector<HTMLElement>(".tv-ai-panel")!;
  const close = root.querySelector<HTMLButtonElement>(".tv-ai-close")!;
  const messagesEl = root.querySelector<HTMLElement>(".tv-ai-messages")!;
  const form = root.querySelector<HTMLFormElement>(".tv-ai-form")!;
  const input = root.querySelector<HTMLTextAreaElement>(".tv-ai-input")!;
  const send = root.querySelector<HTMLButtonElement>(".tv-ai-send")!;
  const history: ChatMessage[] = [];

  const chartHtml = (chart?: ChartPoint[] | null) => {
    if (!chart?.length) return "";
    const max = Math.max(...chart.map((item) => Math.abs(item.value)), 1);
    return `<div class="tv-ai-chart">${chart.map((item) => `<div class="tv-ai-chart-row"><span>${escapeHtml(item.label)}</span><div class="tv-ai-chart-track"><div class="tv-ai-chart-bar" style="width:${Math.max(4, Math.abs(item.value) / max * 100)}%"></div></div><span class="tv-ai-chart-value">${escapeHtml(item.display)}</span></div>`).join("")}</div>`;
  };

  const metaHtml = (message: ChatMessage, index: number) => {
    const meta = message.meta;
    if (!meta) return "";
    const card = meta.card ? `<div class="tv-ai-card"><div class="tv-ai-card-label">${escapeHtml(meta.card.label)}</div><div class="tv-ai-card-value">${escapeHtml(meta.card.value)}</div><div class="tv-ai-card-period">${escapeHtml(meta.card.period)}</div></div>` : "";
    const proof = `<details class="tv-ai-proof"><summary>View sources and calculation</summary><div class="tv-ai-proof-body">${meta.evidence.map((item) => `<div class="tv-ai-proof-row"><b>${escapeHtml(item.label)}</b>${item.value ? `: ${escapeHtml(item.value)}` : ""}<span class="tv-ai-badge">${escapeHtml(item.status)}</span><br>${escapeHtml(item.source)} · ${escapeHtml(item.period)}</div>`).join("")}<div>Data refreshed ${escapeHtml(formatFreshness(meta.dataAsOf))}</div><div>${escapeHtml(meta.dataStatus)} · ${escapeHtml(meta.roleScope)}</div></div></details>`;
    const taskControls = message.actionStatus === "Ready to confirm"
      ? `<button class="tv-ai-mini active" data-action="confirm" data-index="${index}">Confirm task</button><button class="tv-ai-mini" data-action="cancel" data-index="${index}">Cancel</button>`
      : message.actionStatus === "Task created"
        ? ""
        : `<button class="tv-ai-mini" data-action="task" data-index="${index}">Create follow-up task</button>`;
    const actions = `<div class="tv-ai-actions"><button class="tv-ai-mini ${message.feedback === 1 ? "active" : ""}" data-feedback="1" data-index="${index}" aria-label="Helpful answer">Helpful</button><button class="tv-ai-mini ${message.feedback === -1 ? "active" : ""}" data-feedback="-1" data-index="${index}" aria-label="Report incorrect answer">Incorrect</button>${taskControls}</div>${message.actionStatus ? `<div class="tv-ai-action-note">${escapeHtml(message.actionStatus === "Ready to confirm" ? "Preview: create one internal follow-up task. Confirm to continue." : message.actionStatus)}</div>` : ""}`;
    return `${card}${chartHtml(meta.chart)}${proof}${actions}`;
  };

  const render = () => {
    if (!history.length) {
      messagesEl.innerHTML = `<div class="tv-ai-empty"><div class="tv-ai-welcome">Good morning. What should we look at?<span>Answers use controlled metrics and show their source, period, and freshness.</span></div><button class="tv-ai-insight" data-prompt="Why is Pool Location below break-even?"><b>Pool Location is below break-even</b><small>418 visits vs. 500 required</small></button><button class="tv-ai-insight" data-prompt="What should we do about New Location?"><b>New Location needs attention</b><small>164 visits vs. 460 break-even</small></button><button class="tv-ai-insight" data-prompt="Why is Guilford's margin highest?"><b>Guilford leads operating margin</b><small>31% month-to-date</small></button><div class="tv-ai-prompts"><button class="tv-ai-prompt" data-prompt="Compare revenue across all locations">Compare revenue</button><button class="tv-ai-prompt" data-prompt="Which locations are below break-even?">Break-even risk</button><button class="tv-ai-prompt" data-prompt="Compare no-show rates">No-show rates</button></div></div>`;
      return;
    }
    messagesEl.innerHTML = history.map((message, index) => `<div class="tv-ai-msg ${message.role}">${message.role === "assistant" ? metaHtml(message, index) : ""}${formatText(message.content)}</div>`).join("");
    messagesEl.scrollTop = messagesEl.scrollHeight;
  };

  const saveEvent = async (type: string, payload: Record<string, unknown>) => {
    const response = await fetch("/api/ai-event", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ type, payload }) });
    if (!response.ok) throw new Error("Could not save the event.");
    return response.json();
  };

  const ask = async (question: string) => {
    const clean = question.trim(); if (!clean || send.disabled) return;
    history.push({ role: "user", content: clean }); render(); input.value = ""; send.disabled = true;
    const thinking = document.createElement("div"); thinking.className = "tv-ai-msg assistant tv-ai-thinking"; thinking.innerHTML = "<i></i><i></i><i></i>"; messagesEl.appendChild(thinking);
    let assistantMessage: ChatMessage | null = null;
    try {
      const response = await fetch("/api/chat", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ messages: history.slice(-10).map(({ role, content }) => ({ role, content })) }) });
      if (!response.ok) { const payload = await response.json(); throw new Error(payload?.error || "The assistant is unavailable."); }
      if (!response.body) throw new Error("The assistant returned an empty response.");
      thinking.remove(); assistantMessage = { role: "assistant", content: "" }; history.push(assistantMessage); render();
      const reader = response.body.getReader(); const decoder = new TextDecoder(); let buffer = "";
      while (true) {
        const { done, value } = await reader.read(); if (done) break;
        buffer += decoder.decode(value, { stream: true }); const lines = buffer.split(/\r?\n/); buffer = lines.pop() ?? "";
        for (const line of lines) {
          if (!line.startsWith("data:")) continue; const data = line.slice(5).trim(); if (!data || data === "[DONE]") continue;
          const payload = JSON.parse(data);
          if (payload.thrivoli) assistantMessage.meta = payload.thrivoli as ChatMeta;
          const delta = payload.choices?.[0]?.delta?.content; if (typeof delta === "string") assistantMessage.content += delta;
        }
        render();
      }
      assistantMessage.content = normalizeAssistantText(assistantMessage.content) || "I could not produce an answer for that question.";
    } catch (error) {
      const message = error instanceof Error ? error.message : "The assistant is unavailable right now.";
      if (assistantMessage) assistantMessage.content = message; else history.push({ role: "assistant", content: message });
    } finally { thinking.remove(); send.disabled = false; render(); }
  };

  messagesEl.addEventListener("click", async (event) => {
    const target = (event.target as HTMLElement).closest<HTMLButtonElement>("button"); if (!target) return;
    const prompt = target.dataset.prompt; if (prompt) { void ask(prompt); return; }
    const index = Number(target.dataset.index); const message = history[index]; if (!message?.meta) return;
    if (target.dataset.feedback) {
      const rating = Number(target.dataset.feedback); message.feedback = rating; render();
      try { await saveEvent("feedback", { interaction_id: message.meta.interactionId, rating }); } catch { message.feedback = undefined; render(); }
    }
    if (target.dataset.action === "task") {
      if (message.actionStatus === "Task created") return;
      message.actionStatus = "Reviewing task preview…"; render();
      try {
        const preview = await saveEvent("action_preview", { interaction_id: message.meta.interactionId, action_type: "create_follow_up_task", title: `Follow up on: ${message.meta.card?.label || "AI analysis"}` });
        message.actionId = preview.action_id; message.actionStatus = "Ready to confirm";
      } catch { message.actionStatus = "Could not create task"; }
      render();
    }
    if (target.dataset.action === "confirm" && message.actionId) {
      message.actionStatus = "Creating task…"; render();
      try { await saveEvent("action_confirm", { action_id: message.actionId }); message.actionStatus = "Task created"; }
      catch { message.actionStatus = "Could not create task"; }
      render();
    }
    if (target.dataset.action === "cancel") { message.actionStatus = "Task not created"; render(); }
  });

  const setOpen = (open: boolean) => { panel.classList.toggle("is-open", open); launch.setAttribute("aria-expanded", String(open)); if (open) setTimeout(() => input.focus(), 50); };
  launch.addEventListener("click", () => setOpen(!panel.classList.contains("is-open"))); close.addEventListener("click", () => setOpen(false));
  form.addEventListener("submit", (event) => { event.preventDefault(); void ask(input.value); });
  input.addEventListener("keydown", (event) => { if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); void ask(input.value); } });
  render();
}

if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", mountChat); else mountChat();
