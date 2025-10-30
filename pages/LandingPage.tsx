
import React, { useContext } from 'react';
import Button from '../components/Button';
import { AppContext } from '../App';
import { CHAT_ICON, JOB_ICON, SCHOOL_ICON } from '../constants';

const FeatureCard: React.FC<{ icon: React.ReactNode; title: string; description: string }> = ({ icon, title, description }) => (
  <div className="bg-gray-800 bg-opacity-50 p-6 rounded-xl shadow-lg backdrop-blur-sm border border-gray-700">
    <div className="flex items-center justify-center h-12 w-12 rounded-full bg-purple-600 bg-opacity-50 mb-4">
      {icon}
    </div>
    <h3 className="text-xl font-bold mb-2">{title}</h3>
    <p className="text-gray-400">{description}</p>
  </div>
);

const LandingPage: React.FC = () => {
  const { navigateTo } = useContext(AppContext);

  return (
    <div className="relative min-h-screen overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-br from-gray-900 via-purple-900/40 to-blue-900/30"></div>
      <div className="absolute top-0 left-0 w-72 h-72 bg-purple-600 rounded-full filter blur-3xl opacity-20 animate-blob"></div>
      <div className="absolute top-0 right-0 w-72 h-72 bg-blue-500 rounded-full filter blur-3xl opacity-20 animate-blob animation-delay-2000"></div>
      <div className="absolute bottom-0 left-1/4 w-72 h-72 bg-pink-500 rounded-full filter blur-3xl opacity-20 animate-blob animation-delay-4000"></div>
      
      <main className="relative z-10 container mx-auto px-6 py-24 text-center">
        <h1 className="text-5xl md:text-7xl font-extrabold mb-4 bg-clip-text text-transparent bg-gradient-to-r from-purple-400 to-blue-400">
          Sentio AI Interview Coach
        </h1>
        <p className="text-lg md:text-xl text-gray-300 max-w-3xl mx-auto mb-8">
          Master your interviews with AI-powered simulations, real-time feedback on your speech, voice, and facial expressions.
        </p>
        <Button onClick={() => navigateTo('auth')} className="text-lg">
          Get Started For Free
        </Button>

        <section id="features" className="mt-24">
          <h2 className="text-3xl font-bold mb-12">How It Works</h2>
          <div className="grid md:grid-cols-3 gap-8 max-w-6xl mx-auto">
            <FeatureCard
              icon={JOB_ICON}
              title="Choose Your Scenario"
              description="Select from job interviews, school admissions, or casual chats to tailor your practice session."
            />
            <FeatureCard
              icon={CHAT_ICON}
              title="Interact with AI"
              description="Engage in a realistic conversation with our intelligent AI interviewer that adapts to your responses."
            />
            <FeatureCard
              icon={SCHOOL_ICON}
              title="Receive Instant Feedback"
              description="Get a detailed report on your performance, including scores on clarity, confidence, and engagement."
            />
          </div>
        </section>
        
        <section id="future-features" className="mt-24 max-w-3xl mx-auto text-left">
            <h2 className="text-3xl font-bold mb-6 text-center">Future Enhancements</h2>
            <ul className="list-disc list-inside space-y-2 text-gray-300 bg-gray-800 bg-opacity-50 p-6 rounded-xl">
                <li><span className="font-semibold">Custom Interview Scripts:</span> Upload a job description to generate a hyper-specific mock interview.</li>
                <li><span className="font-semibold">Voice Tonality Analysis:</span> Deeper analysis of vocal tone to detect sarcasm, enthusiasm, and stress levels.</li>
                <li><span className="font-semibold">Peer Review Mode:</span> Share your recorded interview with mentors or friends for human feedback.</li>
                <li><span className="font-semibold">Historical Progress Tracking:</span> Visualize your improvement over time with detailed charts and graphs.</li>
            </ul>
        </section>

      </main>
    </div>
  );
};

export default LandingPage;
