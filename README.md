# pi-fast-models

Automatic fast/priority serving for supported models in Pi, with a `/fast` command to toggle it. Currently supports **OpenAI GPT-6.1 Sol**. Packaged as a reusable Pi extension; no build step or runtime dependencies.

Requires **Pi 1.4.0 or newer** with the unified `openai` provider. Older `@mariozechner`-based Pi versions and the legacy `openai-codex` provider are not supported.

## Supported models

| Provider | Model | ChatGPT sign-in tier | API-key tier |
| --- | --- | --- | --- |
| `openai` | `gpt-6.1-sol` | `priority` | `priority` |

Support is explicitly scoped; newly released models are not automatically opted into higher-cost serving. More models can be added after their service-tier behavior is verified.

## Install

Install the pinned GitHub version:

```sh
pi install git:github.com/lilfrogdev/pi-fast-models@v0.1.1
```

Or keep a local clone somewhere permanent, then register it with Pi:

```sh
pi install /path/to/pi-fast-models
```

Local packages are loaded from that directory, not copied. Run `/reload` in an existing Pi session, or start a new session.

No `npm install` is needed to use the extension. Pi supplies its host imports at load time.

## Use

1. Authenticate with OpenAI using `/login` if necessary.
2. Select `openai/gpt-6.1-sol` with `/model`.
3. Fast mode is enabled automatically. Use `/fast off` to disable it for this session.

Fast/priority serving can increase OpenAI costs or subscription usage. Enabling and disabling are silent; use `/fast status` for details.

| Command | Behavior |
| --- | --- |
| `/fast` | Toggle on/off |
| `/fast on` | Enable fast/priority serving for the selected Sol model |
| `/fast off` | Stop modifying subsequent requests |
| `/fast status` | Show whether it is enabled and which tier it requests |

In the terminal footer, fast mode adds a tag to Pi's normal model label: `fast • gpt-6.1-sol • medium`. The thinking level remains whatever you selected. The tag means the extension is requesting fast serving, **not confirmation that OpenAI has granted the requested tier**.

The extension decorates Pi's stock footer renderer only while fast mode is on for a supported model. Switching to another model or using `/fast off` restores the unmodified renderer. Path, usage, context, provider labels, and other extension statuses still come from Pi. On very narrow terminals, the tag is omitted if the full model ID cannot fit. A footer supplied by another extension is not replaced; it will show the tag only if it uses Pi's stock renderer.

### Request behavior

When enabled, the extension sets the outgoing request's `service_tier` to `"priority"` for both ChatGPT sign-in (OAuth) and API keys. It does not read, copy, or store credentials.

### `Unsupported service_tier: fast` (HTTP 400)

Earlier versions sent the literal tier `"fast"` for ChatGPT sign-in. That value can be rejected by the backend. OpenAI's [Codex implementation](https://github.com/openai/codex/blob/main/codex-rs/protocol/src/config_types.rs) maps the user-facing Fast mode to `"priority"` in requests; this extension now does the same. A minimal live request with the current OpenAI credentials and `gpt-6.1-sol` succeeded with `"priority"`. This verifies request acceptance for that account/model, not the tier actually granted or eligibility for other accounts. No automatic fallback or retry is performed.

This requests a different serving tier; it does **not** change the model or reduce its thinking level. The hook applies to matching provider requests made by Pi while enabled, potentially including matching maintenance requests such as compaction. It does not add a search tool or change requests made independently by other extensions.

**OpenAI controls eligibility, availability, price, and usage limits.** It can reject or downgrade the request. The extension does not automatically retry through a cheaper tier or guarantee faster responses. OpenAI's billing/usage records are authoritative; Pi's cost display is only an estimate, especially when request payloads are modified by extensions. No exact price multiplier is assumed here.

## Safety and scope

- **On by default for supported models.** Restarting, reloading, resuming/replacing a session, or starting a new session resets to this default. There is no persistent preference.
- Unsupported models are never modified. Returning to a supported model enables fast mode unless you used `/fast off` in this session; that opt-out survives model switches.
- Only `openai/gpt-6.1-sol` using `openai-responses` and an official OpenAI endpoint is supported. Other models, providers, API protocols, and custom gateways are left alone.
- The request payload must also name `gpt-6.1-sol`; another model's request is never rewritten.
- Enabling is refused during an active run. Disabling is immediate for future requests but cannot change or refund an in-flight request.
- The extension leaves authentication, thinking settings, startup model, prompts, tools, and other request fields unchanged.
- `/fast off` makes this extension stop setting the tier. It does **not** remove tiers configured elsewhere, and another extension can subsequently override this one's payload changes.

## Reuse on another machine

Copy or clone this directory and run the same local `pi install` command. Keep `package.json`, `index.ts`, `README.md`, and `LICENSE`; development dependencies are not needed at runtime.

The public GitHub repository is [lilfrogdev/pi-fast-models](https://github.com/lilfrogdev/pi-fast-models). For a repeatable installation, use the pinned `v0.1.1` tag shown above.

This package has not been published to npm.

To uninstall the local package, use the same source path:

```sh
pi remove /path/to/pi-fast-models
```

Then reload Pi. This removes its registration, not your source directory.

## Development

With Node.js 22.19+:

```sh
npm ci --ignore-scripts
npm run typecheck
```

## License

MIT.
