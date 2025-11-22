require('dotenv').config();
const express = require('express');
const cors = require('cors');
const multer = require('multer');
const { extractTextFromFile } = require('./utils/textExtractor');

const fetch = (...args) => import('node-fetch').then(({ default: fetchFn }) => fetchFn(...args));

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    files: 5,
    fileSize: 12 * 1024 * 1024, // 12MB per file keeps request sizes reasonable
  },
});

const app = express();
const PORT = process.env.PORT || 5000;
const CLIENT_ORIGIN = process.env.CLIENT_ORIGIN;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

const ALLOWED_MODELS = [
  'models/gemini-2.5-pro',
  'models/gemini-2.5-pro-preview-06-05',
  'models/gemini-2.5-pro-preview-05-06',
  'models/gemini-2.5-pro-preview-03-25',
  'models/gemini-2.5-flash',
  'models/gemini-2.5-flash-preview-09-2025',
  'models/gemini-2.5-flash-lite',
  'models/gemini-2.5-flash-lite-preview-09-2025',
  'models/gemini-flash-latest',
  'models/gemini-flash-lite-latest',
  'models/gemini-pro-latest',
  'models/gemini-2.0-flash',
  'models/gemini-2.0-flash-001',
  'models/gemini-2.0-flash-exp',
  'models/gemini-2.0-flash-lite',
  'models/gemini-2.0-flash-lite-001',
  'models/gemini-2.0-flash-lite-preview-02-05',
  'models/gemini-2.0-flash-thinking-exp',
  'models/gemini-2.0-flash-thinking-exp-01-21',
  'models/gemini-2.0-flash-thinking-exp-1219',
  'models/gemini-2.0-pro-exp',
  'models/gemini-2.0-pro-exp-02-05',
  'models/gemini-3-pro-preview',
];

if (!GEMINI_API_KEY) {
  console.warn('Warning: GEMINI_API_KEY is not set. The generation endpoint will fail until it is configured.');
}

app.use(cors({
  origin: CLIENT_ORIGIN ? [CLIENT_ORIGIN] : '*',
}));
app.use(express.json({ limit: '2mb' }));

app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

const TRUNCATE_LIMIT = 16000;

const formatDescription = {
  mcq: 'Return multiple-choice questions with four options labeled A–D. Provide the correct answer key with explanations.',
  short: 'Return short-answer questions that can be answered in two to three sentences. Supply concise sample answers.',
  long: 'Return long-form prompts that require analytical or essay-style responses. Supply structured sample outlines or rubric points.',
};

const difficultyDescription = {
  easy: 'Focus on foundational recall and introductory understanding.',
  medium: 'Balance recall with application and short analysis tasks.',
  hard: 'Emphasize critical thinking, synthesis, and problem solving at an advanced level.',
};

const QUESTION_SCHEMA = {
  type: 'object',
  properties: {
    questions: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          prompt: { type: 'string' },
          type: { type: 'string', enum: ['mcq', 'short', 'long'] },
          difficulty: { type: 'string', enum: ['easy', 'medium', 'hard'] },
          answer: { type: 'string' },
          options: {
            type: 'array',
            items: { type: 'string' },
          },
        },
        required: ['prompt', 'type', 'difficulty', 'answer'],
      },
    },
  },
  required: ['questions'],
};

function buildPrompt({ difficulty, format, questionCount, material }) {
  const formatHint = formatDescription[format] || formatDescription.mcq;
  const difficultyHint = difficultyDescription[difficulty] || difficultyDescription.medium;
  const countHint = questionCount ? `${questionCount} high-quality questions` : 'a clear, well-structured set of high-quality questions';

  return (
    `You are an expert instructional designer helping teachers craft assessments.\n\n` +
    `${difficultyHint}\n` +
    `${formatHint}\n` +
    `Create ${countHint} based strictly on the provided course material.\n` +
    `For each question include:\n` +
    `- "prompt": the question or task.\n` +
    `- "type": one of ["mcq", "short", "long"].\n` +
    `- "difficulty": one of ["easy", "medium", "hard"].\n` +
    `- "answer": the teacher-facing answer key or rubric guidance.\n` +
    `- "options": include only when type is "mcq"; provide an array of answer choices.\n\n` +
    `Respond with valid JSON only, no markdown, using this exact template:\n` +
    `{"questions":[{"prompt":"...","type":"...","difficulty":"...","answer":"...","options":["..."]}]}.\n` +
    `The "options" array is required only for multiple-choice questions; otherwise set it to an empty array. Do not add any extra fields.\n\n` +
    `Course material:\n${material}`
  );
}

