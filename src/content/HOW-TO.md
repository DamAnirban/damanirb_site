# Adding content

Everything here is plain Markdown. Push it and the site rebuilds.
Anything with `draft: true` shows up in `npm run dev` but never on the live site.

## A video lesson

1. Put the lecture PDF in `public/pdfs/`, e.g. `public/pdfs/sta-01-what-is-timing.pdf`.
2. Create `src/content/blog/<url-name>.md`. The file name becomes the URL: `/blog/<url-name>`.

```markdown
---
title: What timing analysis answers
description: One or two sentences shown on the blog tile and in search results.
date: 2026-11-02
type: video
youtubeId: abcdEFGhijk          # the 11 characters after "watch?v=" in the video URL
pdf: /pdfs/sta-01-what-is-timing.pdf
track: static-timing-analysis   # file name of the track, without .md (optional)
lesson: 1                       # its position in that track's outline (needed if track is set)
tags: [sta, timing]
---

Your notes go here.
```

Optional: `cover: ./my-cover.jpg` (an image next to the post) replaces the generated tile.

## An article

Same as above with `type: article`, and no `youtubeId`, `pdf` or `track`.

## A track

Create `src/content/tracks/<url-name>.md`. It appears at `/vlsi/<url-name>`.

```markdown
---
title: Static Timing Analysis
summary: One sentence for the track card.
order: 2                        # position on the VLSI page
level: Intermediate             # Beginner, Intermediate, Advanced or Mixed (optional)
playlist: https://www.youtube.com/playlist?list=...   # optional
outline:                        # every planned lesson, in order
  - What timing analysis answers
  - Setup and hold time
---

A short introduction shown on the track page.
```

Lessons in the outline show as "Coming soon" until a post with matching `track` and `lesson` is published.
The track's status (Coming soon, In progress, Complete) and progress bar update on their own.

## Mistakes are caught at build time

A missing `youtubeId` on a video, a misspelled track name, or a `pdf` path outside `/pdfs/`
fails the build with a message saying which file and field to fix.
