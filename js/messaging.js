import { state, persist, uid } from "./state.js";
import { $, $$, el, initials, fmtTime, ask, confirmAction } from "./ui.js";

const SCRATCH_KIND = { CHAT: "chat", GROUP: "group" };

function contactById(id) {
  return state.contacts.find(c => c.id === id) || { id, name: "Unknown", color: "#666" };
}

function chatById(id) {
  return state.chats.find(c => c.id === id);
}

function ensureMe() {
  if (!state.contacts.some(c => c.id === "me")) {
    state.contacts.unshift({ id: "me", name: "Me", color: "#7c5cff" });
  }
}

function lastMessagePreview(chat) {
  const m = chat.messages[chat.messages.length - 1];
  if (!m) return "No messages yet";
  const c = contactById(m.senderId);
  return `${c.name}: ${m.text.slice(0, 60)}`;
}

function renderChatList() {
  const list = $("#chatList");
  const q = $("#chatSearch").value.trim().toLowerCase();
  list.innerHTML = "";
  const chats = [...state.chats].sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
  for (const chat of chats) {
    if (q && !chat.name.toLowerCase().includes(q)) continue;
    const li = el("li", {
      class: chat.id === state.selected.chatId ? "selected" : "",
      onclick: () => selectChat(chat.id),
    },
      el("div", { class: "avatar", style: `background:${chat.color || "#7c5cff"}` }, initials(chat.name)),
      el("div", { style: "min-width:0;flex:1" },
        el("div", { class: "name" }, chat.name + (chat.kind === SCRATCH_KIND.GROUP ? "  ·  group" : "")),
        el("div", { class: "preview" }, lastMessagePreview(chat)),
      ),
      el("div", { class: "meta" }, chat.updatedAt ? fmtTime(chat.updatedAt) : ""),
    );
    list.append(li);
  }
}

function renderComposerSenders(chat) {
  const sel = $("#composerSender");
  sel.innerHTML = "";
  const senders = chat.kind === SCRATCH_KIND.GROUP
    ? chat.memberIds.map(contactById)
    : [contactById("me"), contactById(chat.peerId)];
  for (const s of senders) {
    const opt = el("option", { value: s.id }, s.name);
    sel.append(opt);
  }
  // Default to "me" if present.
  if (senders.some(s => s.id === "me")) sel.value = "me";
}

function renderMessages(chat) {
  const wrap = $("#messageList");
  wrap.innerHTML = "";
  for (const m of chat.messages) {
    const c = contactById(m.senderId);
    const mine = m.senderId === "me";
    const node = el("div", { class: `msg ${mine ? "me" : ""}` },
      el("div", { class: "avatar", style: `background:${c.color}` }, initials(c.name)),
      el("div", {},
        el("div", { class: "who" }, c.name),
        el("div", { class: "bubble" }, m.text),
        el("div", { class: "stamp" }, fmtTime(m.ts)),
        el("div", { class: "actions" },
          el("button", { onclick: () => editMessage(chat.id, m.id) }, "Edit"),
          el("button", { onclick: () => deleteMessage(chat.id, m.id) }, "Delete"),
        ),
      ),
    );
    wrap.append(node);
  }
  wrap.scrollTop = wrap.scrollHeight;
}

function renderConversation() {
  const chat = chatById(state.selected.chatId);
  if (!chat) {
    $("#convoEmpty").classList.remove("hidden");
    $("#convoView").classList.add("hidden");
    return;
  }
  $("#convoEmpty").classList.add("hidden");
  $("#convoView").classList.remove("hidden");
  $("#convoAvatar").style.background = chat.color || "#7c5cff";
  $("#convoAvatar").textContent = initials(chat.name);
  $("#convoTitle").textContent = chat.name;
  $("#convoSub").textContent = chat.kind === SCRATCH_KIND.GROUP
    ? `${chat.memberIds.length} members`
    : "Direct chat";
  $("#convoMembersBtn").classList.toggle("hidden", chat.kind !== SCRATCH_KIND.GROUP);
  renderComposerSenders(chat);
  renderMessages(chat);
}

function selectChat(id) {
  state.selected.chatId = id;
  persist();
  renderChatList();
  renderConversation();
}

async function newChat() {
  ensureMe();
  const name = await ask("New chat", "");
  if (!name) return;
  // Make a peer contact for this chat with a random color.
  const colors = ["#22c55e", "#06b6d4", "#f97316", "#e11d48", "#a855f7", "#eab308"];
  const color = colors[Math.floor(Math.random() * colors.length)];
  const peer = { id: uid(), name, color };
  state.contacts.push(peer);
  const chat = {
    id: uid(),
    kind: SCRATCH_KIND.CHAT,
    name,
    color,
    peerId: peer.id,
    messages: [],
    updatedAt: Date.now(),
  };
  state.chats.push(chat);
  state.selected.chatId = chat.id;
  persist();
  renderChatList();
  renderConversation();
}

