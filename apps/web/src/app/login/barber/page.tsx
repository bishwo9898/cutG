import { Suspense } from 'react';

import { RoleLoginForm } from '@/components/role-login-form';

export default function BarberLoginPage(): React.ReactElement {
  return (
    <Suspense
      fallback={
        <div className="loading">
          <div className="spinner" />
        </div>
      }
    >
      <RoleLoginForm role="BARBER" />
    </Suspense>
  );
}
