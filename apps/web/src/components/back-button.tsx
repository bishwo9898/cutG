'use client';

import { ArrowLeft } from 'lucide-react';
import { useRouter } from 'next/navigation';

export function BackButton({
  fallbackHref,
  label = 'Go back',
}: {
  fallbackHref: string;
  label?: string;
}): React.ReactElement {
  const router = useRouter();

  return (
    <button
      className="go-back-button"
      onClick={() => {
        if (window.history.length > 1) {
          router.back();
          return;
        }
        router.push(fallbackHref);
      }}
      type="button"
    >
      <ArrowLeft size={16} />
      {label}
    </button>
  );
}
