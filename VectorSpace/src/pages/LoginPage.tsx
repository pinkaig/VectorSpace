/**
 * @file        LoginPage.tsx
 * @project     Spatial Experience Builder
 * @author      Chloe Lau Rey En
 * @brief       The temporary sign-in page: choose Teacher or Student (or the admin
 *              override) and hand the choice to the app. No real login happens here.
 *
 * @copyright   Copyright (C) 2026 DigiPen Institute of Technology.
 *              Reproduction or disclosure of this file or its contents without the
 *              prior written consent of DigiPen Institute of Technology is prohibited.
 */
/******************************************************************************/

import { useEffect, useState } from "react";
import { getShowcaseMuseums, type ShowcaseMuseum } from "../api/showcase";
import { Box, ChevronLeft, ChevronRight } from "lucide-react";
import { MuseumPreview } from "../ui/museumPreview";

// @ts-ignore CSS is loaded by the bundler; it has no TypeScript module declaration.
import "./LoginPage.css";

type LoginPageProps = {
  onSignIn: (role: "teacher" | "student", admin?: boolean) => void;
  // offers the admin button; App passes true only while the sign-in is temporary (session.tsx)
  showAdmin?: boolean;
};

export default function LoginPage({
  onSignIn,
  showAdmin = false,
}: LoginPageProps) {
  const [museums, setMuseums] = useState<ShowcaseMuseum[]>([]);
  const [index, setIndex] = useState(0);

  // load the carousel museums once when the page opens
  useEffect(() => {
    getShowcaseMuseums().then(setMuseums);
  }, []);

  const museum = museums[index];

  // wrap around: after the last museum comes the first, and the other way
  const showNext = () => setIndex((i) => (i + 1) % museums.length);
  const showPrev = () =>
    setIndex((i) => (i - 1 + museums.length) % museums.length);

  return (
    <main className="login-page">
      {/*LEFT: Showcase student museums*/}
      <section className="login-showcase">
        <div className="login-brand">
          <div className="login-logo">
            <Box size={24} />
          </div>
          <span className="login-brand-name">VectorSpace</span>
        </div>

        <h1 className="login-museum">Build a museum you can walk through.</h1>
        <p className="login-lead">Here's what students have made this term.</p>

        {museum && (
          <article className="login-museum-card">
            <div className="login-museum-image">
              <MuseumPreview title={museum.title} />
              <span className="login-chip">Made by a student</span>
              <span className="login-chip login-chip-dark">
                {museum.exhibitCount} exhibits · {museum.roomCount} rooms
              </span>
            </div>
            <div className="login-museum-info">
              <div className="login-avatar">{museum.studentName[0]}</div>
              <div className="login-museum-text">
                <h2 className="login-museum-title">{museum.title}</h2>
                <p className="login-museum-meta">
                  {museum.studentName} · {museum.className}, {museum.schoolName}
                </p>
              </div>
              <span className="login-chip">{museum.subject}</span>
            </div>
          </article>
        )}

        <div className="login-carousel-controls">
          <button
            type="button"
            className="login-arrow"
            aria-label="Previous museum"
            onClick={showPrev}
          >
            <ChevronLeft size={22} />
          </button>

          <div className="login-dots">
            {museums.map((m, i) => (
              <button
                key={m.id}
                type="button"
                className={i === index ? "login-dot active" : "login-dot"}
                aria-label={`Show ${m.title}`}
                aria-current={i === index}
                onClick={() => setIndex(i)}
              />
            ))}
          </div>

          <button
            type="button"
            className="login-arrow"
            aria-label="Next museum"
            onClick={showNext}
          >
            <ChevronRight size={22} />
          </button>
        </div>
      </section>

      {/* RIGHT: sign-in form */}
      <section className="login-panel">
        <h1 className="login-title">Sign in</h1>
        <p className="login-subtitle">Use the account your school gave you.</p>

        {/* not wired up yet: real login would come w the cloud */}
        <form className="login-form" onSubmit={(e) => e.preventDefault()}>
          <label htmlFor="login-email">School email</label>
          <input
            id="login-email"
            type="email"
            placeholder="name@school.edu.sg"
          />

          <label htmlFor="login-password">Password</label>
          <input id="login-password" type="password" />

          <button type="submit" className="login-primary">
            Sign in
          </button>
        </form>

        <p className="login-note">
          There's no sign-up. Your school creates your account. Forgot your
          password? Ask your teacher.
        </p>

        <div className="login-divider">Prototype: jump in as</div>

        <div className="login-jump">
          <button
            type="button"
            className="login-jump-button"
            onClick={() => onSignIn("student")}
          >
            <strong>Student</strong>
            <span>Aisyah</span>
          </button>

          <button
            type="button"
            className="login-jump-button"
            onClick={() => onSignIn("teacher")}
          >
            <strong>Educator</strong>
            <span>Ms Tan</span>
          </button>

          {showAdmin && (
            <button
              type="button"
              className="login-jump-button"
              onClick={() => onSignIn("teacher", true)}
            >
              <strong>VThere Admin</strong>
              <span>Platform team</span>
            </button>
          )}
        </div>
      </section>
    </main>
  );
}
