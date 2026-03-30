import Link from "next/link";
import { loginAction } from "@/app/admin/actions";
import { isDemoMode } from "@/core/env";

export default async function AdminLoginPage({ searchParams }) {
  const params = await searchParams;
  const error = String(params?.error || "").trim();
  const demo = isDemoMode();

  return (
    <main className="login-shell">
      <section className="login-card">
        <span className="eyebrow">Admin Access</span>
        <h1>Open Brooke's distribution control center.</h1>
        <p>
          Use Supabase Auth credentials for operators. If Supabase is not configured yet, the dashboard falls back to a read-only demo state so the workflow can still be reviewed.
        </p>
        {error ? <div className="inline-alert inline-alert--error">{error}</div> : null}
        {demo ? <div className="inline-alert">Demo mode is active because Supabase env vars are missing.</div> : null}
        <form action={loginAction} className="stack-form">
          <label>
            <span>Email</span>
            <input name="email" type="email" placeholder="operator@brooke.test" required={!demo} />
          </label>
          <label>
            <span>Password</span>
            <input name="password" type="password" placeholder="Supabase password" required={!demo} />
          </label>
          <button type="submit" className="primary-button">Enter dashboard</button>
        </form>
        <Link href="/" className="ghost-link">Back to architecture</Link>
      </section>
    </main>
  );
}

