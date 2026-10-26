import assert from "node:assert/strict";
import test from "node:test";
import fastModels from "../index.ts";

const target = () => ({
  provider: "openai",
  id: "gpt-6.1-sol",
  api: "openai-responses",
  baseUrl: "https://api.openai.com/v1",
});

function harness({ oauth = true, model = target(), mode = "tui", idle = true } = {}) {
  const events = new Map();
  const commands = new Map();
  const notifications = [];
  const statuses = new Map();
  const ctx = {
    model,
    mode,
    hasUI: mode === "tui" || mode === "rpc",
    isIdle: () => idle,
    modelRegistry: { isUsingOAuth: () => oauth },
    ui: {
      notify: (message, level) => notifications.push({ message, level }),
      setStatus: (key, value) => statuses.set(key, value),
      theme: { fg: (_color, value) => value },
    },
  };
  fastModels({
    on: (name, handler) => events.set(name, handler),
    registerCommand: (name, command) => commands.set(name, command),
  });
  const emit = (name, event = {}) => events.get(name)?.({ type: name, ...event }, ctx);
  return {
    ctx, events, commands, notifications, statuses, emit,
    command: (args = "") => commands.get("fast").handler(args, ctx),
    request: (payload = { model: "gpt-6.1-sol" }) => emit("before_provider_request", { payload }),
    select: (model) => {
      const previousModel = ctx.model;
      ctx.model = model;
      return emit("model_select", { model, previousModel, source: "set" });
    },
  };
}

test("registers a /fast command with argument completions", () => {
  const h = harness();
  assert.deepEqual([...h.commands.keys()], ["fast"]);
  const complete = h.commands.get("fast").getArgumentCompletions;
  assert.deepEqual(complete("").map((item) => item.value), ["on", "off", "status"]);
  assert.deepEqual(complete("O").map((item) => item.value), ["on", "off"]);
  assert.equal(complete("unknown"), null);
});

test("defaults to off and leaves existing request tiers alone", () => {
  const h = harness();
  h.emit("session_start");
  const payload = Object.freeze({ model: "gpt-6.1-sol", service_tier: "flex" });
  assert.equal(h.request(payload), undefined);
  assert.equal(payload.service_tier, "flex");
  assert.equal(h.statuses.get("pi-fast-models"), "fast: off");
});

test("ChatGPT OAuth requests fast without mutating any other field", async () => {
  const h = harness();
  await h.command("on");
  const payload = Object.freeze({
    model: "gpt-6.1-sol",
    input: [{ role: "user", content: "test" }],
    reasoning: { effort: "high" },
    tools: [{ name: "example" }],
    service_tier: "default",
  });
  const result = h.request(payload);
  assert.deepEqual(result, { ...payload, service_tier: "fast" });
  assert.notEqual(result, payload);
  assert.equal(result.reasoning, payload.reasoning);
  assert.equal(result.tools, payload.tools);
  assert.equal(payload.service_tier, "default");
  assert.match(h.notifications.at(-1).message, /Higher OpenAI cost\/usage/);
  assert.equal(h.statuses.get("pi-fast-models"), "fast: ON (paid)");
});

test("API-key authentication requests the priority tier", async () => {
  const h = harness({ oauth: false });
  await h.command("on");
  assert.equal(h.request().service_tier, "priority");
});

test("turning off stops modifying subsequent requests", async () => {
  const h = harness();
  await h.command("on");
  await h.command("off");
  assert.equal(h.request(), undefined);
  assert.equal(h.statuses.get("pi-fast-models"), "fast: off");
});

test("/fast with no argument toggles, and arguments ignore case/whitespace", async () => {
  const h = harness();
  await h.command();
  assert.equal(h.request().service_tier, "fast");
  await h.command();
  assert.equal(h.request(), undefined);
  await h.command("  ON  ");
  assert.equal(h.request().service_tier, "fast");
});

test("status and invalid arguments never change the selected mode", async () => {
  const h = harness();
  await h.command("status");
  assert.match(h.notifications.at(-1).message, /OFF/);
  assert.equal(h.request(), undefined);
  await h.command("on");
  await h.command("status");
  assert.match(h.notifications.at(-1).message, /service_tier="fast"/);
  await h.command("on please");
  assert.match(h.notifications.at(-1).message, /Usage:/);
  assert.equal(h.request().service_tier, "fast");
});

