# macOS signing and notarization

macOS adds the `com.apple.quarantine` attribute to apps downloaded from the internet. That is expected. The release fix is to publish only a Developer ID signed, notarized, and stapled DMG so Gatekeeper accepts the quarantined download without users running `xattr` or opening the app from Terminal.

The `Daily app builds` workflow requires these repository secrets before it will publish `chessfish-macos.dmg`:

| Secret | Value |
| --- | --- |
| `CSC_LINK` | Base64-encoded `.p12` export of the Developer ID Application certificate and private key |
| `CSC_KEY_PASSWORD` | Password used when exporting the `.p12` certificate |
| `APPLE_ID` | Apple Developer account email used for notarization |
| `APPLE_APP_SPECIFIC_PASSWORD` | App-specific password for that Apple ID, not the Apple ID login password |
| `APPLE_TEAM_ID` | Apple Developer Team ID |

## Export the Developer ID certificate

Install a `Developer ID Application` certificate in the macOS login keychain and confirm it is available:

```sh
security find-identity -v -p codesigning | grep "Developer ID Application"
```

Use Keychain Access to export only that Developer ID Application certificate and its private key as `chessfish-developer-id.p12`. Choose a strong export password; this becomes `CSC_KEY_PASSWORD`.

Encode the `.p12` for GitHub Actions:

```sh
base64 -i chessfish-developer-id.p12 | tr -d '\n' | pbcopy
```

Set the GitHub secrets:

```sh
gh secret set CSC_LINK --body "$(base64 -i chessfish-developer-id.p12 | tr -d '\n')"
gh secret set CSC_KEY_PASSWORD --body "<p12-password>"
gh secret set APPLE_ID --body "<apple-developer-email>"
gh secret set APPLE_APP_SPECIFIC_PASSWORD --body "<app-specific-password>"
gh secret set APPLE_TEAM_ID --body "<team-id>"
```

After the secrets are set, rerun the `Daily app builds` workflow. The macOS job signs with `forceCodeSigning=true`, notarizes through Apple, validates stapling for both the app and DMG, and runs Gatekeeper checks before the release asset is uploaded.
