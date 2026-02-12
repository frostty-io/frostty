# Contributing

## Pull Requests

- Branch from `main` using short-lived branches.
- Open a PR back to `main`.
- Keep the `pr-ci` required check green before requesting review.
- Expect CI to run lint, unit tests, and build on every PR.

## Conventional Commits (Required for Releases)

Release versions are determined from PR titles or squash commit messages:

- `fix:` triggers a patch release.
- `feat:` triggers a minor release.
- `feat!:` or `BREAKING CHANGE:` triggers a major release.

If a change should ship in the next stable release, use one of the prefixes above.

## Release Model

- Stable releases are managed by release-please and tagged as `vX.Y.Z`.
- Canary prereleases are built from `main`, tagged as `canary-*`, and are prerelease-only.
- Canary builds do not change `package.json` version.
