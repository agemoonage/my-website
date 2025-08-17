const express = require('express');
const cors = require('cors');
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const OSS = require('ali-oss');
const config = require('./config.js'); // <-- 引入本地配置文件

const app = express();
const PORT = 3000;

// -------------------- 本地目录 --------------------
const uploadDir = path.join(__dirname, 'uploads');
const archiveDir = path.join(__dirname, 'public/archive');

// 确保目录存在
[uploadDir, archiveDir].forEach(dir => {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
});

// -------------------- 中间件 --------------------
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// 静态资源映射
app.use('/uploads', express.static(uploadDir));
app.use('/public', express.static('public'));
app.use(express.static('public'));

// -------------------- Multer 配置 --------------------
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => cb(null, `${Date.now()}-${file.originalname}`)
});
const upload = multer({ storage });

// -------------------- OSS 客户端 --------------------
const client = new OSS({
  region: config.OSS_REGION,
  accessKeyId: config.OSS_ACCESS_KEY_ID,
  accessKeySecret: config.OSS_ACCESS_KEY_SECRET,
  bucket: config.OSS_BUCKET
});

// 上传文件到 OSS
async function uploadToOSS(localPath, remoteName) {
  try {
    const result = await client.put(remoteName, localPath);
    console.log(`已上传到 OSS: ${result.url}`);
    return result.url;
  } catch (err) {
    console.error('上传 OSS 失败:', err);
    throw err;
  }
}

// -------------------- 工具函数：更新归档首页 --------------------
const updateArchiveIndex = () => {
  const files = fs.readdirSync(archiveDir)
    .filter(f => f.endsWith('.html') && f !== 'index.html');

  const listItems = files.map(f => {
    const name = f.replace(/\.html$/, '');
    return `<li><a href="./${f}">${name}</a></li>`;
  }).join('\n');

  const indexContent = `<!DOCTYPE html>
<html lang="zh">
<head>
  <meta charset="UTF-8" />
  <title>归档文件列表</title>
</head>
<body>
  <h1>归档文件列表</h1>
  <ul>
    ${listItems}
  </ul>
</body>
</html>`;

  fs.writeFileSync(path.join(archiveDir, 'index.html'), indexContent, 'utf8');
};

// -------------------- 上传文件接口 --------------------
app.post('/upload', upload.single('file'), async (req, res) => {
  if (!req.file) return res.status(400).json({ message: '未收到文件' });

  try {
    const url = await uploadToOSS(req.file.path, `public/uploads/${req.file.filename}`);
    res.json({ message: '上传成功', file: req.file.filename, url });
  } catch (err) {
    res.status(500).json({ message: '上传 OSS 失败', error: err.message });
  }
});

// -------------------- 保存文本为 HTML --------------------
app.post('/save-html', (req, res) => {
  const { fileName, title, content } = req.body;

  if (!fileName || !title || !content) {
    return res.status(400).json({ message: '参数缺失' });
  }

  const safeFileName = fileName.trim().replace(/[\\\/:*?"<>|]/g, '_') + '.html';
  const filePath = path.join(archiveDir, safeFileName);

  const htmlContent = `<!DOCTYPE html>
<html lang="zh">
<head>
  <meta charset="UTF-8" />
  <title>${title}</title>
</head>
<body>
  <h1>${title}</h1>
  <pre>${content}</pre>
</body>
</html>`;

  fs.writeFile(filePath, htmlContent, 'utf8', async (err) => {
    if (err) return res.status(500).json({ message: `保存失败：${err.message}` });

    try {
      updateArchiveIndex();
      const url = await uploadToOSS(filePath, `public/archive/${safeFileName}`);
      res.json({ message: `文件已保存为 ${safeFileName}`, path: `/public/archive/${safeFileName}`, url });
    } catch (ossErr) {
      res.status(500).json({ message: 'OSS 上传失败', error: ossErr.message });
    }
  });
});

// -------------------- 首页 --------------------
app.get('/', (_req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// -------------------- 启动服务器 --------------------
app.listen(PORT, () => {
  console.log(`服务器运行在 http://localhost:${PORT}`);
});