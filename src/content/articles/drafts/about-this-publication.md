---
title: About This Publication
description: What this site is, how articles are written and published from a Git repository, and how to follow along with RSS or search.
publishedAt: 2026-10-01
category: site-notes
tags: [astro, publishing, static-sites]
draft: true
featured: false
coverImage: ../../../assets/covers/publication.png
coverImageAlt: Abstract illustration of an article page with a sidebar table of contents.
---

> **Demonstration content.** The articles currently on this site are samples that exercise its publishing features. They will be replaced by real articles over time.

This is the long-form companion to [armenderoian.dev](https://armenderoian.dev): a place for technical articles, tutorials, and engineering write-ups. The portfolio site covers projects at a glance; this site is for the details.

## How the site works

Every article is a Markdown or MDX file in a Git repository. A static site generator turns those files into plain HTML at build time, so there is no server-side application, database, or content management system behind these pages.

| Concern       | Approach                                                  |
| ------------- | --------------------------------------------------------- |
| Content       | Markdown and MDX files, validated against a schema        |
| Rendering     | Static HTML generated at build time                       |
| Code and math | Highlighted and typeset during the build                  |
| Search        | A static index generated after the build, queried locally |
| Hosting       | Static assets served from Cloudflare's network            |

Because the whole site is generated ahead of time, pages load quickly and work without JavaScript. Scripts only run where a feature needs them, such as search, diagrams, and the occasional interactive example.

## Finding articles

- The [archive](/articles) lists every article, newest first.
- [Categories](/categories) group articles by broad subject area, while [tags](/tags) are finer-grained topics.
- [Series](/series) collect multi-part articles meant to be read in order.
- [Search](/search) covers titles, descriptions, headings, and full text.

## Following along

Subscribe to the [RSS feed](/rss.xml) in any feed reader to get new articles as they are published. Article URLs are stable: they do not include categories, tags, or dates, so reorganising the site does not break links.
