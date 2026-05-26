# Plugin Authoring Smoke Example

A DealDesk plugin

## Development

```bash
pnpm install
pnpm dev            # watch builds
pnpm dev:ui         # local dev server with hot-reload events
pnpm test
```

## Install Into DealDesk

```bash
pnpm dealdesk plugin install ./
```

## Build Options

- `pnpm build` uses esbuild presets from `@dealdesk/plugin-sdk/bundlers`.
- `pnpm build:rollup` uses rollup presets from the same SDK.
