# Hosting and storage boundaries

Coach Loop stores training locally, with no account or automatic hosted sync. A public repository contains application source, not visitors' local logs. Only deliberate exports and AI copy/share actions should disclose training text.

IndexedDB security is scoped to the **origin**, not a URL path. Projects at `https://paul-18.github.io/CoachLoop/` and `https://paul-18.github.io/AnotherProject/` share an origin within a browser storage context. Scripts in another visited project on that origin can potentially access Coach Loop's storage. Database-name suffixes prevent accidental collisions; they are not a security boundary. This is not evidence that anyone has accessed a log.

Keep all projects and third-party scripts on this hostname trusted. Before adding unrelated public applications, consider a dedicated origin for Coach Loop. A different GitHub account hostname or a dedicated app subdomain can provide origin separation; simply changing the repository/path or database name cannot.

Do not move the app address as routine maintenance. An origin change does not carry IndexedDB data automatically: save and verify a private JSON backup, test restore at the new origin, check manifest/SW scope and offline readiness, and retain access to the old log until the new one is verified. Never clear the old storage to make an update work.

Safari tabs and installed apps can have different storage contexts depending on platform/install behavior. Check the actual device; do not promise a shared or separate log universally. The single-editor lease coordinates only clients sharing its locking/storage context.

`navigator.storage.persist()` is best-effort. Granted persistence is useful but is not a replacement for external backups. The 50 MB backup boundary remains: parsing/validation runs on the main thread and near-limit files need physical-device testing. Use disposable synthetic data for stress tests, not a personal log.

Keep ZIP updates and all private data out of commits. Ignore rules cannot remove files already committed or historical ZIPs. No history rewrite is necessary without a confirmed sensitive finding and a coordinated plan.
