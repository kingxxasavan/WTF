import { state, persist, reloadFromStorage } from "./state.js";
import { providers } from "./providers.js";
import { storage } from "./storage.js";
import { $, $$ } from "./ui.js";

function bindProvider(key) {
  const keyInput = $(`#key-${key}`);
  const modelInput = $(`#model-${key}`);
  const cfg = state.providers[key] || (state.providers[key] = { apiKey: "", model: providers[key].models[0] });
  keyInput.value = cfg.apiKey || "";
  modelInput.value = cfg.model || providers[key].models[0];
  keyInput.addEventListener("input", () => {
    cfg.apiKey = keyInput.value.trim();
    persist();
  });
  modelInput.addEventListener("change", () => {
    cfg.model = modelInput.value;
    persist();
  });
}

async function testProvider(key, resultEl) {
  resultEl.className = "test-result";
  resultEl.textContent = "Testing…";
  try {
    const cfg = state.providers[key];
    await providers[key].test({ apiKey: cfg.apiKey, model: cfg.model });
    resultEl.className = "test-result ok";
    resultEl.textContent = "OK";
  } catch (e) {
    resultEl.className = "test-result err";
    resultEl.textContent = (e.message || String(e)).slice(0, 200);
  }
}

function exportAll() {
  const data = storage.exportAll();
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `wtf-export-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

function importPick(onReload) {
  $("#importFile").click();
  $("#importFile").onchange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const json = JSON.parse(await file.text());
      storage.importAll(json);
      reloadFromStorage();
      onReload();
    } catch (err) {
      alert("Import failed: " + err.message);
    }
    e.target.value = "";
  };
}

function wipe(onReload) {
  if (!window.confirm("Wipe ALL data in this browser (chats, contacts, AI history, API keys)?")) return;
  storage.wipe();
  reloadFromStorage();
  onReload();
}

export function initSettings(onReload) {
  for (const k of ["anthropic", "openai", "ollama"]) bindProvider(k);
  for (const btn of $$("button[data-test]")) {
    btn.onclick = () => {
      const key = btn.dataset.test;
      const result = $(`[data-test-result="${key}"]`);
      testProvider(key, result);
    };
  }
  $("#exportBtn").onclick = exportAll;
  $("#importBtn").onclick = () => importPick(onReload);
  $("#wipeBtn").onclick = () => wipe(onReload);
}

export function refreshSettings() {
  for (const k of ["anthropic", "openai", "ollama"]) {
    const cfg = state.providers[k];
    if (!cfg) continue;
    const keyInput = $(`#key-${k}`);
    const modelInput = $(`#model-${k}`);
    if (keyInput) keyInput.value = cfg.apiKey || "";
    if (modelInput) modelInput.value = cfg.model || providers[k].models[0];
  }
}
