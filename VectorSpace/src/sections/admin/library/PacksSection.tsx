/**
 * @file        PacksSection.tsx
 * @project     VectorSpace
 * @author      Sherman Goh Wee Hao
 * @date        2026-11-06
 * @brief       Admin Library, right panel: make a pack, choose and order its files, publish it.
 *
 * @responsibility
 * Lists every pack with where it stands (draft, published, changes not published). The open
 * pack shows its files in order and the library files that could go in. Contents are edited
 * here and saved with "Save contents"; "Publish" saves first if needed, then writes a new
 * revision of the manifest. A school only sees a pack once it is published AND switched on
 * for that school on Rooms & assets.
 *
 * @copyright   Copyright (C) 2026 DigiPen Institute of Technology.
 *              Reproduction or disclosure of this file or its contents without the
 *              prior written consent of DigiPen Institute of Technology is prohibited.
 */
/******************************************************************************/

import { useState, type Dispatch, type FormEvent, type SetStateAction } from "react";
import { Link } from "react-router";
import { slugify, type LibraryApi, type LibraryAsset, type Pack } from "../../../api/library";
import { Motion } from "../../../motion/useMotion";
import { Button } from "../../../ui/button";
import { StatusChip } from "../../../ui/statusChip";

type Props = {
  api: LibraryApi;
  files: LibraryAsset[];
  packs: Pack[];
  setPacks: Dispatch<SetStateAction<Pack[] | null>>;
};

const message = (error: unknown): string => (error instanceof Error ? error.message : String(error));

// what each kind of pack may hold, the same rule as apps/api/app/routers/packs.py
const fits = (pack: Pack, asset: LibraryAsset): boolean =>
  asset.status === "uploaded" && (pack.kind === "environments" ? asset.kind === "environment" : asset.kind !== "environment");

const packState = (pack: Pack): { tone: "grey" | "green" | "amber"; label: string } =>
  pack.publishedRevision === null
    ? { tone: "grey", label: "Draft" }
    : pack.unpublishedChanges
      ? { tone: "amber", label: `Revision ${pack.publishedRevision}, changes not published` }
      : { tone: "green", label: `Published, revision ${pack.publishedRevision}` };

export function PacksSection({ api, files, packs, setPacks }: Props) {
  const [openSlug, setOpenSlug] = useState<string | null>(packs[0]?.slug ?? null);
  const [problem, setProblem] = useState<string | null>(null);
  const open = packs.find((pack) => pack.slug === openSlug) ?? null;

  const replace = (next: Pack) =>
    setPacks((list) => (list ? (list.some((p) => p.id === next.id) ? list.map((p) => (p.id === next.id ? next : p)) : [...list, next]) : [next]));

  return (
    <section className="admin-panel admin-library-packs">
      <div className="admin-panel-head">
        <h2>Packs</h2>
        <span className="admin-muted">Switch a published pack on per school in <Link to="/admin/rooms">Rooms &amp; assets</Link></span>
      </div>

      <NewPackForm
        onCreate={async (fields) => {
          try {
            const pack = await api.createPack(fields);
            replace(pack);
            setOpenSlug(pack.slug);
            setProblem(null);
          } catch (error) {
            setProblem(`Could not make the pack: ${message(error)}`);
          }
        }}
      />
      {problem && <Motion as="p" cue="feedback.error" role="alert">{problem}</Motion>}

      {/*PACK LIST: pick one to open it*/}
      <div className="admin-library-packlist" role="list">
        {packs.map((pack) => {
          const state = packState(pack);
          return (
            <button
              key={pack.id}
              type="button"
              role="listitem"
              aria-pressed={pack.slug === openSlug}
              className={`admin-library-pack ${pack.slug === openSlug ? "admin-library-pack-open" : ""}`}
              onClick={() => setOpenSlug(pack.slug)}
            >
              <span className="admin-rooms-name">{pack.title}</span>
              <span className="admin-muted">{pack.assetIds.length} files · {pack.kind === "environments" ? "rooms" : "objects"}</span>
              <StatusChip tone={state.tone}>{state.label}</StatusChip>
            </button>
          );
        })}
        {packs.length === 0 && <p className="admin-muted">No packs yet. Make one above.</p>}
      </div>

      {open && (
        <PackBuilder
          key={open.id}
          pack={open}
          files={files}
          api={api}
          onChange={replace}
          onDeleted={() => {
            setPacks((list) => list && list.filter((p) => p.id !== open.id));
            setOpenSlug(null);
          }}
        />
      )}
    </section>
  );
}

