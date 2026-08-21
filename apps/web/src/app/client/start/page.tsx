import { ArrowRight, LogIn, Search } from 'lucide-react';
import Link from 'next/link';

import { AuthShell } from '@/components/auth-shell';

export default function CustomerStartPage(): React.ReactElement {
  const next = encodeURIComponent('/client/barbers');
  return (
    <AuthShell audience="CLIENT">
      <div className="auth-form customer-entry-card">
        <span className="auth-role-icon" aria-hidden="true">
          <Search size={20} />
        </span>
        <span className="eyebrow">Find your barber</span>
        <h1>Start with your location.</h1>
        <p className="subtitle">
          Create an account to save your search, book securely, and keep every appointment together.
        </p>
        <Link className="button button-primary button-full" href={`/client/register?next=${next}`}>
          Create account <ArrowRight size={17} />
        </Link>
        <Link className="button button-secondary button-full" href={`/client/login?next=${next}`}>
          <LogIn size={17} /> Sign in
        </Link>
        <p className="auth-footer">Your precise search location is used only to find nearby barbers.</p>
      </div>
    </AuthShell>
  );
}
