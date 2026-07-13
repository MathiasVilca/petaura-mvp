import { useState, useRef } from 'react';

export default function PhotoAnalysisMenu({ petProfile, onAnalyzePhoto, isAnalyzing, isOpen }) {
  const [previewUrl, setPreviewUrl] = useState(null);
  const [imageBase64, setImageBase64] = useState(null);
  const [contextText, setContextText] = useState('');
  const fileInputRef = useRef(null);

  const compressImage = (file) =>
    new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          const MAX_SIZE = 800;
          let { width, height } = img;
          if (width > height && width > MAX_SIZE) {
            height = Math.round((height * MAX_SIZE) / width);
            width = MAX_SIZE;
          } else if (height > MAX_SIZE) {
            width = Math.round((width * MAX_SIZE) / height);
            height = MAX_SIZE;
          }
          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;
          canvas.getContext('2d').drawImage(img, 0, 0, width, height);

          // canvas.toDataURL devuelve "data:image/jpeg;base64,/9j/..."
          // El backend necesita solo "/9j/..." — el prefijo lo construye él mismo
          const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
          resolve({ base64Pure: dataUrl.split(',')[1], previewUrl: dataUrl });
        };
        img.src = e.target.result;
      };
      reader.readAsDataURL(file);
    });

  const handleFileChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const { base64Pure, previewUrl } = await compressImage(file);
    setImageBase64(base64Pure);
    setPreviewUrl(previewUrl);
  };

  const handleAnalyze = () => {
    if (!imageBase64 || isAnalyzing) return;
    onAnalyzePhoto(imageBase64, 'image/jpeg', contextText);
  };

  const handleReset = () => {
    setPreviewUrl(null);
    setImageBase64(null);
    setContextText('');
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  return (
    <div>
      {isOpen && (
        <div style={s.body}>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            onChange={handleFileChange}
            style={{ display: 'none' }}
            id="photo-input"
          />

          {!previewUrl ? (
            <label htmlFor="photo-input" style={s.uploadLabel}>
              📷 Tomar foto o elegir de galería
            </label>
          ) : (
            <div style={s.previewWrap}>
              <img src={previewUrl} alt="Vista previa" style={s.preview} />
              <button onClick={handleReset} style={s.resetBtn}>
                Cambiar foto
              </button>
            </div>
          )}

          <textarea
            value={contextText}
            onChange={(e) => setContextText(e.target.value)}
            placeholder="¿Qué estaba pasando en ese momento? (opcional)"
            style={s.textarea}
          />

          <button
            className="state-button calm"
            onClick={handleAnalyze}
            disabled={!imageBase64 || isAnalyzing}
            style={{ justifyContent: 'center', opacity: !imageBase64 ? 0.45 : 1 }}
          >
            {isAnalyzing ? 'Analizando...' : 'Analizar foto'}
          </button>
        </div>
      )}
    </div>
  );
}

const s = {
  body: {
    marginTop: '.75rem',
    display: 'grid',
    gap: '.75rem',
  },
  uploadLabel: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 48,
    borderRadius: 14,
    border: '1px dashed rgba(148,163,184,.35)',
    background: 'rgba(15,23,42,.6)',
    color: '#8899b0',
    fontSize: '.9rem',
    cursor: 'pointer',
    gap: '.5rem',
  },
  previewWrap: {
    display: 'flex',
    flexDirection: 'column',
    gap: '.5rem',
  },
  preview: {
    width: '100%',
    maxHeight: 200,
    objectFit: 'cover',
    borderRadius: 12,
    border: '1px solid rgba(148,163,184,.2)',
  },
  resetBtn: {
    alignSelf: 'flex-end',
    background: 'transparent',
    border: '1px solid rgba(148,163,184,.25)',
    borderRadius: 10,
    color: '#8899b0',
    fontSize: '.8rem',
    padding: '.35rem .85rem',
    cursor: 'pointer',
    minHeight: 48,
  },
  textarea: {
    width: '100%',
    minHeight: 72,
    borderRadius: 14,
    border: '1px solid rgba(148,163,184,.25)',
    padding: '.85rem',
    background: 'rgba(15,23,42,.9)',
    color: 'white',
    resize: 'vertical',
    boxSizing: 'border-box',
    fontSize: '.9rem',
  },
};
