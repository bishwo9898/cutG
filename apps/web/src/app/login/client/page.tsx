import { Suspense } from 'react';

import { RoleLoginForm } from '@/components/role-login-form';

export default function ClientLoginPage(): React.ReactElement {
  return (
    <Suspense
      fallback={
        <div className="loading">
          <div className="spinner" />
        </div>
      }
    >
      <RoleLoginForm role="CLIENT" />
    </Suspense>
  );
}
