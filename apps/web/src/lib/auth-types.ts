/** Result of a signup/login form submission (safe for client import — no deps). */
export interface AuthState {
  ok: boolean;
  error?: string;
  sent?: boolean;
  email?: string;
  /** In development we surface the magic link so you can click it without email set up. */
  devLink?: string;
}
