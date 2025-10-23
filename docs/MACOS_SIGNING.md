# macOS Signing and Notarization Guide

## Building Without Apple Developer Credentials

You can build the Fluxscape DMG without Apple Developer credentials for local testing. The build will complete successfully but produce an unsigned, unnotarized app.

### What You'll See

When you try to open an unsigned DMG on macOS, you'll see one of these errors:
- "Fluxscape is damaged and can't be opened"
- "Fluxscape can't be opened because it is from an unidentified developer"

### Opening Unsigned Builds (Workaround)

**Method 1: Right-click Open (Recommended)**
1. Locate the Fluxscape.app in your Applications folder (or wherever you installed it)
2. **Right-click** (or Control-click) on Fluxscape.app
3. Select **"Open"** from the context menu
4. Click **"Open"** in the dialog that appears
5. macOS will remember your choice and allow the app to run normally

**Method 2: Remove Quarantine Attribute**
```bash
xattr -cr /Applications/Fluxscape.app
```
This removes the quarantine flag that macOS applies to downloaded apps.

**Method 3: System Settings**
1. Try to open the app normally (it will be blocked)
2. Go to **System Settings > Privacy & Security**
3. Scroll down to find the message about Fluxscape being blocked
4. Click **"Open Anyway"**

## Building With Apple Developer Credentials

For distribution to other users, you need to sign and notarize the app using Apple Developer credentials.

### Prerequisites

1. **Apple Developer Account** (paid membership required)
2. **Developer ID Application Certificate** installed in Keychain
3. **App-specific password** for notarization

### Setup Environment Variables

Set these environment variables before building:

```bash
export CSC_NAME="Developer ID Application: Your Name (TEAMID)"
export appleId="your.apple.id@email.com"
export appleIdPassword="xxxx-xxxx-xxxx-xxxx"  # App-specific password
```

**Note:** Never commit these credentials to version control.

### Finding Your Certificate Name

Open **Keychain Access**, search for "Developer ID Application", and copy the full certificate name exactly as shown.

### Creating App-Specific Password

1. Go to [appleid.apple.com](https://appleid.apple.com)
2. Sign in with your Apple ID
3. Go to **Security > App-Specific Passwords**
4. Click **"Generate an app-specific password"**
5. Use this password (not your regular Apple ID password)

### Building

With credentials set, run your normal build command:

```bash
npm run build
```

The build will automatically:
1. Sign the app with your Developer ID certificate (if CSC_NAME is set)
2. Submit the app to Apple for notarization (if appleId and appleIdPassword are set)
3. Wait for notarization to complete
4. Staple the notarization ticket to the app

### Verifying Signing and Notarization

**Check code signature:**
```bash
codesign -vvv --deep --strict /path/to/Fluxscape.app
```

**Check notarization:**
```bash
spctl -a -vv /path/to/Fluxscape.app
```

If properly notarized, you'll see: `source=Notarized Developer ID`

## Troubleshooting

### "Notarization failed: Invalid Apple ID credentials"

- Verify your appleId is correct
- Ensure you're using an **app-specific password**, not your regular password
- Check that your Apple Developer account is active and paid

### Build succeeds but app still shows "damaged" error

- Credentials may not be set correctly (check environment variables)
- Certificate may be expired or revoked
- Run verification commands above to diagnose

### Certificate not found

- Install your Developer ID Application certificate in Keychain
- Ensure CSC_NAME exactly matches the certificate name in Keychain
- Certificate must be valid and not expired
