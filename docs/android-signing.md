# Android Release Signing

Android requires every update APK to be signed with the same private key as the APK already installed on the phone. Without this, Android rejects updates. That is why the release workflow requires signing secrets before it publishes `chessfish-android.apk`.

## Create The Keystore

Run this on a machine with a JDK installed:

```sh
keytool -genkeypair \
  -v \
  -keystore chessfish-release.jks \
  -storetype JKS \
  -keyalg RSA \
  -keysize 4096 \
  -validity 10000 \
  -alias chessfish \
  -dname "CN=Chessfish, OU=Chessfish, O=Chessfish, C=DE"
```

Use a strong password when `keytool` asks. You can use the same password for the keystore and key.

Do not commit `chessfish-release.jks`. The `.gitignore` already excludes `*.jks`.

## Add GitHub Secrets

Encode the keystore:

macOS:

```sh
base64 -i chessfish-release.jks | pbcopy
```

Linux:

```sh
base64 -w0 chessfish-release.jks
```

Then add these repository secrets in GitHub:

- `CHESSFISH_ANDROID_KEYSTORE_BASE64`: the base64 text from the command above
- `CHESSFISH_ANDROID_KEYSTORE_PASSWORD`: the keystore password
- `CHESSFISH_ANDROID_KEY_ALIAS`: `chessfish`
- `CHESSFISH_ANDROID_KEY_PASSWORD`: the key password

After the secrets are set, rerun the Daily app builds workflow. The workflow will publish a stable `chessfish-android.apk` that can be installed and updated later.
