import {
  FooterComponent,
  type ExtensionAPI,
  type ExtensionContext,
} from "@earendil-works/pi-coding-agent";

const MODEL_ID = "gpt-6.1-sol";
const MODEL_NAME = "openai/gpt-6.1-sol";

type Model = ExtensionContext["model"];

function supportsModel(model: Model): model is NonNullable<Model> {
  if (
    model?.provider !== "openai" ||
    model.id !== MODEL_ID ||
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
  let preference: boolean | undefined;
  let restoreFooter: (() => void) | undefined;

  function isEnabled(model: Model): boolean {
    return supportsModel(model) && preference !== false;
  }

  function updateFooter(ctx: ExtensionContext, model: Model = ctx.model): void {
    if (ctx.mode !== "tui") return;
    restoreFooter?.();
    restoreFooter = undefined;
    if (!isEnabled(model)) return;

    const originalRender = FooterComponent.prototype.render;
    const render: typeof originalRender = function (this: FooterComponent, width) {
      const lines = originalRender.call(this, width);
      if (!isEnabled(ctx.model)) return lines;

      const prefix = "fast • ";
      if (width <= prefix.length) return lines;
      const compactLine = originalRender.call(this, width - prefix.length)[1];
      const index = compactLine?.indexOf(MODEL_ID) ?? -1;
      if (index < 0) return lines;

      lines[1] = compactLine.slice(0, index)
        + ctx.ui.theme.fg("accent", "fast")
        + ctx.ui.theme.fg("dim", " • " + compactLine.slice(index));
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
    description: "Toggle fast mode (on by default) for GPT-6.1 Sol: /fast [on|off|status]",
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
          isEnabled(ctx.model)
            ? `Fast mode ON for ${MODEL_NAME}: requesting service_tier="priority".`
            : `Fast mode OFF.${supportsModel(ctx.model) ? " Use /fast on to enable." : ` Select ${MODEL_NAME} to use fast mode.`}`,
        );
        return;
      }

      const next = action === "" ? !isEnabled(ctx.model) : action === "on";
      if (next && !supportsModel(ctx.model)) {
        notify(
          ctx,
          `Fast mode is only supported for ${MODEL_NAME} on an official OpenAI endpoint. Select it with /model first.`,
          "warning",
        );
        return;
      }
      if (next && !isEnabled(ctx.model) && !ctx.isIdle()) {
        notify(ctx, "Wait for the current run to finish, or abort it, before enabling fast mode.", "warning");
        return;
      }

      preference = next;
      updateFooter(ctx);
    },
  });

  pi.on("before_provider_request", (event, ctx) => {
    if (!isEnabled(ctx.model)) return;
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

    return { ...payload, service_tier: "priority" };
  });
}
