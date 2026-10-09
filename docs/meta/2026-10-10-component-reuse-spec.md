# Merqo component reuse cleanup

## Confirmation and scope

Revalidated against origin/main cd6fc235bbf3572bbc6b51e8bcef3190095fecec on 2026-10-10. All 92 production TSX files were reviewed; card, dropdown-menu and sheet primitives have no production or test imports. Two health badge maps and two three-state trend renderers duplicate the same contracts. Team removal and kit revocation duplicate controlled destructive dialog behavior. Wordmark has nine production callers across several features. ProfileForm owns five independent saves.

## Implementation

Remove the three unused complete generated modules. Reuse admin health badge and three-state trend presentation locally. Share the two destructive confirmation lifecycles, showing rejected transport errors and retaining the open dialog for retry. Move the single wordmark into components/brand and update all callers. Split profile settings into route-local sections with their own state, keeping the current two-column order, labels and persistence boundaries. Correct stale comments and README mappings. Reuse the existing ecosystem node lookup.

## Acceptance

Existing presentation and authorized action arguments remain unchanged. Confirmation dialogs close only after success, remain open for returned failures and rejected promises, and block pending cancellation. Profile sections save independently; stall/social links use their original partial patches, while auth metadata/password use their original client. Avatar returned-save failure rolls back and cleans the unused new object; uncertain thrown outcomes restore the previous UI without destructive cleanup. An independent finished-work review expanded the implementation to catch rejected saves in all five sections and preserve editable values for retry. Tests cover these contracts and preserve signed/flat/null trends. Check, full coverage with all four metrics >=80%, secret scans and production dependency audit must pass before pushing.

## Intentional exclusions

No database, auth, shared UI, Qkit, governance or broad features-folder changes. Preserve route colocation, distinct operational/business cards, current shared adapters and dependency-light global error fallback. DeltaPill has different zero/sign/style semantics and is not substituted. Do not manufacture shared abstractions without concrete consumers. Login decomposition and further admin widget moves can remain separate improvements; neither is needed to preserve this spec's acceptance contracts.
