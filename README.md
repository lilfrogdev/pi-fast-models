# pi-fast-models

An opt-in `/fast` command for models with verified paid fast/priority support in Pi. Currently supports **OpenAI GPT-6.1 Sol**. Packaged as a reusable Pi extension; no build step or runtime dependencies.

Requires **Pi 1.4.0 or newer** with the unified `openai` provider. Older `@mariozechner`-based Pi versions and the legacy `openai-codex` provider are not supported.

## Supported models

| Provider | Model | ChatGPT sign-in tier | API-key tier |
| --- | --- | --- | --- |
| `openai` | `gpt-6.1-sol` | `fast` | `priority` |

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

No `npm install` is needed to use the extension. Its only host import is a TypeScript type import, removed at load time.

## Use

1. Authenticate with OpenAI using `/login` if necessary.
2. Select `openai/gpt-6.1-sol` with `/model`.
3. Run `/fast on` when you want to opt into higher-cost serving.

| Command | Behavior |
| --- | --- |
| `/fast` | Toggle on/off |
| `/fast on` | Opt into the paid fast/priority tier for the selected Sol model |
| `/fast off` | Stop modifying subsequent requests |
| `/fast status` | Show whether it is enabled and which tier it requests |

In the terminal footer, `fast: ON (paid)` means the extension is requesting fast serving. It is **not confirmation that OpenAI has granted the requested tier**.

### Request behavior

When explicitly enabled, the extension sets the outgoing request's `service_tier`:

- **Sign in with ChatGPT (OAuth):** `"fast"`.
- **OpenAI API key:** `"priority"`.

The distinction follows Pi 1.4's unified OpenAI provider. The extension uses Pi's reported authentication method; it does not read, copy, or store credentials. Avoid mixing a stored ChatGPT login with a temporary `--api-key` override: use the intended login method so the reported authentication method matches the credential used.

This requests a different serving tier; it does **not** change the model or reduce its thinking level. The hook applies to matching provider requests made by Pi while enabled, potentially including matching maintenance requests such as compaction. It does not add a search tool or change requests made independently by other extensions.

**OpenAI controls eligibility, availability, price, and usage limits.** It can reject or downgrade the request. The extension does not automatically retry through a cheaper tier or guarantee faster responses. OpenAI's billing/usage records are authoritative; Pi's cost display is only an estimate, especially when request payloads are modified by extensions. No exact price multiplier is assumed here.

## Safety and scope

- **Off by default.** Restarting, reloading, resuming/replacing a session, or starting a new session resets the extension to off. There is no persistent paid-mode preference.
- Switching away from the supported model turns it off. Switching back does not silently turn it on again.
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
