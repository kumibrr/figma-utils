export class GitHubError extends Error {
  constructor(
    message: string,
    readonly status: number | null,
  ) {
    super(message);
    this.name = 'GitHubError';
  }
}

export type GitHubClient = { request<T>(method: string, path: string, body?: unknown): Promise<T> };

export const encodePath = (value: string) => value.split('/').map(encodeURIComponent).join('/');

const hhmm = (date: Date) => `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;

/** Plain-language errors. None of them suggests replacing the token. */
export async function toError(response: Response): Promise<GitHubError> {
  const body = (await response.json().catch(() => ({}))) as { message?: string };
  const { status } = response;

  const rateLimited = status === 429 || (status === 403 && response.headers.get('x-ratelimit-remaining') === '0');
  if (rateLimited) {
    const reset = Number(response.headers.get('x-ratelimit-reset'));
    const when = Number.isFinite(reset) && reset > 0 ? `at ${hhmm(new Date(reset * 1000))}` : 'later';
    return new GitHubError(`GitHub rate limit reached; try again ${when}.`, status);
  }

  switch (status) {
    case 401:
      return new GitHubError('GitHub rejected the token.', status);
    case 403:
      return new GitHubError('The token has no permission for this repository.', status);
    case 404:
      return new GitHubError('Repository or branch not found.', status);
    case 409:
      return new GitHubError('The repository is empty.', status);
    default:
      return new GitHubError(`GitHub error ${status}: ${body.message ?? response.statusText}`, status);
  }
}

export function createClient(token: string, fetchImpl: typeof fetch = fetch): GitHubClient {
  return {
    async request<T>(method: string, path: string, body?: unknown): Promise<T> {
      let response: Response;
      try {
        response = await fetchImpl(`https://api.github.com${path}`, {
          method,
          headers: {
            Accept: 'application/vnd.github+json',
            Authorization: `Bearer ${token}`,
            'X-GitHub-Api-Version': '2022-11-28',
            ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
          },
          body: body === undefined ? undefined : JSON.stringify(body),
        });
      } catch {
        throw new GitHubError("Couldn't reach GitHub.", null);
      }

      if (!response.ok) {
        throw await toError(response);
      }
      return (response.status === 204 ? undefined : await response.json()) as T;
    },
  };
}
