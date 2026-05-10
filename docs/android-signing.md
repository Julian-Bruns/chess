# Android Release Signing

Android requires every update APK to be signed with the same private key as the APK already installed on the phone. Without this, Android rejects updates. That is why the release workflow requires signing secrets before it publishes `chessfish-android.apk`.

## Create The Keystore

Run this on a machine with OpenSSL installed:

```sh
mkdir -p ~/.chessfish-signing
chmod 700 ~/.chessfish-signing

openssl req \
  -x509 \
  -newkey rsa:4096 \
  -sha256 \
  -days 10000 \
  -nodes \
  -keyout ~/.chessfish-signing/chessfish-release.key \
  -out ~/.chessfish-signing/chessfish-release.crt \
  -subj "/CN=Chessfish/OU=Chessfish/O=Chessfish/C=DE"

openssl pkcs12 \
  -export \
  -name chessfish \
  -inkey ~/.chessfish-signing/chessfish-release.key \
  -in ~/.chessfish-signing/chessfish-release.crt \
  -out ~/.chessfish-signing/chessfish-release.p12
```

Use a strong export password. The workflow uses the same value for the keystore password and key password.

Do not commit the signing files. The `.gitignore` already excludes `*.p12`, `*.pem`, `*.key`, `*.jks`, and `*.keystore`.

## Add GitHub Secrets

Encode the keystore:

macOS:

```sh
base64 -i ~/.chessfish-signing/chessfish-release.p12 | pbcopy
```

Linux:

```sh
base64 -w0 ~/.chessfish-signing/chessfish-release.p12
```

Then add these repository secrets in GitHub:

- `CHESSFISH_ANDROID_KEYSTORE_BASE64`: the base64 text from the command above
- `CHESSFISH_ANDROID_KEYSTORE_PASSWORD`: the export password
- `CHESSFISH_ANDROID_KEY_ALIAS`: `chessfish`
- `CHESSFISH_ANDROID_KEY_PASSWORD`: the export password

After the secrets are set, rerun the Daily app builds workflow. The workflow will publish a stable `chessfish-android.apk` that can be installed and updated later.
