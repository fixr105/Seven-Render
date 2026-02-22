import type { Plugin } from 'vite';
import path from 'path';
import fs from 'fs';

const VIDEOS_PATH = '/videos/';
const DEMO_DIR = 'DEMO';

function getDemoDir(root: string): string {
  return path.resolve(root, DEMO_DIR);
}

function getContentType(filename: string): string {
  const ext = path.extname(filename).toLowerCase();
  if (ext === '.mp4') return 'video/mp4';
  if (ext === '.webm') return 'video/webm';
  return 'application/octet-stream';
}

function copyDirRecursive(src: string, dest: string): void {
  if (!fs.existsSync(src)) return;
  fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      copyDirRecursive(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

function createVideosMiddleware(): (req: any, res: any, next: () => void) => void {
  return (req, res, next) => {
    if (req.method !== 'GET') return next();
    const rawUrl = req.url ?? '';
    const pathname = rawUrl.split('?')[0];
    if (!pathname.startsWith(VIDEOS_PATH)) return next();
    const root = process.cwd();
    const demoDir = getDemoDir(root);
    if (!fs.existsSync(demoDir) || !fs.statSync(demoDir).isDirectory()) {
      return next();
    }
    const suffix = pathname.slice(VIDEOS_PATH.length).replace(/^(\.\.\/)+/, '');
    if (!suffix) return next();
    const filename = path.basename(suffix);
    const filePath = path.join(demoDir, filename);
    if (!fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) {
      return next();
    }
    res.setHeader('Content-Type', getContentType(filename));
    res.statusCode = 200;
    fs.createReadStream(filePath).pipe(res);
  };
}

export function demoVideos(): Plugin {
  return {
    name: 'demo-videos',
    apply: undefined, // both dev and build
    configureServer(server) {
      return () => {
        const middleware = createVideosMiddleware();
        (server.middlewares as any).stack.unshift({ route: '', handle: middleware });
      };
    },
    closeBundle() {
      const root = process.cwd();
      const demoDir = getDemoDir(root);
      if (!fs.existsSync(demoDir) || !fs.statSync(demoDir).isDirectory()) {
        return;
      }
      const outDir = path.resolve(root, 'dist');
      if (!fs.existsSync(outDir)) return;
      const destDir = path.join(outDir, 'videos');
      copyDirRecursive(demoDir, destDir);
    },
  };
}
