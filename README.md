# pi-fast-models

An opt-in `/fast` command for models with verified paid fast/priority support in Pi. Currently supports **OpenAI GPT-6.1 Sol**. Packaged as a reusable Pi extension; no build step or runtime dependencies.

Requires **Pi 1.4.0 or newer** with the unified `openai` provider. Tested against Pi 1.4.0. Older `@mariozechner`-based Pi versions and the legacy `openai-codex` provider are not supported.

## Supported models

| Provider | Model | ChatGPT sign-in tier | API-key tier |
| --- | --- | --- | --- |
| `openai` | `gpt-6.1-sol` | `fast` | `priority` |

Support is explicitly scoped; newly released models are not automatically opted into higher-cost serving. More models can be added after their service-tier behavior is verified.

## Install

Install the pinned GitHub version (the private repository requires GitHub access):

```sh
pi install git:github.com/lilfrogdev/pi-fast-models@v0.1.0
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

The GitHub repository is [lilfrogdev/pi-fast-models](https://github.com/lilfrogdev/pi-fast-models). For a repeatable installation, use the pinned `v0.1.0` tag shown above. A private repository requires authenticated Git access, for example through `gh auth login` and `gh auth setup-git`.

This package has not been published to npm.

To uninstall the local package, use the same source path:

```sh
pi remove /path/to/pi-fast-models
```

Then reload Pi. This removes its registration, not your source directory.

## Develop and verify

With Node.js 22.19+:

```sh
npm ci --ignore-scripts
npm run typecheck
npm test
```

Unit tests use a mock ExtensionAPI and inspect payload transformations without contacting a model provider. A separate smoke test starts a real Pi executable in an isolated temporary home with no credentials, offline startup, and MCP disabled. It verifies package loading and slash-command handling, without starting a model run. The smoke test is skipped if `pi` is unavailable; set `PI_BIN=/path/to/pi` to choose an executable.

Actual OpenAI acceptance/performance has not been live-tested. Enabling and sending your next prompt is a paid operation subject to your account's terms.

## License

MIT.
