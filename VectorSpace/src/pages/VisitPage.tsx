/**
 * @file        VisitPage.tsx
 * @project     VectorSpace
 * @author      Goh Pin Kai
 * @brief       /visit/:slug: the page a project's share link opens. Anyone may open it; the
 *              server decides who sees the project (GET /visit/:slug, routers/visit.py):
 *                public, unlisted  anyone, signed in or not
 *                sign_in_only     signed in and in the project's class
 *              A project sent to the teacher and not approved yet shows "Waiting for approval".
 *              Once loaded it is the same view as the editor's Play. Its owner also gets
 *              "Back to my projects" and "Edit my project" (the server says who owns it).
 *
 *              Uploaded images and videos still need the owner's sign-in to load, so a visitor
 *              sees "unavailable" in their place for now.
 *
 * @copyright   Copyright (C) 2026 DigiPen Institute of Technology.
 *              Reproduction or disclosure of this file or its contents without the
 *              prior written consent of DigiPen Institute of Technology is prohibited.
 */
/******************************************************************************/

import { useEffect, useState, type ReactNode } from "react";
import { Link, useNavigate, useParams } from "react-router";
import { ApiError, apiUrl } from "../api/client";
import { getVisitProject, type VisitProject } from "../api/visit";
import RuntimeView from "../../apps/runtime/src/RuntimeApplication";
import { auth0Enabled } from "../session/auth0";
import { useSession } from "../session/session";
import "./VisitPage.css";

type State =
  | { kind: "loading" }
  | { kind: "ready"; shared: VisitProject }
  | { kind: "sign-in" }
  | { kind: "problem"; heading: string; text: string };

const NOT_OPEN = {
  heading: "This project isn't open",
  text: "It may not be published yet, or it's only for its class. Check the link with whoever shared it.",
};

// sent to the teacher and not approved yet (409); the link starts working once it is
const WAITING = {
  heading: "Waiting for approval",
  text: "The teacher is taking a look at this project. The link will work once it's approved, so check back soon.",
};

export default function VisitPage() {
  const { slug = "" } = useParams();
  const { getToken, role, signIn } = useSession();
  const navigate = useNavigate();
  const [state, setState] = useState<State>({ kind: "loading" });

  // role changes when the visitor signs in, which can open a class-only project
  useEffect(() => {
    if (!apiUrl) return;
    let current = true;
    setState({ kind: "loading" });
    getVisitProject(getToken, slug).then(
      (shared) => current && setState({ kind: "ready", shared }),
      (error: unknown) => {
        if (!current) return;
        if (error instanceof ApiError && error.status === 401) setState({ kind: "sign-in" });
        else if (error instanceof ApiError && error.status === 409) setState({ kind: "problem", ...WAITING });
        else if (error instanceof ApiError && (error.status === 404 || error.status === 403)) setState({ kind: "problem", ...NOT_OPEN });
        else setState({ kind: "problem", heading: "Couldn't open this project", text: error instanceof Error ? error.message : "Something went wrong. Try again in a moment." });
      },
    );
    return () => { current = false; };
  }, [slug, role, getToken]);

  if (!apiUrl) return <VisitMessage heading="Visiting needs the server" text="Set VITE_API_URL to open shared projects." />;
  if (state.kind === "loading") return <VisitMessage heading="Opening the project…" />;
  if (state.kind === "problem") return <VisitMessage heading={state.heading} text={state.text} />;
  if (state.kind === "sign-in") {
    return (
      <VisitMessage heading="Sign in to visit" text="This project is for its class. Sign in with your school account to go in.">
        {/* the hosted login comes back to this page by itself; the dev sign-in is told where to return */}
        {auth0Enabled
          ? <button type="button" className="visit-button" onClick={() => void signIn("student")}>Sign in</button>
          : <Link className="visit-button" to={`/login?next=${encodeURIComponent(`/visit/${slug}`)}`}>Sign in</Link>}
      </VisitMessage>
    );
  }

  const { shared } = state;
  const byline = [shared.studentName && `By ${shared.studentName}`, shared.className, shared.schoolName].filter(Boolean).join(" · ");
  // the owner looking at their own link: it is what visitors see (the approved version), with a
  // way back to their projects ("/" lands on their home) and to editing it
  const ownProjectId = shared.ownProjectId;
  return (
    <div className="visit-page">
      <header className="visit-head">
        <div className="visit-head-text">
          <h1 className="visit-title">{shared.title}</h1>
          {byline && <p className="visit-byline">{byline}</p>}
        </div>
        {ownProjectId && (
          <div className="visit-owner-actions">
            <span className="visit-live">Live</span>
            <button type="button" className="visit-button" onClick={() => navigate(`/editor/${ownProjectId}`)}>
              Edit my project
            </button>
          </div>
        )}
      </header>
      {ownProjectId
        ? <RuntimeView
            project={shared.project}
            title="Viewing · exactly what visitors see"
            onExit={() => navigate("/")}
            exitLabel="Back to my projects"
            escapeExits={false}
          />
        : <RuntimeView project={shared.project} title={shared.title} />}
    </div>
  );
}

function VisitMessage({ heading, text, children }: { heading: string; text?: string; children?: ReactNode }) {
  return (
    <main className="visit-message">
      <div className="visit-card" role={text ? "alert" : "status"}>
        <h1 className="visit-title">{heading}</h1>
        {text && <p className="visit-text">{text}</p>}
        {children}
      </div>
    </main>
  );
}
