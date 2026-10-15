/**
 * @file        LoginPage.tsx
 * @project     Spatial Experience Builder
 * @author      Chloe Lau Rey En
 * @date        2026-10-10
 * @reviewed    2026-10-12
 * @modified    2026-10-12 by Sherman Goh Wee Hao: admin sign-in button, corrected this header
 * @brief       The temporary sign-in page: choose Teacher or Student (or the admin
 *              override) and hand the choice to the app. No real login happens here.
 *
 * @copyright   Copyright (C) 2026 DigiPen Institute of Technology.
 *              Reproduction or disclosure of this file or its contents without the
 *              prior written consent of DigiPen Institute of Technology is prohibited.
 */
/******************************************************************************/

import './LoginPage.css'

type LoginPageProps = {
  onSignIn: (role: 'teacher' | 'student', admin?: boolean) => void
  // offers the admin button; App passes true only while the sign-in is temporary (session.tsx)
  showAdmin?: boolean
}

export default function LoginPage({ onSignIn, showAdmin = false }: LoginPageProps) {
  return (
    <main className="login-page">
      <div className="login-card">
        <h1 className="login-title">VectorSpace</h1>
        <p className="login-subtitle">Sign in to start building your exhibition.</p>

        <button className="login-button" onClick={() => onSignIn('teacher')}>
          Sign in as a Teacher
        </button>
        <button className="login-button login-button-secondary" onClick={() => onSignIn('student')}>Sign in as a Student</button>
        {showAdmin && (
          <button className="login-button login-button-secondary" onClick={() => onSignIn('teacher', true)}>Sign in as an Admin</button>
        )}

        <p className="login-note">Temporary sign-in. Real login will come later.</p>
      </div>
    </main>
  )
}
