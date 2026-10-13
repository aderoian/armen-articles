---
title: 'Feature Tour, Part 1: Code Blocks'
description: A demonstration of syntax highlighting across twelve languages, with file names, highlighted lines, line numbers, diffs, and long lines that scroll.
publishedAt: 2026-09-01
category: tooling
tags: [code, syntax-highlighting, c++, rust]
draft: false
featured: true
series: publication-demo
seriesOrder: 1
coverImage: ../../assets/covers/code-blocks.png
coverImageAlt: Abstract illustration of indented lines of code inside an editor frame.
---

> **Demonstration content.** This article exists to exercise the code rendering on this site. The snippets are small, self-contained textbook examples.

Code blocks are rendered at build time with [Expressive Code](https://expressive-code.com/), which uses the same grammars as VS Code. Every block has a copy button, scrolls horizontally instead of wrapping, and follows the site's light or dark theme.

## Systems languages

A C function with a file name and two highlighted lines. The highlighted lines are the ones that do the wrap-around:

```c title="ring_buffer.c" {5-6}
#include <stddef.h>

size_t ring_next(size_t index, size_t capacity)
{
    index += 1;
    return index == capacity ? 0 : index;
}
```

C++ with line numbers enabled:

```cpp title="clamp.hpp" showLineNumbers
#include <algorithm>
#include <concepts>

template <std::totally_ordered T>
constexpr T clamp_value(T value, T low, T high)
{
    return std::min(std::max(value, low), high);
}

static_assert(clamp_value(15, 0, 10) == 10);
```

A Rust change shown as a diff. Inserted and deleted lines are marked with `+` and `-` as well as color:

```diff lang="rust" title="src/lib.rs"
 pub fn mean(values: &[f64]) -> Option<f64> {
-    let sum: f64 = values.iter().sum();
-    Some(sum / values.len() as f64)
+    if values.is_empty() {
+        return None;
+    }
+    Some(values.iter().sum::<f64>() / values.len() as f64)
 }
```

## Scripting and web languages

```python title="chunks.py"
from collections.abc import Iterator, Sequence


def chunks[T](items: Sequence[T], size: int) -> Iterator[Sequence[T]]:
    """Yield successive slices of at most `size` items."""
    if size < 1:
        raise ValueError("size must be positive")
    for start in range(0, len(items), size):
        yield items[start : start + size]
```

TypeScript with individual lines marked as inserted or deleted:

```ts title="slug.ts" del={3} ins={4-6}
export function slugify(input: string): string {
  return input
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}
```

```js
const debounce = (fn, delay) => {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), delay);
  };
};
```

Shell sessions get a terminal frame:

```bash
npm ci
npm run build
npx wrangler dev --local
```

## Build and configuration files

```cmake title="CMakeLists.txt"
cmake_minimum_required(VERSION 3.25)
project(example LANGUAGES C CXX)

add_executable(example src/main.cpp)
target_compile_features(example PRIVATE cxx_std_20)
target_compile_options(example PRIVATE
    $<$<CXX_COMPILER_ID:GNU,Clang>:-Wall -Wextra -Wpedantic>)
```

```json title="package.json"
{
  "name": "example",
  "private": true,
  "scripts": { "build": "tsc -p ." }
}
```

```yaml title=".github/workflows/ci.yml"
on: [push, pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: npm ci && npm test
```

## Shading languages

```glsl title="tonemap.frag"
#version 330 core
in vec2 uv;
out vec4 color;
uniform sampler2D hdr;

void main() {
    vec3 c = texture(hdr, uv).rgb;
    color = vec4(c / (c + vec3(1.0)), 1.0); // Reinhard
}
```

```hlsl title="Luminance.hlsl"
float Luminance(float3 linearRgb)
{
    return dot(linearRgb, float3(0.2126, 0.7152, 0.0722));
}
```

## Long lines

Long lines scroll horizontally rather than wrapping, so indentation and alignment stay intact on narrow screens:

```ts
export const veryLongConfigurationValue = { name: 'example', description: 'This line is intentionally long so that it overflows the article column and demonstrates horizontal scrolling.' };
```
