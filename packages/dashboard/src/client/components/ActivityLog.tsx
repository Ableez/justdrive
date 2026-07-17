import { useState, useEffect } from 'react';
import type { ActivityLogEntry } from '@juststore/shared';
import { fetchActivity } from '../api/client';

export function ActivityLog() {
  const [entries, setEntries] = useState<ActivityLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchActivity()
      .then(setEntries)
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load'))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div>Loading activity...</div>;
  if (error) return <div role="alert">Error: {error}</div>;
  if (entries.length === 0) return <div>No activity yet.</div>;

  return (
    <div>
      <h2>Activity Log</h2>
      <ul>
        {entries.map((entry, i) => (
          <li key={i}>
            [{entry.timestamp}] {entry.operation} - {entry.path} - {entry.status}
            {entry.detail && ` (${entry.detail})`}
          </li>
        ))}
      </ul>
    </div>
  );
}
