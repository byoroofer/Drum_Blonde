import Link from "next/link";
import { loginAction } from "@/app/admin/actions";
import { isAdminAuthenticated } from "@/lib/admin-auth";
import { hasAdminCredentials } from "@/lib/env";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

function normalizeAdminNext(value) {
  const next = String(value || "").trim();
  return next.startsWith("/admin") ? next : "/admin";
}

export default async function AdminLoginPage({ searchParams }) {
  const params = await searchParams;
  const error = params?.error || "";
  const next = normalizeAdminNext(params?.next);
  const configured = hasAdminCredentials();

  if (configured && (await isAdminAuthenticated())) {
    redirect(next);
  }

  return (
    <main className="admin-shell admin-shell--login">
      <section className="admin-login-card">
        <p className="admin-kicker">Drum Blonde Admin</p>
        <h1>Manage homepage media and featured content.</h1>
        <p>
          Use the admin dashboard to upload media, feature clips on the homepage,
          and manage the ranking signals that feed the landing page.
        </p>

        {!configured ? (
          <div className="admin-alert">
            <strong>Admin credentials are not configured yet.</strong>
            <p>
              Add `ADMIN_USERNAME`, `ADMIN_PASSWORD`, and `ADMIN_SESSION_SECRET`
              to your environment before using the dashboard.
            </p>
          </div>
        ) : null}

        {error === "invalid" ? (
          <p className="admin-error">The username or password was not correct.</p>
        ) : null}

        {error === "setup" ? (
          <p className="admin-error">Admin credentials are missing from the environment.</p>
        ) : null}

        {error === "locked" ? (
          <p className="admin-error">Too many sign-in attempts. Wait a few minutes and try again.</p>
        ) : null}

        <form action={loginAction} className="admin-form-stack">
          <input type="hidden" name="next" value={next} />

          <label className="admin-field">
            <span>Username</span>
            <input name="username" autoComplete="username" />
          </label>

          <label className="admin-field">
            <span>Password</span>
            <input name="password" type="password" autoComplete="current-password" />
          </label>

          <button type="submit" disabled={!configured}>Sign in</button>
        </form>

        <Link href="/">Return to site</Link>
      </section>
    </main>
  );
}
