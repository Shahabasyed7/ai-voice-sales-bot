# LeadFlow AI — Voice Sales Bot

Autonomous real-time voice sales agent for qualifying inbound B2B prospects, handling objections, answering pricing questions, and scheduling demos or free pilots.

Operates with guaranteed zero cost using the browser's native Web Speech API and an embedded local sales rule engine, with optional Google Gemini integration for conversational speech replies and post-call CRM analysis.

## Setup & Running

1. **Install dependencies**:
   ```bash
   npm install
   ```

2. **Environment Variables (Optional)**:
   Copy `.env.example` to `.env.local` to enable Google Gemini:
   ```bash
   cp .env.example .env.local
   ```
   Configure the following variables in `.env.local`:
   - `GEMINI_API_KEY`: Your Google Gemini API key. If omitted or left empty, LeadFlow AI automatically falls back to its built-in local sales engine at zero cost.
   - `GEMINI_MODEL`: Model name override (defaults to `gemini-3.5-flash-lite`).

3. **Run Development Server**:
   ```bash
   npm run dev
   ```
   Open [http://localhost:3000](http://localhost:3000) in your browser.

4. **Production Build**:
   ```bash
   npm run build
   npm start
   ```

## Limitations & Architecture Notes

- **Per-Browser Storage**: Call history, transcripts, and audio recordings are stored locally per browser using IndexedDB. Clearing browser site data will reset stored calls.
- **Browser Compatibility**: Chrome or Edge recommended for optimal Web Speech API (SpeechRecognition and SpeechSynthesis) support.
- **Language Support & Hindi Accuracy**: Supports English (`en-US`) and Hindi (`hi-IN`). Hindi recognition accuracy varies depending on the underlying browser and operating system speech recognition engine.
- **Recording & Replay**: The saved audio recording captures the caller's microphone stream directly via MediaRecorder. During conversation replay, the caller's actual recorded microphone audio plays while Alex's turns are re-spoken synchronously using text-to-speech.
