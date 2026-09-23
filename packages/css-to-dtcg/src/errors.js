/** Every problem found in one run, reported together. */
export class TokenBuildError extends Error {
  /** @param {string[]} errors */
  constructor(errors) {
    super(`css-to-dtcg found ${errors.length} problem(s):\n${errors.map((error) => `  - ${error}`).join('\n')}`);
    this.name = 'TokenBuildError';
    this.errors = errors;
  }
}
