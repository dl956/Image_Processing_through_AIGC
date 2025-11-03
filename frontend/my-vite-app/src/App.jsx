import React, { useState } from 'react';

function App() {
  const [image, setImage] = useState(null);
  const [imagePreview, setImagePreview] = useState('');
  const [prompt, setPrompt] = useState('');
  const [resultUrl, setResultUrl] = useState('');
  const [loading, setLoading] = useState(false);

  const handleImageChange = e => {
    const file = e.target.files[0];
    setImage(file);
    if (file) {
      setImagePreview(URL.createObjectURL(file));
    } else {
      setImagePreview('');
    }
  };
  const handlePromptChange = e => setPrompt(e.target.value);

  const handleSubmit = async e => {
    e.preventDefault();
    if (!image || !prompt) return alert('上传图片和输入提示词');
    setLoading(true);
    setResultUrl('');

    const formData = new FormData();
    formData.append('image', image);
    formData.append('prompt', prompt);

    const res = await fetch('http://localhost:5000/api/process-image', {
      method: 'POST',
      body: formData
    });
    const data = await res.json();
    setLoading(false);

    if (data.outputUrl) {
      setResultUrl(data.outputUrl);
    } else {
      alert('处理失败：' + (data.error || '未知错误'));
    }
  };

  return (
    <div
      style={{
        minHeight: '100vh',
        width: '100vw',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        paddingTop: 40,
        boxSizing: 'border-box',
        background: '#fff',
      }}
    >
      <div style={{ width: 1000, maxWidth: '98vw', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        <h2
          style={{
            textAlign: 'center',
            width: '100%',
            fontSize: 36,
            fontWeight: 700,
            marginBottom: 30
          }}
        >
          图像处理系统
        </h2>
        <form
          onSubmit={handleSubmit}
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            width: '100%'
          }}
        >
          {/* 图片选择和两个预览大区域 */}
          <div
            style={{
              display: 'flex',
              flexDirection: 'row',
              justifyContent: 'center',
              alignItems: 'flex-end',
              width: '100%',
              marginBottom: 28,
              gap: 40
            }}
          >
            {/* 左侧：未处理图片 */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <input
                type="file"
                accept="image/*"
                onChange={handleImageChange}
                style={{ marginBottom: 16 }}
              />
              <div
                style={{
                  width: 320,
                  height: 320,
                  border: '1px solid #ddd',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  background: '#fafafa',
                  marginBottom: 8
                }}
              >
                {imagePreview ? (
                  <img
                    src={imagePreview}
                    alt="原图"
                    style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }}
                  />
                ) : (
                  <span style={{ color: '#bbb', fontSize: 18 }}>未处理图片预览</span>
                )}
              </div>
              <span style={{ fontSize: 17 }}>原图</span>
            </div>
            {/* 右侧：处理后图片 */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <div
                style={{
                  width: 320,
                  height: 320,
                  border: '1px solid #ddd',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  background: '#fafafa',
                  marginBottom: 8
                }}
              >
                {resultUrl ? (
                  <img
                    src={resultUrl}
                    alt="处理结果"
                    style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }}
                  />
                ) : (
                  <span style={{ color: '#bbb', fontSize: 18 }}>处理后图片预览</span>
                )}
              </div>
              <span style={{ fontSize: 17 }}>处理后</span>
            </div>
          </div>
          {/* 多行提示词输入框 + 紧贴提交按钮 */}
          <div style={{ width: 660, maxWidth: '98vw', display: 'flex', flexDirection: 'column', alignItems: 'center', marginTop: 12 }}>
            <textarea
              placeholder="提示词"
              value={prompt}
              onChange={handlePromptChange}
              rows={3}
              style={{
                fontSize: 20,
                minHeight: 80,       // 更小的默认高度
                maxHeight: 200,
                width: 640,          // 更宽
                padding: '12px 16px',
                marginBottom: 18,
                boxSizing: 'border-box',
                resize: 'vertical',
                lineHeight: 1.6,
              }}
            />
            <button
              type="submit"
              disabled={loading}
              style={{
                fontSize: 20,
                padding: '12px 0',
                width: '100%',
                borderRadius: 5,
                border: 0,
                background: '#2563eb',
                color: '#fff',
                cursor: loading ? 'not-allowed' : 'pointer',
                marginTop: 0    // 紧贴textarea
              }}
            >
              {loading ? '处理中...' : '提交'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default App;