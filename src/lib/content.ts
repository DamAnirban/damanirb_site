import { getCollection, type CollectionEntry } from 'astro:content';

export type Post = CollectionEntry<'blog'>;
export type Track = CollectionEntry<'tracks'>;

// Drafts show up in `npm run dev` so you can preview them, but never in a production build.
const isVisible = (entry: { data: { draft: boolean } }) => import.meta.env.DEV || !entry.data.draft;

/** Published posts, newest first. */
export async function getPosts(): Promise<Post[]> {
	const posts = await getCollection('blog', isVisible);
	return posts.sort((a, b) => b.data.date.getTime() - a.data.date.getTime());
}

export interface TrackLesson {
	number: number;
	title: string;
	post?: Post; // set once the lesson's video is published
}

export interface TrackWithLessons {
	track: Track;
	lessons: TrackLesson[];
	published: number;
	status: 'live' | 'in-progress' | 'coming-soon';
}

/** Tracks in display order, each with its outline matched against published lesson posts. */
export async function getTracks(): Promise<TrackWithLessons[]> {
	const [tracks, posts] = await Promise.all([getCollection('tracks', isVisible), getPosts()]);
	return tracks
		.sort((a, b) => a.data.order - b.data.order)
		.map((track) => {
			const lessons = track.data.outline.map((title, i) => ({
				number: i + 1,
				title,
				post: posts.find((post) => post.data.track?.id === track.id && post.data.lesson === i + 1),
			}));
			const published = lessons.filter((lesson) => lesson.post).length;
			const status = published === 0 ? 'coming-soon' : published === lessons.length ? 'live' : 'in-progress';
			return { track, lessons, published, status };
		});
}

export const STATUS_LABELS: Record<TrackWithLessons['status'], string> = {
	live: 'Complete',
	'in-progress': 'In progress',
	'coming-soon': 'Coming soon',
};

export const formatDate = (date: Date) =>
	date.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric', timeZone: 'UTC' });
