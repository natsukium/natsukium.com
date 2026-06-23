import data from "../data/standard-site.json";

// standard.site records use `key: "tid"`, so record keys cannot be derived from
// slugs and must be persisted. This module is the read side of that mapping;
// the write side is scripts/sync-standard-site.ts.
type StandardSiteData = {
  did: string;
  publicationRkey: string | null;
  documents: Record<string, string>;
};

const standardSite = data as StandardSiteData;

export function publicationUri(): string | undefined {
  return standardSite.publicationRkey
    ? `at://${standardSite.did}/site.standard.publication/${standardSite.publicationRkey}`
    : undefined;
}

export function documentUri(slug: string): string | undefined {
  const rkey = standardSite.documents[slug];
  return rkey ? `at://${standardSite.did}/site.standard.document/${rkey}` : undefined;
}
