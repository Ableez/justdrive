export class JustStoreError extends Error {
  constructor(
    message: string,
    public code: string,
  ) {
    super(message);
    this.name = 'JustStoreError';
  }
}

export class AuthError extends JustStoreError {
  constructor(message: string) {
    super(message, 'AUTH_ERROR');
    this.name = 'AuthError';
  }
}

export class PathNotFoundError extends JustStoreError {
  constructor(path: string) {
    super(`Path not found: ${path}`, 'PATH_NOT_FOUND');
    this.name = 'PathNotFoundError';
  }
}
