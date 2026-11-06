/**
 * @file        library.ts
 * @project     VectorSpace
 * @author      Sherman Goh Wee Hao
 * @date        2026-11-06
 * @brief       The browser's calls for the shared asset library and asset packs.
 *
 * @responsibility
 * Admin: list, upload, rename and delete library files (/library), and build, fill and publish
 * packs (/packs). Everyone signed in: the packs their own school has switched on (/packs/mine).
 *
 * @inputs
 * The session's getToken, and for an upload the File the admin dropped.
 *
 * @outputs
 * camelCase objects for the pages; an ApiError (client.ts) when the API refuses.
 *
 * @boundary
 * An upload is hash-first, the same three steps as apps/api/scripts/sync_library.py: hash the file
 * here, ask for a ticket (the API answers "already have it" for bytes it holds), PUT the bytes
 * straight to the bucket with the headers the ticket names, then confirm. The bytes never pass
 * through the API server. Which schools have a pack is admin.ts's getRooms/setRoomEnabled.
 *
 * @status
 * Current. The editor does not read packs yet (P7 in the asset-management roadmap).
 */

import { apiFetch, apiUrl, type GetToken } from "./client";

export type LibraryKind = "model" | "environment" | "image" | "audio" | "video";

export type LibraryAsset = {
  id: string;
  sha256: string;
  kind: LibraryKind;
  contentType: string;
  sizeBytes: number;
  filename: string;
  title: string;
  attribution: string | null;
  status: "pending" | "uploaded" | "failed";
  /** The public address, once the bytes are confirmed. */
  url: string | null;
  createdAt: string;
};

export type Pack = {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  kind: "objects" | "environments";
  /** The draft's files, in order. */
  assetIds: string[];
  publishedRevision: number | null;
  publishedAt: string | null;
  manifestUrl: string | null;
  /** The draft differs from what was last published, or it was never published. */
  unpublishedChanges: boolean;
};

/** A pack the caller's school has switched on: what a teacher's catalogue lists. */
export type MyPack = {
  slug: string;
  title: string;
  description: string | null;
  kind: Pack["kind"];
  revision: number;
  manifestUrl: string;
  itemCount: number;
};

export type UploadOutcome = { asset: LibraryAsset; uploaded: boolean };

// ---- what the API sends (snake_case) ----------------------------------------------------------
type LibraryRow = {
  id: string;
  content_sha256: string;
  kind: LibraryKind;
  content_type: string;
  size_bytes: number;
  filename: string;
  title: string;
  attribution: string | null;
  status: LibraryAsset["status"];
  url: string | null;
  created_at: string;
};
type TicketRow = { asset: LibraryRow; upload_url: string | null; upload_headers: Record<string, string> | null };
type PackRow = {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  kind: Pack["kind"];
  asset_ids: string[];
  published_revision: number | null;
  published_at: string | null;
  manifest_url: string | null;
  unpublished_changes: boolean;
};
type MyPackRow = Omit<MyPack, "manifestUrl" | "itemCount"> & { manifest_url: string; item_count: number };

const toAsset = (row: LibraryRow): LibraryAsset => ({
  id: row.id,
  sha256: row.content_sha256,
  kind: row.kind,
  contentType: row.content_type,
  sizeBytes: row.size_bytes,
  filename: row.filename,
  title: row.title,
  attribution: row.attribution,
  status: row.status,
  url: row.url,
  createdAt: row.created_at,
});

const toPack = (row: PackRow): Pack => ({
  id: row.id,
  slug: row.slug,
  title: row.title,
  description: row.description,
  kind: row.kind,
  assetIds: row.asset_ids,
  publishedRevision: row.published_revision,
  publishedAt: row.published_at,
  manifestUrl: row.manifest_url,
  unpublishedChanges: row.unpublished_changes,
});

/** The SHA-256 of a file as 64 lowercase hex characters, the library's key for it. */
export const sha256Hex = async (blob: Blob): Promise<string> => {
  const digest = await crypto.subtle.digest("SHA-256", await blob.arrayBuffer());
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
};

/**
 * What kind of library file this is and the content type to send, from its name, or null for a
 * file the library does not take. Rooms are .glb too, so a .glb is a model unless the admin says
 * it is an environment. .gltf is refused on purpose: it points at sibling files by relative path.
 */
