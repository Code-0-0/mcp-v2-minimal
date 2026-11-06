/**
 * A minimal MCP server written against the current spec (2026-07-28) and the
 * v2 TypeScript SDK (`@modelcontextprotocol/server` 2.4.x).
 *
 * Two things about this file are the whole point:
 *
 *   1. `serveStdio(createServer)` — the v2 entry. There is no transport object
 *      and no `server.connect(...)`. v2 servers are factories.
 *   2. Logging goes to stderr. stdout is the JSON-RPC channel; one `console.log`
 *      corrupts framing and the host drops the connection without an error.
 */
import { pathToFileURL } from 'node:url';
import { McpServer } from '@modelcontextprotocol/server';
import { serveStdio } from '@modelcontextprotocol/server/stdio';
import * as z from 'zod/v4';

export function createServer(): McpServer {
  const server = new McpServer(
    { name: 'mcp-v2-minimal', version: '1.0.0' },
    {
      instructions:
        'Two small utilities. Use json_format to normalise JSON the user pasted, and echo to verify the connection.'
    }
  );

  server.registerTool(
    'echo',
    {
      title: 'Echo',
      description: 'Return the text you pass in. Use this to confirm a host is actually connected.',
      annotations: { readOnlyHint: true, idempotentHint: true },
      inputSchema: z.object({
        text: z.string().min(1).describe('Text to echo back')
      })
    },
    async ({ text }) => ({ content: [{ type: 'text', text }] })
  );

  server.registerTool(
    'json_format',
    {
      title: 'Format JSON',
      description:
        'Parse JSON and return it pretty-printed with a stable key order. Returns a readable error instead of throwing when the input is not valid JSON.',
      annotations: { readOnlyHint: true, idempotentHint: true },
      inputSchema: z.object({
        json: z.string().describe('The JSON text to format'),
        indent: z.number().int().min(0).max(8).default(2).describe('Spaces of indentation')
      }),
      outputSchema: z.object({
        keys: z.number().int(),
        formatted: z.string()
      })
    },
    async ({ json, indent }) => {
      let parsed: unknown;
      try {
        parsed = JSON.parse(json);
      } catch (error) {
        // A schema violation or a bad input comes back as isError:true, which the
        // model can read and correct. Throwing would give it an opaque failure.
        const message = error instanceof Error ? error.message : 'unknown parse error';
        return {
          content: [{ type: 'text', text: `Invalid JSON: ${message}` }],
          isError: true
        };
      }

      const formatted = JSON.stringify(parsed, null, indent);
      const keys = typeof parsed === 'object' && parsed !== null ? Object.keys(parsed).length : 0;

      return {
        content: [{ type: 'text', text: formatted }],
        structuredContent: { keys, formatted }
      };
    }
  );

  return server;
}

const isMain = process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href;

if (isMain) {
  void serveStdio(createServer);
  console.error('[mcp-v2-minimal] ready on stdio');
}
