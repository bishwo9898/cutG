import { Scissors } from 'lucide-react';

export function AuthShell({ children }: { children: React.ReactNode }): React.ReactElement {
  return (
    <main className="auth-page">
      <section className="auth-brand">
        <div className="brand-lockup">
          <span className="brand-mark">
            <Scissors size={19} />
          </span>
          cutG
        </div>
        <div className="auth-quote">
          <h2>More time behind the chair. Less time behind a screen.</h2>
          <p>
            Keep your services, schedule, clients, and daily appointments in one calm place built
            for independent barbers.
          </p>
        </div>
        <small>Built for the craft.</small>
      </section>
      <section className="auth-panel">{children}</section>
    </main>
  );
}
