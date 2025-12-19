# 🎙️ Sentio AI Interview Coach

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Gemini](https://img.shields.io/badge/Model-Gemini%203%20Pro-blueviolet)](https://ai.google.dev/)
[![React](https://img.shields.io/badge/Frontend-React%2019-blue)](https://react.dev/)
[![Firebase](https://img.shields.io/badge/Backend-Firebase-orange)](https://firebase.google.com/)

**Sentio** is an intelligent, high-fidelity interview preparation platform. It leverages the cutting-edge reasoning capabilities of **Google Gemini 3 Pro** and real-time biometric analysis via **face-api.js** to transform your webcam into a world-class career coach.

---

## ✨ Why Sentio?

Unlike static question banks, Sentio provides a dynamic, immersive simulation that analyzes not just *what* you say, but *how* you say it.

-   **🧠 Adaptive Reasoning:** Powered by Gemini 3 Pro, the interviewer dynamically adjusts its questioning based on your specific background and previous answers.
-   **🎭 Emotional Intelligence:** Real-time facial expression tracking detects confidence, stress, and engagement levels.
-   **🗣️ Natural Interaction:** Low-latency Text-to-Speech (TTS) via Gemini 2.5 Flash creates a conversational flow that feels human.
-   **📊 The STAR Evaluation:** Receive a granular performance report scoring your clarity, confidence, and adherence to the Situation-Task-Action-Result (STAR) framework.

---

## 🛠️ Tech Stack

-   **LLM Core:** `@google/genai` (Gemini 3 Pro for logic, Gemini 2.5 Flash for TTS).
-   **Computer Vision:** `face-api.js` (TinyFaceDetector, FaceExpressionNet).
-   **Frontend:** React 19, TypeScript, Tailwind CSS, Recharts.
-   **Backend-as-a-Service:** Firebase Auth (Identity), Firestore (Persistence).
-   **Reporting:** jsPDF & html2canvas for high-resolution report exports.

---

## 🏗️ Architecture: The 5-Turn Blueprint

Sentio doesn't just ask random questions. Every session follows a sophisticated **5-Turn Blueprint** designed to mimic real-world interview progression:

1.  **The Opening:** High-level interest and alignment check.
2.  **Competency Deep-Dive:** Technical or academic skill validation (extracted from your PDF/Link).
3.  **Behavioral STAR:** Probing your soft skills through situational challenges.
4.  **Vision & Growth:** Testing your long-term roadmap and adaptability.
5.  **Synthesis/Curveball:** A unique closing question that tests critical thinking under pressure.

---

## 🚀 Getting Started

### 1. Prerequisites
- A **Google Gemini API Key** from [Google AI Studio](https://aistudio.google.com/).
- A **Firebase Project** for user authentication and history storage.

### 2. Environment Configuration
The application expects your Gemini API key in the environment.
```bash
# In your local environment or .env file
API_KEY=your_gemini_api_key_here
```

### 3. Firebase Setup
Paste your `firebaseConfig` into `src/firebase.ts`. Then, configure your **Firestore Security Rules** to ensure data privacy:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /users/{userId}/{documents=**} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
  }
}
```

### 4. Installation
```bash
npm install
npm run dev
```

---

## 🛡️ Safety & Privacy

-   **Data Sovereignty:** Your interview recordings and transcripts are stored exclusively in your own Firebase project.
-   **AI Safety:** We implement `BLOCK_ONLY_HIGH` safety thresholds via the Gemini API to ensure a professional environment while allowing for rigorous, high-stakes questioning.
-   **On-Device Analysis:** Facial expression analysis is performed locally in your browser using `face-api.js`. No raw video data is ever sent to external servers.

---

## 🔮 Future Roadmap

-   **Custom Personality Profiles:** Practice against "The Skeptic," "The Encourager," or "The Executive."
-   **Vocal Tonality Analysis:** Integration of Gemini's native audio modalities for sarcasm and stress detection in voice.
-   **Peer Comparison:** Anonymized benchmarking against industry standards for specific roles.

---

## 📄 License

Distributed under the MIT License. See `LICENSE` for more information.

---

<p align="center">
  Built with ❤️ by the Sentio Team.
</p>
