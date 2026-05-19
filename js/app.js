import { storage } from "./storage.js";
import { state, persist, reloadFromStorage } from "./state.js";
import { $, $$ } from "./ui.js";
import { initMessaging, refreshMessaging } from "./messaging.js";
import { initChatbot, refreshChatbot } from "./chatbot.js";
import { initSettings, refreshSettings } from "./settings.js";

function setTab(name) {
  for (const t of $$(".tab")) t.classList.toggle("active", t.dataset.tab === name);
  for (const v of $$(".view")) v.classList.toggle("active", v.id === `view-${name}`);
  state.selected.tab = name;
  persist();
}

function initTabs() {
  for (const t of $$(".tab")) {
    t.addEventListener("click", () => setTab(t.dataset.tab));
  }
  // Anchor-style nav from inside views.
  document.body.addEventListener("click", e => {
    const a = e.target.closest("[data-goto]");
    if (!a) return;
    e.preventDefault();
    setTab(a.dataset.goto);
  });
}

function refreshAll() {
  refreshMessaging();
  refreshChatbot();
  refreshSettings();
}

function initPrivateMode() {
  const toggle = $("#privateToggle");
  const banner = $("#privateBanner");
  function apply() {
    const on = storage.isPrivate();
    toggle.checked = on;
    banner.classList.toggle("hidden", !on);
  }
  apply();
  toggle.addEventListener("change", () => {
    storage.setPrivate(toggle.checked);
    reloadFromStorage();
    apply();
    refreshAll();
  });
}

function main() {
  initTabs();
  initPrivateMode();
  initMessaging();
  initChatbot();
  initSettings(refreshAll);
  setTab(state.selected.tab || "messaging");
}

main();
