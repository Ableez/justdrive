import { ActivityLog } from './components/ActivityLog';
import { FileBrowser } from './components/FileBrowser';
import { UploadForm } from './components/UploadForm';
import { AuthStatus } from './components/AuthStatus';

export function App() {
  return (
    <div>
      <h1>juststore dashboard</h1>
      <nav>
        <a href="/">Activity</a> | <a href="/files">Files</a> |{' '}
        <a href="/upload">Upload</a> | <a href="/auth">Auth</a>
      </nav>
      <main>
        <AuthStatus />
        <ActivityLog />
        <FileBrowser />
        <UploadForm />
      </main>
    </div>
  );
}