for (const [name, model] of [
  ["other GPT models", { ...target(), id: "gpt-5.5" }],
  ["other providers", { ...target(), provider: "openrouter" }],
  ["the legacy Codex provider", { ...target(), provider: "openai-codex", api: "openai-codex-responses" }],
  ["other API protocols", { ...target(), api: "openai-completions" }],
  ["custom gateways", { ...target(), baseUrl: "https://gateway.example.com/v1" }],
  ["look-alike hosts", { ...target(), baseUrl: "https://api.openai.com.example.com/v1" }],
  ["non-HTTPS endpoints", { ...target(), baseUrl: "http://api.openai.com/v1" }],
  ["URLs with credentials", { ...target(), baseUrl: "https://user:password@api.openai.com/v1" }],
  ["URLs with query parameters", { ...target(), baseUrl: "https://api.openai.com/v1?api-key=example" }],
  ["malformed URLs", { ...target(), baseUrl: "not a URL" }],
  ["no selected model", null],
]) {
  test(`refuses enabling for ${name}`, async () => {
    const h = harness({ model });
    await h.command("on");
    assert.match(h.notifications.at(-1).message, /only supported/);
    assert.equal(h.request(), undefined);
  });
}

for (const baseUrl of ["https://api.openai.com/v1/", "https://chatgpt.com/backend-api"]) {
  test(`allows the official endpoint ${baseUrl}`, async () => {
    const h = harness({ model: { ...target(), baseUrl } });
    await h.command("on");
    assert.equal(h.request().service_tier, "fast");
  });
}

test("other-model and malformed payloads are never rewritten", async () => {
  const h = harness();
  await h.command("on");
  for (const payload of [
    { model: "gpt-5.5" }, {}, null, undefined, [], "text", 42,
  ]) {
    // Call emit directly because request(undefined) uses its default payload.
    assert.equal(h.emit("before_provider_request", { payload }), undefined);
  }
});

test("leaving Sol disables fast mode and returning does not re-enable it", async () => {
  const h = harness();
  await h.command("on");
  h.select({ ...target(), id: "gpt-5.5" });
  assert.equal(h.request(), undefined);
  assert.equal(h.statuses.get("pi-fast-models"), undefined);
  h.select(target());
  assert.equal(h.request(), undefined);
  assert.equal(h.statuses.get("pi-fast-models"), "fast: off");
});

test("request hook independently checks provider and model scope", async () => {
  const h = harness();
  await h.command("on");
  h.ctx.model = { ...target(), provider: "openrouter" };
  assert.equal(h.request(), undefined);
});

test("session startup and a fresh extension runtime always default to off", async () => {
  const h = harness();
  await h.command("on");
  h.emit("session_start");
  assert.equal(h.request(), undefined);
  assert.equal(harness().request(), undefined);
});

test("does not enable during a run but allows disabling immediately", async () => {
  const h = harness({ idle: false });
  await h.command("on");
  assert.match(h.notifications.at(-1).message, /current run/);
  assert.equal(h.request(), undefined);

  h.ctx.isIdle = () => true;
  await h.command("on");
  h.ctx.isIdle = () => false;
  await h.command("off");
  assert.equal(h.request(), undefined);
});

test("RPC gets notifications but no terminal-only status calls", async () => {
  const h = harness({ mode: "rpc" });
  h.ctx.ui.setStatus = () => { throw new Error("RPC has no terminal status"); };
  h.emit("session_start");
  await h.command("on");
  assert.equal(h.request().service_tier, "fast");
  assert.match(h.notifications.at(-1).message, /Fast mode ON/);
});

test("print/JSON feedback uses stderr, never stdout", async (t) => {
  const stderr = t.mock.method(console, "error", () => {});
  const stdout = t.mock.method(console, "log", () => {
    throw new Error("must not pollute stdout");
  });
  const h = harness({ mode: "json" });
  h.emit("session_start");
  await h.command("status");
  assert.equal(stderr.mock.callCount(), 1);
  assert.equal(stdout.mock.callCount(), 0);
});
