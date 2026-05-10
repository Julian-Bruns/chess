import { createWriteStream, existsSync } from 'node:fs';
import { chmod, copyFile, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { execFile } from 'node:child_process';
import os from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';

const execFileAsync = promisify(execFile);
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const apiUrl = 'https://api.github.com/repos/official-stockfish/Stockfish/releases/latest';
const userAgent = 'chessfish/0.1.0';

const targets = [
  {
    key: 'macos-arm64',
    asset: /^stockfish-macos-m1-apple-silicon\.tar$/,
    out: path.join(root, 'engines', 'macos', 'arm64', 'stockfish')
  },
  {
    key: 'macos-x64-bmi2',
    asset: /^stockfish-macos-x86-64-bmi2\.tar$/,
    out: path.join(root, 'engines', 'macos', 'x64', 'stockfish-bmi2')
  },
  {
    key: 'macos-x64-avx2',
    asset: /^stockfish-macos-x86-64-avx2\.tar$/,
    out: path.join(root, 'engines', 'macos', 'x64', 'stockfish-avx2')
  },
  {
    key: 'macos-x64-popcnt',
    asset: /^stockfish-macos-x86-64-sse41-popcnt\.tar$/,
    out: path.join(root, 'engines', 'macos', 'x64', 'stockfish-popcnt')
  },
  {
    key: 'macos-x64',
    asset: /^stockfish-macos-x86-64\.tar$/,
    out: path.join(root, 'engines', 'macos', 'x64', 'stockfish')
  },
  {
    key: 'android-arm64-v8a',
    asset: /^stockfish-android-armv8\.tar$/,
    out: path.join(root, 'android', 'app', 'src', 'main', 'jniLibs', 'arm64-v8a', 'libstockfish.so')
  },
  {
    key: 'android-armeabi-v7a',
    asset: /^stockfish-android-armv7-neon\.tar$/,
    out: path.join(root, 'android', 'app', 'src', 'main', 'jniLibs', 'armeabi-v7a', 'libstockfish.so')
  }
];

async function download(url, outPath) {
  const response = await fetch(url, {
    headers: {
      'User-Agent': userAgent
    },
    redirect: 'follow'
  });

  if (!response.ok || response.body == null) {
    throw new Error(`Failed to download ${url}: ${response.status} ${response.statusText}`);
  }

  await mkdir(path.dirname(outPath), { recursive: true });
  const file = createWriteStream(outPath);
  await new Promise((resolve, reject) => {
    response.body.pipeTo(
      new WritableStream({
        write(chunk) {
          file.write(Buffer.from(chunk));
        },
        close() {
          file.end(resolve);
        },
        abort(error) {
          file.destroy(error);
          reject(error);
        }
      })
    ).catch(reject);
  });
}

async function fetchLatestRelease() {
  const response = await fetch(apiUrl, {
    headers: {
      'Accept': 'application/vnd.github+json',
      'User-Agent': userAgent
    }
  });

  if (!response.ok) {
    throw new Error(`GitHub release lookup failed: ${response.status} ${response.statusText}`);
  }

  return response.json();
}

async function walk(dir) {
  const entries = await import('node:fs/promises').then((fs) => fs.readdir(dir, { withFileTypes: true }));
  const files = [];

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...await walk(fullPath));
    } else {
      files.push(fullPath);
    }
  }

  return files;
}

async function extractBinary(archivePath, workDir) {
  const extractDir = path.join(workDir, 'extract');
  await mkdir(extractDir, { recursive: true });
  await execFileAsync('tar', ['-xf', archivePath, '-C', extractDir]);

  const files = await walk(extractDir);
  const candidates = [];
  for (const file of files) {
    const base = path.basename(file);
    if (!base.startsWith('stockfish') || base.endsWith('.txt') || base.endsWith('.md')) {
      continue;
    }
    const stat = await import('node:fs/promises').then((fs) => fs.stat(file));
    if (stat.size > 1024 * 1024) {
      candidates.push(file);
    }
  }

  if (candidates.length === 0) {
    throw new Error(`No Stockfish executable found in ${archivePath}`);
  }

  return candidates.sort((a, b) => path.basename(a).localeCompare(path.basename(b)))[0];
}

async function readExistingManifest() {
  const manifestPath = path.join(root, 'engine-manifest.json');
  if (!existsSync(manifestPath)) {
    return {};
  }

  try {
    return JSON.parse(await readFile(manifestPath, 'utf8'));
  } catch {
    return {};
  }
}

const release = await fetchLatestRelease();
const previous = await readExistingManifest();
const manifest = {
  releaseTag: release.tag_name,
  releaseName: release.name,
  releaseUrl: release.html_url,
  updatedAt: new Date().toISOString(),
  previousReleaseTag: previous.releaseTag ?? null,
  binaries: {}
};

const workDir = await import('node:fs/promises').then((fs) => fs.mkdtemp(path.join(os.tmpdir(), 'stockfish-')));

try {
  for (const target of targets) {
    const asset = release.assets.find((item) => target.asset.test(item.name));
    if (!asset) {
      throw new Error(`Release ${release.tag_name} does not contain expected asset for ${target.key}`);
    }

    const archivePath = path.join(workDir, asset.name);
    console.log(`Downloading ${asset.name}`);
    await download(asset.browser_download_url, archivePath);

    const binaryPath = await extractBinary(archivePath, path.join(workDir, target.key));
    await mkdir(path.dirname(target.out), { recursive: true });
    await copyFile(binaryPath, target.out);
    await chmod(target.out, 0o755);

    manifest.binaries[target.key] = {
      asset: asset.name,
      path: path.relative(root, target.out),
      size: asset.size,
      downloadUrl: asset.browser_download_url
    };
  }

  await writeFile(path.join(root, 'engine-manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);
  console.log(`Stockfish ${release.name} (${release.tag_name}) installed`);
} finally {
  await rm(workDir, { recursive: true, force: true });
}
