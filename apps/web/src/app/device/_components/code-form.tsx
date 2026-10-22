'use client';

import { useState } from 'react';

export function CodeForm() {
  const [code, setCode] = useState('');

  return (
    <form action="/device" className="text-sm">
      <label className="block">
        <span className="mb-1 block text-muted-foreground">Code from justdrive login</span>
        <input
          name="user_code"
          value={code}
          onChange={(event) => setCode(event.target.value.toUpperCase())}
          placeholder="ABCD-2345"
          maxLength={9}
          required
          className="w-40 rounded-md border border-input bg-background px-2.5 py-1.5 font-mono uppercase focus:outline-none focus:ring-2 focus:ring-ring"
        />
      </label>
      <button
        type="submit"
        className="mt-4 rounded-md bg-foreground px-4 py-2 font-medium text-background"
      >
        Continue
      </button>
    </form>
  );
}
