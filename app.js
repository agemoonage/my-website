const express = require('express');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = 3000;

// 用于解析 JSON 请求体
app.use(express.json());

// 固定的 archive 保存路径
const archiveDir = 'C:/Users/xu/Desktop/html_single_site/archive';

// 确保目录存在
if (!fs.existsSync(archiveDir)) {
  fs.mkdirSync(archiveDir, { recursive: true });
}

// 保存 HTML 的接口
app.post('/save-html', (req, res) => {
  const { title, content } = req.body;

  // 检查标题
  if (!title || typeof title !== 'string' || title.trim() === '') {
    return res.status(400).json({ message: '保存失败：缺少标题或标题无效' });
  }

  // 检查内容
  if (!content || typeof content !== 'string' || content.trim() === '') {
    return res.status(400).json({ message: '保存失败：内容为空或无效' });
  }

  // 清理标题中的非法字符作为文件名（如 ?, /, \, *, :, 等）
  const safeTitle = title.replace(/[^a-zA-Z0-9\u4e00-\u9fa5-_]/g, '_');
  const filename = `${safeTitle}.html`;
  const filePath = path.join(archiveDir, filename);

  // 构造 HTML 内容
  const htmlContent = `<!DOCTYPE html>
<html lang="zh">
<head>
  <meta charset="UTF-8">
  <title>${title}</title>
</head>
<body>
  <h1>${title}</h1>
  <pre>${content}</pre>
</body>
</html>`;

  // 写入文件
  fs.writeFile(filePath, htmlContent, 'utf8', (err) => {
    if (err) {
      console.error('保存 HTML 文件失败:', err);
      return res.status(500).json({ message: `保存失败：${err.message}` });
    }

    res.json({ message: `文件已保存为 ${filename}` });
  });
});

// 启动服务
app.listen(PORT, () => {
  console.log(`服务器运行在 http://localhost:${PORT}`);
});