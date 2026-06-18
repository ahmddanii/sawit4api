const Groq = require('groq-sdk');

if (!process.env.GROQ_API_KEY) {
  console.warn('[WARN] GROQ_API_KEY tidak ditemukan di environment!');
}

let groq;
try {
  if (process.env.GROQ_API_KEY) {
    groq = new Groq({
      apiKey: process.env.GROQ_API_KEY,
    });
  }
} catch (err) {
  console.error('[ERROR] Gagal inisialisasi Groq client:', err.message);
}

const MODELS = {
  reasoning: 'llama-3.3-70b-versatile',
  fast: 'llama-3.1-8b-instant',
};

const SYSTEM_MESSAGE = `Anda adalah ahli AMDAL (Analisis Dampak Lingkungan) untuk tambang batu bara KIDECO.

Aturan mutlak:
- Jawab langsung ke inti teknis, TANPA kalimat pembuka seperti "Tentu", "Baik", "Halo", dsb.
- Gunakan bahasa Indonesia yang efektif dan padat.
- Berikan solusi praktis dan actionable untuk operasional tambang.
- Jika diminta format JSON, kembalikan HANYA JSON valid tanpa markdown code block, tanpa penjelasan tambahan.
- Langsung ke data dan analisis.`;

const callGroq = async (userPrompt, modelType = 'reasoning', maxTokens = 1024) => {
  if (!groq) {
    if (process.env.GROQ_API_KEY) {
      groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
    } else {
      throw new Error('AUTH_INVALID');
    }
  }

  const model = MODELS[modelType] || MODELS.reasoning;

  try {
    const chatCompletion = await groq.chat.completions.create({
      model,
      temperature: 0.2,
      max_tokens: maxTokens,
      messages: [
        {
          role: 'system',
          content: SYSTEM_MESSAGE,
        },
        {
          role: 'user',
          content: userPrompt,
        },
      ],
    });

    return chatCompletion.choices[0]?.message?.content || '';
  } catch (error) {
    if (error?.status === 429 || error?.error?.type === 'tokens' || error?.message?.includes('rate_limit')) {
      const retryAfter = error?.headers?.['retry-after'] || 60;
      const rateLimitError = new Error('RATE_LIMIT');
      rateLimitError.retryAfter = retryAfter;
      throw rateLimitError;
    }

    if (error?.status === 401) {
      throw new Error('AUTH_INVALID');
    }

    if (error?.status === 503 || error?.status === 400) {
      throw new Error('MODEL_UNAVAILABLE');
    }

    throw error;
  }
};

const sendError = (res, statusCode, code, message, extra = {}) => {
  res.status(statusCode).json({ success: false, error: { code, message, ...extra } });
};

// 1. POST /api/ai/insight
exports.getInsight = async (req, res) => {
  const { sensorData } = req.body;
  if (!sensorData) {
    return sendError(res, 400, 'INVALID_PAYLOAD', 'Field sensorData diperlukan dalam request body.');
  }

  const { ph, tds, nodeId, status, phMin = 4.5, tdsMax = 800 } = sensorData;
  if (ph === undefined || tds === undefined || !nodeId) {
    return sendError(res, 400, 'MISSING_FIELDS', 'sensorData harus mengandung ph, tds, dan nodeId.');
  }

  const prompt = `Data sensor: Node ${nodeId}, pH ${ph} (ambang ${phMin}-9.0), TDS ${tds} ppm (maks ${tdsMax}), Status ${status}.

Buat insight 1-2 kalimat tentang kondisi air dan dampaknya ke lingkungan tambang.`;

  try {
    const result = await callGroq(prompt, 'fast', 200);
    res.json({ success: true, data: result });
  } catch (error) {
    if (error.message === 'RATE_LIMIT') {
      return sendError(res, 429, 'RATE_LIMIT_EXCEEDED',
        'Batas kecepatan Groq API tercapai. Tunggu sebentar lalu coba lagi.',
        { retryAfter: error.retryAfter }
      );
    }
    if (error.message === 'AUTH_INVALID') {
      return sendError(res, 401, 'AUTH_INVALID', 'API Key Groq tidak valid.');
    }
    sendError(res, 500, 'INTERNAL_ERROR', 'Gagal menghasilkan insight dari AI.');
  }
};

// 2. POST /api/ai/action-plan
exports.getActionPlan = async (req, res) => {
  const { sensorData } = req.body;
  if (!sensorData) {
    return sendError(res, 400, 'INVALID_PAYLOAD', 'Field sensorData diperlukan dalam request body.');
  }

  const { ph, tds, nodeId, status, phMin = 4.5, tdsMax = 800, history } = sensorData;
  if (ph === undefined || tds === undefined || !nodeId) {
    return sendError(res, 400, 'MISSING_FIELDS', 'sensorData harus mengandung ph, tds, dan nodeId.');
  }

  const historyText = Array.isArray(history) && history.length > 0
    ? history.slice(0, 5).map(h => `${h.timestamp}: pH ${h.ph}, TDS ${h.tds}ppm`).join('; ')
    : 'Tidak ada data historis';

  const prompt = `Data: Node ${nodeId}, pH ${ph} (ambang ${phMin}-9.0), TDS ${tds}ppm (maks ${tdsMax}), Status ${status}. Histori: ${historyText}.

Kembalikan HANYA JSON valid berikut (tanpa markdown, tanpa penjelasan):
{
  "masalah": "Deskripsi masalah utama",
  "data_detail": [
    {"parameter": "pH", "nilai": "${ph}", "ambang": "${phMin}-9.0", "status": "BAHAYA atau AMAN"},
    {"parameter": "TDS", "nilai": "${tds}", "ambang": "maks ${tdsMax}", "status": "BAHAYA atau AMAN"}
  ],
  "solusi": [
    {"langkah": 1, "tindakan": "Judul tindakan", "detail": "Detail teknis", "alasan": "Alasan teknis"}
  ],
  "dampak": "Dampak lingkungan jika tidak ditindaklanjuti"
}

Berikan minimal 3-4 solusi realistis mencakup: tindakan darurat, penanganan teknis, pencegahan jangka panjang, dan pelaporan.`;

  try {
    const result = await callGroq(prompt, 'reasoning', 1500);

    const cleaned = result
      .replace(/```json\n?/g, '')
      .replace(/```\n?/g, '')
      .trim();

    const parsed = JSON.parse(cleaned);
    res.json({ success: true, data: parsed });
  } catch (error) {
    if (error.message === 'RATE_LIMIT') {
      return sendError(res, 429, 'RATE_LIMIT_EXCEEDED',
        'Batas kecepatan Groq API tercapai. Tunggu sebentar lalu coba lagi.',
        { retryAfter: error.retryAfter }
      );
    }
    if (error.message === 'AUTH_INVALID') {
      return sendError(res, 401, 'AUTH_INVALID', 'API Key Groq tidak valid.');
    }
    if (error instanceof SyntaxError) {
      return sendError(res, 502, 'INVALID_AI_RESPONSE', 'AI mengembalikan format yang tidak valid.');
    }
    sendError(res, 500, 'INTERNAL_ERROR', 'Gagal menghasilkan rencana tindakan dari AI.');
  }
};
