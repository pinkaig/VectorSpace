/// <reference types="vite/client" />

/**
 * Every build-time variable the browser app reads. Declaring them here means a typo in
 * import.meta.env is a compile error rather than a silent undefined.
 */
interface ImportMetaEnv {
  /** The API's address. Unset means the app runs offline with the prototype role picker. */
  readonly VITE_API_URL?: string
  /** Offers the admin override button in a production build (picker mode only). */
  readonly VITE_ADMIN_OVERRIDE?: string
  /** Auth0 tenant domain, e.g. vectorspace.eu.auth0.com. All three or none; see session/auth0.ts. */
  readonly VITE_AUTH0_DOMAIN?: string
  /** Client ID of the Auth0 Single Page Application. */
  readonly VITE_AUTH0_CLIENT_ID?: string
  /** The Auth0 API identifier the token is requested for; must equal the API's AUTH0_AUDIENCE. */
  readonly VITE_AUTH0_AUDIENCE?: string
}
