/**
 * @file        colors.ts
 * @project     Spatial Experience Builder
 * @author      Chloe Lau Rey En
 * @brief       per axis color constants for the gizmo.
 *              Base colors match the app's object palette,
 *              and the hover colors are lighter versions
 *              shown when the cursor is over an arrow
 *
 * @copyright   Copyright (C) 2026 DigiPen Institute of Technology.
 *              Reproduction or disclosure of this file or its contents without the
 *              prior written consent of DigiPen Institute of Technology is prohibited.
 */
/******************************************************************************/

import './loginPage.css'

type LoginPageProps = {
  onSignIn: (role: 'teacher' | 'student') => void
}

export default function LoginPage({ onSignIn }: LoginPageProps) {
  return (
    <main className="login-page">
      <div className="login-card">
        <h1 className="login-title">VectorSpace</h1>
        <p className="login-subtitle">Sign in to start building your exhibition.</p>

        <button className="login-button" onClick={() => onSignIn('teacher')}>
          Sign in as a Teacher
        </button>
        <button className="login-button login-button secondary" onClick={() => onSignIn('student')}>Sign in as a Student</button>
      
        <p className="login-note">Temporary sign-in. Real login will come later.</p>
      </div>
    </main>
  )
}
