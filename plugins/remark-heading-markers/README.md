# remark-heading-markers

A [remark](https://github.com/remarkjs/remark) plugin that adds visual heading markers (`#`, `##`, `###`, etc.) to the rendered heading text.

This plugin makes markdown heading syntax visible in the rendered output by prepending the appropriate number of hash symbols to the heading text.

## Features

- ✅ Zero runtime dependencies (only uses type definitions)
- ✅ Supports all heading levels (h1-h6)
- ✅ Works with complex heading content (inline code, emphasis, links, etc.)
- ✅ Fully tested with comprehensive test suite
- ✅ TypeScript support
- ✅ Easy to integrate with any remark-based project

## Installation

This plugin is part of a pnpm workspace monorepo. To use it in another workspace package:

1. Add it to your `package.json` dependencies:

```json
{
  "dependencies": {
    "remark-heading-markers": "workspace:*"
  }
}
```

2. Run `pnpm install` from the project root

For standalone projects (if published to npm):

```bash
npm install remark-heading-markers
# or
pnpm add remark-heading-markers
# or
yarn add remark-heading-markers
```

## Usage

### With Astro

```typescript
// astro.config.ts
import { defineConfig } from "astro/config";
import remarkHeadingMarkers from "remark-heading-markers";

export default defineConfig({
  markdown: {
    remarkPlugins: [remarkHeadingMarkers],
  },
});
```

### With unified

```typescript
import { unified } from "unified";
import remarkParse from "remark-parse";
import remarkHeadingMarkers from "remark-heading-markers";
import remarkRehype from "remark-rehype";
import rehypeStringify from "rehype-stringify";

const file = await unified()
  .use(remarkParse)
  .use(remarkHeadingMarkers)
  .use(remarkRehype)
  .use(rehypeStringify)
  .process("## Example Heading");

console.log(String(file));
// Output: <h2>## Example Heading</h2>
```

### With Next.js (MDX)

```javascript
// next.config.mjs
import remarkHeadingMarkers from "remark-heading-markers";

/** @type {import('next').NextConfig} */
const nextConfig = {
  pageExtensions: ["js", "jsx", "ts", "tsx", "md", "mdx"],
  webpack: (config) => {
    config.resolve.fallback = { fs: false };
    return config;
  },
  // For MDX
  experimental: {
    mdxRs: true,
  },
};

export default nextConfig;
```

## Examples

### Input

```markdown
# First Level

## Second Level

### Third Level

#### Fourth Level
```

### Output (Markdown)

```markdown
# # First Level

## ## Second Level

### ### Third Level

#### #### Fourth Level
```

### Output (HTML)

```html
<h1># First Level</h1>
<h2>## Second Level</h2>
<h3>### Third Level</h3>
<h4>#### Fourth Level</h4>
```

## Development

### Running Tests

```bash
# Run tests once
pnpm test

# Run tests in watch mode
pnpm test:watch
```

### Project Structure

```
remark-heading-markers/
├── index.ts           # Plugin implementation
├── index.test.ts      # Test suite
├── package.json       # Package metadata
├── tsconfig.json      # TypeScript configuration
└── README.md          # This file
```

## How It Works

The plugin traverses the markdown Abstract Syntax Tree (AST) and finds all heading nodes. For each heading, it:

1. Determines the heading level (1-6)
2. Generates the appropriate marker (`#` repeated `depth` times)
3. Finds the first text node in the heading
4. Prepends the marker to the text content

The implementation uses a custom recursive visitor function instead of external dependencies like `unist-util-visit`, keeping the plugin lightweight and dependency-free.

## API

### `remarkHeadingMarkers()`

No options are currently supported. The plugin works out of the box.

## TypeScript

This plugin is written in TypeScript and includes full type definitions. It uses types from `@types/mdast` for AST node types.

## License

MIT

## Author

natsukium

## Contributing

Contributions are welcome! If you find a bug or have a feature request, please open an issue.

### Development Setup

This plugin is part of a pnpm workspace. To contribute:

1. Clone the repository and navigate to the project root
2. Install dependencies: `pnpm install` (run from the project root)
3. Navigate to the plugin directory: `cd plugins/remark-heading-markers`
4. Run tests: `pnpm test`
5. Make your changes
6. Ensure tests pass
7. Submit a pull request

## Related

- [remark](https://github.com/remarkjs/remark) - Markdown processor
- [unified](https://github.com/unifiedjs/unified) - Interface for parsing, inspecting, transforming, and serializing content
- [mdast](https://github.com/syntax-tree/mdast) - Markdown Abstract Syntax Tree format

## Changelog

### 1.0.0

- Initial release
- Support for all heading levels (h1-h6)
- Zero runtime dependencies
- Comprehensive test suite
