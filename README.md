# mcp-v2-minimal

A minimal **MCP (Model Context Protocol) server** that actually runs on the **current** spec —
`2026-07-28` — using TypeScript SDK **v2** (`@modelcontextprotocol/server` 2.4.x).

Most MCP server examples you will find online target the 2025 revisions. They fail on today's SDK,
and they fail *quietly*: the host connects, then lists no tools.

```
[error] MCP server "myserver" failed to start: no tools found
```

This repo is the smallest thing that works, plus the notes that explain why the old shape stopped
working.

```
Verified on @modelcontextprotocol/server 2.4.0 · MCP spec 2026-07-28 · Node 20+
Built and smoke-tested on Node 25.8.2 / TypeScript 7.0.2
```

**This repo is the minimal cut.** The parts that cost the hours are in a paid kit: Streamable HTTP
with the `Host`/`Origin` guards, resources and resource templates, an 18-test harness, and the
cookbook with the full v1 → v2 migration diff.
**[MCP Starter Kit — $29 →](https://haojm.gumroad.com/l/mcp-starter-kit)**

## Quick start

```bash
npm install
npm run build
npm run smoke     # drives the server with a real client in memory — 6 checks, no subprocess
npm start         # the server itself; it waits on stdin
```

`npm start` prints one line to **stderr** and then waits. That is success:

```
[mcp-v2-minimal] ready on stdio
```

## Register it in a host

The host launches your server as a child process and speaks JSON-RPC over its stdin/stdout. Every host
uses the same launch command; only the config file differs.

**Claude Code**

```bash
claude mcp add minimal -- node /absolute/path/to/mcp-v2-minimal/dist/index.js
```

**Cursor** — `.cursor/mcp.json`

```json
{
  "mcpServers": {
    "minimal": { "command": "node", "args": ["/absolute/path/to/mcp-v2-minimal/dist/index.js"] }
  }
}
```

**VS Code (GitHub Copilot)** — `.vscode/mcp.json`

```json
{
  "servers": {
    "minimal": {
      "type": "stdio",
      "command": "node",
      "args": ["${workspaceFolder}/dist/index.js"]
    }
  }
}
```

**Claude Desktop** — `claude_desktop_config.json`, same `mcpServers` shape as Cursor.

## What changed, and why your old snippet breaks

| Concern | 2025 revisions | `2026-07-28` |
| --- | --- | --- |
| Package | `@modelcontextprotocol/sdk` | `@modelcontextprotocol/server` (split packages) |
| Register a tool | `server.tool(name, schema, fn)` | `server.registerTool(name, { description, inputSchema }, fn)` |
| Register a resource | `server.resource(...)` | `server.registerResource(name, uri, config, fn)` |
| stdio entry | `new StdioServerTransport()` + `server.connect(t)` | `serveStdio(createServer)` — hand it a **factory** |
| HTTP entry | transport per request + `connect()` | `createMcpHandler(factory)` → `{ fetch }` |
| Handshake | `initialize` / `notifications/initialized` | **removed**; version travels in `_meta` |
| Sessions | `Mcp-Session-Id` header | **removed**; the endpoint is stateless |
| Result shape | — | every result carries `resultType: "complete"` |
| Modules | CJS or ESM | **ESM only** |

The three symptoms these cause, in the order you will meet them:

1. **Connects, then no tools.** A `console.log` in the startup path. stdout is the protocol channel.
2. **`TypeError: server.connect is not a function`.** v1 code on v2.
3. **`server/discover` returns `-32601 Method not found`.** Not a bug: a request without
   `_meta["io.modelcontextprotocol/protocolVersion"]` is routed to the legacy 2025 path.

## The minimal server, in full

```ts
import { McpServer } from '@modelcontextprotocol/server';
import { serveStdio } from '@modelcontextprotocol/server/stdio';
import * as z from 'zod/v4';

export function createServer(): McpServer {
  const server = new McpServer({ name: 'mcp-v2-minimal', version: '1.0.0' });

  server.registerTool(
    'echo',
    {
      description: 'Return the text you pass in',
      inputSchema: z.object({ text: z.string().describe('Text to echo back') })
    },
    async ({ text }) => ({ content: [{ type: 'text', text }] })
  );

  return server;
}

void serveStdio(createServer);
console.error('[mcp-v2-minimal] ready on stdio');   // never console.log
```

Three details that matter more than they look:

- **`serveStdio` takes the factory, not an instance.** That is what makes the identical server serve
  HTTP later — the factory is called once per request, so nothing may be kept on the instance.
- **`inputSchema` is the only schema you write.** The SDK derives the JSON Schema the model sees,
  validates arguments before your handler runs, and infers your handler's types.
- **Bad arguments return an `isError: true` tool result, not a throw.** That is deliberate: the model
  reads the message and retries. `json_format` in `src/index.ts` shows the pattern.

## What the full kit adds (only if you need it)

This repo is deliberately minimal: one transport, two tools, no HTTP. The kit is for the moment you
outgrow it.

| | This repo | Full kit |
| --- | --- | --- |
| stdio transport | ✅ | ✅ |
| Streamable HTTP + `Host`/`Origin` guards | — | ✅ |
| Resources + resource templates + prompts | — | ✅ |
| Structured output / annotations examples | partial | ✅ |
| Tests | 6 (in memory) | 18 (10 in memory + 8 over a real socket) |
| v1 → v2 migration diff | summary table | full diff |
| HTTP header contract (`-32020` debugging) | — | ✅ |
| Configs: VS Code / Cursor / Claude Code / Claude Desktop | 4 snippets in this README | 4 files |
| Handbook (PDF, 15 pages) | — | ✅ |

→ **https://haojm.gumroad.com/l/mcp-starter-kit**

If this repo saved you an hour, a ⭐ helps someone else find it.

## License

MIT — see [LICENSE](LICENSE).
