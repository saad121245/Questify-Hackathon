const pdfParse = require('pdf-parse');
const path = require('path');

const SUPPORTED_TEXT_EXTENSIONS = new Set(['.txt', '.md', '.csv', '.json']);

/**
 * Extracts readable text from the uploaded file buffer.
 * Currently supports PDF and plain-text formats.
 */
async function extractTextFromFile(file) {
  const { buffer, mimetype, originalname } = file;

  if (!buffer || buffer.length === 0) {
    return '';
  }

  const ext = path.extname(originalname || '').toLowerCase();

  if (mimetype === 'application/pdf' || ext === '.pdf') {
    const { text } = await pdfParse(buffer);
    return text;
  }

  if (mimetype.startsWith('text/') || SUPPORTED_TEXT_EXTENSIONS.has(ext)) {
    return buffer.toString('utf8');
  }

  throw new Error(`Unsupported file type: ${originalname || mimetype}`);
}

module.exports = {
  extractTextFromFile,
};
