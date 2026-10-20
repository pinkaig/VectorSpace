/**
 * @file        StudentHomePage.tsx
 * @project     VectorSpace
 * @author      Chloe Lau Rey En
 * @brief       Student home: greeting, the project assigned by the teacher
 *              (with Start building, which opens the editor), and the
 *              student's other projects. Uses the shared LandingPageTopBar.
 *              Uses fake data until the backend has due dates, tasks and
 *              assignment info.
 *
 * @copyright   Copyright (C) 2026 DigiPen Institute of Technology.
 *              Reproduction or disclosure of this file or its contents without the
 *              prior written consent of DigiPen Institute of Technology is prohibited.
 */
/******************************************************************************/

import { useSession } from "../session/session";
import { useNavigate } from "react-router";
import { ProjectListsSection } from "../sections/home/ProjectListsSection";
import { LandingPageTopBar } from "../ui/LandingPageTopBar";
import { MuseumPreview } from "../ui/museumPreview";
import "./StudentHomePage.css";

// Fake data shaped like the API's Project. The ? fields don't exist in the backend yet.
type StudentProject = {
  id: string;
  name: string;
  statusLabel: "Not started" | "Building" | "Published" | "Draft";
  subline?: string;      // "Published · 34 visits" / "Draft · edited 3 days ago"
  teacherName?: string;  // missing in backend
  due?: string;          // missing in backend
  task?: string;         // missing in backend
  templateName?: string;
};

const assigned: StudentProject = {
  id: "fake-1",
  name: "Dinosaur museum",
  statusLabel: "Not started",
  teacherName: "Ms Tan",
  due: "Due Friday",
  task: "Build a virtual exhibition about dinosaurs. Add at least 3 exhibits with facts, and one thing that reacts when visitors click.",
  templateName: "the museum template",
};

const otherProjects: StudentProject[] = [
  { id: "fake-2", name: "Ancient Egypt tour", statusLabel: "Published", subline: "Published · 34 visits" },
  { id: "fake-3", name: "Space station", statusLabel: "Draft", subline: "Draft · edited 3 days ago" },
];

export default function StudentHomePage() {
  const { signOut } = useSession();
  const navigate = useNavigate();

  return (
    <div className="student-home">
      <LandingPageTopBar
        userName="Aisyah"
        userSubline="Sec 2B · Student"
        onSignOut={signOut}
      />
      <main className="student-home-content">
        <h1 className='student-home-greeting'>Hi Aisyah</h1>
        <p className='student-home-lead'>You have one project waiting for you.</p>

        {assigned.teacherName && (
          <h2 className='student-home-label'>From {assigned.teacherName}</h2>
        )}

        <article className='student-home-assigned'>
          <div className='student-home-assigned-image'>
            <MuseumPreview title={assigned.name} />
          </div>

          <div className='student-home-assigned-info'>
            <div className='student-home-chips'>
              {assigned.due && <span className='student-home-chip'>{assigned.due}</span>}
              <span className="student-home-chip grey">{assigned.statusLabel}</span>
            </div>
            <h3 className="student-home-assigned-title">{assigned.name}</h3>
            {assigned.task && <p className="student-home-task">{assigned.task}</p>}
            {assigned.templateName && (
              <p className="student-home-template">
                Starts from {assigned.templateName} · 2 rooms ready for you
              </p>
            )}
            <button type="button" className='student-home-start'>Start building</button>
          </div>
        </article>
      </main>
    </div>
  );
}
