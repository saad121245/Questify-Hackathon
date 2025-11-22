import { useState } from 'react';
import './App.css';

const MODEL_OPTIONS = [
  { value: 'models/gemini-2.5-flash', label: 'Questify Beta X' },
  { value: 'models/gemini-2.5-pro', label: 'Questify Pro' },
  { value: 'model/gemini-2.0-flash', label: 'Questify 2.0'},
];

const DIFFICULTY_OPTIONS = [
  { value: 'easy', label: 'Easy' },
  { value: 'medium', label: 'Medium' },
  { value: 'hard', label: 'Hard' },
];

const FORMAT_OPTIONS = [
  { value: 'mcq', label: 'Multiple Choice' },
  { value: 'short', label: 'Short Answer' },
  { value: 'long', label: 'Long Answer' },
];

function App() {
  const [difficulty, setDifficulty] = useState('medium');
  const [format, setFormat] = useState('mcq');
  const [questionCount, setQuestionCount] = useState(5);
  const [textInput, setTextInput] = useState('');
  const [model, setModel] = useState(MODEL_OPTIONS[0].value);
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState(null);

  const handleFileChange = (event) => {
    const files = event.target.files ? Array.from(event.target.files) : [];
    setSelectedFiles(files);
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');
    setResult(null);

    if (!textInput && selectedFiles.length === 0) {
      setError('Please paste material text or upload at least one file.');
      return;
    }

    setIsLoading(true);

    try {
      const formData = new FormData();
      formData.append('difficulty', difficulty);
      formData.append('format', format);
      formData.append('model', model);
      formData.append('questionCount', questionCount);
      formData.append('textInput', textInput);
      selectedFiles.forEach((file) => formData.append('files', file));

      const response = await fetch('https://hackathon1-hg60.onrender.com/api/generate', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const errorPayload = await response.json().catch(() => ({ error: 'Unknown server error.' }));
        throw new Error(errorPayload.error || 'Failed to generate questions.');
      }

      const payload = await response.json();
      setResult(payload);
    } catch (err) {
      setError(err.message || 'Unexpected error.');
    } finally {
      setIsLoading(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="app-container">
      <header>
        <h1>Questify Question Builder</h1>
        <p>Transform course materials into ready-to-use assessments powered by Questify.</p>
      </header>

      <main>
        <section className="panel">
          <h2>1. Provide your material</h2>
          <form onSubmit={handleSubmit}>
            <label className="field">
              <span>Paste course material (optional)</span>
              <textarea
                value={textInput}
                onChange={(event) => setTextInput(event.target.value)}
                placeholder="Paste relevant sections from your syllabus, lecture notes, or textbook."
                rows={8}
              />
            </label>

            <label className="field">
              <span>Upload files (PDF or text)</span>
              <input type="file" multiple accept=".pdf,.txt,.md,.csv,.json,text/plain,application/pdf" onChange={handleFileChange} />
              {selectedFiles.length > 0 && (
                <small>{selectedFiles.length} file(s) selected: {selectedFiles.map((file) => file.name).join(', ')}</small>
              )}
            </label>

            <div className="field-group">
              <label className="field">
                <span>Difficulty</span>
                <select value={difficulty} onChange={(event) => setDifficulty(event.target.value)}>
                  {DIFFICULTY_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>

              <label className="field">
                <span>Question type</span>
                <select value={format} onChange={(event) => setFormat(event.target.value)}>
                  {FORMAT_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>

              <label className="field">
                <span>Amount</span>
                <input
                  type="number"
                  min="1"
                  max="15"
                  value={questionCount}
                  onChange={(event) => setQuestionCount(event.target.value)}
                />
              </label>
            </div>

            <label className="field">
              <span>Questify model</span>
              <select value={model} onChange={(event) => setModel(event.target.value)}>
                {MODEL_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>

            <button type="submit" disabled={isLoading}>
              {isLoading ? 'Generating…' : 'Generate questions'}
            </button>
          </form>

          {error && <p className="error">{error}</p>}
        </section>

        <section className="panel">
          <div className="panel-header">
          <h2>Generated Result</h2>
          {result && (
              <button className="print-button" onClick={handlePrint} title="Print questions">
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="6 9 6 2 18 2 18 9"></polyline>
                  <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"></path>
                  <rect x="6" y="14" width="12" height="8"></rect>
                </svg>
                Print
              </button>
            )}
          </div>
          {!result && <p className="placeholder">Run a generation to preview questions here.</p>}
          {result && (
            <div className="results">
            <div className="print-only-header">
                <h1>Course Assessment Questions</h1>
                <div className="print-meta">
                  <p><strong>Model:</strong> Questify</p>
                  <p><strong>Difficulty:</strong> {result.difficulty}</p>
                  <p><strong>Type:</strong> {result.format}</p>
                  <p><strong>Total Questions:</strong> {result.questions.length}</p>
                  <p><strong>Generated:</strong> {new Date().toLocaleDateString()}</p>
                </div>
              </div>
              
              <div className="meta screen-only">
                <p>
                  Model: <strong>Questify</strong>
                </p>
                <p>
                  Difficulty: <strong>{result.difficulty}</strong> · Type: <strong>{result.format}</strong>
                </p>
                {result.questionCount && (
                  <p>
                    Requested question count: <strong>{result.questionCount}</strong>
                  </p>
                )}
              </div>

              <ol className="question-list">
                {result.questions.map((question, index) => (
                  <li key={`${question.prompt}-${index}`}>
                    <h3>{question.prompt}</h3>
                    <p className="tag-row screen-only">
                      <span className="tag">Type: {question.type}</span>
                      <span className="tag">Difficulty: {question.difficulty}</span>
                    </p>
                    {Array.isArray(question.options) && question.options.length > 0 && (
                      <ul className="options">
                        {question.options.map((option, optionIndex) => (
                          <li key={optionIndex}>{option}</li>
                        ))}
                      </ul>
                    )}
                    <details>
                      <summary>Answer key</summary>
                      <p>{question.answer}</p>
                    </details>
                  </li>
                ))}
              </ol>

            </div>
          )}
        </section>
      </main>

      <footer>
        <p>
          © 2025 Questify Inc. All rights reserved.
        </p>
      </footer>
    </div>
  );
}

export default App;