function sanitizeModel(rawModel) {
  if (!rawModel) {
    return ALLOWED_MODELS[0];
  }
  const candidate = rawModel.startsWith('models/') ? rawModel : `models/${rawModel}`;
  if (!ALLOWED_MODELS.includes(candidate)) {
    throw new Error('Selected model is not in the approved allow list.');
  }
  return candidate;
}

async function callGemini(model, prompt) {
  if (!GEMINI_API_KEY) {
    throw new Error('Gemini API key is not configured on the server.');
  }

  const url = `https://generativelanguage.googleapis.com/v1beta/${model}:generateContent?key=${GEMINI_API_KEY}`;
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      contents: [
        {
          role: 'user',
          parts: [{ text: prompt }],
        },
      ],
      generationConfig: {
        temperature: 0.7,
        maxOutputTokens: 2048,
        responseMimeType: 'application/json',
        responseSchema: QUESTION_SCHEMA,
      },
    }),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`Gemini API error (${response.status}): ${errorBody}`);
  }

  const data = await response.json();
  if (data?.promptFeedback?.blockReason) {
    const reason = data.promptFeedback.blockReason;
    throw new Error(`Gemini blocked the prompt: ${reason}.`);
  }

  const parts = data?.candidates?.[0]?.content?.parts || [];
  const firstTextPart = parts.find((part) => typeof part.text === 'string');

  if (!firstTextPart || !firstTextPart.text) {
    throw new Error('Gemini API returned an empty response.');
  }

  return firstTextPart.text.trim();
}

app.post('/api/generate', upload.array('files', 5), async (req, res) => {
  try {
    const { difficulty = 'medium', format = 'mcq', model, questionCount: rawQuestionCount, textInput = '' } = req.body;

    const questionCount = rawQuestionCount ? Number(rawQuestionCount) : undefined;
    if (rawQuestionCount && Number.isNaN(questionCount)) {
      return res.status(400).json({ error: 'Question count must be a number.' });
    }

    const selectedModel = sanitizeModel(model);

    const collectedTexts = [];
    if (textInput) {
      collectedTexts.push(textInput);
    }

    if (req.files && req.files.length > 0) {
      for (const file of req.files) {
        const extracted = await extractTextFromFile(file);
        collectedTexts.push(extracted);
      }
    }

    if (collectedTexts.length === 0) {
      return res.status(400).json({ error: 'Please provide either text input or at least one supported file.' });
    }

    const combined = collectedTexts.join('\n\n');
    const material = combined.length > TRUNCATE_LIMIT
      ? `${combined.slice(0, TRUNCATE_LIMIT)}\n...[truncated for token limit]`
      : combined;

    const prompt = buildPrompt({ difficulty, format, questionCount, material });
    const llmResponse = await callGemini(selectedModel, prompt);

    let json;
    try {
      json = JSON.parse(llmResponse);
    } catch (parseError) {
      return res.status(502).json({
        error: 'The model returned an unexpected format. Please try again or adjust the prompt.',
        raw: llmResponse,
      });
    }

    res.json({
      model: selectedModel,
      difficulty,
      format,
      questionCount: questionCount || null,
      materialLength: combined.length,
      questions: json.questions || [],
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: error.message || 'Unexpected server error.' });
  }
});

app.listen(PORT, () => {
  console.log(`Question generator API listening on port ${PORT}`);
});
