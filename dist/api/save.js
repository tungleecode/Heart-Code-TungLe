const DEFAULT_OWNER = 'tungleecode';
const DEFAULT_REPO = 'Heart-Code-TungLe';
const DEFAULT_BRANCH = 'main';
const CONFIG_PATH = process.env.CONFIG_PATH || 'dist/config.json';
const IMAGE_PATH = process.env.IMAGE_PATH || 'dist/heart-photo.jpg';

function send(res, status, data) {
  res.statusCode = status;
  res.setHeader('content-type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(data));
}

function normalizeBase64Image(image) {
  if (!image || typeof image !== 'string' || !image.startsWith('data:image/')) return null;
  const comma = image.indexOf(',');
  if (comma === -1) return null;
  return image.slice(comma + 1);
}

async function github(path, options = {}) {
  const token = process.env.GITHUB_TOKEN || process.env.GH_TOKEN;
  if (!token) throw new Error('Server chưa cấu hình GITHUB_TOKEN.');
  const owner = process.env.GITHUB_OWNER || DEFAULT_OWNER;
  const repo = process.env.GITHUB_REPO || DEFAULT_REPO;
  const [filePath, query = ''] = path.split('?');
  const encodedPath = filePath.split('/').map(encodeURIComponent).join('/');
  const response = await fetch(`https://api.github.com/repos/${owner}/${repo}/contents/${encodedPath}${query ? `?${query}` : ''}`, {
    ...options,
    headers: {
      accept: 'application/vnd.github+json',
      authorization: `Bearer ${token}`,
      'x-github-api-version': '2022-11-28',
      ...(options.headers || {}),
    },
  });
  if (!response.ok) {
    const body = await response.text();
    throw new Error(`${response.status} ${response.statusText}: ${body.slice(0, 220)}`);
  }
  return response.json();
}

async function getSha(path, branch) {
  try {
    const data = await github(`${path}?ref=${encodeURIComponent(branch)}`);
    return data.sha;
  } catch (error) {
    if (String(error.message).startsWith('404')) return undefined;
    throw error;
  }
}

async function putFile(path, content, message, branch) {
  const sha = await getSha(path, branch);
  return github(path, {
    method: 'PUT',
    body: JSON.stringify({ message, content, sha, branch }),
  });
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return send(res, 405, { error: 'Method not allowed' });
  try {
    const chunks = [];
    for await (const chunk of req) chunks.push(chunk);
    const body = JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}');
    const copyright = String(body.copyright || '').trim() || 'Lê Thanh Tùng: Trái Tim Mã Nguồn';
    const imageBase64 = normalizeBase64Image(body.image);
    const branch = process.env.GITHUB_BRANCH || DEFAULT_BRANCH;
    const updatedAt = new Date().toISOString();
    const image = imageBase64 ? 'heart-photo.jpg' : String(body.currentImage || 'img1.jpg');

    if (imageBase64) {
      await putFile(IMAGE_PATH, imageBase64, `Update heart photo ${updatedAt}`, branch);
    }

    const config = { image, copyright, updatedAt };
    const configBase64 = Buffer.from(JSON.stringify(config, null, 2), 'utf8').toString('base64');
    await putFile(CONFIG_PATH, configBase64, `Update site config ${updatedAt}`, branch);
    return send(res, 200, { ok: true, config });
  } catch (error) {
    return send(res, 500, { error: error.message || 'Không lưu được cấu hình.' });
  }
};
