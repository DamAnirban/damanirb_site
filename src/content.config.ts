import { defineCollection, reference } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';

// Tracks are ordered VLSI learning paths (one per YouTube playlist). The
// `outline` lists every planned lesson up front; a lesson "lights up" on the
// track page once a blog post with `track` + `lesson` set to it is published.
const tracks = defineCollection({
	loader: glob({ pattern: '**/*.md', base: './src/content/tracks' }),
	schema: z.object({
		title: z.string(),
		summary: z.string(),
		order: z.number(), // position on the VLSI page
		level: z.enum(['Beginner', 'Intermediate', 'Advanced']).optional(),
		playlist: z.url().optional(), // YouTube playlist URL
		outline: z.array(z.string()).min(1), // planned lesson titles, in order
		draft: z.boolean().default(false),
	}),
});

// Blog posts are either articles or videos. A video can also be a lesson in a track.
const blog = defineCollection({
	loader: glob({ pattern: '**/*.{md,mdx}', base: './src/content/blog' }),
	schema: ({ image }) =>
		z
			.object({
				title: z.string(),
				description: z.string(),
				date: z.coerce.date(),
				type: z.enum(['article', 'video']),
				tags: z.array(z.string()).default([]),
				cover: image().optional(), // local image; videos without one get a generated tile
				youtubeId: z.string().regex(/^[\w-]{11}$/, 'Expected an 11-character YouTube video ID').optional(),
				pdf: z.string().startsWith('/pdfs/', 'Put lecture PDFs in public/pdfs/ and link them as /pdfs/...').optional(),
				track: reference('tracks').optional(),
				lesson: z.number().int().positive().optional(), // 1-based position in the track's outline
				draft: z.boolean().default(false),
			})
			.refine((post) => post.type !== 'video' || post.youtubeId, {
				message: 'Video posts need a youtubeId',
				path: ['youtubeId'],
			})
			.refine((post) => !post.track === !post.lesson, {
				message: 'Set both `track` and `lesson`, or neither',
				path: ['lesson'],
			}),
});

export const collections = { tracks, blog };
