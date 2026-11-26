# pi-fast-models

Fast and Ultrafast modes for supported **OpenAI models** in Pi. GPT 6.2 Sol defaults to Ultrafast. GPT 6.2 Astra and all other supported models default to Fast. Use `/fast on` to force Fast or `/fast ultrafast` to opt into Ultrafast on Astra.

Requires **Pi 1.4.0+**. Supports the native `openai` provider using `openai-responses` on official OpenAI endpoints, with ChatGPT sign-in or an API key. Other models, legacy providers, and custom gateways are left unchanged.

Models supporting Fast and Ultrafast:

- `gpt-6.2-sol`
- `gpt-6.2-astra`

Models supporting Fast only:

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

Select a supported OpenAI model with `/model`. The model's default speed mode turns on automatically and adds a tag to the normal footer:

```text
ultrafast • gpt-6.2-sol • medium
```

| Command | Action |
| --- | --- |
| `/fast` | Turn the active speed mode off, or switch from off to Fast |
| `/fast on` | Force Fast, including on GPT 6.2 Sol |
| `/fast ultrafast` | Select Ultrafast on GPT 6.2 Sol or Astra |
| `/fast off` | Disable both speed modes |
| `/fast status` | Show effective mode, requested tier, and session preference |

- Fast requests `service_tier="fast"` for API-key access or `service_tier="priority"` for ChatGPT sign-in. Ultrafast requests `service_tier="ultrafast"` for either authentication type. Neither changes the model or thinking level.
- Authentication is checked on every request, so changing authentication changes the Fast tier.
- Until you select a mode, model switches use each model's default. `/fast status` reports the session preference as `automatic (model default)`.
- An explicit session preference survives model switches. With Ultrafast selected, switching to a Fast-only model uses Fast; returning to GPT 6.2 Sol or Astra resumes Ultrafast. The footer and status show the effective mode.
- Selecting Ultrafast on an older or unsupported model is rejected without changing the preference. Changing to an enabled mode requires an idle session.
- `/fast off` is respected across model switches. Toggling back on with `/fast` explicitly selects Fast, even on Sol. Reloading or starting/resuming a session resets to model defaults.
- The footer shows `fast` or `ultrafast` and disappears when disabled or using an unsupported model.
- Speed tiers can increase API costs or subscription usage. Sol now requests Ultrafast automatically unless you select Fast or turn speed mode off. Pi's reported costs may not reflect Ultrafast pricing. The tag indicates the requested tier, not account eligibility or a guarantee of actual served speed.
- OpenAI documents Ultrafast support for API keys and Codex. Availability through native Pi OAuth on its direct route has not been independently verified. This extension does not change authentication or establish entitlement.

## Development

```sh
npm ci --ignore-scripts
npm run typecheck
```

## License

MIT.
