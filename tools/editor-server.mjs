import { createReadStream } from "node:fs";
import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import { createServer } from "node:http";
import { execFile } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const port = Number(process.env.EDITOR_PORT || 5190);
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const editorRoot = path.join(root, "tools", "editor");

const dataFiles = {
  site: path.join(root, "data", "site-content.json"),
  apex: path.join(root, "data", "apex-custom.json"),
  wildcard: path.join(root, "data", "wildcard-custom.json"),
  participation: path.join(root, "data", "participation-history.json"),
};

const mimeTypes = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
};

const server = createServer(async (request, response) => {
  try {
    const url = new URL(request.url || "/", `http://127.0.0.1:${port}`);
    if (url.pathname === "/api/data" && request.method === "GET") return sendJson(response, await loadAllData());
    if (url.pathname === "/api/save" && request.method === "POST") return saveData(request, response);
    if (url.pathname === "/api/upload-image" && request.method === "POST") return uploadImage(request, response);
    if (url.pathname === "/api/publish" && request.method === "POST") return publishChanges(response);
    if (url.pathname === "/api/status" && request.method === "GET") return gitStatus(response);
    return serveStatic(url.pathname, response);
  } catch (error) {
    sendJson(response, { ok: false, error: error.message }, 500);
  }
});

server.listen(port, "127.0.0.1", () => {
  console.log(`YUTORI Editor: http://127.0.0.1:${port}/`);
});

async function loadAllData() {
  return {
    site: await readJson(dataFiles.site),
    apex: await readJson(dataFiles.apex),
    wildcard: await readJson(dataFiles.wildcard),
    participation: await readJson(dataFiles.participation),
  };
}

async function saveData(request, response) {
  const body = await readBodyJson(request);
  await writeJson(dataFiles.site, body.site);
  await writeJson(dataFiles.apex, body.apex);
  await writeJson(dataFiles.wildcard, body.wildcard);
  await writeJson(dataFiles.participation, body.participation);
  sendJson(response, { ok: true, message: "保存しました。" });
}

async function uploadImage(request, response) {
  const body = await readBodyJson(request);
  const targetPath = validateRepoPath(body.path, ["images", "public"]);
  const match = String(body.dataUrl || "").match(/^data:(.+);base64,(.+)$/);
  if (!match) throw new Error("画像データを読み込めませんでした。");
  await mkdir(path.dirname(targetPath), { recursive: true });
  await writeFile(targetPath, Buffer.from(match[2], "base64"));
  sendJson(response, { ok: true, path: `/${path.relative(root, targetPath).replaceAll("\\", "/")}` });
}

async function publishChanges(response) {
  const status = await run("git", ["status", "--short"]);
  if (!status.stdout.trim()) return sendJson(response, { ok: true, message: "公開する変更はありません。" });
  await run("git", ["add", "data", "images", "public", "assets", "apex-custom", "wildcard-custom", "participation-history", "index.html", "404.html", "README.md", "tools"]);
  const message = `Update site content ${new Date().toISOString().slice(0, 16).replace("T", " ")}`;
  await run("git", ["commit", "-m", message]);
  const push = await run("git", ["push", "origin", "main"]);
  sendJson(response, { ok: true, message: "GitHub Pagesへ送信しました。反映まで少し待ってください。", output: push.stdout || push.stderr });
}

async function gitStatus(response) {
  const status = await run("git", ["status", "--short"]);
  sendJson(response, { ok: true, status: status.stdout.trim() });
}

async function serveStatic(pathname, response) {
  let filePath;
  if (pathname === "/") {
    filePath = path.join(editorRoot, "index.html");
  } else if (pathname.startsWith("/editor/")) {
    filePath = path.join(editorRoot, pathname.replace("/editor/", ""));
  } else {
    filePath = path.join(root, pathname);
  }

  const resolved = path.resolve(filePath);
  if (!resolved.startsWith(root)) {
    response.writeHead(403);
    response.end("Forbidden");
    return;
  }

  let fileStat;
  try {
    fileStat = await stat(resolved);
  } catch (error) {
    if (error.code === "ENOENT") {
      response.writeHead(404, { "content-type": "text/plain; charset=utf-8" });
      response.end("Not Found");
      return;
    }
    throw error;
  }
  const ext = path.extname(resolved).toLowerCase();
  response.writeHead(200, {
    "content-type": mimeTypes[ext] || "application/octet-stream",
    "content-length": fileStat.size,
    "cache-control": "no-store",
  });
  createReadStream(resolved).pipe(response);
}

async function readJson(file) {
  return JSON.parse(await readFile(file, "utf8"));
}

async function writeJson(file, data) {
  await writeFile(file, `${JSON.stringify(data, null, 2)}\n`, "utf8");
}

async function readBodyJson(request) {
  const chunks = [];
  for await (const chunk of request) chunks.push(chunk);
  return JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}");
}

function sendJson(response, data, status = 200) {
  const body = JSON.stringify(data);
  response.writeHead(status, { "content-type": "application/json; charset=utf-8", "content-length": Buffer.byteLength(body) });
  response.end(body);
}

function validateRepoPath(input, allowedRoots) {
  const clean = String(input || "").replace(/^\/+/, "");
  const first = clean.split(/[\\/]/)[0];
  if (!allowedRoots.includes(first)) throw new Error("保存できる場所は images または public の中だけです。");
  const target = path.resolve(root, clean);
  if (!target.startsWith(root)) throw new Error("保存先パスが不正です。");
  return target;
}

function run(command, args) {
  return new Promise((resolve, reject) => {
    execFile(command, args, { cwd: root, windowsHide: true }, (error, stdout, stderr) => {
      if (error) {
        error.message = `${error.message}\n${stderr}`;
        reject(error);
        return;
      }
      resolve({ stdout, stderr });
    });
  });
}
