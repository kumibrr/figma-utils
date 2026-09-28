# GitHub settings — step-by-step pickers

Package: `packages/figma-plugin`
Amends: `2026-09-23-figma-plugin-token-export-design.md` (section "GitHub settings")

## Goal

Replace the free-text GitHub settings with a guided flow: token → owner → repository →
base branch → folder. Each step unlocks the next and offers choices read from GitHub,
so nobody has to type `owner/repo` or guess branch names. Typing a base branch that
does not exist creates it.

## Decisions

- **Authentication stays a fine-grained personal access token.** GitHub's OAuth and
  device-flow endpoints (`github.com/login/...`) send no CORS headers, so the plugin
  iframe (origin `null`) cannot complete a sign-in without a server. No server is
  added. `api.github.com` does allow CORS, so all browsing happens in the iframe.
- **The branch picker chooses the base branch** (the PR target). Publishing is
  unchanged: every export still creates `styles/figma-export-<UTC timestamp>` from
  the base and opens a PR into it.
- **Stored settings keep their shape** `{ repository: 'owner/repo', base, folder }`.
  Existing users keep their configuration; `publish.ts` and `storage.ts` do not change.
- The folder stays a text field (default `tokens`).

## Flow

```
┌ GitHub settings ──────────────────────┐
│ Token        [••••••••]  [Continue]   │   or "Token saved · Replace token"
│ Owner        [ acme              ▾ ]  │
│ Repository   [ ui-kit            ▾ ]  │
│ Base branch  [ main                 ] │   input + datalist of branches
│              New branch — will be created from main
│ Folder       [ tokens               ] │
│                        [Back] [Save]  │
└───────────────────────────────────────┘
```

1. **Token.**
   - Nothing saved: password field, the existing help text, and a **Continue**
     button. Continue lists repositories with the entered token. On success the
     token is saved (`saveToken`) and the field becomes "Token saved". On failure the
     error shows under the field and nothing is saved.
   - Saved: "Token saved" and **Replace token**. When the screen opens, repositories
     load with the saved token.
   - Replace token: an empty field with Continue and **Keep the saved token**. While
     replacing, the later steps are disabled. Keep restores the previous lists and
     choices. Continue works like the first-time case and reloads every later step.
   - The help text also says that a fine-grained token belongs to one resource
     owner: to reach an organization's repositories, create the token with that
     organization as the resource owner.
2. **Owner.** A `<select>` of the distinct `owner.login` values across the listed
   repositories, sorted case-insensitively. When there is only one owner it is
   selected automatically. Owners come from the repository list rather than
   `/user/orgs`, because a fine-grained token sees only its own resource owner and
   `/user/orgs` needs extra permissions.
3. **Repository.** A `<select>` of that owner's repositories with
   `permissions.push === true`, sorted by name. Changing the owner clears the
   repository and branch. When the owner has only one pushable repository it is
   selected automatically. If the owner has none: "The token can't push to any
   repository of `<owner>`."
4. **Base branch.** A text input with a `<datalist>` of the repository's branches.
   Choosing a repository loads its branches and pre-fills the input with the
   repository's `default_branch`. When the trimmed input is not in the branch list,
   a hint reads "New branch — will be created from `<default_branch>`."
5. **Folder** and **Save.**

Steps that can't be used yet are disabled, and a spinner shows while a list loads.

**Reopening with saved settings.** Repositories load with the saved token. The saved
`owner/repo` pre-selects the owner and repository, and the saved base fills the branch
input. If the saved repository is not in the list (or is no longer pushable), the
owner is pre-selected when present, the repository is left empty, and the flow says
"`owner/repo` isn't available with this token — pick a repository."

**Save.**
1. `validateSettings` (unchanged) runs on `{ repository: owner/repo, base, folder }`.
2. If the base is not in the branch list, the branch is created from the repository's
   default branch (`createBranch`). A 422 means someone created it in the meantime
   and is treated as success.
3. `saveSettings`, then `checkSettings` (unchanged) as the final check, then return
   to the export view. Errors show inline, as today.

## Modules

### `src/github/browse.ts` (new)

```ts
export type Repo = { owner: string; name: string; fullName: string; defaultBranch: string; canPush: boolean };

export async function listRepos(client: GitHubClient): Promise<Repo[]>;
export function ownersOf(repos: Repo[]): string[];
export function reposOf(repos: Repo[], owner: string): Repo[];   // pushable only, sorted
export async function listBranches(client: GitHubClient, owner: string, repo: string): Promise<string[]>;
export async function createBranch(client: GitHubClient, owner: string, repo: string, name: string, from: string): Promise<void>;
```

- `listRepos`: `GET /user/repos?per_page=100&page=N&sort=full_name`, mapping
  `owner.login`, `name`, `full_name`, `default_branch`, `permissions.push`.
- `listBranches`: `GET /repos/{o}/{r}/branches?per_page=100&page=N`, returning names.
- Paging for both: request pages 1, 2, … and stop at the first page with fewer than
  100 items. `GitHubClient` stays as it is (no `Link` header parsing).
- `createBranch`: `GET /repos/{o}/{r}/git/ref/heads/{from}`, then
  `POST /repos/{o}/{r}/git/refs` with `refs/heads/{name}` and that SHA. Branch names
  in paths go through `encodePath`.

### `src/ui/state.ts` (additions)

Plain functions, tested like the existing ones:

- `isNewBranch(branches: string[], input: string): boolean` — `true` when the trimmed
  input is non-empty and not in `branches`.
- `initialPick(repos: Repo[], saved: RepoSettings | null): { owner: string | null; repo: string | null; missing: string | null }`
  — pre-selection from saved settings and the single-owner and single-repository
  auto-selection. `missing` is the saved `owner/repo` when it isn't available.

### `src/ui/SettingsView.tsx`

Rewritten around the flow above. It keeps using `call('getToken')`, `saveToken`,
`saveSettings`, `checkSettings`, `errorBanner` and the `TokenField` helpers.
When a list fails to load, the error shows under the step that asked for it
(`toError` messages, unchanged).

## Testing

- `test/browse.test.ts` with a fake `GitHubClient`: paging stops on a short page;
  repository mapping; `ownersOf` distinct and sorted; `reposOf` filters to pushable
  and sorts; `listBranches` paging; `createBranch` reads the source ref and posts the
  new ref with an encoded path.
- `test/state.test.ts`: `isNewBranch` (trim, empty, existing) and `initialPick`
  (saved hit, saved missing, one owner, one repository, nothing saved).
- `docs/manual-test.md`: replace the settings checks with the new flow: first-time
  Continue, wrong token, owner and repository auto-selection, picking an existing
  base, creating a new base, reopening with saved settings, and replacing the token.
- `README.md`: update the GitHub section.

## Out of scope

- Signing in with GitHub (OAuth or device flow). It needs a server; revisit if one is
  ever hosted.
- Changing how publishing names branches or opens PRs.
- Searching or filtering in pickers for very large accounts beyond what `<select>`
  and `<datalist>` provide.
