#!/usr/bin/env node
// Thin headless wrapper around obsidian-clipper's clip() (vendored + patched).
//   web-clip <url> [-t template.json] [-o outdir] [--html file] [--url url] [--print]
// Flow: fetch(url) -> html -> linkedom documentParser -> patched clip() -> raw markdown.
// Fetch is plain (no JS rendering); SPA/paywall/bot-blocked pages yield empty bodies.
// api.mjs is the obsidian-clipper `build:api` bundle (patched); built into /opt/web-clip.
import './polyfill.mjs'; // side-effect: MUST precede the api.mjs import below
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { parseHTML } from 'linkedom';
import { clip } from './api.mjs';

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const UA =
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 ' +
  '(KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36';

function parseArgs(argv) {
  const a = { _: [], template: null, out: 'out', html: null, url: null, print: false };
  for (let i = 0; i < argv.length; i++) {
    const t = argv[i];
    if (t === '-t' || t === '--template') a.template = argv[++i];
    else if (t === '-o' || t === '--out') a.out = argv[++i];
    else if (t === '--html') a.html = argv[++i];
    else if (t === '--url') a.url = argv[++i];
    else if (t === '--print') a.print = true;
    else a._.push(t);
  }
  return a;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const url = args.url || args._[0];
  if (!url) {
    console.error('usage: web-clip <url> [-t template.json] [-o outdir] [--html file] [--url url] [--print]');
    process.exit(2);
  }

  // 1. Acquire HTML — from --html file (browser-fallback / reproducible tests) or plain fetch.
  let html;
  if (args.html) {
    html = await readFile(args.html, 'utf8');
  } else {
    const res = await fetch(url, {
      headers: {
        'User-Agent': UA,
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en,ja;q=0.8',
      },
      redirect: 'follow',
    });
    if (!res.ok) throw new Error(`fetch ${url} -> HTTP ${res.status} ${res.statusText}`);
    html = await res.text();
  }

  // 2. Resolve template (explicit -t is cwd-relative; default is the bundled one).
  const templatePath = args.template
    ? path.resolve(process.cwd(), args.template)
    : path.join(SCRIPT_DIR, 'template.default.json');
  const template = JSON.parse(await readFile(templatePath, 'utf8'));

  // 3. Clip: linkedom document -> patched clip() (defuddle extract + template render).
  const documentParser = { parseFromString: (h) => parseHTML(h).document };
  const result = await clip({ html, url, template, documentParser });

  // 4. Write raw markdown. Note name is already safe_name'd by the template.
  const base = (result.noteName || 'Untitled').replace(/[\\/]+/g, '-');
  const outDir = path.resolve(process.cwd(), args.out);
  await mkdir(outDir, { recursive: true });
  const outPath = path.join(outDir, `${base}.md`);
  await writeFile(outPath, result.fullContent, 'utf8');

  // Report from the compiled template properties (the authoritative rendered values).
  const prop = (n) => {
    const p = result.properties.find((x) => x.name === n);
    if (!p) return '';
    return Array.isArray(p.value) ? p.value.join(',') : p.value;
  };
  const contentChars = result.content.length;
  const summary = {
    url,
    out: outPath,
    noteName: result.noteName,
    title: prop('title'),
    author: prop('author'),
    site: prop('site'),
    published: prop('published'),
    contentChars,
    empty: contentChars < 200,
  };
  console.error(JSON.stringify(summary, null, 2));
  if (args.print) process.stdout.write(result.fullContent);
}

main().catch((e) => {
  console.error('web-clip ERROR:', e && e.stack ? e.stack : e);
  process.exit(1);
});
