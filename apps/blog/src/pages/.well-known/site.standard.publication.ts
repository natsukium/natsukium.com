import type { APIRoute } from "astro";
import { publicationUri } from "../../utils/standardSite";

// Domain-level proof that links this site back to the publication record.
// Served as a route (not a public/ file) so the AT-URI stays derived from the
// single source of truth and is never copied out of sync.
export const GET: APIRoute = () => {
  const uri = publicationUri();
  if (!uri) {
    return new Response("Not Found", { status: 404 });
  }
  return new Response(`${uri}\n`, {
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
};
