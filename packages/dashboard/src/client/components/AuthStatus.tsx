import { useState, useEffect } from 'react';
import { fetchStatus } from '../api/client';

interface AuthInfo {
  authenticated: boolean;
  email?: string;
  fullAccess?: boolean;
  error?: string;
}

export function AuthStatus() {
  const [auth, setAuth] = useState<AuthInfo | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchStatus()
      .then(setAuth)
      .catch((err) =>
        setAuth({ authenticated: false, error: err instanceof Error ? err.message : undefined }),
      )
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div>Checking auth...</div>;

  return (
    <div>
      <h2>Auth Status</h2>
      {auth?.authenticated ? (
        <div>
          <span>Authenticated</span>
          {auth.email && <span> as {auth.email}</span>}
          {auth.fullAccess !== undefined && (
            <span> ({auth.fullAccess ? 'full Drive access' : 'files created by justdrive'})</span>
          )}
        </div>
      ) : auth?.error ? (
        <div role="alert">{auth.error}</div>
      ) : (
        <div>
          Not authenticated. Run: <code>justdrive auth login</code>
        </div>
      )}
    </div>
  );
}
