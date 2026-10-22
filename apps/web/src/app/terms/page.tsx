export default function TermsPage() {
  return (
    <main className="mx-auto max-w-2xl px-4 py-16 text-sm leading-relaxed">
      <h1 className="mb-6 text-2xl font-semibold">Terms of service</h1>
      <p className="mb-4">Last updated 26 September 2026.</p>

      <h2 className="mb-2 text-base font-medium">The service</h2>
      <p className="mb-4">
        justdrive coordinates machines you approve so they can move files in and out of the justdrive
        folder in your own Google Drive. We act as a broker: we never handle file contents.
      </p>

      <h2 className="mb-2 text-base font-medium">Your responsibilities</h2>
      <ul className="mb-4 list-disc pl-5">
        <li>You keep control of the Google account granting access, and can revoke it at any time.</li>
        <li>You are responsible for what the approved machines do with your Drive.</li>
        <li>Do not use justdrive to store or distribute content you do not have the right to.</li>
      </ul>

      <h2 className="mb-2 text-base font-medium">Availability</h2>
      <p className="mb-4">
        The service is provided as is, without warranty. We may change or discontinue it. Files stay
        in your Drive, so removing justdrive never puts your data at risk.
      </p>

      <h2 className="mb-2 text-base font-medium">Contact</h2>
      <p>Questions go to support@astexlabs.com.</p>
    </main>
  );
}
