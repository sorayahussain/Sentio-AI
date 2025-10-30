# Sentio AI Interview Coach

Sentio is an intelligent, AI-powered interview preparation platform that helps users practice and improve their interview skills through realistic simulations and comprehensive multi-modal feedback.

![Sentio AI Screenshot](https://storage.googleapis.com/aistudio-ux-team-public/sdk_gallery/demos/sentio.png)

## ✨ Features

- **Realistic AI Simulations:** Engage in dynamic conversations with an AI interviewer powered by the Google Gemini API.
- **Multiple Scenarios:** Practice for different contexts, including professional job interviews, school admissions, and casual conversations.
- **Multi-Modal Feedback:** Receive a detailed performance report analyzing not just what you say, but how you say it.
- **Real-time Emotion Analysis:** Using your webcam, Sentio analyzes your facial expressions to provide feedback on confidence and engagement.
- **Speech-to-Text:** Your answers are transcribed in real-time.
- **Text-to-Speech:** The AI interviewer's questions are spoken aloud for a more immersive experience.
- **Comprehensive Reports:** Get scores on clarity, confidence, engagement, and answer quality, along with AI-generated strengths and areas for improvement.
- **Interview History:** Track your progress over time by reviewing past interview reports.
- **Secure Authentication:** User accounts and data are managed securely with Firebase Authentication and Firestore.

## 🛠️ Tech Stack

- **Frontend:** React, TypeScript, Tailwind CSS
- **AI & ML:** Google Gemini API (for conversational AI and TTS), face-api.js (for facial expression analysis)
- **Backend & Database:** Firebase (Authentication, Firestore)
- **UI Components:** Recharts (for data visualization)

## 🚀 Getting Started

Follow these instructions to get a copy of the project up and running on your local machine for development and testing purposes.

### Prerequisites

- [Node.js](https://nodejs.org/) (v18 or later recommended)
- [npm](https://www.npmjs.com/) or [yarn](https://yarnpkg.com/)
- A [Google Cloud project](https://cloud.google.com/resource-manager/docs/creating-managing-projects) with the Gemini API enabled.
- A [Firebase project](https://firebase.google.com/docs/web/setup).

### Installation & Setup

1.  **Clone the repository:**
    ```bash
    git clone https://github.com/your-username/sentio-ai-coach.git
    cd sentio-ai-coach
    ```

2.  **Install dependencies:**
    ```bash
    npm install
    ```

3.  **Set up Firebase:**
    *   Go to your [Firebase Console](https://console.firebase.google.com/), create a new project.
    *   Add a new Web App to your project.
    *   Copy the `firebaseConfig` object from the setup screen.
    *   Paste your configuration into `firebase.ts`, replacing the placeholder config.
    *   In the Firebase console, go to **Authentication** -> **Sign-in method** and enable the **Email/Password** provider.
    *   Go to **Firestore Database**, create a database in production mode, and then navigate to the **Rules** tab.
    *   Replace the default rules with the following to allow users to access their own data:
        ```
        rules_version = '2';
        service cloud.firestore {
          match /databases/{database}/documents {
            match /users/{userId}/{documents=**} {
              allow read, write: if request.auth != null && request.auth.uid == userId;
            }
          }
        }
        ```

4.  **Set up Google Gemini API Key:**
    *   Go to [Google AI Studio](https://aistudio.google.com/) and create an API key.
    *   The application is configured to read the API key from `process.env.API_KEY`. You will need to set up your environment to provide this key. For local development, you can create a `.env.local` file in the root of the project:
        ```
        API_KEY=YOUR_GEMINI_API_KEY
        ```
    *   *Note: Ensure your development environment (e.g., Vite, Create React App) is configured to load environment variables.*

5.  **Run the application:**
    ```bash
    npm run dev
    ```
    Open your browser and navigate to the local server address provided (usually `http://localhost:5173`).

## 🔮 Future Enhancements

-   **Custom Interview Scripts:** Upload a job description to generate a hyper-specific mock interview.
-   **Voice Tonality Analysis:** Deeper analysis of vocal tone to detect sarcasm, enthusiasm, and stress levels.
-   **Peer Review Mode:** Share your recorded interview with mentors or friends for human feedback.
-   **Multi-language Support:** Practice interviews in different languages.
-   **Historical Progress Tracking:** Visualize your improvement over time with detailed charts and graphs.

## 📄 License

This project is licensed under the MIT License - see the `LICENSE.md` file for details.
