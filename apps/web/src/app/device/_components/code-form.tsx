'use client';

import { useState } from 'react';

export function CodeForm() {
  const [code, setCode] = useState('');

  return (
    <form action="/device" className="text-sm">
      <label className="block">
        <span className="mb-1 block text-zinc-500">Code shown by justdrive login</span>
        <input
          name="user_code"
          value={code}
          onChange={(event) => setCode(event.target.value.toUpperCase())}
          placeholder="ABCD-2345"
          maxLength={9}
          required
          className="w-40 rounded-md border border-zinc-300 px-2 py-1 font-mono uppercase dark:border-zinc-700 dark:bg-zinc-900"
        />
      </label>
      <button
        type="submit"
        className="mt-4 rounded-md bg-zinc-900 px-4 py-2 font-medium text-white dark:bg-zinc-100 dark:text-zinc-900"
      >
        Continue
      </button>
    </form>
  );
}
