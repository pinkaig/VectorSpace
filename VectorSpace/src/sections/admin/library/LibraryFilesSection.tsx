/**
 * @file        LibraryFilesSection.tsx
 * @project     VectorSpace
 * @author      Sherman Goh Wee Hao
 * @date        2026-11-06
 * @brief       Admin Library, left panel: drop files to upload them, then rename, credit or
 *              delete each one.
 *
 * @responsibility
 * Uploads one file at a time (hash, ticket, PUT, confirm in api/library.ts) and shows each file's
 * progress, including "already in the library" for bytes the library holds. Edits save when the
 * field loses focus. Delete asks twice, and the API refuses a file a pack still holds.
 *
 * @copyright   Copyright (C) 2026 DigiPen Institute of Technology.
 *              Reproduction or disclosure of this file or its contents without the
 *              prior written consent of DigiPen Institute of Technology is prohibited.
 */
/******************************************************************************/

import { useRef, useState, type Dispatch, type DragEvent, type SetStateAction } from "react";
import type { LibraryApi, LibraryAsset, Pack } from "../../../api/library";
import { Motion } from "../../../motion/useMotion";
import { Button } from "../../../ui/button";
import { StatusChip } from "../../../ui/statusChip";

type Props = {
  api: LibraryApi;
  files: LibraryAsset[];
  setFiles: Dispatch<SetStateAction<LibraryAsset[] | null>>;
  packs: Pack[];
};

type Progress = { name: string; state: "working" | "done" | "had" | "failed"; message?: string };

const KIND_LABEL: Record<LibraryAsset["kind"], string> = {
  model: "Model", environment: "Room", image: "Image", audio: "Sound", video: "Video",
};

const formatSize = (bytes: number): string =>
  bytes >= 1_000_000 ? `${(bytes / 1_000_000).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1000))} KB`;

const message = (error: unknown): string => (error instanceof Error ? error.message : String(error));

