import type {
  ExtensionAPI,
  ExtensionContext,
} from "@earendil-works/pi-coding-agent";

const MODEL_ID = "gpt-6.1-sol";
const MODEL_NAME = "openai/gpt-6.1-sol";
const STATUS_KEY = "pi-fast-models";

type Model = ExtensionContext["model"];

function supportsModel(model: Model): model is NonNullable<Model> {
  if (
    model?.provider !== "openai" ||
    model.id !== MODEL_ID ||
    model.api !== "openai-responses"
  ) {
    return false;
  }

  // Do not assume a custom OpenAI-compatible gateway implements these tiers.
  try {
    const url = new URL(model.baseUrl);
    const path = url.pathname.replace(/\/+$/, "");
    return (
      !url.username &&
      !url.password &&
      !url.search &&
      !url.hash &&
      ((url.origin === "https://api.openai.com" && path === "/v1") ||
        (url.origin === "https://chatgpt.com" && path === "/backend-api"))
    );
  } catch {
    return false;
  }
}

function requestedTier(ctx: ExtensionContext): "fast" | "priority" {
  // Pi 1.4's unified OpenAI provider uses the ChatGPT protocol for OAuth.
  return ctx.model && ctx.modelRegistry.isUsingOAuth(ctx.model)
    ? "fast"
    : "priority";
}

function notify(
  ctx: ExtensionContext,
  message: string,
  level: "info" | "warning" = "info",
): void {
  if (ctx.hasUI) {
    ctx.ui.notify(message, level);
  } else {
    // Preserve stdout for print-mode output and JSON/RPC protocol records.
    console.error(`[pi-fast-models] ${message}`);
  }
}

export default function fastModels(pi: ExtensionAPI): void {
  // Deliberately not persisted: restart, reload, and session replacement reset it.
  let enabled = false;

  function updateStatus(ctx: ExtensionContext, model: Model = ctx.model): void {
    if (ctx.mode !== "tui") return;
    ctx.ui.setStatus(
      STATUS_KEY,
      enabled
        ? ctx.ui.theme.fg("warning", "fast: ON (paid)")
        : supportsModel(model)
          ? ctx.ui.theme.fg("dim", "fast: off")
          : undefined,
    );
  }

  pi.on("session_start", (_event, ctx) => {
    enabled = false;
    updateStatus(ctx);
  });

  pi.on("model_select", (event, ctx) => {
    if (enabled && !supportsModel(event.model)) {
      enabled = false;
      notify(ctx, "Fast mode OFF after leaving the supported Sol model.");
    }
    updateStatus(ctx, event.model);
  });

  pi.registerCommand("fast", {
    description: "Toggle paid fast mode for GPT-6.1 Sol: /fast [on|off|status]",
    getArgumentCompletions: (prefix) => {
      const choices = ["on", "off", "status"].filter((value) =>
        value.startsWith(prefix.toLowerCase()),
      );
      return choices.length
        ? choices.map((value) => ({ value, label: value }))
        : null;
    },
    handler: async (args, ctx) => {
      const action = args.trim().toLowerCase();
      if (!["", "on", "off", "status"].includes(action)) {
        notify(ctx, "Usage: /fast [on|off|status]", "warning");
        return;
      }

      if (action === "status") {
        notify(
          ctx,
          enabled
            ? `Fast mode ON for ${MODEL_NAME}: requesting service_tier="${requestedTier(ctx)}" (paid).`
            : `Fast mode OFF. Select ${MODEL_NAME}, then /fast on to opt in.`,
        );
        return;
      }

      const next = action === "" ? !enabled : action === "on";
      if (next && !supportsModel(ctx.model)) {
        notify(
          ctx,
          `Fast mode is only supported for ${MODEL_NAME} on an official OpenAI endpoint. Select it with /model first.`,
          "warning",
        );
        return;
      }
      if (next && !enabled && !ctx.isIdle()) {
        notify(ctx, "Wait for the current run to finish, or abort it, before enabling paid fast mode.", "warning");
        return;
      }

      enabled = next;
      updateStatus(ctx);
      notify(
        ctx,
        enabled
          ? `Fast mode ON for ${MODEL_NAME}: requesting service_tier="${requestedTier(ctx)}". Higher OpenAI cost/usage rates apply; acceptance is determined by OpenAI.`
          : "Fast mode OFF. Subsequent requests are no longer modified; in-flight requests are unchanged.",
        enabled ? "warning" : "info",
      );
    },
  });

  pi.on("before_provider_request", (event, ctx) => {
    if (!enabled || !supportsModel(ctx.model)) return;
    const payload = event.payload;
    if (
      payload === null ||
      typeof payload !== "object" ||
      Array.isArray(payload) ||
      !("model" in payload) ||
      payload.model !== MODEL_ID
    ) {
      return;
    }

    // Preserve all other fields and earlier extensions' transformations.
    return { ...payload, service_tier: requestedTier(ctx) };
  });
}
