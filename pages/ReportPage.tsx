

import React, { useContext } from 'react';
import { AppContext } from '../App';
import { InterviewResult, EmotionData } from '../types';
import Button from '../components/Button';
import { PieChart, Pie, Cell, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Legend, Sector } from 'recharts';

interface ReportPageProps {
  result: InterviewResult;
}

const ScoreCard: React.FC<{ title: string; score: number }> = ({ title, score }) => {
    const color = score > 7 ? 'text-green-400' : score > 4 ? 'text-yellow-400' : 'text-red-400';
    return (
        <div className="bg-gray-800 p-4 rounded-lg text-center">
            <p className="text-gray-400 text-sm">{title}</p>
            <p className={`text-4xl font-bold ${color}`}>{score}<span className="text-lg">/10</span></p>
        </div>
    )
};

const ReportPage: React.FC<ReportPageProps> = ({ result }) => {
  const { navigateTo } = useContext(AppContext);
  const { feedback, interviewType, log } = result;

  const scoreData = [
    { name: 'Clarity', score: feedback.clarity },
    { name: 'Confidence', score: feedback.confidence },
    { name: 'Engagement', score: feedback.engagement },
    { name: 'Answer Quality', score: feedback.answerQuality },
  ];

  // Calculate overall emotion distribution
  const allEmotionSnapshots = log.flatMap(turn => turn.emotionData || []);
  const emotionDistribution = allEmotionSnapshots.length > 0 ? Object.keys(allEmotionSnapshots[0]).map(key => {
    const total = allEmotionSnapshots.reduce((acc, snapshot) => acc + (snapshot as any)[key], 0);
    return { name: key, value: total / allEmotionSnapshots.length };
  }).filter(item => item.value > 0.05) : []; // Filter out minor emotions for a cleaner chart

  const PIE_COLORS = ['#8884d8', '#82ca9d', '#ffc658', '#ff8042', '#0088fe', '#00c49f', '#ffbb28'];
  
  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-900 to-purple-900/30 p-4 sm:p-6 md:p-8">
      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-blue-400">
            Interview Performance Report
          </h1>
          <p className="text-gray-400 mt-2">Here's the breakdown of your {interviewType} interview session.</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column: Scores and Feedback */}
          <div className="lg:col-span-2 flex flex-col gap-6">
            <div className="bg-gray-800/50 border border-gray-700 rounded-xl p-6">
              <h2 className="text-xl font-bold mb-4">Performance Scores</h2>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <ScoreCard title="Clarity" score={feedback.clarity} />
                <ScoreCard title="Confidence" score={feedback.confidence} />
                <ScoreCard title="Engagement" score={feedback.engagement} />
                <ScoreCard title="Answer Quality" score={feedback.answerQuality} />
              </div>
            </div>

            <div className="bg-gray-800/50 border border-gray-700 rounded-xl p-6">
                <h2 className="text-xl font-bold mb-4">AI Coach Feedback</h2>
                <div className="space-y-6">
                    <div>
                        <h3 className="font-semibold text-purple-300 mb-2">Overall Summary</h3>
                        <p className="text-gray-300">{feedback.overallFeedback}</p>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                            <h3 className="font-semibold text-green-400 mb-2">Strengths</h3>
                            <ul className="list-disc list-inside space-y-1 text-gray-300">
                                {feedback.strengths.map((s, i) => <li key={i}>{s}</li>)}
                            </ul>
                        </div>
                        <div>
                            <h3 className="font-semibold text-yellow-400 mb-2">Areas for Improvement</h3>
                            <ul className="list-disc list-inside space-y-1 text-gray-300">
                                {feedback.areasForImprovement.map((a, i) => <li key={i}>{a}</li>)}
                            </ul>
                        </div>
                    </div>
                </div>
            </div>
            
            <div className="bg-gray-800/50 border border-gray-700 rounded-xl p-6">
                 <h2 className="text-xl font-bold mb-4">Interview Transcript</h2>
                 <div className="space-y-4 max-h-96 overflow-y-auto pr-2">
                    {log.map((turn, index) => (
                        <div key={index} className="p-3 bg-gray-700/50 rounded-lg">
                            <p className="font-semibold text-purple-300">Q: {turn.question}</p>
                            <p className="text-gray-300 mt-1">A: {turn.answer}</p>
                        </div>
                    ))}
                 </div>
            </div>
          </div>
          
          {/* Right Column: Charts */}
          <div className="flex flex-col gap-6">
             <div className="bg-gray-800/50 border border-gray-700 rounded-xl p-6">
                <h2 className="text-xl font-bold mb-4 text-center">Score Breakdown</h2>
                <ResponsiveContainer width="100%" height={250}>
                    <BarChart data={scoreData} layout="vertical" margin={{ top: 5, right: 20, left: 20, bottom: 5 }}>
                        <XAxis type="number" domain={[0, 10]} hide />
                        <YAxis type="category" dataKey="name" width={100} stroke="#9CA3AF" tick={{ fill: '#D1D5DB' }} />
                        <Tooltip cursor={{fill: 'rgba(139, 92, 246, 0.1)'}} contentStyle={{ backgroundColor: '#1F2937', border: '1px solid #4B5563' }} />
                        <Bar dataKey="score" barSize={20}>
                           {scoreData.map((entry) => (
                             <Cell key={`cell-${entry.name}`} fill={entry.score > 7 ? '#4ADE80' : entry.score > 4 ? '#FACC15' : '#F87171'} />
                           ))}
                        </Bar>
                    </BarChart>
                </ResponsiveContainer>
            </div>
            {emotionDistribution.length > 0 && (
                 <div className="bg-gray-800/50 border border-gray-700 rounded-xl p-6">
                    <h2 className="text-xl font-bold mb-4 text-center">Emotion Distribution</h2>
                    <ResponsiveContainer width="100%" height={250}>
                        <PieChart>
                            <Pie
                                data={emotionDistribution}
                                cx="50%"
                                cy="50%"
                                labelLine={false}
                                outerRadius={80}
                                fill="#8884d8"
                                dataKey="value"
                                label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                            >
                                {emotionDistribution.map((entry, index) => (
                                    <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                                ))}
                            </Pie>
                            <Tooltip cursor={{fill: 'rgba(139, 92, 246, 0.1)'}} contentStyle={{ backgroundColor: '#1F2937', border: '1px solid #4B5563' }}/>
                        </PieChart>
                    </ResponsiveContainer>
                </div>
            )}
          </div>
        </div>

        <div className="text-center mt-8">
            <Button onClick={() => navigateTo('interview', 'Job')}>Practice Again</Button>
        </div>
      </div>
    </div>
  );
};

export default ReportPage;