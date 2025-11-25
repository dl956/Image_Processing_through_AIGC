const express = require('express');
const multer = require('multer');
const cors = require('cors');
const fs = require('fs');
const app = express();
const upload = multer({ dest: 'uploads/' });
app.use(cors());
app.use(express.json());

const REPLICATE_API_TOKEN = process.env.REPLICATE_API_TOKEN;

// Logging function: unified with time, IP, extra info
function logWithDetails(msg, req, extra = {}) {
  const now = new Date().toISOString();
  const ip = req.headers['x-forwarded-for'] || req.connection.remoteAddress;
  console.log(`[${now}] [IP:${ip}] ${msg} | Extra: ${JSON.stringify(extra)}`);
}

// Read uploaded file as base64, return null on error
function getUploadedFileBase64(imagePath) {
  try {
    return fs.readFileSync(imagePath, { encoding: 'base64' });
  } catch (e) {
    return null;
  }
}

// Delete temporary file (async)
function cleanupFile(imagePath) {
  if (imagePath) {
    fs.unlink(imagePath, err => {
      if (err) {
        console.warn(`[CLEANUP] Failed to delete temp file: ${imagePath}, err=${err.message}`);
      } else {
        console.log(`[CLEANUP] Successfully deleted temp file: ${imagePath}`);
      }
    });
  }
}

// Wrap Replicate async inference + polling, throw on error
async function handleReplicate(imageBase64, prompt, req) {
  const input = {
    input_image: `data:image/png;base64,${imageBase64}`,
    prompt: prompt
  };
  logWithDetails('[Replicate] Request parameters', req, { prompt });
  const resp = await fetch('https://api.replicate.com/v1/models/black-forest-labs/flux-kontext-pro/predictions', {
    method: 'POST',
    headers: {
      'Authorization': `Token ${REPLICATE_API_TOKEN}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ input })
  });
  const data = await resp.json();
  logWithDetails('[Replicate] First response', req, data);

  if (!data || !data.id) {
    throw new Error('Replicate API returned an unexpected result:' + JSON.stringify(data));
  }

  // Poll up to 30 times, every 2 seconds
  const maxTries = 30;
  let status = data.status;
  let outputUrl = null;
  for (let tryCount = 0; status !== 'succeeded' && status !== 'failed' && tryCount < maxTries; ++tryCount) {
    await new Promise(r => setTimeout(r, 2000));
    const pollResp = await fetch(`https://api.replicate.com/v1/predictions/${data.id}`, {
      headers: { 'Authorization': `Token ${REPLICATE_API_TOKEN}` }
    });
    const pollData = await pollResp.json();
    logWithDetails('[Replicate] Polling response', req, { tryCount, status: pollData.status });
    status = pollData.status;
    if (status === 'succeeded') {
      outputUrl = pollData.output;
    }
  }
  if (!outputUrl) throw new Error('Replicate output failed');
  return outputUrl;
}

// Main route
app.post('/api/process-image', upload.single('image'), async (req, res) => {
  let imagePath = null;
  try {
    if (!req.file || !req.body.prompt) {
      logWithDetails('Parameter validation failed', req, { hasFile: !!req.file, prompt: req.body.prompt });
      return res.status(400).json({ error: 'Missing file or prompt parameter' });
    }
    imagePath = req.file.path;
    const prompt = req.body.prompt;
    const imageBase64 = getUploadedFileBase64(imagePath);
    if (!imageBase64) {
      logWithDetails('Failed to read image', req, { imagePath });
      return res.status(500).json({ error: 'Failed to read uploaded file' });
    }

    const outputUrl = await handleReplicate(imageBase64, prompt, req);
    logWithDetails('Process complete, returning to user', req, { outputUrl });

    res.json({ outputUrl });
  } catch (err) {
    logWithDetails('Processing exception', req, { msg: err.message, stack: err.stack });
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
