import { compile } from 'tailwindcss';
import { readFile } from 'node:fs/promises';
import { dirname, resolve, join } from 'node:path';

const TW_DIR = resolve(process.cwd(), 'node_modules/tailwindcss');

async function loadStylesheet(id, base) {
  const path = id.startsWith('.')
    ? resolve(base, id)
    : join(TW_DIR, id.replace(/^tailwindcss\/?/, ''));
  return {
    base: dirname(path),
    content: await readFile(path, 'utf8'),
  };
}

async function run(name, css) {
  try {
    const compiler = await compile(css, {
      base: process.cwd(),
      loadStylesheet,
      loadModule: async () => { throw new Error('no modules'); },
    });
    const out = compiler.build(['dark:bg-black']);
    console.log('===', name, '===');
    console.log(out.replace(/\/\*!.*?\*\/\s*/s, '').trim() || '(empty)');
  } catch (e) {
    console.log('===', name, '=== ERROR');
    console.log(e.message);
  }
}

const base = `@import "tailwindcss/index.css";`;

await run('class only', `${base}
@custom-variant dark (&:where(.dark, .dark *));
`);

await run('nested at-rule', `${base}
@custom-variant dark {
  &:where(.dark, .dark *) {
    @slot;
  }
  @media (prefers-color-scheme: dark) {
    @slot;
  }
}
`);

await run('media inside custom-variant', `${base}
@custom-variant dark {
  @media (prefers-color-scheme: dark) {
    &:where(.dark, .dark *) {
      @slot;
    }
  }
}
`);
