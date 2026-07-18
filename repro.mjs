import http from "node:http"

import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import * as ManagedRuntime from "effect/ManagedRuntime"
import * as FetchHttpClient from "effect/unstable/http/FetchHttpClient"
import * as HttpClient from "effect/unstable/http/HttpClient"
import * as HttpRouter from "effect/unstable/http/HttpRouter"
import * as HttpServerRequest from "effect/unstable/http/HttpServerRequest"
import * as HttpServerResponse from "effect/unstable/http/HttpServerResponse"
import * as NodeHttpServer from "@effect/platform-node/NodeHttpServer"

let markUpstreamStarted
const upstreamStarted = new Promise((resolve) => {
  markUpstreamStarted = resolve
})
const upstream = http.createServer(() => {
  markUpstreamStarted()
  // Keep the upstream HEAD pending so downstream cancellation must interrupt it.
})
await listen(upstream)

const server = http.createServer()
const router = HttpRouter.use((router) =>
  router.add(
    "GET",
    "/",
    Effect.gen(function*() {
      const request = yield* HttpServerRequest.HttpServerRequest
      if (request.method !== "HEAD") return HttpServerResponse.text("ok")
      yield* HttpClient.head(`http://localhost:${tcpPort(upstream)}`)
      return HttpServerResponse.empty()
    })
  )
)
const runtime = ManagedRuntime.make(
  Layer.effectDiscard(
    HttpRouter.serve(router).pipe(
      Layer.provide(NodeHttpServer.layer(() => server, {
        port: 0,
        gracefulShutdownTimeout: "100 millis"
      })),
      Layer.provide(FetchHttpClient.layer),
      Layer.launch,
      Effect.forkScoped,
      Effect.asVoid
    )
  )
)

await runtime.context()
if (!server.listening) await new Promise((resolve) => server.once("listening", resolve))

const downstream = http.request({ method: "HEAD", port: tcpPort(server), path: "/" })
downstream.on("error", () => {})
downstream.end()
await upstreamStarted
downstream.destroy()
await new Promise((resolve) => downstream.once("close", resolve))

await Promise.race([
  runtime.dispose().then(() => console.log("PASS: runtime.dispose completed")),
  new Promise((_, reject) =>
    setTimeout(() => reject(new Error("FAIL: runtime.dispose exceeded 2 seconds")), 2_000)
  )
])

function listen(server) {
  return new Promise((resolve) => server.listen(0, resolve))
}

function tcpPort(server) {
  const address = server.address()
  if (address === null || typeof address === "string") throw new Error("expected TCP address")
  return address.port
}