export function LibraryFilesSection({ api, files, setFiles, packs }: Props) {
  const [progress, setProgress] = useState<Progress[]>([]);
  const [asEnvironment, setAsEnvironment] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [confirming, setConfirming] = useState<string | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const picker = useRef<HTMLInputElement>(null);

  // which packs hold each file, so the table can say so and the admin knows why delete is refused
  const heldBy = new Map<string, string[]>();
  for (const pack of packs) for (const id of pack.assetIds) heldBy.set(id, [...(heldBy.get(id) ?? []), pack.title]);

  const upsert = (asset: LibraryAsset) =>
    setFiles((list) => (list ? [asset, ...list.filter((row) => row.id !== asset.id)] : [asset]));

  const uploadAll = async (chosen: File[]) => {
    setProgress(chosen.map((file) => ({ name: file.name, state: "working" })));
    // one at a time: a class of 30 GLBs should not open 30 uploads at once on a school network
    for (const [index, file] of chosen.entries()) {
      const set = (next: Progress) => setProgress((rows) => rows.map((row, i) => (i === index ? next : row)));
      try {
        const outcome = await api.upload(file, { asEnvironment });
        upsert(outcome.asset);
        set({ name: file.name, state: outcome.uploaded ? "done" : "had", message: outcome.uploaded ? undefined : `already in the library as "${outcome.asset.title}"` });
      } catch (error) {
        set({ name: file.name, state: "failed", message: message(error) });
      }
    }
  };

  const onDrop = (event: DragEvent) => {
    event.preventDefault();
    setDragging(false);
    if (event.dataTransfer.files.length) void uploadAll(Array.from(event.dataTransfer.files));
  };

  const save = async (asset: LibraryAsset, fields: { title?: string; attribution?: string | null }) => {
    try {
      upsert(await api.updateAsset(asset.id, fields));
      setProblem(null);
    } catch (error) {
      setProblem(`Could not save ${asset.title}: ${message(error)}`);
    }
  };

  const remove = async (asset: LibraryAsset) => {
    setConfirming(null);
    try {
      await api.deleteAsset(asset.id);
      setFiles((list) => list && list.filter((row) => row.id !== asset.id));
      setProblem(null);
    } catch (error) {
      setProblem(`Could not delete ${asset.title}: ${message(error)}`);
    }
  };

  return (
    <section className="admin-panel admin-library-files">
      <div className="admin-panel-head">
        <h2>Files</h2>
        <span className="admin-muted">{files.length} in the library</span>
      </div>

      {/*DROP ZONE: drag files here, or click to choose*/}
      <div
        className={`admin-library-drop ${dragging ? "admin-library-drop-over" : ""}`}
        onDragOver={(event) => { event.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
      >
        <p><strong>Drop files here</strong> or <button type="button" className="admin-library-link" onClick={() => picker.current?.click()}>choose files</button></p>
        <p className="admin-muted">.glb models (up to 50 MB), images, .mp4 or .webm videos. A file the library already has is not uploaded again.</p>
        <label className="admin-library-check">
          <input type="checkbox" checked={asEnvironment} onChange={(event) => setAsEnvironment(event.target.checked)} />
          These .glb files are whole rooms (environments), not objects
        </label>
        <input
          ref={picker}
          type="file"
          multiple
          hidden
          accept=".glb,.png,.jpg,.jpeg,.webp,.gif,.mp4,.webm"
          aria-label="Choose files to upload"
          onChange={(event) => { if (event.target.files?.length) void uploadAll(Array.from(event.target.files)); event.target.value = ""; }}
        />
      </div>

      {progress.length > 0 && (
        <ul className="admin-library-progress" aria-live="polite">
          {progress.map((row, index) => (
            <li key={`${row.name}-${index}`} className={`admin-library-progress-${row.state}`}>
              {row.name}: {row.state === "working" ? "uploading…" : row.state === "done" ? "uploaded" : row.state === "had" ? row.message : `failed, ${row.message}`}
            </li>
          ))}
        </ul>
      )}
      {problem && <Motion as="p" cue="feedback.error" role="alert">{problem}</Motion>}

      {/*TABLE: one row per file*/}
      <div className="admin-scroll">
        <table className="admin-table admin-library-table">
          <thead>
            <tr><th>Title and credit</th><th>Kind</th><th>Size</th><th>In packs</th><th /></tr>
          </thead>
          <tbody>
            {files.map((asset) => (
              <tr key={asset.id}>
                <td>
                  <input
                    className="ui-input admin-library-title"
                    defaultValue={asset.title}
                    aria-label={`Title of ${asset.filename}`}
                    onBlur={(event) => {
                      const title = event.target.value.trim();
                      if (title && title !== asset.title) void save(asset, { title });
                      else event.target.value = asset.title;
                    }}
                  />
                  <input
                    className="ui-input admin-library-credit"
                    defaultValue={asset.attribution ?? ""}
                    placeholder="Credit: author, licence, source"
                    aria-label={`Credit for ${asset.title}`}
                    onBlur={(event) => {
                      const attribution = event.target.value.trim() || null;
                      if (attribution !== asset.attribution) void save(asset, { attribution });
                    }}
                  />
                  <span className="admin-muted admin-library-filename">{asset.filename}</span>
                </td>
                <td>
                  <StatusChip tone={asset.status === "uploaded" ? "purple" : asset.status === "failed" ? "red" : "amber"}>
                    {asset.status === "uploaded" ? KIND_LABEL[asset.kind] : asset.status === "failed" ? "Failed" : "Uploading"}
                  </StatusChip>
                </td>
                <td>{formatSize(asset.sizeBytes)}</td>
                <td>{heldBy.get(asset.id)?.join(", ") ?? <span className="admin-muted">none</span>}</td>
                <td className="admin-actions">
                  {asset.url && <a className="ui-btn ui-btn-secondary ui-btn-small" href={asset.url} target="_blank" rel="noreferrer">Open</a>}
                  {confirming === asset.id ? (
                    <>
                      <Button size="small" variant="danger" onClick={() => void remove(asset)}>Delete for good</Button>
                      <Button size="small" onClick={() => setConfirming(null)}>Keep</Button>
                    </>
                  ) : (
                    <Button size="small" variant="danger" onClick={() => setConfirming(asset.id)}>Delete</Button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {files.length === 0 && <p className="admin-muted">The library is empty. Drop a .glb above to start.</p>}
      </div>
    </section>
  );
}
