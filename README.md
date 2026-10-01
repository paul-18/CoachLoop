# Coach Loop — GitHub Pages PWA

A personal strength and activity log with FITLOG import, History, Progress, HYROX, and JSON backup. This source package contains **no workout history, profile, credentials, or private Site settings**.

## Publish from GitHub

1. Extract the ZIP. Create a **new repository** on GitHub, then upload the contents of the `Coach-Loop-GitHub` folder to the repository root. Keep the `.github/workflows/pages.yml` file; in GitHub's web uploader, hidden folders may be easy to miss. A Git client is another way to push the whole folder.
2. In the repository, open **Settings → Pages → Build and deployment** and set **Source** to **GitHub Actions**.
3. Push to `main` (or run the `Publish Coach Loop PWA` workflow manually). When the workflow succeeds, open the Pages URL shown in the deployment. A project repository normally uses `https://USERNAME.github.io/REPOSITORY/`.
4. On your iPhone, open that URL in Safari, tap **Share → Add to Home Screen**, then launch it once while online. Settings will show whether offline files are ready.

The workflow builds a static PWA with relative asset paths, so a project repository path works without editing the code. If your default branch is not `main`, change the branch in `.github/workflows/pages.yml` or run the workflow manually.

## Data and privacy

- The GitHub Pages edition stores training data in **IndexedDB on that browser and origin**. It does not include cloud sync or a server account. GitHub hosts the app code, not your workouts.
- A GitHub Pages site is publicly reachable even when the repository is private. Anyone with the URL can open a fresh, empty instance; they cannot see your device's workout data. Do not upload JSON backups, screenshots, `.env` files, or personal notes to the repository.
- Your existing Coach Loop Site and the new GitHub Pages address have different browser storage. To move history, use **Settings → Download full backup** in the existing app, then **Settings → Restore JSON backup** in the new app. Keep a separate safe copy of the backup. Nothing migrates automatically.
- Browser storage can be lost if the app is removed or Safari site data is cleared. Download backups regularly and keep them outside the GitHub repository.
- Updating the repository rebuilds the app. A saved PWA downloads new code on a later online visit; close and reopen it after the update notice. Workout data remains in that browser's IndexedDB.

## Work locally

Use Node 24 and pnpm 11.25.0:

```sh
corepack enable
pnpm install --frozen-lockfile
pnpm dev
```

`pnpm build` writes the GitHub Pages files to `dist/`. `pnpm preview` serves that build locally. `pnpm test` runs the existing unit tests. The standalone edition uses the same log format and JSON backup structure as the Site edition.
