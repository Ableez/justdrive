export default function PrivacyPage() {
  return (
    <main className="mx-auto max-w-2xl px-4 py-16 text-sm leading-relaxed">
      <h1 className="mb-6 text-2xl font-semibold">Privacy policy</h1>
      <p className="mb-4">Last updated 26 September 2026.</p>

      <h2 className="mb-2 text-base font-medium">What we store</h2>
      <ul className="mb-4 list-disc pl-5">
        <li>Your Google account subject id and email address.</li>
        <li>An encrypted copy of your Google refresh token, used only to mint short-lived Drive access tokens for machines you approve.</li>
        <li>The id of your juststore folder in Drive.</li>
        <li>Device records: a name, hostname, operating system, CLI version, and the last IP address seen.</li>
        <li>An activity history of file operations, reported by the CLI.</li>
      </ul>

      <h2 className="mb-2 text-base font-medium">What we never do</h2>
      <ul className="mb-4 list-disc pl-5">
        <li>We never see, store or proxy your file contents. Files move between your machines and Google Drive directly.</li>
        <li>We never sell or share your data.</li>
      </ul>

      <h2 className="mb-2 text-base font-medium">Deleting your data</h2>
      <p className="mb-4">
        Deleting your account in Settings revokes access at Google and erases everything listed
        above. Files already in your Drive are left untouched, because they belong to your Google
        account.
      </p>

      <h2 className="mb-2 text-base font-medium">Contact</h2>
      <p>Questions go to privacy@astexlabs.com.</p>
    </main>
  );
}
