# Demo videos

Place tutorial video files here. They are served at `/videos/` in the app (New Application page).

**Required files:**

- `drive.mp4` – Google Drive shared folder tutorial
- `onedrive.mp4` – OneDrive shared folder tutorial

Videos must be H.264/AVC encoded for browser compatibility.

If videos still don't load, ensure these exact filenames exist in DEMO.

**Deploying:** Commit `drive.mp4` and `onedrive.mp4` in DEMO; the frontend build copies them into `dist/videos`, so they are deployed with the app (e.g. Vercel serves them at `/videos/drive.mp4` and `/videos/onedrive.mp4`).
