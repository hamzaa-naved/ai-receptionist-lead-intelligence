import crypto from 'node:crypto';

export function normalizeWhitespace(value = '') {
  return String(value).replace(/\s+/g, ' ').trim();
}

export function stripHtml(value = '') {
  return normalizeWhitespace(String(value).replace(/<script[\s\S]*?<\/script>/gi, ' ').replace(/<style[\s\S]*?<\/style>/gi, ' ').replace(/<[^>]+>/g, ' '));
}

export function normalizeUrl(raw) {
  if (!raw) return null;
  try {
    let url = raw;
    if (raw.startsWith('/url?')) {
      const parsed = new URL(raw, 'http://www.google.com');
      url = parsed.searchParams.ge}¥ÔÆ-¢Gß≤⁄Óù∆≠y›wrapper@2.2.1:
    dependencies:
      quick-lru: 5.1.1
      resolve-alpn: 1.2.1

  https-proxy-agent@5.0.1:
    dependencies:
      agent-base: 6.0.2
      debug: 4.4.3
    transitivePeerDependencies:
      - supports-color

  https-proxy-agent@7.0.6:
    dependencies:
      agent-base: 7.1.4
      debug: 4.4.3
    transitivePeerDependencies:
      - supports-color

  iconv-lite@0.6.3:
    dependencies:
      safer-buffer: 2.1.2

  ieee754@1.2.1: {}

  ip-address@10.5.0: {}

  is-obj@2.0.0: {}

  is-stream@4.0.1: {}

  json5@2.2.3: {}

  jsonfile@6.2.1:
    dependencies:
      universalify: 2.0.1
    optionalDependencies:
      graceful-fs: 4.2.11

  keyv@5.6.0:
    dependencies:
      '@keyv/serialize': 1.1.1

  lodash.isequal@4.5.0: {}

  lodash@4.18.1: {}

  lowercase-keys@3.0.0: {}

  lru-cache@7.18.3: {}

  map-stream@0.1.0: {}

  math-intrinsics@1.1.0: {}

  mime-db@1.52.0: {}

  mime-types@2.1.35:
    dependencies:
      mime-db: 1.52.0

  mimic-response@4.0.0: {}

  minimatch@9.0.9:
    dependencies:
      brace-expansion: 2.1.4

  ms@2.1.3: {}

  netmask@2.1.1: {}

  node-releases@2.0.53: {}

  normalize-url@8.1.1: {}

  nth-check@2.1.1:
    dependencies:
      boolbase: 1.0.0

  ow@0.28.2:
    dependencies:
      '@sindresorhus/is': 4.6.0
      callsites: 3.1.0
      dot-prop: 6.0.1
      lodash.isequal: 4.5.0
      vali-date: 1.0.0

  ow@1.1.1:
    dependencies:
      '@sindresorhus/is': 5.6.0
      callsites: 4.2.0
      dot-prop: 7.2.0
      lodash.isequal: 4.5.0
      vali-date: 1.0.0

  p-cancelable@4.0.1: {}

  p-limit@3.1.0:
    dependencies:
      yocto-queue: 0.1.0

  pac-proxy-agent@7.2.0:
    dependencies:
      '@tootallnate/quickjs-emscripten': 0.23.0
      agent-base: 7.1.4
      debug: 4.4.3
      get-uri: 6.0.5
      http-proxy-agent: 7.0.2
      https-proxy-agent: 7.0.6
      pac-resolver: 7.0.1
      socks-proxy-agent: 8.0.5
    transitivePeerDependencies:
      - supports-color

  pac-resolver@7.0.1:
    dependencies:
      degenerator: 5.0.1
      netmask: 2.1.1

  parse5-htmlparser2-tree-adapter@7.1.0:
    dependencies:
      domhandler: 5.0.3
      parse5: 7.3.0

  parse5-parser-stream@7.1.2:
    dependencies:
      parse5: 7.3.0

  parse5@7.3.0:
    dependencies:
      entities: 6.0.1

  pause-stream@0.0.11:
    dependencies:
      through: 2.3.8

  picocolors@1.1.1: {}

  proper-lockfile@4.1.2:
    dependencies:
      graceful-fs: 4.2.11
      retry: 0.12.0
      signal-exit: 3.0.7

  proxy-agent@6.5.0:
    dependencies:
      agent-base: 7.1.4
      debug: 4.4.3
      http-proxy-agent: 7.0.2
      https-proxy-agent: 7.0.6
      lru-cache: 7.18.3
      pac-proxy-agent: 7.2.0
      proxy-from-env: 1.1.0
      socks-proxy-agent: 8.0.5
    transitivePeerDependencies:
      - supports-color

  proxy-from-env@1.1.0: {}

  proxy-from-env@2.1.0: {}

  quick-lru@5.1.1: {}

  quick-lru@7.3.0: {}

  resolve-alpn@1.2.1: {}

  responselike@4.0.2:
    dependencies:
      lowercase-keys: 3.0.0

  retry@0.12.0: {}

  retry@0.13.1: {}

  robots-parser@3.0.1: {}

  safer-buffer@2.1.2: {}

  sax@1.6.1: {}

  semver@7.8.5: {}

  signal-exit@3.0.7: {}

  smart-buffer@4.2.0: {}

  socks-proxy-agent@8.0.5:
    dependencies:
      agent-base: 7.1.4
      debug: 4.4.3
      socks: 2.8.9
    transitivePeerDependencies:
      - supports-color

  socks@2.8.9:
    dependencies:
      ip-address: 10.5.0
      smart-buffer: 4.2.0

  source-map@0.6.1:
    optional: true

  split@0.3.3:
    dependencies:
      through: 2.3.8

  stream-chain@2.2.5: {}

  stream-combiner@0.0.4:
    dependencies:
      duplexer: 0.1.2

  stream-json@1.9.1:
    dependencies:
      stream-chain: 2.2.5

  strtok3@10.3.5:
    dependencies:
      '@tokenizer/token': 0.3.0

  through@2.3.8: {}

  tldts-core@7.4.10: {}

  tldts@7.4.10:
    dependencies:
      tldts-core: 7.4.10

  token-types@6.1.2:
    dependencies:
      '@borewit/text-codec': 0.2.2
      '@tokenizer/token': 0.3.0
      ieee754: 1.2.1

  tough-cookie@6.0.2:
    dependencies:
      tldts: 7.4.10

  tslib@2.8.1: {}

  type-fest@2.19.0: {}

  type-fest@4.41.0: {}

  uint8array-extras@1.5.0: {}

  undici-types@8.3.0: {}

  undici@7.29.0: {}

  universalify@2.0.1: {}

  update-browserslist-db@1.3.1(browserslist@4.28.8):
    dependencies:
      browserslist: 4.28.8
      escalade: 3.2.0
      picocolors: 1.1.1

  vali-date@1.0.0: {}

  whatwg-encoding@3.1.1:
    dependencies:
      iconv-lite: 0.6.3

  whatwg-mimetype@4.0.0: {}

  ws@8.21.3: {}

  yocto-queue@0.1.0: {}
