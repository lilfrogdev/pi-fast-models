# pi-fast-models

Fast mode for **OpenAI GPT-6.1 Sol** in Pi. Enabled by default, with a `/fast` command to toggle it.

Requires **Pi 1.4.0+**. Supports `openai/gpt-6.1-sol` using `openai-responses` on official OpenAI endpoints, with ChatGPT sign-in or an API key. Other models and custom gateways are left unchanged.

## Install

```sh
pi install git:github.com/lilfrogdev/pi-fast-models@v0.1.2
```

Or install a local clone:

```sh
pi install /path/to/pi-fast-models
```

Run `/reload` in an existing Pi session.

## Use

Select `openai/gpt-6.1-sol` with `/model`. Fast mode turns on automatically and adds a tag to the normal footer:

```text
fast • gpt-6.1-sol • medium
```

| Command | Action |
| --- | --- |
| `/fast` | Toggle fast mode |
| `/fast on` | Enable fast mode |
| `/fast off` | Disable fast mode |
| `/fast status` | Show current state and requested tier |

- Requests `service_tier="priority"` without changing the model or thinking level.
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
