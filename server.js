const express = require('express');
const cors = require('cors');
const multer = require('multer');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = 3000;

// 目录路径
const uploadDir = path.join(__dirname, 'uploads');
const archiveDir = path.join(__dirname, 'public/archive');

// 确保 uploads 和 archive 目录存在
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });
if (!fs.existsSync(archiveDir)) fs.mkdirSync(archiveDir, { recursive: true });

// 中间件
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use('/uploads', express.static(uploadDir));
app.use('/public', express.static('public'));
app.use(express.static('public'));

// 配置 Multer 存储
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => cb(null, `${Date.now()}-${file.originalname}`)
});
const upload = multer({ storage });

// 工具函数：更新 archive/index.html
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

// 上传文件接口
app.post('/upload', upload.single('file'), (req, res) => {
  if (!req.file) {
    console.error('没有收到文件');
    return res.status(400).json({ message: '未收到文件' });
  }
  console.log('收到文档：', req.file.originalname);
  res.json({ message: '上传成功', file: req.file.filename });
});

// 首页
app.get('/', (_req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// 保存文本为 HTML 接口
app.post('/save-html', (req, res) => {
  const { fileName, title, content } = req.body;

  if (!fileName || typeof fileName !== 'string' || fileName.trim() === '') {
    return res.status(400).json({ message: '文件名无效或缺失' });
  }
  if (!title || typeof title !== 'string' || title.trim() === '') {
    return res.status(400).json({ message: '标题无效或缺失' });
  }
  if (!content || typeof content !== 'string' || content.trim() === '') {
    return res.status(400).json({ message: '内容无效或缺失' });
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

  fs.writeFile(filePath, htmlContent, 'utf8', (err) => {
    if (err) {
      console.error('保存 HTML 文件失败:', err);
      return res.status(500).json({ message: `保存失败：${err.message}` });
    }

    // 保存成功后，更新归档首页
    try {
      updateArchiveIndex();
    } catch (e) {
      console.error('更新归档首页失败:', e);
    }

    res.json({ message: `文件已保存为 ${safeFileName}`, path: `/archive/${safeFileName}` });
  });
});

// 启动服务器
app.listen(PORT, () => {
  console.log(`服务器运行在 http://localhost:${PORT}`);
});