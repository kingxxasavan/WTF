import { state, persist, uid } from "./state.js";
import { providers } from "./providers.js";
import { $, el, fmtTime, ask, confirmAction, initials } from "./ui.js";

function botById(id) {
  return state.botChats.find(c => c.id === id);
}

function renderBotList() {
  const list = $("#botChatList");
  list.innerHTML = "";
  const chats = [...state.botChats].sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
  for (const chat of chats) {
    const li = el("li", {
      class: chat.id === state.selected.botChatId ? "selected" : "",
      onclick: () => selectBot(chat.id),
    },
      el("div", { class: "avatar" }, "AI"),
      el("div", { style: "min-width:0;flex:1" },
        el("div", { class: "name" }, chat.name),
        el("div", { class: "preview" },
          `${providers[chat.provider]?.label || chat.provider} · ${chat.model}`,
        ),
      ),
      el("div", { class: "meta" }, chat.updatedAt ? fmtTime(chat.updatedAt) : ""),
    );
    list.append(li);
  }
}

function fillProviderModelSelects(chat) {
  const provSel = $("#botProviderSelect");
  const modelSel = $("#botModelSelect");
  provSel.innerHTML = "";
  for (const [key, p] of Object.entries(providers)) {
    provSel.append(el("option", { value: key }, p.label));
  }
  provSel.value = chat.provider;
  function fillModels(pkey) {
    modelSel.innerHTML = "";
    for (const m of providers[pkey].models) {
      modelSel.append(el("option", { value: m }, m));
    }
    modelSel.value = chat.model && providers[pkey].models.includes(chat.model)
      ? chat.model
      : providers[pkey].models[0];
  }
  fillModels(chat.provider);
  provSel.onchange = () => {
    chat.provider = provSel.value;
    fillModels(chat.provider);
    chat.model = modelSel.value;
    persist();
    renderBotList();
    renderBotHeader(chat);
  };
  modelSel.onchange = () => {
    chat.model = modelSel.value;
    persist();
    renderBotList();
    renderBotHeader(chat);
  };
}

function renderBotHeader(chat) {
  $("#botTitle").textContent = chat.name;
  $("#botSub").textContent = `${providers[chat.provider]?.label || chat.provider} · ${chat.model}`;
}

function renderBotMessages(chat, streamingId = null) {
  const wrap = $("#botMessageList");
  wrap.innerHTML = "";
  for (const m of chat.messages) {
    if (m.role === "system") continue;
    const mine = m.role === "user";
    const node = el("div", { class: `msg ${mine ? "me" : ""}` },
      el("div", { class: "avatar", style: mine ? "background:#7c5cff" : "background:#22c55e" },
        mine ? initials("Me") : "AI"),
      el("div", {},
        el("div", { class: "who" }, mine ? "You" : (providers[chat.provider]?.label || "Assistant")),
        el("div", { class: "bubble", id: `bot-msg-${m.id}` }, m.content || ""),
        el("div", { class: "stamp" }, m.ts ? fmtTime(m.ts) : ""),
        mine ? null : el("div", { class: "actions" },
          el("button", { onclick: () => regenerate(chat.id, m.id) }, "Regenerate"),
          el("button", { onclick: () => deleteBotMessage(chat.id, m.id) }, "Delete"),
        ),
      ),
    );
    wrap.append(node);
  }
  wrap.scrollTop = wrap.scrollHeight;
}

function renderBotConversation() {
  const chat = botById(state.selected.botChatId);
  if (!chat) {
    $("#botEmpty").classList.remove("hidden");
    $("#botView").classList.add("hidden");
    return;
  }
  $("#botEmpty").classList.add("hidden");
  $("#botView").classList.remove("hidden");
  fillProviderModelSelects(chat);
  renderBotHeader(chat);
  renderBotMessages(chat);
}

function selectBot(id) {
  state.selected.botChatId = id;
  persist();
  renderBotList();
  renderBotConversation();
}

async function newBotChat() {
  // Pick first provider that has a key, else default to anthropic.
  const order = ["anthropic", "openai", "ollama"];
  const pkey = order.find(k => state.providers[k]?.apiKey) || "anthropic";
  const chat = {
    id: uid(),
    name: "New chat",
    provider: pkey,
    model: state.providers[pkey]?.model || providers[pkey].models[0],
    messages: [
      { id: uid(), role: "system", content: "You are a helpful assistant.", ts: Date.now() },
    ],
    updatedAt: Date.now(),
  };
  state.botChats.push(chat);
  state.selected.botChatId = chat.id;
  persist();
  renderBotList();
  renderBotConversation();
  $("#botInput").focus();
}

