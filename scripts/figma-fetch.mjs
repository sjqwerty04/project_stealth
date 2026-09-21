import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const usage = 'usage: node scripts/figma-fetch.mjs <fileKey> <nodeId> [nodeId...]';
const [fileKey, ...nodeIds] = process.argv.slice(2);

if (!fileKey || nodeIds.length === 0) {
  console.error(usage);
  process.exit(1);
}

const token = process.env.FIGMA_TOKEN;
if (!token) {
  console.error(
    'FIGMA_TOKEN is missing. Create a Figma personal access token while signed in as the file owner, add it as the Cloud Agent secret FIGMA_TOKEN, and start a new agent run. Secrets are not injected into this already-running VM.',
  );
  process.exit(1);
}

function lookup(map, nodeId) {
  if (!map || typeof map !== 'object') return undefined;
  if (Object.hasOwn(map, nodeId)) return map[nodeId];
  const colon = nodeId.replaceAll('-', ':');
  if (Object.hasOwn(map, colon)) return map[colon];
  const hyphen = nodeId.replaceAll(':', '-');
  if (Object.hasOwn(map, hyphen)) return map[hyphen];
  return undefined;
}

async function figmaJson(url) {
  const res = await fetch(url, { headers: { 'X-Figma-Token': token } });
  const text = await res.text();
  let body = null;
  try {
    body = JSON.parse(text);
  } catch {
    body = null;
  }
  const err = (body && (body.err || body.message)) || text.slice(0, 200) || res.statusText;
  if (res.status === 403 || res.status === 404 || !res.ok) {
    console.error(`Figma API ${res.status} for ${url}: ${err}`);
    process.exit(1);
  }
  return body;
}

const idsParam = nodeIds.join(',');
const nodesUrl = `https://api.figma.com/v1/files/${encodeURIComponent(fileKey)}/nodes?ids=${encodeURIComponent(idsParam)}&geometry=paths`;
const imagesUrl = `https://api.figma.com/v1/images/${encodeURIComponent(fileKey)}?ids=${encodeURIComponent(idsParam)}&format=png&scale=2`;

const nodesBody = await figmaJson(nodesUrl);
const imagesBody = await figmaJson(imagesUrl);

for (const nodeId of nodeIds) {
  const node = lookup(nodesBody.nodes, nodeId);
  if (node == null) {
    console.error(`Figma API 404: no node ${nodeId} in file ${fileKey}`);
    process.exit(1);
  }
  const pngUrl = lookup(imagesBody.images, nodeId);
  if (!pngUrl) {
    console.error(`Figma API 404: no PNG URL for node ${nodeId} in file ${fileKey}`);
    process.exit(1);
  }

  const dir = join(process.cwd(), 'artifacts', 'figma', nodeId);
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, 'node.json'), `${JSON.stringify(node, null, 2)}\n`);

  const pngRes = await fetch(pngUrl);
  if (!pngRes.ok) {
    console.error(`PNG download ${pngRes.status} for node ${nodeId}`);
    process.exit(1);
  }
  writeFileSync(join(dir, 'node.png'), Buffer.from(await pngRes.arrayBuffer()));
  console.log(`wrote ${join(dir, 'node.json')}`);
  console.log(`wrote ${join(dir, 'node.png')}`);
}
