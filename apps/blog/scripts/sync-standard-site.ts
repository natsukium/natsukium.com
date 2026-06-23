import { join, relative, sep } from "node:path";
import { readFileSync, readdirSync, writeFileSync } from "node:fs";
import { SITE } from "../src/config.ts";
import { parse as parseYaml } from "yaml";

// Publishes standard.site records to the author's PDS from the blog content.
//
// Both site.standard.publication and site.standard.document declare `key: "tid"`,
// so record keys are server-assigned TIDs, not slugs, and must be recovered
// rather than derived. Each run rebuilds the slug -> rkey map from the PDS itself
// (listRecords, keyed by each document's `path`), which keeps the sync idempotent
// even when run from CI where the committed src/data/standard-site.json cache is
// empty or stale: relying on that cache alone, a lost rkey would createRecord a
// duplicate. The committed json is only a build-time cache for environments that
// render the verification tags without running this sync (local dev, previews).

const appRoot = join(import.meta.dirname, "..");
const mappingPath = join(appRoot, "src/data/standard-site.json");
const blogDir = join(appRoot, "src/content/blog");

// Resolved from the account's DID document at startup so a PDS migration is
// followed automatically (records and AT-URIs are DID-based, so only the host
// serving them moves). PDS_URL overrides this for local testing against a
// specific host. Assigned before the first authenticated call.
let pds = "";
// The AppView is queried unauthenticated to turn a Bluesky post reference into a
// strong ref (uri + cid) and to resolve a handle to a DID; it never touches the
// author's PDS credentials.
const PUBLIC_API = "https://public.api.bsky.app";
const PLC_DIRECTORY = "https://plc.directory";
const identifier = process.env.ATP_IDENTIFIER ?? process.env.ATP_HANDLE;
const password = process.env.ATP_APP_PASSWORD ?? process.env.ATP_PASSWORD;

if (!identifier || !password) {
  console.error("Set ATP_IDENTIFIER (handle or DID) and ATP_APP_PASSWORD (app password).");
  process.exit(1);
}

type Mapping = {
  did: string;
  publicationRkey: string | null;
  documents: Record<string, string>;
};

type StrongRef = { uri: string; cid: string };

type Frontmatter = {
  title: string;
  description?: string;
  pubDatetime: string | Date;
  modDatetime?: string | Date | null;
  tags?: string[];
  draft?: boolean;
  bskyPostUri?: string;
};

