// Storage adapter. When privateMode is on, all reads/writes go to sessionStorage.
// Otherwise localStorage. Switching modes copies the current state across once
// so the UI doesn't jump.

const PRIVATE_FLAG_KEY = "wtf:privateMode";
const APP_KEYS = [
  "wtf:chats",
  "wtf:contacts",
  "wtf:botChats",
  "wtf:providers",
  "wtf:selected",
];

function isPrivate() {
  // The flag itself lives in sessionStorage so closing the tab resets it.
  return sessionStorage.getItem(PRIVATE_FLAG_KEY) === "1";
}

function backend() {
  return isPrivate() ? sessionStorage : localStorage;
}

export const storage = {
  isPrivate,

  setPrivate(on) {
    const was = isPrivate();
    if (was === on) return;
    if (on) {
      // Copy current localStorage values into sessionStorage so the UI keeps
      // showing the same state while editing — but only for this tab.
      for (const k of APP_KEYS) {
        const v = localStorage.getItem(k);
        if (v != null) sessionStorage.setItem(k, v);
      }
      sessionStorage.setItem(PRIVATE_FLAG_KEY, "1");
    } else {
      // Leaving private mode: drop the session copy so future reads come from
      // localStorage. We do NOT persist session changes to localStorage.
      sessionStorage.removeItem(PRIVATE_FLAG_KEY);
      for (const k of APP_KEYS) sessionStorage.removeItem(k);
    }
  },

  get(key, fallback) {
    const raw = backend().getItem(key);
    if (raw == null) return fallback;
    try { return JSON.parse(raw); } catch { return fallback; }
  },

  set(key, value) {
    backend().setItem(key, JSON.stringify(value));
  },

  remove(key) {
    backend().removeItem(key);
  },

  wipe() {
    for (const k of APP_KEYS) backend().removeItem(k);
  },

  exportAll() {
    const out = {};
    for (const k of APP_KEYS) {
      const v = backend().getItem(k);
      if (v != null) out[k] = JSON.parse(v);
    }
    return out;
  },

  importAll(obj) {
    for (const k of APP_KEYS) {
      if (obj[k] !== undefined) backend().setItem(k, JSON.stringify(obj[k]));
    }
  },
};