function NewPackForm({ onCreate }: { onCreate: (fields: { slug: string; title: string; description?: string; kind: Pack["kind"] }) => Promise<void> }) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [kind, setKind] = useState<Pack["kind"]>("objects");
  const slug = slugify(title);
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!slug) return;
    await onCreate({ slug, title: title.trim(), description: description.trim() || undefined, kind });
    setTitle("");
    setDescription("");
  };
  return (
    <form className="admin-library-newpack" onSubmit={(event) => void submit(event)}>
      <input className="ui-input" value={title} onChange={(event) => setTitle(event.target.value)} placeholder="New pack, e.g. Fossils" aria-label="New pack title" />
      <input className="ui-input" value={description} onChange={(event) => setDescription(event.target.value)} placeholder="What it holds (optional)" aria-label="New pack description" />
      <select className="ui-input" value={kind} onChange={(event) => setKind(event.target.value as Pack["kind"])} aria-label="What the pack holds">
        <option value="objects">Objects</option>
        <option value="environments">Rooms</option>
      </select>
      <Button variant="add" type="submit" disabled={!slug}>+ Make pack</Button>
      {slug && <span className="admin-muted">Published as {slug}</span>}
    </form>
  );
}

type BuilderProps = { pack: Pack; files: LibraryAsset[]; api: LibraryApi; onChange: (pack: Pack) => void; onDeleted: () => void };

function PackBuilder({ pack, files, api, onChange, onDeleted }: BuilderProps) {
  // the contents being edited; saved to the draft with Save contents (or by Publish)
  const [ids, setIds] = useState<string[]>(pack.assetIds);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const byId = new Map(files.map((file) => [file.id, file]));
  const dirty = ids.join() !== pack.assetIds.join();
  const addable = files.filter((file) => fits(pack, file) && !ids.includes(file.id));

  const move = (index: number, by: number) =>
    setIds((list) => {
      const next = [...list];
      const [item] = next.splice(index, 1);
      next.splice(Math.max(0, Math.min(next.length, index + by)), 0, item);
      return next;
    });

  const run = async (label: string, work: () => Promise<void>) => {
    setBusy(true);
    setProblem(null);
    setNote(null);
    try {
      await work();
    } catch (error) {
      setProblem(`${label}: ${message(error)}`);
    } finally {
      setBusy(false);
    }
  };

  const saveContents = () => run("Could not save", async () => {
    onChange(await api.setPackAssets(pack.slug, ids));
    setNote("Contents saved to the draft. Schools still get the last published revision until you publish.");
  });

  const publish = () => run("Could not publish", async () => {
    if (dirty) await api.setPackAssets(pack.slug, ids);
    const published = await api.publishPack(pack.slug);
    onChange(published);
    setNote(`Published revision ${published.publishedRevision}. Schools that have this pack switched on get it now.`);
  });

  const remove = () => run("Could not delete", async () => {
    await api.deletePack(pack.slug);
    onDeleted();
  });

  return (
    <div className="admin-library-builder">
      <div className="admin-library-builder-head">
        <div>
          <h3>{pack.title}</h3>
          {pack.description && <p className="admin-muted">{pack.description}</p>}
          {pack.manifestUrl && (
            <a className="admin-muted" href={pack.manifestUrl} target="_blank" rel="noreferrer">Published manifest</a>
          )}
        </div>
        <div className="admin-actions">
          <Button size="small" disabled={!dirty || busy} onClick={() => void saveContents()}>Save contents</Button>
          <Button size="small" variant="primary" disabled={busy || ids.length === 0 || (!dirty && !pack.unpublishedChanges)} onClick={() => void publish()}>
            {pack.publishedRevision === null ? "Publish" : "Publish again"}
          </Button>
          {pack.publishedRevision === null && (
            <Button size="small" variant="danger" disabled={busy} onClick={() => void remove()}>Delete draft</Button>
          )}
        </div>
      </div>
      {problem && <Motion as="p" cue="feedback.error" role="alert">{problem}</Motion>}
      {note && <p className="admin-library-note" role="status">{note}</p>}

      <div className="admin-library-columns">
        {/*IN THIS PACK: ordered, the order the catalogue shows*/}
        <div>
          <h4 className="admin-media-heading">In this pack ({ids.length})</h4>
          <ol className="admin-library-items">
            {ids.map((id, index) => (
              <li key={id} className="admin-media-row">
                <span>{byId.get(id)?.title ?? "A file that is no longer listed"}</span>
                <span className="admin-media-actions">
                  <Button size="small" disabled={index === 0} onClick={() => move(index, -1)} aria-label="Move up">↑</Button>
                  <Button size="small" disabled={index === ids.length - 1} onClick={() => move(index, 1)} aria-label="Move down">↓</Button>
                  <Button size="small" onClick={() => setIds((list) => list.filter((other) => other !== id))}>Take out</Button>
                </span>
              </li>
            ))}
          </ol>
          {ids.length === 0 && <p className="admin-muted">Empty. Add files from the right.</p>}
        </div>
        {/*CAN GO IN: library files of the right kind that are not in it yet*/}
        <div>
          <h4 className="admin-media-heading">Add from the library ({addable.length})</h4>
          <ul className="admin-library-items">
            {addable.map((file) => (
              <li key={file.id} className="admin-media-row">
                <span>{file.title}</span>
                <Button size="small" variant="add" onClick={() => setIds((list) => [...list, file.id])}>+ Add</Button>
              </li>
            ))}
          </ul>
          {addable.length === 0 && <p className="admin-muted">Nothing else of this kind in the library.</p>}
        </div>
      </div>
    </div>
  );
}
