import { AlertTriangle, Inbox } from 'lucide-react';

import { Notice } from './notice';

export function LoadingState(): React.ReactElement {
  return (
    <div className="loading" role="status">
      <div className="spinner" aria-label="Loading" />
    </div>
  );
}

export function EmptyState({
  title,
  detail,
  action,
}: {
  title: string;
  detail: string;
  action?: React.ReactNode;
}): React.ReactElement {
  return (
    <div className="empty-state">
      <div>
        <Inbox size={27} />
        <strong>{title}</strong>
        <span>{detail}</span>
        {action !== undefined && <div style={{ marginTop: 16 }}>{action}</div>}
      </div>
    </div>
  );
}

export function ErrorState({ message }: { message: string }): React.ReactElement {
  return (
    <div className="panel-body">
      <Notice>
        <AlertTriangle size={0} />
        {message}
      </Notice>
    </div>
  );
}
