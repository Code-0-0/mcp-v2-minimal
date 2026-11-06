#!/usr/bin/env node
/**
 * Smoke test — drives the real server through a real MCP client, in memory.
 * No subprocess, no port, no pipes: works in CI and in locked-down sandboxes.
 *
 *   npm run build && npm run smoke
 *
 * If this passes, the build output loads, the tools register, structured output
 * validates, and a bad argument comes back as a correctable isError result.
 */
import assert from 'node:assert/strict';
import { Client, InMemoryTransport } from '@modelcontextprotocol/client';
import { createServer } from '../dist/index.js';

let passed = 0;
const ok = label => {
  passed += 1;
  console.log(`  ok  ${label}`);
};

const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
const server = createServer();
const client = new Client({ name: 'smoke', version: '1.0.0' });

try {
  await server.connect(serverTransport);
  await client.connect(clientTransport);
  ok('client connected to the server in memory');

  const { tools } = await client.listTools();
  const names = tools.map(t => t.name).sort();
  assert.deepEqual(names, ['echo', 'json_format']);
  ok(`tools/list returned ${names.length}: ${names.join(', ')}`);

  assert.equal(
    tools.every(t => typeof t.description === 'string' && t.description.length > 0),
    true,
    'every tool needs a description — it is all the model sees'
  );
  ok('every tool advertises a description');

  const echoed = await client.callTool({ name: 'echo', arguments: { text: 'ping' } });
  assert.equal(echoed.content[0].text, 'ping');
  ok('echo round-tripped');

  const formatted = await client.callTool({
    name: 'json_format',
    arguments: { json: '{"b":2,"a":1}' }
  });
  assert.equal(formatted.structuredContent.keys, 2);
  assert.match(formatted.structuredContent.formatted, /\n {2}"b": 2/);
  ok('json_format returned validated structuredContent');

  const rejected = await client.callTool({ name: 'json_format', arguments: { json: '{oops' } });
  assert.equal(rejected.isError, true, 'invalid JSON must be a correctable isError result');
  assert.match(rejected.content[0].text, /Invalid JSON/);
  ok('invalid input returned isError:true instead of throwing');

  await client.close();
  await server.close();
  console.log(`\n${passed} checks passed.`);
  process.exit(0);
} catch (error) {
  console.error('\nSMOKE FAILED:', error instanceof Error ? error.message : error);
  try {
    await client.close();
    await server.close();
  } catch {
    /* ignore teardown errors */
  }
  process.exit(1);
}
