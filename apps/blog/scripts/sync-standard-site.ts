import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { parse as parseYaml } from "yaml";
import { SITE } from "../src/config.ts";

// Publishes standard.site records to the author's PDS from the blog content.
//
// Both site.standard.publication and site.standard.document declare `key: "tid"`,
// so record keys must be server-assigned TIDs rather than slugs. We therefore
// persist a slug -> rkey mapping (src/data/standard-site.json): new posts go
// through createRecord (which mints a TID) and updates go through putRecord
// against the stored rkey, keeping the records and their AT-URIs stable.

const appRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const mappingPath = join(appRoot, "src/data/standard-site.json");
const blogDir = join(appRoot, "src/content/blog");

const PDS = process.env.PDS_URL ?? "https://bsky.social";
const identifier = process.env.ATP_IDENTIFIER ?? process.env.ATP_HANDLE;
const password = process.env.ATP_APP_PASSWORD ?? process.env.ATP_PASSWORD;

if (!identifier || !password) {
	console.error(
		"Set ATP_IDENTIFIER (handle or DID) and ATP_APP_PASSWORD (app password).",
	);
	process.exit(1);
}

type Mapping = {
	did: string;
	publicationRkey: string | null;
	documents: Record<string, string>;
};

type Frontmatter = {
	title: string;
	description?: string;
	pubDatetime: string | Date;
	modDatetime?: string | Date | null;
	tags?: string[];
	draft?: boolean;
};

async function xrpc(
	nsid: string,
	body: Record<string, unknown>,
	jwt?: string,
): Promise<Record<string, unknown>> {
	const res = await fetch(`${PDS}/xrpc/${nsid}`, {
		method: "POST",
		headers: {
			"Content-Type": "application/json",
			...(jwt ? { Authorization: `Bearer ${jwt}` } : {}),
		},
		body: JSON.stringify(body),
	});
	if (!res.ok) {
		throw new Error(`${nsid} failed: ${res.status} ${await res.text()}`);
	}
	return res.json();
}

function rkeyOf(uri: string): string {
	return uri.split("/").pop() as string;
}

function toIso(value: string | Date): string {
	return value instanceof Date
		? value.toISOString()
		: new Date(value).toISOString();
}

function parseFrontmatter(raw: string): Frontmatter {
	const match = raw.match(/^---\r?\n([\s\S]*?)\r?\n---/);
	if (!match) {
		throw new Error("missing frontmatter");
	}
	return parseYaml(match[1]) as Frontmatter;
}

const mapping: Mapping = JSON.parse(readFileSync(mappingPath, "utf8"));

const session = await xrpc("com.atproto.server.createSession", {
	identifier,
	password,
});
const did = session.did as string;
const jwt = session.accessJwt as string;
mapping.did = did;

// Upsert the publication first so document records can reference its AT-URI.
const publicationRecord = {
	$type: "site.standard.publication",
	name: SITE.title,
	url: SITE.website,
	description: SITE.desc,
};
if (mapping.publicationRkey) {
	await xrpc(
		"com.atproto.repo.putRecord",
		{
			repo: did,
			collection: "site.standard.publication",
			rkey: mapping.publicationRkey,
			record: publicationRecord,
		},
		jwt,
	);
} else {
	const created = await xrpc(
		"com.atproto.repo.createRecord",
		{
			repo: did,
			collection: "site.standard.publication",
			record: publicationRecord,
		},
		jwt,
	);
	mapping.publicationRkey = rkeyOf(created.uri as string);
}
const publicationUri = `at://${did}/site.standard.publication/${mapping.publicationRkey}`;

const published = new Set<string>();
for (const file of readdirSync(blogDir).filter((f) => f.endsWith(".md"))) {
	const slug = file.replace(/\.md$/, "");
	const fm = parseFrontmatter(readFileSync(join(blogDir, file), "utf8"));
	if (fm.draft) {
		continue;
	}
	published.add(slug);

	const record = {
		$type: "site.standard.document",
		site: publicationUri,
		title: fm.title,
		path: `/posts/${slug}`,
		publishedAt: toIso(fm.pubDatetime),
		...(fm.modDatetime ? { updatedAt: toIso(fm.modDatetime) } : {}),
		...(fm.description ? { description: fm.description } : {}),
		...(fm.tags?.length ? { tags: fm.tags } : {}),
	};

	const existing = mapping.documents[slug];
	if (existing) {
		await xrpc(
			"com.atproto.repo.putRecord",
			{
				repo: did,
				collection: "site.standard.document",
				rkey: existing,
				record,
			},
			jwt,
		);
		console.log(`updated ${slug}`);
	} else {
		const created = await xrpc(
			"com.atproto.repo.createRecord",
			{ repo: did, collection: "site.standard.document", record },
			jwt,
		);
		mapping.documents[slug] = rkeyOf(created.uri as string);
		console.log(`created ${slug}`);
	}
}

// Drop records for posts that were removed or switched to draft so the PDS
// does not keep advertising content the site no longer serves.
for (const slug of Object.keys(mapping.documents)) {
	if (!published.has(slug)) {
		await xrpc(
			"com.atproto.repo.deleteRecord",
			{
				repo: did,
				collection: "site.standard.document",
				rkey: mapping.documents[slug],
			},
			jwt,
		);
		delete mapping.documents[slug];
		console.log(`deleted ${slug}`);
	}
}

const sorted: Mapping = {
	did: mapping.did,
	publicationRkey: mapping.publicationRkey,
	documents: Object.fromEntries(
		Object.entries(mapping.documents).sort(([a], [b]) => a.localeCompare(b)),
	),
};
writeFileSync(mappingPath, `${JSON.stringify(sorted, null, "\t")}\n`);
console.log("standard.site sync complete");
