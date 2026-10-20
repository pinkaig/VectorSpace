/**
 * @file        StudentHomePage.tsx
 * @project     VectorSpace
 * @author      Chloe Lau Rey En
 * @brief       Student home: greeting, the project assigned by the teacher
 *              (with Start building, which opens the editor), and the
 *              student's other projects. Uses the shared AppTopBar.
 *
 * @copyright   Copyright (C) 2026 DigiPen Institute of Technology.
 *              Reproduction or disclosure of this file or its contents without the
 *              prior written consent of DigiPen Institute of Technology is prohibited.
 */
/******************************************************************************/

import { useSession } from "../session/session";
import { ProjectListsSection } from "../sections/home/ProjectListsSection";
import { LandingPageTopBar } from "../ui/LandingPageTopbar";
import "./StudentHomePage.css";

export default function StudentHomePage() {
  const { signOut } = useSession();

  return (
    <div className="student-home">
      <LandingPageTopBar
        userName="Aisyah"
        userSubline="Sec 2B · Student"
        onSignOut={signOut}
      />
      <main className="student-name-content">
        <section>
          <ProjectListsSection />
        </section>
      </main>
    </div>
  );
}
