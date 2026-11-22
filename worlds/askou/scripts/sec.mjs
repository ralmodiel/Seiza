// The dev server's forwarder to Askou, checked against a stand-in Askou that only records what reaches it (nothing is
// sent to the real Askou): the three calls the village makes get through, nothing else does, and a visitor's cookies,
// credentials and X-Chat-Log are not passed on.
// Usage: node worlds/askou/scripts/sec.mjs        prints `sec: N checks, M FAIL`
import http from "node:http";
import { createServer } from "vite";
import { Checks } from "./lib/village.mjs";

const c = new Checks();
const seen = [];
const echo = http.createServer((req, res) => {
  let body = "";
  req.on("data", (d) => (body += d));
  req.on("end", () => {
    seen.push({ method: req.method, url: req.url, headers: req.headers, body });
    res.setHeader("set-cookie", "askou=1; Path=/");
    res.setHeader("content-type", "application/json");
    res.end('{"ok":true}');
  });
});
await new Promise((r) => echo.listen(0, "127.0.0.1", r));
const stand = `http://127.0.0.1:${echo.address().port}`;

/** A request with the path exactly as written (fetch would tidy "/../" away). */
const call = (base, method, path, headers = {}, body) =>
  new Promise((done, fail) => {
    const u = new URL(base);
    const req = http.request({ host: u.hostname, port: u.port, method, path, headers: { ...headers, ...(body ? { "content-type": "application/json", "content-length": Buffer.byteLength(body) } : {}) } }, (res) => {
      let text = "";
      res.on("data", (d) => (text += d));
      res.on("end", () => done({ status: res.statusCode, headers: res.headers, text }));
    });
    req.on("error", fail);
    req.end(body);
  });
const serve = async (env) => {
  for (const k of ["ASKOU_URL", "ASKOU_TEST"]) delete process.env[k];
  Object.assign(process.env, { VITE_SEIZA_WORLD_ID: "askou" }, env);
  const vite = await createServer({ logLevel: "silent", server: { host: "127.0.0.1", port: 5300, strictPort: false, hmr: false, watch: null } });
  await vite.listen();
  return { vite, base: `http://127.0.0.1:${vite.httpServer.address().port}` };
};

let { vite, base } = await serve({ ASKOU_URL: stand, ASKOU_TEST: "1" });
try {
  const visitor = { cookie: "session=secret", authorization: "Bearer secret", "x-chat-log": "1" };
  for (const [method, path, body] of [["GET", "/askou/api/bot?bot=registrar"], ["GET", "/askou/api/bot/characters"], ["POST", "/askou/api/chat", '{"message":"hi"}']]) {
    const before = seen.length, r = await call(base, method, path, visitor, body), got = seen[before];
    if (!c.check(r.status === 200 && !!got, `${method} ${path} is forwarded`, `status ${r.status}`)) continue;
    c.check(got.url === path.replace("/askou", ""), `${method} ${path} arrives as Askou's own path`, got.url);
    c.check(!got.headers.cookie && !got.headers.authorization, `${method} ${path}: the visitor's cookies and credentials are not passed on`);
    c.check(!got.headers["x-chat-log"], `${method} ${path}: X-Chat-Log is dropped`);
    c.check(got.headers["x-askou-test"] === "1", `${method} ${path}: marked as a test with ASKOU_TEST=1`);
    c.check(!r.headers["set-cookie"], `${method} ${path}: Askou's cookies are not passed back`);
    if (body) c.check(got.body === body, "the question arrives unchanged");
  }
  const closed = [
    ["DELETE", "/askou/api/chat/conversation"], ["POST", "/askou/api/chat/reaction"], ["GET", "/askou/api/chat/updates"], ["GET", "/askou/api/chat"], ["POST", "/askou/api/bot"],
    ["PUT", "/askou/api/chat"], ["GET", "/askou/api/admin/bots"], ["GET", "/askou/api"], ["GET", "/askou/api/"], ["GET", "/askou/api/chat/../admin/bots"], ["GET", "/askou/api/bot/%2e%2e/admin/bots"],
    ["GET", "/askou/api/bot/characters/"], ["GET", "/askou/api/bot/../../actuator/health"], ["POST", "/askou/api/chat/"], ["GET", "/askou/api//bot"],
  ];
  for (const [method, path] of closed) {
    const before = seen.length, r = await call(base, method, path, visitor, method === "GET" ? undefined : "{}");
    c.check(r.status === 404 && seen.length === before, `${method} ${path} is not forwarded (404)`, `status ${r.status}, reached Askou ${seen.length - before}×`);
  }
  await vite.close();

  ({ vite, base } = await serve({ ASKOU_URL: stand }));
  let before = seen.length;
  await call(base, "GET", "/askou/api/bot");
  c.check(seen.length === before + 1 && !seen[before].headers["x-askou-test"], "without ASKOU_TEST a request is not marked as a test (real visitors)");
  await vite.close();

  ({ vite, base } = await serve({}));
  before = seen.length;
  await call(base, "GET", "/askou/api/bot");
  c.check(seen.length === before, "without ASKOU_URL nothing is forwarded");
} finally {
  await vite.close();
  echo.close();
}
c.done("sec");