async function send() {
  const chat = botById(state.selected.botChatId);
  if (!chat) return;
  const ta = $("#botInput");
  const text = ta.value.trim();
  if (!text) return;
  ta.value = "";
  ta.disabled = true;
  $("#botSend").disabled = true;

  chat.messages.push({ id: uid(), role: "user", content: text, ts: Date.now() });
  // Auto-name from first user message.
  if (chat.name === "New chat") chat.name = text.slice(0, 40);
  const assistant = { id: uid(), role: "assistant", content: "", ts: Date.now() };
  chat.messages.push(assistant);
  chat.updatedAt = Date.now();
  persist();
  renderBotList();
  renderBotMessages(chat);

  const bubble = $(`#bot-msg-${assistant.id}`);
  const provider = providers[chat.provider];
  const cfg = state.providers[chat.provider];
  try {
    await provider.stream({
      apiKey: cfg.apiKey,
      model: chat.model,
      messages: chat.messages
        .filter(m => m.id !== assistant.id)
        .map(m => ({ role: m.role, content: m.content })),
      onDelta: t => {
        assistant.content += t;
        if (bubble) bubble.textContent = assistant.content;
        $("#botMessageList").scrollTop = $("#botMessageList").scrollHeight;
      },
    });
  } catch (e) {
    assistant.content = (assistant.content ? assistant.content + "\n\n" : "") +
      `⚠️ ${e.message || e}`;
    if (bubble) bubble.textContent = assistant.content;
  }
  assistant.ts = Date.now();
  chat.updatedAt = Date.now();
  persist();
  renderBotList();
  ta.disabled = false;
  $("#botSend").disabled = false;
  ta.focus();
}

async function regenerate(chatId, msgId) {
  const chat = botById(chatId);
  if (!chat) return;
  const idx = chat.messages.findIndex(m => m.id === msgId);
  if (idx < 0) return;
  // Drop this assistant message and resend prior context.
  const prior = chat.messages.slice(0, idx);
  const assistant = { id: uid(), role: "assistant", content: "", ts: Date.now() };
  chat.messages = [...prior, assistant];
  persist();
  renderBotMessages(chat);
  const bubble = $(`#bot-msg-${assistant.id}`);
  const provider = providers[chat.provider];
  const cfg = state.providers[chat.provider];
  try {
    await provider.stream({
      apiKey: cfg.apiKey,
      model: chat.model,
      messages: prior.map(m => ({ role: m.role, content: m.content })),
      onDelta: t => {
        assistant.content += t;
        if (bubble) bubble.textContent = assistant.content;
      },
    });
  } catch (e) {
    assistant.content = `⚠️ ${e.message || e}`;
    if (bubble) bubble.textContent = assistant.content;
  }
  assistant.ts = Date.now();
  chat.updatedAt = Date.now();
  persist();
  renderBotList();
}

async function deleteBotMessage(chatId, msgId) {
  if (!(await confirmAction("Delete this message?"))) return;
  const chat = botById(chatId);
  if (!chat) return;
  chat.messages = chat.messages.filter(m => m.id !== msgId);
  persist();
  renderBotMessages(chat);
}

async function renameBot() {
  const chat = botById(state.selected.botChatId);
  if (!chat) return;
  const name = await ask("Rename conversation", chat.name);
  if (!name) return;
  chat.name = name;
  persist();
  renderBotList();
  renderBotHeader(chat);
}

async function deleteBot() {
  const chat = botById(state.selected.botChatId);
  if (!chat) return;
  if (!(await confirmAction(`Delete "${chat.name}"?`))) return;
  state.botChats = state.botChats.filter(c => c.id !== chat.id);
  state.selected.botChatId = null;
  persist();
  renderBotList();
  renderBotConversation();
}

export function initChatbot() {
  $("#newBotChatBtn").onclick = newBotChat;
  $("#botSend").onclick = send;
  $("#botInput").addEventListener("keydown", e => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); }
  });
  $("#botRenameBtn").onclick = renameBot;
  $("#botDeleteBtn").onclick = deleteBot;
  renderBotList();
  renderBotConversation();
}

export function refreshChatbot() {
  renderBotList();
  renderBotConversation();
}
