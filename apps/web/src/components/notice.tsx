import { AlertCircle, CheckCircle2 } from 'lucide-react';

export function Notice({
  children,
  tone = 'error',
}: {
  children: React.ReactNode;
  tone?: 'error' | 'success';
}): React.ReactElement {
  return (
    <div className={`notice notice-${tone}`} role={tone === 'error' ? 'alert' : 'status'}>
      {tone === 'error' ? <AlertCircle size={18} /> : <CheckCircle2 size={18} />}
      <span>{children}</span>
    </div>
  );
}