async function xrpc(
  nsid: string,
  body: Record<string, unknown>,
  jwt?: string,
): Promise<Record<string, unknown>> {
  const res = await fetch(`${pds}/xrpc/${nsid}`, {
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

// Returns the stored record's value, or null when it does not exist yet, so the
// caller can decide between putRecord (unchanged records are skipped) and create.
async function getRecord(
  did: string,
  collection: string,
  rkey: string,
): Promise<Record<string, unknown> | null> {
  const params = new URLSearchParams({ repo: did, collection, rkey });
  const res = await fetch(`${pds}/xrpc/com.atproto.repo.getRecord?${params.toString()}`);
  if (res.status === 400) {
    return null;
  }
  if (!res.ok) {
    throw new Error(`getRecord failed: ${res.status} ${await res.text()}`);
  }
  return (await res.json()).value as Record<string, unknown>;
}

type ListedRecord = { uri: string; value: Record<string, unknown> };

// Lists every record in a collection, following the cursor so repos with more
// than one page are fully covered. Read-only and unauthenticated: the records
// are public, and this only reconstructs rkeys, never mutates.
async function listAllRecords(did: string, collection: string): Promise<ListedRecord[]> {
  const out: ListedRecord[] = [];
  let cursor: string | undefined;
  do {
    const params = new URLSearchParams({ repo: did, collection, limit: "100" });
    if (cursor) {
      params.set("cursor", cursor);
    }
    const res = await fetch(`${pds}/xrpc/com.atproto.repo.listRecords?${params.toString()}`);
    if (!res.ok) {
      throw new Error(`listRecords failed: ${res.status} ${await res.text()}`);
    }
    const data = await res.json();
    out.push(...(data.records as ListedRecord[]));
    cursor = data.cursor as string | undefined;
  } while (cursor);
  return out;
}

// Resolve the login identifier to a DID: passed through if already a DID,
// otherwise resolved from the handle via the AppView.
async function resolveDid(id: string): Promise<string> {
  if (id.startsWith("did:")) {
    return id;
  }
  const res = await fetch(`${PUBLIC_API}/xrpc/com.atproto.identity.resolveHandle?handle=${id}`);
  if (!res.ok) {
    throw new Error(`Failed to resolve handle ${id}: ${res.status}`);
  }
  return (await res.json()).did as string;
}

// Read the account's DID document (did:plc via the directory, did:web via its
// well-known) so the current PDS can be discovered rather than hard-coded.
async function resolveDidDocument(did: string): Promise<Record<string, unknown>> {
  let url: string;
  if (did.startsWith("did:plc:")) {
    url = `${PLC_DIRECTORY}/${did}`;
  } else if (did.startsWith("did:web:")) {
    url = `https://${did.slice("did:web:".length).replaceAll(":", "/")}/.well-known/did.json`;
  } else {
    throw new Error(`Unsupported DID method: ${did}`);
  }
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`DID document lookup failed for ${did}: ${res.status}`);
  }
  return res.json();
}

type DidService = { id: string; serviceEndpoint: string };

// The #atproto_pds service endpoint is the repo's current home; a migration just
// rewrites it, so resolving it each run makes the sync follow the account.
async function resolvePds(did: string): Promise<string> {
  const doc = await resolveDidDocument(did);
  const service = (doc.service as DidService[] | undefined)?.find((s) =>
    s.id.endsWith("#atproto_pds"),
  );
  if (!service?.serviceEndpoint) {
    throw new Error(`No #atproto_pds service in DID document for ${did}`);
  }
  return service.serviceEndpoint.replace(/\/+$/u, "");
}

function rkeyOf(uri: string): string {
  return uri.split("/").pop() as string;
}

function toIso(value: string | Date): string {
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

// Stable serialization (keys sorted at every depth) so records are compared by
// value; this keeps unchanged posts from emitting spurious putRecord updates
// that would otherwise stream to the firehose on every run.
function canonical(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map(canonical).join(",")}]`;
  }
  if (value && typeof value === "object") {
    return `{${Object.keys(value as Record<string, unknown>)
      .toSorted()
      .map((k) => `${JSON.stringify(k)}:${canonical((value as Record<string, unknown>)[k])}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}

function parseFrontmatter(raw: string): Frontmatter {
  const match = raw.match(/^---\r?\n([\s\S]*?)\r?\n---/u);
  if (!match) {
    throw new Error("missing frontmatter");
  }
  return parseYaml(match[1]) as Frontmatter;
}

// Mirror the glob content loader (`**/*.md`): walk recursively and key each post
// by its path relative to blogDir without the extension, which is exactly the
// entry id the site uses to build both the URL and the document <link> tag.
function listPosts(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      out.push(...listPosts(full));
    } else if (entry.name.endsWith(".md")) {
      out.push(relative(blogDir, full).replace(/\.md$/u, "").split(sep).join("/"));
    }
  }
  return out;
}

// Resolve a bsky.app URL or at:// URI to a strong ref (uri + cid). standard.site
// stores bskyPostRef as a com.atproto.repo.strongRef, which requires the cid, so
// the AppView is queried for the current post record.
async function resolveBskyRef(input: string): Promise<StrongRef> {
  let atUri = input;
  if (!input.startsWith("at://")) {
    const match = input.match(/profile\/([^/]+)\/post\/([^/?#]+)/u);
    if (!match) {
      throw new Error(`Unrecognized Bluesky post reference: ${input}`);
    }
    let actor = match[1];
    const rkey = match[2];
    if (!actor.startsWith("did:")) {
      const res = await fetch(
        `${PUBLIC_API}/xrpc/com.atproto.identity.resolveHandle?handle=${actor}`,
      );
      if (!res.ok) {
        throw new Error(`Failed to resolve handle ${actor}`);
      }
      actor = (await res.json()).did;
    }
    atUri = `at://${actor}/app.bsky.feed.post/${rkey}`;
  }
  const res = await fetch(
    `${PUBLIC_API}/xrpc/app.bsky.feed.getPosts?uris=${encodeURIComponent(atUri)}`,
  );
  if (!res.ok) {
    throw new Error(`getPosts failed: ${res.status}`);
  }
  const post = (await res.json()).posts?.[0];
  if (!post?.cid) {
    throw new Error(`Bluesky post not found: ${atUri}`);
  }
  return { uri: post.uri as string, cid: post.cid as string };
}

const mapping: Mapping = { did: "", publicationRkey: null, documents: {} };

// Persist eagerly so a mid-run failure never strands a freshly minted rkey: the
// record would exist on the PDS while the mapping forgot it, and the next run
// would create a duplicate instead of updating.
function saveMapping(): void {
  const sorted: Mapping = {
    did: mapping.did,
    publicationRkey: mapping.publicationRkey,
    documents: Object.fromEntries(
      Object.entries(mapping.documents).toSorted(([a], [b]) => a.localeCompare(b)),
    ),
  };
  // Two-space indent matches the repo's oxfmt config, so the committed mapping
  // stays format-stable and does not trip the treefmt check after a sync.
  writeFileSync(mappingPath, `${JSON.stringify(sorted, null, 2)}\n`);
}

// putRecord only when the stored value actually differs, so unchanged posts stay
// quiet on the firehose. Returns whether a write happened, for logging.
async function upsert(
  did: string,
  jwt: string,
  collection: string,
  rkey: string,
  record: Record<string, unknown>,
): Promise<boolean> {
  const existing = await getRecord(did, collection, rkey);
  if (existing && canonical(existing) === canonical(record)) {
    return false;
  }
  await xrpc("com.atproto.repo.putRecord", { repo: did, collection, rkey, record }, jwt);
  return true;
}

// Resolve identity -> PDS before authenticating so the session, and every record
// call after it, target whichever host currently serves the account's repo.
const did = await resolveDid(identifier);
pds = process.env.PDS_URL ?? (await resolvePds(did));

const session = await xrpc("com.atproto.server.createSession", {
  identifier,
  password,
});
const jwt = session.accessJwt as string;
mapping.did = did;

// Recover existing rkeys from the PDS so this run is idempotent regardless of the
// committed cache. Publications are matched by url (the site can only own one);
// documents are keyed back to their slug via the `path` this script itself sets.
const POST_PREFIX = "/posts/";
const existingPublications = await listAllRecords(did, "site.standard.publication");
const ownPublication =
  existingPublications.find((r) => r.value.url === SITE.website) ?? existingPublications[0];
mapping.publicationRkey = ownPublication ? rkeyOf(ownPublication.uri) : null;

const existingDocuments = await listAllRecords(did, "site.standard.document");
for (const { uri, value } of existingDocuments) {
  const path = value.path;
  if (typeof path === "string" && path.startsWith(POST_PREFIX)) {
    mapping.documents[path.slice(POST_PREFIX.length)] = rkeyOf(uri);
  }
}

// Upsert the publication first so document records can reference its AT-URI.
const publicationRecord = {
  $type: "site.standard.publication",
  name: SITE.title,
  url: SITE.website,
  description: SITE.desc,
};
if (mapping.publicationRkey) {
  const changed = await upsert(
    did,
    jwt,
    "site.standard.publication",
    mapping.publicationRkey,
    publicationRecord,
  );
  console.log(changed ? "updated publication" : "publication unchanged");
} else {
  const created = await xrpc(
    "com.atproto.repo.createRecord",
    { repo: did, collection: "site.standard.publication", record: publicationRecord },
    jwt,
  );
  mapping.publicationRkey = rkeyOf(created.uri as string);
  saveMapping();
  console.log("created publication");
}
const publicationUri = `at://${did}/site.standard.publication/${mapping.publicationRkey}`;

const published = new Set<string>();
for (const slug of listPosts(blogDir)) {
  const fm = parseFrontmatter(readFileSync(join(blogDir, `${slug}.md`), "utf8"));
  if (fm.draft) {
    continue;
  }
  published.add(slug);

  const bskyPostRef = fm.bskyPostUri ? await resolveBskyRef(fm.bskyPostUri) : undefined;

  const record = {
    $type: "site.standard.document",
    site: publicationUri,
    title: fm.title,
    path: `/posts/${slug}`,
    publishedAt: toIso(fm.pubDatetime),
    ...(fm.modDatetime ? { updatedAt: toIso(fm.modDatetime) } : {}),
    ...(fm.description ? { description: fm.description } : {}),
    ...(fm.tags?.length ? { tags: fm.tags } : {}),
    ...(bskyPostRef ? { bskyPostRef } : {}),
  };

  const existing = mapping.documents[slug];
  if (existing) {
    const changed = await upsert(did, jwt, "site.standard.document", existing, record);
    console.log(changed ? `updated ${slug}` : `unchanged ${slug}`);
  } else {
    const created = await xrpc(
      "com.atproto.repo.createRecord",
      { repo: did, collection: "site.standard.document", record },
      jwt,
    );
    mapping.documents[slug] = rkeyOf(created.uri as string);
    saveMapping();
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
    saveMapping();
    console.log(`deleted ${slug}`);
  }
}

saveMapping();
console.log("standard.site sync complete");
