# remark-ogp-card

A remark plugin that converts standalone URLs in Markdown to OGP (Open Graph Protocol) cards.

## Why This Plugin?

### The Problem with Existing Solutions

Existing plugins like [remark-link-card-plus](https://github.com/okaryo/remark-link-card-plus) use [open-graph-scraper](https://github.com/jshemas/openGraphScraper) internally,
which relies on [undici](https://github.com/nodejs/undici) (Node.js's HTTP client) to fetch pages.
However, some websites block requests from Node.js by detecting its **TLS fingerprint**.

TLS fingerprinting identifies clients based on characteristics of the TLS handshake, such as:
- Supported cipher suites and their order
- TLS extensions
- Supported elliptic curves

Node.js has a distinctive TLS fingerprint that differs from browsers, allowing servers to block it even when custom User-Agent headers are set.

### The Solution: impit

This plugin uses [impit](https://github.com/apify/impit), a Rust-based library that mimics browser TLS fingerprints.
By impersonating Chrome's TLS fingerprint, we can successfully fetch OGP metadata from sites that would otherwise block Node.js.

## Installation

```bash
pnpm add remark-ogp-card
```

## Usage

```typescript
import remarkOgpCard from 'remark-ogp-card';
import { unified } from 'unified';
import remarkParse from 'remark-parse';
import remarkHtml from 'remark-html';

const result = await unified()
  .use(remarkParse)
  .use(remarkOgpCard, { thumbnailPosition: 'left' })
  .use(remarkHtml)
  .process('https://example.com');
```

### With Astro

```typescript
// astro.config.ts
import remarkOgpCard from 'remark-ogp-card';

export default defineConfig({
  markdown: {
    remarkPlugins: [
      [remarkOgpCard, { thumbnailPosition: 'left' }],
    ],
  },
});
```

## Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `cache` | `boolean` | `true` | Enable disk caching for OGP metadata and images |
| `cacheDir` | `string` | `'public/ogp-cache'` | Directory for cached files |
| `thumbnailPosition` | `'left' \| 'right'` | `'left'` | Position of the thumbnail image |

## How It Works

1. **URL Detection**: Scans Markdown AST for paragraphs containing only a standalone URL
2. **Caching**: Checks memory cache, then disk cache for existing OGP data
3. **Fetching**: Uses IMPIT with Chrome's TLS fingerprint to fetch the page
4. **Parsing**: Extracts `og:title`, `og:description`, and `og:image` meta tags
5. **Image Download**: Optionally downloads and caches OGP images locally
6. **HTML Generation**: Replaces the URL with an HTML card component

## Generated HTML

```html
<div class="ogp-card">
  <a href="https://example.com" target="_blank" rel="noreferrer noopener" class="ogp-card__link">
    <div class="ogp-card__thumbnail">
      <img src="/ogp-cache/abc123.png" alt="" />
    </div>
    <div class="ogp-card__content">
      <div class="ogp-card__title">Page Title</div>
      <div class="ogp-card__description">Page description...</div>
      <div class="ogp-card__url">example.com</div>
    </div>
  </a>
</div>
```

## Styling

The plugin generates semantic HTML with BEM-style class names. Add your own CSS:

```css
.ogp-card {
  width: 100%;
  margin: 1rem 0;
}

.ogp-card__link {
  display: flex;
  height: 10rem;
  overflow: hidden;
  border-radius: 0.25rem;
  border: 1px solid #e5e7eb;
  text-decoration: none;
  transition: border-color 0.2s;
}

.ogp-card__link:hover {
  border-color: #3b82f6;
}

.ogp-card__thumbnail {
  flex-shrink: 0;
  height: 100%;
}

.ogp-card__thumbnail img {
  height: 100%;
  width: auto;
  object-fit: contain;
}

.ogp-card__content {
  display: flex;
  flex-direction: column;
  justify-content: center;
  gap: 0.25rem;
  padding: 0.5rem 0.75rem;
  overflow: hidden;
  flex: 1;
}

.ogp-card__title {
  font-weight: 500;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.ogp-card__description {
  font-size: 0.75rem;
  overflow: hidden;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
}

.ogp-card__url {
  font-size: 0.75rem;
  opacity: 0.5;
}
```

## Caching

The plugin implements a two-tier caching strategy:

1. **Memory Cache**: Prevents duplicate requests during a single build
2. **Disk Cache**: Persists OGP metadata and images across builds

Cache files are named using SHA256 hashes (first 16 characters) of the URL:
- `{hash}.json` - OGP metadata
- `{hash}.png` - Downloaded OGP image

## License

MIT
