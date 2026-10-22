import chalk from 'chalk';

export function title(text: string): void {
  console.log();
  console.log(chalk.bold(text));
  console.log();
}

export function note(text: string): void {
  console.log(chalk.dim(text));
  console.log();
}

export function line(text = ''): void {
  console.log(text);
}