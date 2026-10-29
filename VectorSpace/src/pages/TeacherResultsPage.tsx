/**
 * @file        TeacherResultsPage.tsx
 * @project     VectorSpace
 * @author      Chloe Lau Rey En
 * @brief       Teacher Results tab: the class's published museums on the left, their visitor
 *              results on the right. Shown inside TeacherLayout. Empty until the API records
 *              visits: the analytics routes (POST/GET /projects/{id}/analytics/events and
 *              /summary) answer 501 and nothing in the app sends events yet.
 *
 *              The earlier mock of this page (class tiles, visits by student, where the class
 *              is at, most clicked, one student's visits per day) is in git history, to build
 *              the real one from once there is data to show.
 *
 * @copyright   Copyright (C) 2026 DigiPen Institute of Technology.
 *              Reproduction or disclosure of this file or its contents without the
 *              prior written consent of DigiPen Institute of Technology is prohibited.
 */
/******************************************************************************/

import "./TeacherResultsPage.css";

export default function TeacherResultsPage() {
  return (
    <main className="results">
      <section className="results-list-panel">
        <h1 className="results-list-title">Results</h1>
        <p className="results-list-sub">Published museums show here, most visited first.</p>
      </section>

      <section className="results-detail-panel">
        <header className="results-detail-header">
          <div className="results-detail-heading">
            <div>
              <h2 className="results-detail-title">No results yet</h2>
              <p className="results-detail-sub">
                They appear once students publish museums and visitors explore them.
              </p>
            </div>
          </div>
        </header>
      </section>
    </main>
  );
}
