import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import { once } from "node:events";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const root = dirname(dirname(fileURLToPath(import.meta.url)));

test("real Pi loads the package and handles /fast without a model call", { timeout: 30000 }, async (t) => {
  const binary = process.env.PI_BIN || "pi";
  const temp = await mkdtemp(join(tmpdir(), "pi-fast-models-smoke-"));
  let child;
  let exited;
  try {
    const agentDir = join(temp, "agent");
    await mkdir(agentDir);
    const env = {
      PATH: process.env.PATH,
      HOME: temp,
      PI_CODING_AGENT_DIR: agentDir,
      PI_OFFLINE: "1",
      TERM: "dumb",
    };
    const version = spawnSync(binary, ["--version"], { env, encoding: "utf8", timeout: 5000 });
    if (version.error?.code === "ENOENT") {
      t.skip("Pi executable unavailable; set PI_BIN to run the smoke test");
      return;
    }
    assert.equal(version.status, 0, version.stderr || String(version.error));
    await writeFile(join(agentDir, "settings.json"), JSON.stringify({
      packages: [root],
      enableInstallTelemetry: false,
      defaultProjectTrust: "never",
    }));

    child = spawn(binary, [
      "--offline", "--mode", "rpc", "--no-session", "--no-mcp",
      "--no-skills", "--no-prompt-templates", "--no-themes",
      "--provider", "openai", "--model", "gpt-6.1-sol",
    ], { cwd: temp, env, stdio: ["pipe", "pipe", "pipe"] });
    exited = once(child, "exit");
    const pending = new Map();
    const records = [];
    let stderr = "";
    let buffer = "";
    let counter = 0;
    child.stderr.setEncoding("utf8").on("data", (data) => { stderr += data; });
    child.stdout.setEncoding("utf8").on("data", (data) => {
      buffer += data;
      let newline;
      while ((newline = buffer.indexOf("\n")) !== -1) {
        const line = buffer.slice(0, newline).replace(/\r$/, "");
        buffer = buffer.slice(newline + 1);
        if (!line) continue;
        let record;
        try {
          record = JSON.parse(line);
        } catch (error) {
          for (const waiter of pending.values()) waiter.reject(error);
          continue;
        }
        records.push(record);
        if (record.type === "response") pending.get(record.id)?.resolve(record);
      }
    });

    async function rpc(type, extra = {}) {
      const id = String(++counter);
      const response = await new Promise((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error(`RPC ${type} timed out: ${stderr}`)), 8000);
        pending.set(id, {
          resolve: (value) => { clearTimeout(timer); pending.delete(id); resolve(value); },
          reject: (error) => { clearTimeout(timer); pending.delete(id); reject(error); },
        });
        child.stdin.write(`${JSON.stringify({ id, type, ...extra })}\n`);
      });
      assert.equal(response.success, true, response.error || stderr);
      return response.data;
    }

    const { commands } = await rpc("get_commands");
    assert.equal(commands.filter((command) => command.name === "fast").length, 1, stderr);
    const { model } = await rpc("get_state");
    assert.equal(model.id, "gpt-6.1-sol");
    assert.equal(model.provider, "openai");

    const notification = () => records.findLast((record) =>
      record.type === "extension_ui_request" && record.method === "notify")?.message;
    for (const [message, expected] of [
      ["/fast status", /Fast mode OFF/],
      ["/fast on", /service_tier="priority"/],
      ["/fast status", /Fast mode ON/],
      ["/fast off", /Fast mode OFF/],
    ]) {
      const result = await rpc("prompt", { message });
      assert.equal(result.disposition, "handled", message);
      assert.match(notification() || "", expected);
    }
    const stats = await rpc("get_session_stats");
    assert.equal(stats.cost, 0);
    assert.equal(stats.tokens.total, 0);
    assert.equal(records.some((record) => record.type === "agent_start"), false);
    assert.doesNotMatch(stderr, /failed to load|extension error/i);
  } finally {
    if (child) {
      const killTimer = setTimeout(() => child.kill("SIGKILL"), 3000);
      child.stdin.end();
      await exited;
      clearTimeout(killTimer);
    }
    await rm(temp, { recursive: true, force: true });
  }
});
