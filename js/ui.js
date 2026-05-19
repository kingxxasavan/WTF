// Small UI helpers shared across views.

export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

export function el(tag, attrs = {}, ...children) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === "class") node.className = v;
    else if (k === "dataset") Object.assign(node.dataset, v);
    else if (k.startsWith("on") && typeof v === "function") {
      node.addEventListener(k.slice(2).toLowerCase(), v);
    } else if (v === true) node.setAttribute(k, "");
    else if (v === false || v == null) {}
    else node.setAttribute(k, v);
  }
  for (const c of children.flat()) {
    if (c == null || c === false) continue;
    node.append(c.nodeType ? c : document.createTextNode(String(c)));
  }
  return node;
}

export function initials(name) {
  return (name || "?")
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map(w => w[0]?.toUpperCase() || "")
    .join("");
}

export function fmtTime(ts) {
  const d = new Date(ts);
  const now = new Date();
  const sameDay = d.toDateString() === now.toDateString();
  return sameDay
    ? d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
    : d.toLocaleDateString([], { month: "short", day: "numeric" });
}

export function ask(title, defaultValue = "") {
  return new Promise(resolve => {
    const dlg = document.getElementById("promptDialog");
    const titleEl = document.getElementById("promptTitle");
    const input = document.getElementById("promptInput");
    titleEl.textContent = title;
    input.value = defaultValue;
    const onClose = () => {
      dlg.removeEventListener("close", onClose);
      resolve(dlg.returnValue === "ok" ? input.value.trim() : null);
    };
    dlg.addEventListener("close", onClose);
    dlg.showModal();
    setTimeout(() => input.focus(), 0);
  });
}

export function confirmAction(message) {
  // Small wrapper so we have a single place to swap for a custom dialog later.
  return Promise.resolve(window.confirm(message));
}
