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
    let title = req.body.title || file.originalname;
    title = title.replace(/\s+/g, '-')
              .replace(/[^\w\-]/g, '')
              .toLowerCase();
    if (!title) title = 'video';
    
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9).toString().substring(0, 4);
    const ext = path.extname(file.originalname);
    cb(null, `${title}-${uniqueSuffix}${ext}`);
  }
});

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
    fileSize: 1024 * 1024 * 500 // 500MB
  }
});

let videos = [];

app.post('/upload', upload.single('video'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: '没有上传文件' });
  }

  const videoInfo = {
    id: Date.now().toString(),
    title: req.body.title || path.parse(req.file.originalname).name,
    filename: req.file.filename,
    path: '/uploads/' + req.file.filename,
    size: req.file.size,
    uploadDate: new Date().toISOString()
  };

  videos.push(videoInfo);
  res.json(videoInfo);
});

app.get('/videos', (req, res) => {
  res.json(videos);
});

app.get('/video/:id', (req, res) => {
  const video = videos.find(v => v.id === req.params.id);
  if (!video) {
    return res.status(404).json({ error: '视频未找到' });
  }
  res.json(video);
});

app.use('/uploads', express.static('uploads'));

app.get('/', (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>视频上传带进度条</title>
      <style>
        body { font-family: Arial, sans-serif; max-width: 800px; margin: 0 auto; padding: 20px; }
        form { margin-bottom: 20px; }
        .video-item { margin-bottom: 20px; border-bottom: 1px solid #eee; padding-bottom: 20px; }
        input, button { margin: 5px 0; }
        label { display: block; margin-top: 10px; }
        
        /* 进度条样式 */
        .progress-container {
          width: 100%;
          background-color: #f3f3f3;
          border-radius: 5px;
          margin: 10px 0;
          display: none;
        }
        .progress-bar {
          height: 20px;
          border-radius: 5px;
          background-color: #4CAF50;
          width: 0%;
          transition: width 0.3s;
          text-align: center;
          line-height: 20px;
          color: white;
        }
        
        .upload-status {
          margin: 10px 0;
          font-weight: bold;
        }
      </style>
    </head>
    <body>
      <h1>视频上传带进度条</h1>
      
      <form id="uploadForm" enctype="multipart/form-data">
        <div>
          <label for="title">视频标题:</label>
          <input type="text" id="title" name="title" required placeholder="请输入视频标题">
        </div>
        <div>
          <label for="video">选择视频文件:</label>
          <input type="file" id="video" name="video" accept="video/*" required>
        </div>
        
        <!-- 进度条容器 -->
        <div class="progress-container" id="progressContainer">
          <div class="progress-bar" id="progressBar">0%</div>
        </div>
        <div class="upload-status" id="uploadStatus"></div>
        
        <button type="submit" id="submitBtn">上传视频</button>
      </form>
      
      <h2>已上传视频</h2>
      <div id="videoList"></div>
      
      <script>
        document.getElementById('uploadForm').addEventListener('submit', function(e) {
          e.preventDefault();
          
          const titleInput = document.getElementById('title');
          const fileInput = document.getElementById('video');
          const progressContainer = document.getElementById('progressContainer');
          const progressBar = document.getElementById('progressBar');
          const uploadStatus = document.getElementById('uploadStatus');
          const submitBtn = document.getElementById('submitBtn');
          
          // 验证输入
          if (!titleInput.value.trim()) {
            alert('请输入视频标题');
            return;
          }
          
          if (!fileInput.files.length) {
            alert('请选择视频文件');
            return;
          }
          
          // 准备上传
          const formData = new FormData();
          formData.append('title', titleInput.value.trim());
          formData.append('video', fileInput.files[0]);
          
          // 显示进度条
          progressContainer.style.display = 'block';
          progressBar.style.width = '0%';
          progressBar.textContent = '0%';
          uploadStatus.textContent = '准备上传...';
          submitBtn.disabled = true;
          
          // 使用XMLHttpRequest以便获取上传进度
          const xhr = new XMLHttpRequest();
          
          // 进度事件处理
          xhr.upload.addEventListener('progress', function(e) {
            if (e.lengthComputable) {
              const percentComplete = Math.round((e.loaded / e.total) * 100);
              progressBar.style.width = percentComplete + '%';
              progressBar.textContent = percentComplete + '%';
              uploadStatus.textContent = '上传中: ' + percentComplete + '%';
            }
          });
          
          // 上传完成处理
          xhr.addEventListener('load', function() {
            if (xhr.status === 200) {
              const data = JSON.parse(xhr.responseText);
              uploadStatus.textContent = '上传成功: ' + data.title;
              progressBar.style.backgroundColor = '#4CAF50';
              document.getElementById('uploadForm').reset();
              loadVideos();
            } else {
              uploadStatus.textContent = '上传失败: ' + xhr.statusText;
              progressBar.style.backgroundColor = '#f44336';
            }
            submitBtn.disabled = false;
          });
          
          // 错误处理
          xhr.addEventListener('error', function() {
            uploadStatus.textContent = '上传过程中发生错误';
            progressBar.style.backgroundColor = '#f44336';
            submitBtn.disabled = false;
          });
          
          // 中止处理
          xhr.addEventListener('abort', function() {
            uploadStatus.textContent = '上传已取消';
            progressBar.style.backgroundColor = '#ff9800';
            submitBtn.disabled = false;
          });
          
          // 开始上传
          xhr.open('POST', '/upload', true);
          xhr.send(formData);
        });
        
        // 加载视频列表
        async function loadVideos() {
          try {
            const response = await fetch('/videos');
            if (!response.ok) throw new Error('获取视频列表失败');
            
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
                <p>文件名: \${video.filename}</p>
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

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(\`服务器运行在 http://localhost:\${PORT}\`);
});