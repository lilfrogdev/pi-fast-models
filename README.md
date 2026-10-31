# pi-fast-models

Fast mode for supported **OpenAI models** in Pi. Enabled by default, with a `/fast` command to toggle it.

Requires **Pi 1.4.0+**. Supports the native `openai` provider using `openai-responses` on official OpenAI endpoints, with ChatGPT sign-in or an API key. Other models, legacy providers, and custom gateways are left unchanged.

Supported models:

- `gpt-6.1-sol`
- `gpt-6-astra`
- `gpt-6-sol`
- `gpt-6-luna`
- `gpt-5.4`
- `gpt-5.5`
- `gpt-5.6-luna`
- `gpt-5.6-sol`
- `gpt-5.6-terra`

## Install

```sh
pi install git:github.com/lilfrogdev/pi-fast-models@v0.1.3
```

Or install a local clone:

```sh
pi install /path/to/pi-fast-models
```

Run `/reload` in an existing Pi session.

## Use

Select a supported OpenAI model with `/model`. Fast mode turns on automatically and adds a tag to the normal footer:

```text
fast • gpt-6.1-sol • medium
```

| Command | Action |
| --- | --- |
| `/fast` | Toggle fast mode |
| `/fast on` | Enable fast mode |
| `/fast off` | Disable fast mode |
| `/fast status` | Show current state and requested tier |

- Requests `service_tier="fast"` for API-key access or `service_tier="priority"` for ChatGPT sign-in, without changing the model or thinking level.
- Authentication is checked on every request, so changing authentication changes the requested tier.
- `/fast off` is respected across model switches. Reloading or starting/resuming a session resets to on by default.
- The tag disappears when disabled or using an unsupported model.
- Fast mode is charged at higher rates than standard speed, increasing API costs or subscription usage. The tag indicates a request, not a guarantee of priority serving.

## Development

```sh
npm ci --ignore-scripts
npm run typecheck
```

## License

MIT.
