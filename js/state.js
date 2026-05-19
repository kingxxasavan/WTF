import { storage } from "./storage.js";

export const uid = () =>
  Math.random().toString(36).slice(2, 10) + Date.now().toString(36);

const DEFAULT_CONTACTS = [
  { id: "me", name: "Me", color: "#7c5cff" },
];

export const state = {
  // Messaging
  chats: storage.get("wtf:chats", []),
  contacts: storage.get("wtf:contacts", DEFAULT_CONTACTS),
  // Chatbot
  botChats: storage.get("wtf:botChats", []),
  // Provider config { anthropic: {apiKey, model}, openai: {...}, ollama: {...} }
  providers: storage.get("wtf:providers", {
    anthropic: { apiKey: "", model: "claude-opus-4-7" },
    openai: { apiKey: "", model: "gpt-4o-mini" },
    ollama: { apiKey: "", model: "gpt-oss:20b" },
  }),
  // UI selection { chatId, botChatId, tab }
  selected: storage.get("wtf:selected", { chatId: null, botChatId: null, tab: "messaging" }),
};

export function persist() {
  storage.set("wtf:chats", state.chats);
  storage.set("wtf:contacts", state.contacts);
  storage.set("wtf:botChats", state.botChats);
  storage.set("wtf:providers", state.providers);
  storage.set("wtf:selected", state.selected);
}

export function reloadFromStorage() {
  state.chats = storage.get("wtf:chats", []);
  state.contacts = storage.get("wtf:contacts", DEFAULT_CONTACTS);
  state.botChats = storage.get("wtf:botChats", []);
  state.providers = storage.get("wtf:providers", state.providers);
  state.selected = storage.get("wtf:selected", state.selected);
}
