import { BriefcaseBusiness, Search } from 'lucide-react';
import Link from 'next/link';

import { AuthShell } from '@/components/auth-shell';

export default function LoginPage(): React.ReactElement {
  return (
    <AuthShell>
      <div className="auth-form auth-role-page">
        <span className="eyebrow">Choose your account</span>
        <h1>How are you using cutG?</h1>
        <p className="subtitle">Each side has its own focused workspace and sign-in flow.</p>
        <div className="auth-role-grid">
          <Link className="auth-role-card" href="/login/client">
            <span className="auth-role-card-icon">
              <Search size={22} />
            </span>
            <strong>I'm a client</strong>
            <span>Book and manage appointments</span>
          </Link>
          <Link className="auth-role-card" href="/login/barber">
            <span className="auth-role-card-icon">
              <BriefcaseBusiness size={22} />
            </span>
            <strong>I'm a barber</strong>
            <span>Run services and your schedule</span>
          </Link>
        </div>
        <p className="auth-footer">
          New to cutG?{' '}
          <Link className="text-link" href="/register">
            Create an account
          </Link>
        </p>
      </div>
    </AuthShell>
  );
}
