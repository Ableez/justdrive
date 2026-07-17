import { useState, useEffect } from 'react';
import { fetchStatus } from '../api/client';

interface AuthInfo {
  authenticated: boolean;
  email?: string;
  expiresAt?: string | null;
}

export function AuthStatus() {
  const [auth, setAuth] = useState<AuthInfo | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchStatus()
      .then(setAuth)
      .catch(() => setAuth({ authenticated: false }))
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
          {auth.expiresAt && (
            <span> (expires: {new Date(auth.expiresAt).toLocaleString()})</span>
          )}
        </div>
      ) : (
        <div>
          Not authenticated. Run: <code>juststore auth login</code>
        </div>
      )}
    </div>
  );
}
