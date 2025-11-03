const express = require('express');
const multer = require('multer');
const cors = require('cors');
const fs = require('fs');
const app = express();
const upload = multer({ dest: 'uploads/' });
app.use(cors());
app.use(express.json());

const REPLICATE_API_TOKEN = process.env.REPLICATE_API_TOKEN;

// 日志函数，统一带时间、IP、附加信息
function logWithDetails(msg, req, extra = {}) {
  const now = new Date().toISOString();
  const ip = req.headers['x-forwarded-for'] || req.connection.remoteAddress;
  console.log(`[${now}] [IP:${ip}] ${msg} | Extra: ${JSON.stringify(extra)}`);
}

// 读取上传文件base64内容，异常返回null
function getUploadedFileBase64(imagePath) {
  try {
    return fs.readFileSync(imagePath, { encoding: 'base64' });
  } catch (e) {
    return null;
  }
}

// 删除临时文件，异步
function cleanupFile(imagePath) {
  if (imagePath) {
    fs.unlink(imagePath, err => {
      if (err) {
        console.warn(`[CLEANUP] 删除临时文件失败: ${imagePath}, err=${err.message}`);
      } else {
        console.log(`[CLEANUP] 成功删除临时文件: ${imagePath}`);
      }
    });
  }
}

// 封装 Replicate 异步推理+轮询，出错抛异常
async function handleReplicate(imageBase64, prompt, req) {
  const input = {
    input_image: `data:image/png;base64,${imageBase64}`,
    prompt: prompt
  };
  logWithDetails('[Replicate] 请求参数', req, { prompt });
  const resp = await fetch('https://api.replicate.com/v1/models/black-forest-labs/flux-kontext-pro/predictions', {
    method: 'POST',
    headers: {
      'Authorization': `Token ${REPLICATE_API_TOKEN}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ input })
  });
  const data = await resp.json();
  logWithDetails('[Replicate] 首次响应', req, data);

  if (!data || !data.id) {
    throw new Error('Replicate API 返回异常:' + JSON.stringify(data));
  }

  // 轮询最多30次，每2秒
  const maxTries = 30;
  let status = data.status;
  let outputUrl = null;
  for (let tryCount = 0; status !== 'succeeded' && status !== 'failed' && tryCount < maxTries; ++tryCount) {
    await new Promise(r => setTimeout(r, 2000));
    const pollResp = await fetch(`https://api.replicate.com/v1/predictions/${data.id}`, {
      headers: { 'Authorization': `Token ${REPLICATE_API_TOKEN}` }
    });
    const pollData = await pollResp.json();
    logWithDetails('[Replicate] 轮询响应', req, { tryCount, status: pollData.status });
    status = pollData.status;
    if (status === 'succeeded') {
      outputUrl = pollData.output;
    }
  }
  if (!outputUrl) throw new Error('Replicate输出失败');
  return outputUrl;
}

// 主路由
app.post('/api/process-image', upload.single('image'), async (req, res) => {
  let imagePath = null;
  try {
    if (!req.file || !req.body.prompt) {
      logWithDetails('参数校验失败', req, { hasFile: !!req.file, prompt: req.body.prompt });
      return res.status(400).json({ error: '缺少文件或prompt参数' });
    }
    imagePath = req.file.path;
    const prompt = req.body.prompt;
    const imageBase64 = getUploadedFileBase64(imagePath);
    if (!imageBase64) {
      logWithDetails('图片读取失败', req, { imagePath });
      return res.status(500).json({ error: 'Failed to read uploaded file' });
    }

    const outputUrl = await handleReplicate(imageBase64, prompt, req);
    logWithDetails('流程完成，返回用户', req, { outputUrl });

    res.json({ outputUrl });
  } catch (err) {
    logWithDetails('处理异常', req, { msg: err.message, stack: err.stack });
    res.status(500).json({ error: err.message });
  } finally {
    cleanupFile(imagePath);
  }
});

app.get('/ping', (req, res) => {
  res.send('pong');
});

app.listen(5000, () => {
  console.log('Server running on http://localhost:5000');
});