export const kindForFile = (name: string, asEnvironment = false): { kind: LibraryKind; contentType: string } | null => {
  const ext = name.toLowerCase().split(".").pop() ?? "";
  if (ext === "glb") return { kind: asEnvironment ? "environment" : "model", contentType: "model/gltf-binary" };
  const image: Record<string, string> = { png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", webp: "image/webp", gif: "image/gif" };
  if (image[ext]) return { kind: "image", contentType: image[ext] };
  if (ext === "mp4") return { kind: "video", contentType: "video/mp4" };
  if (ext === "webm") return { kind: "video", contentType: "video/webm" };
  return null;
};

/** "Pedestal_Large.glb" -> "Pedestal Large": the title a file starts with until someone edits it. */
export const titleFromFilename = (name: string): string =>
  name.replace(/\.[^.]+$/, "").replace(/[_-]+/g, " ").replace(/\s+/g, " ").trim() || name;

/** "Ancient Egypt!" -> "ancient-egypt": the short name a pack is stored and published under. */
export const slugify = (title: string): string =>
  title.toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 100);

export function createLibraryApi(getToken: GetToken, base: string | undefined = apiUrl) {
  const call = <T>(path: string, init: Parameters<typeof apiFetch>[2] = {}) => apiFetch<T>(getToken, path, init, base);

  return {
    listLibrary: async (): Promise<LibraryAsset[]> => (await call<LibraryRow[]>("/library")).map(toAsset),

    /** Hash, ticket, PUT, confirm. A file the library already holds is not sent again. */
    upload: async (file: File, options: { asEnvironment?: boolean; title?: string; attribution?: string } = {}): Promise<UploadOutcome> => {
      const type = kindForFile(file.name, options.asEnvironment);
      if (!type) throw new Error(`${file.name}: the library takes .glb models, images and .mp4 or .webm videos`);
      const ticket = await call<TicketRow>("/library/tickets", {
        method: "POST",
        body: {
          content_sha256: await sha256Hex(file),
          filename: file.name,
          kind: type.kind,
          content_type: type.contentType,
          size_bytes: file.size,
          title: options.title || titleFromFilename(file.name),
          attribution: options.attribution || null,
        },
      });
      if (!ticket.upload_url) return { asset: toAsset(ticket.asset), uploaded: false };
      // straight to the bucket; the headers are part of the signature, so send exactly these
      const put = await fetch(ticket.upload_url, { method: "PUT", headers: ticket.upload_headers ?? {}, body: file });
      if (!put.ok) throw new Error(`${file.name}: the storage bucket refused the upload (${put.status})`);
      const confirmed = await call<LibraryRow>(`/library/${ticket.asset.id}/confirm`, { method: "POST" });
      return { asset: toAsset(confirmed), uploaded: true };
    },

    updateAsset: async (id: string, fields: { title?: string; attribution?: string | null }): Promise<LibraryAsset> =>
      toAsset(await call<LibraryRow>(`/library/${id}`, { method: "PATCH", body: fields })),

    deleteAsset: (id: string): Promise<void> => call<void>(`/library/${id}`, { method: "DELETE" }),

    listPacks: async (): Promise<Pack[]> => (await call<PackRow[]>("/packs")).map(toPack),

    createPack: async (fields: { slug: string; title: string; description?: string; kind?: Pack["kind"] }): Promise<Pack> =>
      toPack(await call<PackRow>("/packs", { method: "POST", body: fields })),

    updatePack: async (slug: string, fields: { title?: string; description?: string | null }): Promise<Pack> =>
      toPack(await call<PackRow>(`/packs/${slug}`, { method: "PATCH", body: fields })),

    setPackAssets: async (slug: string, assetIds: string[]): Promise<Pack> =>
      toPack(await call<PackRow>(`/packs/${slug}/assets`, { method: "PUT", body: { asset_ids: assetIds } })),

    publishPack: async (slug: string): Promise<Pack> => toPack(await call<PackRow>(`/packs/${slug}/publish`, { method: "POST" })),

    deletePack: (slug: string): Promise<void> => call<void>(`/packs/${slug}`, { method: "DELETE" }),

    myPacks: async (): Promise<MyPack[]> =>
      (await call<MyPackRow[]>("/packs/mine")).map(({ manifest_url, item_count, ...rest }) => ({
        ...rest,
        manifestUrl: manifest_url,
        itemCount: item_count,
      })),
  };
}

export type LibraryApi = ReturnType<typeof createLibraryApi>;
