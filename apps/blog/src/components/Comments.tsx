import { LOCALE } from "@config";
import { useEffect, useState } from "react";

// Comments are the replies to a Bluesky post. They are fetched at runtime from
// the public AppView (no auth, no API key) so threads stay live without a
// rebuild, rather than being baked in at build time.
const PUBLIC_API = "https://public.api.bsky.app";
const BSKY_APP = "https://bsky.app";

interface Author {
	did: string;
	handle: string;
	displayName?: string;
	avatar?: string;
}

interface PostView {
	uri: string;
	cid: string;
	author: Author;
	record: { text?: string };
	replyCount?: number;
	repostCount?: number;
	likeCount?: number;
	indexedAt: string;
}

interface ThreadViewPost {
	$type?: string;
	post: PostView;
	replies?: ThreadViewPost[];
}

function rkeyOf(uri: string): string {
	return uri.split("/").pop() ?? "";
}

function webUrl(post: PostView): string {
	return `${BSKY_APP}/profile/${post.author.handle}/post/${rkeyOf(post.uri)}`;
}

async function resolveAtUri(input: string): Promise<string> {
	if (input.startsWith("at://")) {
		return input;
	}
	const match = input.match(/profile\/([^/]+)\/post\/([^/?#]+)/);
	if (!match) {
		throw new Error("Unrecognized Bluesky post reference");
	}
	let [, actor] = match;
	const rkey = match[2];
	if (!actor.startsWith("did:")) {
		const res = await fetch(
			`${PUBLIC_API}/xrpc/com.atproto.identity.resolveHandle?handle=${actor}`,
		);
		if (!res.ok) {
			throw new Error("Failed to resolve handle");
		}
		actor = (await res.json()).did;
	}
	return `at://${actor}/app.bsky.feed.post/${rkey}`;
}

// Surface the most-engaged replies first; fall back to recency for ties.
function sortReplies(replies: ThreadViewPost[] = []): ThreadViewPost[] {
	return [...replies]
		.filter((r) => r.post?.author)
		.sort((a, b) => {
			const likes = (b.post.likeCount ?? 0) - (a.post.likeCount ?? 0);
			return likes !== 0
				? likes
				: a.post.indexedAt.localeCompare(b.post.indexedAt);
		});
}

function formatDate(iso: string): string {
	return new Date(iso).toLocaleDateString(LOCALE.langTag, {
		year: "numeric",
		month: "short",
		day: "numeric",
	});
}

function Comment({ comment }: { comment: ThreadViewPost }) {
	const { post } = comment;
	return (
		<div className="mt-4">
			<div className="flex items-center gap-2">
				{post.author.avatar && (
					<img
						src={post.author.avatar}
						alt=""
						className="h-6 w-6 rounded-full"
						loading="lazy"
					/>
				)}
				<a
					href={`${BSKY_APP}/profile/${post.author.handle}`}
					target="_blank"
					rel="noopener noreferrer"
					className="font-medium text-blue hover:underline"
				>
					{post.author.displayName ?? post.author.handle}
				</a>
				<span className="text-sm opacity-60">@{post.author.handle}</span>
			</div>
			<p className="mt-1 whitespace-pre-wrap break-words">{post.record.text}</p>
			<div className="mt-1 flex gap-3 text-xs opacity-60">
				<a
					href={webUrl(post)}
					target="_blank"
					rel="noopener noreferrer"
					className="hover:underline"
				>
					{formatDate(post.indexedAt)}
				</a>
				<span>♥ {post.likeCount ?? 0}</span>
				<span>🔁 {post.repostCount ?? 0}</span>
				<span>💬 {post.replyCount ?? 0}</span>
			</div>
			{comment.replies && comment.replies.length > 0 && (
				<div className="mt-2 border-l border-dashed pl-4">
					{sortReplies(comment.replies).map((child) => (
						<Comment key={child.post.uri} comment={child} />
					))}
				</div>
			)}
		</div>
	);
}

export default function Comments({ postUri }: { postUri: string }) {
	const [root, setRoot] = useState<ThreadViewPost | null>(null);
	const [error, setError] = useState<string | null>(null);
	const [loading, setLoading] = useState(true);

	useEffect(() => {
		let cancelled = false;
		(async () => {
			try {
				const atUri = await resolveAtUri(postUri);
				const res = await fetch(
					`${PUBLIC_API}/xrpc/app.bsky.feed.getPostThread?uri=${encodeURIComponent(
						atUri,
					)}&depth=10`,
				);
				if (!res.ok) {
					throw new Error(`getPostThread failed: ${res.status}`);
				}
				const data = await res.json();
				const thread = data.thread as ThreadViewPost;
				if (!thread?.post?.author) {
					throw new Error("Thread is unavailable");
				}
				if (!cancelled) {
					setRoot(thread);
				}
			} catch (e) {
				if (!cancelled) {
					setError(e instanceof Error ? e.message : "Failed to load comments");
				}
			} finally {
				if (!cancelled) {
					setLoading(false);
				}
			}
		})();
		return () => {
			cancelled = true;
		};
	}, [postUri]);

	const replies = root ? sortReplies(root.replies) : [];

	return (
		<section className="mt-8">
			<h2 className="text-2xl font-semibold">Comments</h2>
			{root && (
				<p className="mt-1 text-sm opacity-80">
					Reply on{" "}
					<a
						href={webUrl(root.post)}
						target="_blank"
						rel="noopener noreferrer"
						className="text-blue hover:underline"
					>
						Bluesky
					</a>{" "}
					to join the conversation.
				</p>
			)}
			{loading && <p className="mt-4 opacity-60">Loading comments…</p>}
			{error && <p className="mt-4 opacity-60">Could not load comments.</p>}
			{!loading && !error && replies.length === 0 && (
				<p className="mt-4 opacity-60">No comments yet.</p>
			)}
			{replies.map((reply) => (
				<Comment key={reply.post.uri} comment={reply} />
			))}
		</section>
	);
}
