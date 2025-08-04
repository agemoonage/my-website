const express = require('express');
const cors = require('cors');
const multer = require('multer');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = 3000;

app.use(cors());
app.use(express.static('public'));
app.use('/uploads', express.static('uploads'));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// 确保 uploads 目录存在
const uploadDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// 确保待归档目录存在
const archiveDir = path.join(__dirname, 'public/待归档');
if (!fs.existsSync(archiveDir)) {
  fs.mkdirSync(archiveDir, { recursive: true });
}

// 配置 Multer
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueName = `${Date.now()}-${file.originalname}`;
    cb(null, uniqueName);
  },
});
const upload = multer({ storage });

// 文件上传接口
app.post('/upload', upload.single('file'), (req, res) => {
  if (!req.file) {
    console.error('没有收到文件');
    return res.status(400).json({ message: '未收到文件' });
  }
  console.log('收到文档：', req.file.originalname);
  res.json({ message: '上传成功', file: req.file.filename });
});

app.get('/', (_req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// 文本保存为HTML接口
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

    res.json({ message: `文件已保存为 ${safeFileName}`, path: `/archive/${safeFileName}` });
  });
});

app.listen(PORT, () => {
  console.log(`服务器运行在 http://localhost:${PORT}`);
});