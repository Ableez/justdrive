import { useState, useEffect } from 'react';
import type { DriveFile } from '@juststore/shared';
import { fetchFiles, deleteFile } from '../api/client';

export function FileBrowser() {
  const [files, setFiles] = useState<DriveFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentPath, setCurrentPath] = useState('');

  async function loadFiles(path: string) {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchFiles(path);
      setFiles(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadFiles(currentPath);
  }, [currentPath]);

  async function handleDelete(file: DriveFile) {
    if (!confirm(`Move "${file.name}" to the Drive trash?`)) return;
    try {
      const filePath = currentPath ? `${currentPath}/${file.name}` : file.name;
      await deleteFile(filePath);
      loadFiles(currentPath);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Delete failed');
    }
  }

  function handleNavigate(folderName: string) {
    setCurrentPath(currentPath ? `${currentPath}/${folderName}` : folderName);
  }

  function handleBack() {
    const parts = currentPath.split('/');
    parts.pop();
    setCurrentPath(parts.join('/'));
  }

  if (loading) return <div>Loading files...</div>;
  if (error) return <div role="alert">Error: {error}</div>;

  return (
    <div>
      <h2>Files {currentPath && `/ ${currentPath}`}</h2>
      {currentPath && (
        <button onClick={handleBack}>Back</button>
      )}
      {files.length === 0 ? (
        <div>No files found.</div>
      ) : (
        <table>
          <thead>
            <tr>
              <th>Name</th>
              <th>Type</th>
              <th>Size</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {files.map((file) => (
              <tr key={file.id}>
                <td>
                  {file.mimeType === 'application/vnd.google-apps.folder' ? (
                    <button onClick={() => handleNavigate(file.name)}>
                      {file.name}
                    </button>
                  ) : (
                    file.name
                  )}
                </td>
                <td>{file.mimeType === 'application/vnd.google-apps.folder' ? 'folder' : file.mimeType.split('/').pop()}</td>
                <td>{file.size ?? '-'}</td>
                <td>
                  <button onClick={() => handleDelete(file)}>Delete</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
