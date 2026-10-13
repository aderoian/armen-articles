---
title: 'Draft Preview Example'
description: A demonstration draft. It is visible on the local dev server and must never appear in production pages, feeds, the sitemap, or search.
publishedAt: 2026-10-10
category: site-notes
tags: [publishing, drafts]
draft: true
---

> **Demonstration content.** This is an unpublished draft used to verify draft handling.

While `draft: true` is set, this article is only rendered by `npm run dev`, where a banner marks it as a draft. Production builds leave it out of every route, listing, feed, sitemap, and the search index.

To publish it, set `draft: false` and update `publishedAt` to the publication date.

## Unique marker

The phrase `zebra-quasar-draft-marker` appears only in this draft. Automated tests check that it does not appear anywhere in the production build.