async function newGroup() {
  ensureMe();
  const name = await ask("New group name", "");
  if (!name) return;
  const memberIds = ["me", ...state.contacts.filter(c => c.id !== "me").slice(0, 0).map(c => c.id)];
  const chat = {
    id: uid(),
    kind: SCRATCH_KIND.GROUP,
    name,
    color: "#5b8cff",
    memberIds,
    messages: [],
    updatedAt: Date.now(),
  };
  state.chats.push(chat);
  state.selected.chatId = chat.id;
  persist();
  renderChatList();
  renderConversation();
  openMembers();
}

function sendMessage() {
  const chat = chatById(state.selected.chatId);
  if (!chat) return;
  const ta = $("#composerInput");
  const text = ta.value.trim();
  if (!text) return;
  const senderId = $("#composerSender").value || "me";
  chat.messages.push({ id: uid(), senderId, text, ts: Date.now() });
  chat.updatedAt = Date.now();
  ta.value = "";
  persist();
  renderChatList();
  renderMessages(chat);
}

async function editMessage(chatId, msgId) {
  const chat = chatById(chatId);
  const m = chat?.messages.find(x => x.id === msgId);
  if (!m) return;
  const next = await ask("Edit message", m.text);
  if (next == null) return;
  m.text = next;
  persist();
  renderMessages(chat);
}

async function deleteMessage(chatId, msgId) {
  if (!(await confirmAction("Delete this message?"))) return;
  const chat = chatById(chatId);
  if (!chat) return;
  chat.messages = chat.messages.filter(m => m.id !== msgId);
  persist();
  renderChatList();
  renderMessages(chat);
}

async function renameChat() {
  const chat = chatById(state.selected.chatId);
  if (!chat) return;
  const name = await ask("Rename", chat.name);
  if (!name) return;
  chat.name = name;
  persist();
  renderChatList();
  renderConversation();
}

async function deleteChat() {
  const chat = chatById(state.selected.chatId);
  if (!chat) return;
  if (!(await confirmAction(`Delete "${chat.name}"? Messages will be lost.`))) return;
  state.chats = state.chats.filter(c => c.id !== chat.id);
  state.selected.chatId = null;
  persist();
  renderChatList();
  renderConversation();
}

function openContacts() {
  const dlg = $("#contactsDialog");
  const list = $("#contactsList");
  function paint() {
    list.innerHTML = "";
    for (const c of state.contacts) {
      const li = el("li", {},
        el("span", { class: "swatch", style: `background:${c.color}` }),
        el("span", { class: "name" }, c.name + (c.id === "me" ? " (you)" : "")),
        c.id === "me" ? null : el("button", {
          class: "del",
          onclick: () => {
            state.contacts = state.contacts.filter(x => x.id !== c.id);
            // Remove from any group memberships.
            for (const ch of state.chats) {
              if (ch.kind === SCRATCH_KIND.GROUP) {
                ch.memberIds = ch.memberIds.filter(id => id !== c.id);
              }
            }
            persist();
            paint();
            renderChatList();
            renderConversation();
          },
        }, "Remove"),
      );
      list.append(li);
    }
  }
  paint();
  $("#addContactBtn").onclick = () => {
    const name = $("#newContactName").value.trim();
    const color = $("#newContactColor").value;
    if (!name) return;
    state.contacts.push({ id: uid(), name, color });
    $("#newContactName").value = "";
    persist();
    paint();
  };
  dlg.showModal();
}

function openMembers() {
  const chat = chatById(state.selected.chatId);
  if (!chat || chat.kind !== SCRATCH_KIND.GROUP) return;
  const dlg = $("#membersDialog");
  const list = $("#memberCheckList");
  list.innerHTML = "";
  for (const c of state.contacts) {
    const checked = chat.memberIds.includes(c.id);
    const cb = el("input", { type: "checkbox", checked });
    cb.addEventListener("change", () => {
      if (cb.checked) {
        if (!chat.memberIds.includes(c.id)) chat.memberIds.push(c.id);
      } else {
        chat.memberIds = chat.memberIds.filter(id => id !== c.id);
      }
      persist();
      renderConversation();
    });
    const li = el("li", {},
      cb,
      el("span", { class: "swatch", style: `background:${c.color}` }),
      el("span", { class: "name" }, c.name + (c.id === "me" ? " (you)" : "")),
    );
    list.append(li);
  }
  dlg.showModal();
}

export function initMessaging() {
  ensureMe();
  $("#newChatBtn").onclick = newChat;
  $("#newGroupBtn").onclick = newGroup;
  $("#composerSend").onclick = sendMessage;
  $("#composerInput").addEventListener("keydown", e => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); }
  });
  $("#convoRenameBtn").onclick = renameChat;
  $("#convoDeleteBtn").onclick = deleteChat;
  $("#convoMembersBtn").onclick = openMembers;
  $("#manageContactsBtn").onclick = openContacts;
  $("#chatSearch").addEventListener("input", renderChatList);
  renderChatList();
  renderConversation();
}

export function refreshMessaging() {
  renderChatList();
  renderConversation();
}
