// AI provider adapters. All calls happen directly from the browser.
// Each provider exposes:
//   async stream({apiKey, model, messages, onDelta, signal})
//   async test({apiKey, model})

const ANTHROPIC_URL = "https://api.anthropic.com/v1/messages";
const OPENAI_URL = "https://api.openai.com/v1/chat/completions";
const OLLAMA_URL = "https://ollama.com/api/chat";

function toAnthropicMessages(messages) {
  // Anthropic wants alternating user/assistant. System messages go in a top-level field.
  const sys = messages.filter(m => m.role === "system").map(m => m.content).join("\n\n");
  const msgs = messages
    .filter(m => m.role !== "system")
    .map(m => ({ role: m.role, content: m.content }));
  return { system: sys || undefined, messages: msgs };
}

async function readSse(response, onEvent) {
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    let idx;
    while ((idx = buffer.indexOf("\n\n")) !== -1) {
      const raw = buffer.slice(0, idx);
      buffer = buffer.slice(idx + 2);
      const lines = raw.split("\n");
      let event = "message";
      const dataLines = [];
      for (const line of lines) {
        if (line.startsWith("event:")) event = line.slice(6).trim();
        else if (line.startsWith("data:")) dataLines.push(line.slice(5).trim());
      }
      if (dataLines.length) onEvent(event, dataLines.join("\n"));
    }
  }
}

async function readNdjson(response, onLine) {
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    let idx;
    while ((idx = buffer.indexOf("\n")) !== -1) {
      const line = buffer.slice(0, idx).trim();
      buffer = buffer.slice(idx + 1);
      if (line) onLine(line);
    }
  }
}

export const providers = {
  anthropic: {
    label: "Anthropic",
    models: ["claude-opus-4-7", "claude-sonnet-4-6", "claude-haiku-4-5-20251001"],
    async stream({ apiKey, model, messages, onDelta, signal }) {
      if (!apiKey) throw new Error("Set your Anthropic API key in Settings.");
      const { system, messages: msgs } = toAnthropicMessages(messages);
      const res = await fetch(ANTHROPIC_URL, {
        method: "POST",
        signal,
        headers: {
          "content-type": "application/json",
          "x-api-key": apiKey,
          "anthropic-version": "2023-06-01",
          "anthropic-dangerous-direct-browser-access": "true",
        },
        body: JSON.stringify({
          model,
          max_tokens: 1024,
          stream: true,
          system,
          messages: msgs,
        }),
      });
      if (!res.ok) {
        const txt = await res.text().catch(() => "");
        throw new Error(`Anthropic ${res.status}: ${txt.slice(0, 300)}`);
      }
      await readSse(res, (event, data) => {
        if (event === "content_block_delta") {
          try {
            const j = JSON.parse(data);
            const t = j.delta?.text;
            if (t) onDelta(t);
          } catch {}
        } else if (event === "error") {
          try {
            const j = JSON.parse(data);
            throw new Error(j.error?.message || "stream error");
          } catch {}
        }
      });
    },
    async test({ apiKey, model }) {
      let out = "";
      await this.stream({
        apiKey, model,
        messages: [{ role: "user", content: "Reply with just: pong" }],
        onDelta: t => (out += t),
      });
      return out.trim();
    },
  },

  openai: {
    label: "OpenAI",
    models: ["gpt-4o", "gpt-4o-mini", "gpt-4.1", "gpt-4.1-mini", "o4-mini"],
    async stream({ apiKey, model, messages, onDelta, signal }) {
      if (!apiKey) throw new Error("Set your OpenAI API key in Settings.");
      const res = await fetch(OPENAI_URL, {
        method: "POST",
        signal,
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({ model, messages, stream: true }),
      });
      if (!res.ok) {
        const txt = await res.text().catch(() => "");
        throw new Error(`OpenAI ${res.status}: ${txt.slice(0, 300)}`);
      }
      await readSse(res, (_event, data) => {
        if (data === "[DONE]") return;
        try {
          const j = JSON.parse(data);
          const t = j.choices?.[0]?.delta?.content;
          if (t) onDelta(t);
        } catch {}
      });
    },
    async test({ apiKey, model }) {
      let out = "";
      await this.stream({
        apiKey, model,
        messages: [{ role: "user", content: "Reply with just: pong" }],
        onDelta: t => (out += t),
      });
      return out.trim();
    },
  },

  ollama: {
    label: "Ollama Cloud",
    models: ["gpt-oss:20b", "gpt-oss:120b", "deepseek-v3.1:671b", "qwen3-coder:480b", "kimi-k2:1t"],
    async stream({ apiKey, model, messages, onDelta, signal }) {
      if (!apiKey) throw new Error("Set your Ollama Cloud API key in Settings.");
      const res = await fetch(OLLAMA_URL, {
        method: "POST",
        signal,
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({ model, messages, stream: true }),
      });
      if (!res.ok) {
        const txt = await res.text().catch(() => "");
        throw new Error(`Ollama ${res.status}: ${txt.slice(0, 300)}`);
      }
      await readNdjson(res, line => {
        try {
          const j = JSON.parse(line);
          const t = j.message?.content;
          if (t) onDelta(t);
        } catch {}
      });
    },
    async test({ apiKey, model }) {
      let out = "";
      await this.stream({
        apiKey, model,
        messages: [{ role: "user", content: "Reply with just: pong" }],
        onDelta: t => (out += t),
      });
      return out.trim();
    },
  },
};
