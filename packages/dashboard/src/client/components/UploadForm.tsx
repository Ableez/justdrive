import { useState, type FormEvent, useRef } from 'react';
import { uploadFile } from '../api/client';

export function UploadForm() {
  const [status, setStatus] = useState<'idle' | 'uploading' | 'success' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const file = fileInputRef.current?.files?.[0];

    if (!file || file.size === 0) {
      setStatus('error');
      setErrorMessage('Please select a file');
      return;
    }

    setStatus('uploading');
    setErrorMessage(null);

    try {
      await uploadFile(file);
      setStatus('success');
      if (fileInputRef.current) fileInputRef.current.value = '';
    } catch (err) {
      setStatus('error');
      setErrorMessage(err instanceof Error ? err.message : 'Upload failed');
    }
  }

  return (
    <div>
      <h2>Upload</h2>
      <form onSubmit={handleSubmit}>
        <input ref={fileInputRef} type="file" name="file" />
        <button type="submit" disabled={status === 'uploading'}>
          {status === 'uploading' ? 'Uploading...' : 'Upload'}
        </button>
      </form>
      {status === 'success' && <div>Upload complete!</div>}
      {status === 'error' && <div role="alert">Error: {errorMessage}</div>}
    </div>
  );
}
