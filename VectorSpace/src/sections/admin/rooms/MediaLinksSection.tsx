/**
 * @file        MediaLinksSection.tsx
 * @project     VectorSpace
 * @author      Weian Ching
 * @brief       Rooms & assets: YouTube and image links. Add a link (approved at
 *              once), approve or send back links students and teachers added in
 *              the editor, and remove links. A rough approval screen.
 *
 * @responsibility
 * Reads and writes the media library kept in this browser
 * (src/content/localMediaLibrary.ts). A link plays in info cards only once it
 * is approved here; until then cards show "unavailable". Uploaded files need
 * no approval and are not listed here.
 *
 * @copyright   Copyright (C) 2026 DigiPen Institute of Technology.
 *              Reproduction or disclosure of this file or its contents without the
 *              prior written consent of DigiPen Institute of Technology is prohibited.
 */
/******************************************************************************/

import { useState } from "react";
import { Button } from "../../../ui/button";
import {
  addLocalMediaLink,
  classifyMediaLink,
  removeLocalMedia,
  reviewLocalMedia,
  useLocalMediaLibrary,
  type LocalMediaEntry,
} from "../../../content/localMediaLibrary";

// where a link can be opened to check it; YouTube addresses are rebuilt from the id
const openUrl = (entry: LocalMediaEntry) =>
  entry.source === "youtube" ? `https://www.youtube.com/watch?v=${entry.providerId}` : entry.url;

const kindText = (entry: LocalMediaEntry) => (entry.source === "youtube" ? "YouTube video" : "Image link");

function ReviewRow({ entry }: { entry: LocalMediaEntry }) {
  const [comment, setComment] = useState("");
  return (
    <div className="admin-media-row admin-media-review">
      <div className="admin-media-main">
        <div className="admin-rooms-name">{entry.label}</div>
        <div className="admin-rooms-desc">
          {kindText(entry)} · added in the editor ·{" "}
          <a href={openUrl(entry)} target="_blank" rel="noopener noreferrer">Open to check</a>
        </div>
        <input
          className="admin-media-input"
          aria-label={`Comment for ${entry.label}`}
          placeholder="Comment if sending back (optional)"
          maxLength={500}
          value={comment}
          onChange={(event) => setComment(event.target.value)}
        />
      </div>
      <div className="admin-media-actions">
        <Button variant="primary" onClick={() => reviewLocalMedia(entry.id, "approved", comment)}>Approve</Button>
        <Button onClick={() => reviewLocalMedia(entry.id, "rejected", comment)}>Send back</Button>
      </div>
    </div>
  );
}

export function MediaLinksSection() {
  const library = useLocalMediaLibrary();
  const links = library.filter((entry) => entry.source !== "file");
  const waiting = links.filter((entry) => entry.approval === "pending");
  const decided = links.filter((entry) => entry.approval !== "pending");

  const [url, setUrl] = useState("");
  const [name, setName] = useState("");
  const [problem, setProblem] = useState<string | null>(null);
  const parsed = url.trim() ? classifyMediaLink(url) : null;

  const add = () => {
    const result = addLocalMediaLink(url, "admin", name);
    if ("error" in result) return setProblem(result.error);
    setUrl("");
    setName("");
    setProblem(null);
  };

  return (
    <section className="admin-panel admin-media">
      <div className="admin-panel-head">
        <h2>YouTube &amp; image links</h2>
      </div>
      <p className="admin-rooms-note">
        Videos and pictures from the web for info cards. A link added here is approved straight away; links added in the editor wait for you below.
        Unlike the settings above, these are kept: in this browser, for now.
      </p>

      {/*ADD: a YouTube link or a direct https link to a PNG, JPEG or WebP image*/}
      <div className="admin-media-add">
        <input
          className="admin-media-input"
          aria-label="YouTube or image link"
          placeholder="https://www.youtube.com/watch?v=… or https://…/picture.png"
          value={url}
          onChange={(event) => { setUrl(event.target.value); setProblem(null); }}
        />
        <input
          className="admin-media-input admin-media-name"
          aria-label="Name (optional)"
          placeholder="Name (optional)"
          maxLength={200}
          value={name}
          onChange={(event) => setName(event.target.value)}
        />
        <Button variant="add" onClick={add} disabled={!parsed || "error" in parsed}>+ Add link</Button>
      </div>
      {parsed && "error" in parsed && <p className="admin-media-hint error">{parsed.error}</p>}
      {parsed && !("error" in parsed) && (
        <p className="admin-media-hint">{parsed.source === "youtube" ? `YouTube video ${parsed.providerId}` : "Image link"}. Approved as soon as you add it.</p>
      )}
      {problem && <p className="admin-media-hint error" role="alert">{problem}</p>}

      <div className="admin-scroll">
        <h3 className="admin-media-heading">Waiting for approval · {waiting.length}</h3>
        {waiting.length === 0 && <p className="admin-rooms-desc">Nothing to check.</p>}
        {waiting.map((entry) => <ReviewRow key={entry.id} entry={entry} />)}

        <h3 className="admin-media-heading">In the library · {decided.length}</h3>
        {decided.length === 0 && <p className="admin-rooms-desc">No links yet.</p>}
        {decided.map((entry) => (
          <div key={entry.id} className="admin-media-row">
            <div className="admin-media-main">
              <div className="admin-rooms-name">{entry.label}</div>
              <div className="admin-rooms-desc">
                {kindText(entry)} ·{" "}
                <span className={entry.approval === "approved" ? "admin-media-status ok" : "admin-media-status no"}>
                  {entry.approval === "approved" ? "Approved" : "Sent back"}
                </span>
                {entry.reviewComment && <> · “{entry.reviewComment}”</>}
              </div>
            </div>
            <div className="admin-media-actions">
              {entry.approval === "rejected" && <Button onClick={() => reviewLocalMedia(entry.id, "approved")}>Approve</Button>}
              <Button variant="danger" onClick={() => void removeLocalMedia(entry.id)} aria-label={`Remove ${entry.label}`}>Remove</Button>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
