# Release versioning policy

Guild Operations uses [Semantic Versioning 2.0.0](https://semver.org/) with a documented convention for the pre-1.0 development series.

Version tags use `vMAJOR.MINOR.PATCH` (for example, `v0.1.2`). The `v` prefix is part of the Git tag and container image tag, not the SemVer version itself.

## Version increments

- **MAJOR**: a new compatibility generation. Starting at 1.0.0, increment for incompatible changes to the supported public contract.
- **MINOR**: new product functionality or meaningful capabilities. In the 0.x series, a minor release may also change compatibility; document migration and compatibility implications.
- **PATCH**: fixes, security corrections, and reliability or maintenance improvements to the existing minor release's capabilities. Do not introduce new product features or intentionally break supported compatibility in a patch.

Refactoring, performance work, and internal changes can ship in a patch when they preserve the existing capabilities and supported contract. A fix can change incorrect behavior without counting as a new feature.

## Pre-1.0 policy

SemVer allows the public API to change during 0.x initial development. Guild Operations voluntarily uses the stricter feature/minor and fix/patch distinction above, but **does not promise full compatibility stability before 1.0.0**. Describe any compatibility or migration impact in release notes, even when the version number alone does not communicate it.

The supported contract for a self-hosted release can include deployment configuration, persisted data and migrations, externally consumed APIs, and integrations, as these become defined and supported.

## Release series

- `v0.0.1` and `v0.0.2` are historical release-pipeline rehearsals, not a supported product release line.
- `v0.1.0` is the intended first coherent, independently deployable product baseline.
- `v0.1.x` is reserved for correcting and stabilizing the `0.1` capabilities, not adding features.
- `v0.2.0` and subsequent minor versions are for new functionality or product milestones.
- `v1.0.0` will require an explicitly declared compatibility contract; its timing is not determined solely by feature count.

## GitHub releases and container tags

GitHub's **pre-release** checkbox is independent of SemVer pre-release identifiers (such as `-rc.1`). The historical `v0.0.x` rehearsals were marked GitHub pre-releases. Starting with `v0.1.0`, publish normal GitHub releases unless a release is explicitly designated a candidate or preview.

Do not move or reuse a published version tag. Correct a published release with a new version. Versioned container tags should identify the corresponding release source; `latest` is a distribution alias and must not be used as a substitute for a pinned version during controlled validation.

## Release rehearsal

Before the first `v0.1.0` release, a disposable tag such as `v0.1.0-rehearsal.1` may exercise the version-tag publication workflow. Rehearsal tags publish their own GHCR tag and a commit-SHA tag, **not** `latest`; they are not official Guild Operations releases. Do not create a GitHub Release for a rehearsal tag.

Rehearsal procedure:

1. Merge and verify the publication-safety change before tagging. Select the exact `main` commit to rehearse and create the rehearsal tag at that commit.
2. Confirm the tag-triggered **Publish Guild Operations Image** workflow succeeds. Verify the rehearsal image and SHA image exist in GHCR and `latest` has not changed.
3. In an isolated Compose project with fresh named volumes, pin `GUILD_OPERATIONS_VERSION=v0.1.0-rehearsal.1` and follow the README's first-run setup. Do not reuse production or development volumes or credentials.
4. Verify installation completion, container replacement with the same volumes, and a recoverable backup/restore of **both** database and installation-key volumes. Record the actual observed outcomes against issue #128; CI alone cannot prove these runtime steps.
5. Delete the disposable Git tag and, if desired, the rehearsal package version after validation. Deleting the tag does not automatically remove the GHCR image.

A passing rehearsal does not replace verification of the actual `v0.1.0` tag, GHCR `v0.1.0`/`latest`/SHA image publication, and a fresh deployment of the official artifact. Never reuse or move a published version tag.
