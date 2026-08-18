# ZEROONE MARASEM V1.2.0

- Replace the GitHub repository contents with this release.
- Commit and wait for GitHub Pages deployment.
- Test in a private/incognito window.
- After authentication is verified, publish hardened Firestore rules.

Do not keep `allow read, write: if true` in production.


## V1.5.0 Master Base stabilization

- Deploy the repository files from this release.
- Publish `firestore.rules` to the `zeroone-marasem` Firestore database.
- Verify the `/admins/{uid}` document matches the Firebase Auth UID and has `role: admin`.
- Test login, dashboard access, event creation, invitation creation, WhatsApp preparation, invitation RSVP, and check-in.
- Do not use `allow read, write: if true` in production.
