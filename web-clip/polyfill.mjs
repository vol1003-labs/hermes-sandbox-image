// Headless polyfill shim for obsidian-clipper's clip() in Node.
// MUST be imported (side-effect) BEFORE ./vendor-src/dist/api.mjs, because
// defuddle/full bundles Turndown, which reads `window.DOMParser` at module-init.
// Mirrors scripts/build-cli.mjs's polyfillBanner + adds `navigator`
// (clip() -> sanitizeFileName reads navigator.platform; the CLI banner omits it).
import { parseHTML } from 'linkedom';

const LinkedomDOMParser = function () {};
LinkedomDOMParser.prototype.parseFromString = function (html) {
  return parseHTML(html).document;
};

if (typeof globalThis.window === 'undefined') globalThis.window = globalThis;
if (!globalThis.DOMParser) globalThis.DOMParser = LinkedomDOMParser;
if (!globalThis.window.DOMParser) globalThis.window.DOMParser = LinkedomDOMParser;
if (typeof globalThis.document === 'undefined') {
  globalThis.document = parseHTML(
    '<!DOCTYPE html><html><head></head><body></body></html>'
  ).document;
}
// Node 20 has no global `navigator` (added in v21). Define one so
// sanitizeFileName (utils/string-utils.ts) can read navigator.platform.
if (typeof globalThis.navigator === 'undefined') {
  globalThis.navigator = { platform: 'Linux x86_64', userAgent: 'node' };
}
