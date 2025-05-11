const express = require('express');
const multer = require('multer');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const app = express();

// 启用 CORS
app.use(cors());

// 配置上传存储
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = 'uploads';
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir);
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    // 获取标题并清理文件名中的特殊字符
    let title = req.body.title || file.originalname;
    
    // 确保标题不为空
    if (!title) title = 'video';
    
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9).toString().substring(0, 4);
    const ext = path.extname(file.originalname);
    cb(null, `${title}-${uniqueSuffix}${ext}`);

  }
});

// 文件过滤器 - 只允许视频文件
const fileFilter = (req, file, cb) => {
  if (file.mimetype.startsWith('video/')) {
    cb(null, true);
  } else {
    cb(new Error('只允许上传视频文件!'), false);
  }
};

const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 1024 * 1024 * 500 // 500MB 限制
  }
});

// 内存中的视频数据存储 (替代数据库)
let videos = [];

// 上传视频接口
app.post('/upload', upload.single('video'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: '没有上传文件' });
  }

  const videoInfo = {
    id: Date.now().toString(),
    title: req.body.title || req.file.originalname,
    filename: req.file.filename,
    path: '/uploads/' + req.file.filename,
    size: req.file.size,
    uploadDate: new Date().toISOString()
  };

  videos.push(videoInfo);
  res.json(videoInfo);
});

// 获取所有视频信息
app.get('/videos', (req, res) => {
  res.json(videos);
});

// 获取单个视频信息
app.get('/video/:id', (req, res) => {
  const video = videos.find(v => v.id === req.params.id);
  if (!video) {
    return res.status(404).json({ error: '视频未找到' });
  }
  res.json(video);
});

// 提供上传的视频文件
app.use('/uploads', express.static('uploads'));

// 简单的首页 - 使用模板字符串避免转义问题
app.get('/', (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>简易视频上传</title>
      <style>
        body { font-family: Arial, sans-serif; max-width: 800px; margin: 0 auto; padding: 20px; }
        form { margin-bottom: 20px; }
        .video-item { margin-bottom: 20px; border-bottom: 1px solid #eee; padding-bottom: 20px; }
        input, button { margin: 5px 0; }
      </style>
    </head>
    <body>
      <h1>简易视频上传</h1>
      
      <form id="uploadForm" enctype="multipart/form-data">
        <div>
          <label for="title">姓名:</label><br>
          <input type="text" id="title" name="title">
        </div>
        <div>
          <label for="video">选择视频:</label><br>
          <input type="file" id="video" name="video" accept="video/*" required>
        </div>
        <button type="submit">上传</button>
      </form>
      
      <h2>已上传视频</h2>
      <div id="videoList"></div>
      
      <script>
        // 上传表单处理
        document.getElementById('uploadForm').addEventListener('submit', async (e) => {
          e.preventDefault();
          
          const formData = new FormData();
          formData.append('title', document.getElementById('title').value);
          formData.append('video', document.getElementById('video').files[0]);
          
          try {
            const response = await fetch('/upload', {
              method: 'POST',
              body: formData
            });
            
            const data = await response.json();
            alert('上传成功: ' + data.title);
            document.getElementById('uploadForm').reset();
            loadVideos();
          } catch (error) {
            console.error('上传错误:', error);
            alert('上传失败: ' + error.message);
          }
        });
        
        // 加载视频列表
        async function loadVideos() {
          try {
            const response = await fetch('/videos');
            const videos = await response.json();
            
            const videoList = document.getElementById('videoList');
            videoList.innerHTML = '';
            
            if (videos.length === 0) {
              videoList.innerHTML = '<p>暂无上传视频</p>';
              return;
            }
            
            videos.forEach(video => {
              const videoElement = document.createElement('div');
              videoElement.className = 'video-item';
              videoElement.innerHTML = \`
                <h3>\${video.title}</h3>
                <p>上传时间: \${new Date(video.uploadDate).toLocaleString()}</p>
                <p>文件大小: \${Math.round(video.size / (1024 * 1024))} MB</p>
                <video width="400" controls>
                  <source src="\${video.path}" type="video/mp4">
                  您的浏览器不支持视频播放
                </video>
              \`;
              videoList.appendChild(videoElement);
            });
          } catch (error) {
            console.error('加载视频列表错误:', error);
            document.getElementById('videoList').innerHTML = '<p>加载视频列表失败</p>';
          }
        }
        
        // 初始加载视频
        loadVideos();
      </script>
    </body>
    </html>
  `);
});

// 启动服务器
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log('服务器运行在 http://localhost:3000');
});