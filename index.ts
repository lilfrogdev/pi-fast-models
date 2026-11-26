import {
  FooterComponent,
  type ExtensionAPI,
  type ExtensionContext,
} from "@earendil-works/pi-coding-agent";

type SpeedMode = "off" | "fast" | "ultrafast";
type EnabledMode = Exclude<SpeedMode, "off">;

const MODEL_CAPABILITIES = new Map<string, EnabledMode>([
  ["gpt-6.2-sol", "ultrafast"],
  ["gpt-6.2-astra", "ultrafast"],
  ["gpt-6.1-sol", "fast"],
  ["gpt-6-astra", "fast"],
  ["gpt-6-sol", "fast"],
  ["gpt-6-luna", "fast"],
  ["gpt-5.4", "fast"],
  ["gpt-5.5", "fast"],
  ["gpt-5.6-luna", "fast"],
  ["gpt-5.6-sol", "fast"],
  ["gpt-5.6-terra", "fast"],
]);

type Model = ExtensionContext["model"];

function supportsModel(model: Model): model is NonNullable<Model> {
  if (
    model?.provider !== "openai" ||
    !MODEL_CAPABILITIES.has(model.id) ||
    model.api !== "openai-responses"
  ) {
    return false;
  }

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

function notify(
  ctx: ExtensionContext,
  message: string,
  level: "info" | "warning" = "info",
): void {
  if (ctx.hasUI) {
    ctx.ui.notify(message, level);
  } else {
    console.error(`[pi-fast-models] ${message}`);
  }
}

export default function fastModels(pi: ExtensionAPI): void {
  let preference: SpeedMode | undefined;
  let restoreFooter: (() => void) | undefined;

  function effectiveMode(model: Model): SpeedMode {
    if (!supportsModel(model) || preference === "off") return "off";
    const requested = preference ?? (model.id === "gpt-6.2-sol" ? "ultrafast" : "fast");
    return requested === "ultrafast" && MODEL_CAPABILITIES.get(model.id) === "ultrafast"
      ? "ultrafast"
      : "fast";
  }

  function requestedTier(ctx: ExtensionContext, mode: EnabledMode): "fast" | "priority" | "ultrafast" {
    if (mode === "ultrafast") return "ultrafast";
    return ctx.model && ctx.modelRegistry.isUsingOAuth(ctx.model) ? "priority" : "fast";
  }

  function updateFooter(ctx: ExtensionContext, model: Model = ctx.model): void {
    if (ctx.mode !== "tui") return;
    restoreFooter?.();
    restoreFooter = undefined;
    if (effectiveMode(model) === "off") return;

    const originalRender = FooterComponent.prototype.render;
    const render: typeof originalRender = function (this: FooterComponent, width) {
      const lines = originalRender.call(this, width);
      const mode = effectiveMode(ctx.model);
      if (mode === "off") return lines;

      const prefix = `${mode} • `;
      if (width <= prefix.length) return lines;
      const compactLine = originalRender.call(this, width - prefix.length)[1];
      const index = compactLine?.indexOf(ctx.model!.id) ?? -1;
      if (index < 0) return lines;

      lines[1] = compactLine.slice(0, index)
        + ctx.ui.theme.fg("dim", prefix + compactLine.slice(index));
      return lines;
    };

    FooterComponent.prototype.render = render;
    restoreFooter = () => {
      if (FooterComponent.prototype.render === render) {
        FooterComponent.prototype.render = originalRender;
      }
    };
  }

  pi.on("session_start", (_event, ctx) => {
    preference = undefined;
    updateFooter(ctx);
  });

  pi.on("model_select", (event, ctx) => {
    updateFooter(ctx, event.model);
  });

  pi.on("session_shutdown", () => {
    restoreFooter?.();
    restoreFooter = undefined;
  });

  pi.registerCommand("fast", {
    description: "Toggle speed mode (Ultrafast by default for GPT 6.2 Sol, Fast for other supported OpenAI models): /fast [on|off|ultrafast|status]",
    getArgumentCompletions: (prefix) => {
      const choices = ["on", "off", "ultrafast", "status"].filter((value) =>
        value.startsWith(prefix.toLowerCase()),
      );
      return choices.length
        ? choices.map((value) => ({ value, label: value }))
        : null;
    },
    handler: async (args, ctx) => {
      const action = args.trim().toLowerCase();
      if (!["", "on", "off", "ultrafast", "status"].includes(action)) {
        notify(ctx, "Usage: /fast [on|off|ultrafast|status]", "warning");
        return;
      }

      const mode = effectiveMode(ctx.model);
      if (action === "status") {
        notify(
          ctx,
          (mode !== "off"
            ? `${mode === "ultrafast" ? "Ultrafast" : "Fast"} mode ON for ${ctx.model!.provider}/${ctx.model!.id}: requesting service_tier="${requestedTier(ctx, mode)}".`
            : `Fast mode OFF.${supportsModel(ctx.model) ? " Use /fast on to enable." : " Select a supported OpenAI model to use fast mode."}`)
            + ` Session preference: ${preference ?? "automatic (model default)"}.`,
        );
        return;
      }

      const next: SpeedMode = action === ""
        ? (mode === "off" ? "fast" : "off")
        : action === "off" ? "off" : action === "ultrafast" ? "ultrafast" : "fast";
      if (next !== "off" && !supportsModel(ctx.model)) {
        notify(
          ctx,
          "Fast mode requires a supported OpenAI model on an official OpenAI endpoint. Select one with /model first.",
          "warning",
        );
        return;
      }
      if (next === "ultrafast" && MODEL_CAPABILITIES.get(ctx.model!.id) !== "ultrafast") {
        notify(ctx, "Ultrafast requires a supported GPT 6.2 Sol or Astra model. Session preference unchanged.", "warning");
        return;
      }
      if (next !== "off" && next !== mode && !ctx.isIdle()) {
        notify(ctx, "Wait for the current run to finish, or abort it, before changing to an enabled speed mode.", "warning");
        return;
      }

      preference = next;
      updateFooter(ctx);
    },
  });

  pi.on("before_provider_request", (event, ctx) => {
    const mode = effectiveMode(ctx.model);
    if (mode === "off") return;
    const payload = event.payload;
    if (
      payload === null ||
      typeof payload !== "object" ||
      Array.isArray(payload) ||
      !("model" in payload) ||
      payload.model !== ctx.model?.id
    ) {
      return;
    }

    return { ...payload, service_tier: requestedTier(ctx, mode) };
  });
}
