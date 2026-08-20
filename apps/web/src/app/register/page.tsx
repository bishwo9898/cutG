import { BriefcaseBusiness, Search } from 'lucide-react';
import Link from 'next/link';

import { AuthShell } from '@/components/auth-shell';

export default function RegisterPage(): React.ReactElement {
  return (
    <AuthShell>
      <div className="auth-form auth-role-page">
        <span className="eyebrow">Create your account</span>
        <h1>Choose your cutG experience</h1>
        <p className="subtitle">Your role determines the tools and navigation you receive.</p>
        <div className="auth-role-grid">
          <Link className="auth-role-card" href="/client/register">
            <span className="auth-role-card-icon">
              <Search size={22} />
            </span>
            <strong>Customer account</strong>
            <span>Discover, save, and book barbers</span>
          </Link>
          <Link className="auth-role-card" href="/barber/register">
            <span className="auth-role-card-icon">
              <BriefcaseBusiness size={22} />
            </span>
            <strong>Barber account</strong>
            <span>Manage your business and customers</span>
          </Link>
        </div>
        <p className="auth-footer">
          Already registered?{' '}
          <Link className="text-link" href="/login">
            Sign in
          </Link>
        </p>
      </div>
    </AuthShell>
  );
}
