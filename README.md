# Effect NodeHttpServer - aborted request blocks disposal

An aborted downstream request can leave a `NodeHttpServer` handler fiber alive indefinitely, blocking scoped server disposal beyond `gracefulShutdownTimeout`.

## Reproduction

```bash
npm install
node repro.mjs
```

## Expected

`runtime.dispose()` completes after the configured 100 ms graceful shutdown timeout.

## Actual

`runtime.dispose()` remains pending and the reproduction fails after two seconds:

```text
Error: FAIL: runtime.dispose exceeded 2 seconds
```

## Versions

- `effect`: `4.0.0-beta.99`
- `@effect/platform-node`: `4.0.0-beta.99`
- Node.js: `24.15.0`
- Linux: `x86_64`

The same reproduction fails against Effect main at `ce95d88603e9facbcd6c462c5444e391792dde6b`.

## Related Issue

https://github.com/Effect-TS/effect/issues/6485
