/**
 * @file        TeacherHomePage.tsx
 * @project     VectorSpace
 * @author      Chloe Lau Rey En
 * @brief       Teacher home: greeting, the teacher's classes and their
 *              projects (with Set up project and Review), published projects,
 *              and starting a new project from the museum template. Uses the
 *              shared LandingPageTopBar.
 *
 * @copyright   Copyright (C) 2026 DigiPen Institute of Technology.
 *              Reproduction or disclosure of this file or its contents without the
 *              prior written consent of DigiPen Institute of Technology is prohibited.
 */
/******************************************************************************/

import { useSession } from "../session/session";
import { ProjectListsSection } from "../sections/home/ProjectListsSection";
import { LandingPageTopBar } from "../ui/LandingPageTopBar";
// import "./TeacherHomePage.css";

function greetingForTime(): string {
  const hour = new Date().getHours();
  if (hour >= 5 && hour < 12) return "Good morning";
  if (hour >= 12 && hour < 17) return "Good afternoon";
  return "Good evening";
}

export default function TeacherHomePage() {
  const { signOut } = useSession();
  return (
    <div className="teacher-home">
      <LandingPageTopBar
        roleBadge="teacher"
        tabs={
          <>
            <button type="button" className="landing-top-bar-tab active">
              Classes
            </button>
            <button type="button" className="landing-top-bar-tab">
              Review (6)
            </button>
            <button type="button" className="landing-top-bar-tab">
              Results
            </button>
          </>
        }
        userName="Ms Tan"
        userSubline="Riverside Secondary"
        onSignOut={signOut}
      />

      <main className='teacher-name-content'>
        <h1 className='teacher-home-greeting'>{greetingForTime()}, Ms Tan</h1>
        
        {/* temporary: keeps the template link and Sherman's project lists until the real UI replaces them */}
        {/* <Link to="/teacher/template">Create/edit template</Link> */}
        <ProjectListsSection />
      </main>
    </div>
  );
}
