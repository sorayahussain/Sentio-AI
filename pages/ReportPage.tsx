

import React, { useContext, useRef, useState } from 'react';
import { AppContext } from '../App';
import { InterviewResult, EmotionData } from '../types';
import Button from '../components/Button';
import { PieChart, Pie, Cell, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Legend, Sector } from 'recharts';
import { DOWNLOAD_ICON, PRINT_ICON } from '../constants';
import Loader from '../components/Loader';

// Globals from CDN scripts
declare const html2canvas: any;
declare const jspdf: any;

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
  const reportRef = useRef<HTMLDivElement>(null);
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);

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

  const handleDownloadPDF = async () => {
    if (!reportRef.current || isGeneratingPdf) return;
    setIsGeneratingPdf(true);

    try {
        // Wait for charts to be fully rendered (sometimes animation takes a moment)
        await new Promise(resolve => setTimeout(resolve, 500));

        const canvas = await html2canvas(reportRef.current, {
            scale: 2, // Higher scale for better quality
            backgroundColor: '#111827', // Match bg-gray-900
            useCORS: true,
            logging: false
        });

        const imgData = canvas.toDataURL('image/png');
        
        // Access jsPDF from global window object (loaded via CDN)
        // FIX: Cast window to any to avoid TypeScript error when accessing jspdf
        const { jsPDF } = (window as any).jspdf;
        const pdf = new jsPDF('p', 'mm', 'a4');
        const pdfWidth = pdf.internal.pageSize.getWidth();
        const pdfHeight = pdf.internal.pageSize.getHeight();
        
        const imgProps = pdf.getImageProperties(imgData);
        const imgHeight = (imgProps.height * pdfWidth) / imgProps.width;
        
        // If image height is greater than page height, we'd need multi-page logic.
        // For this single dashboard view, we'll scale it to fit if it's too long, 
        // or just let it spill (which usually means cutoff).
        // Let's implement a simple multi-page split if needed.
        
        let heightLeft = imgHeight;
        let position = 0;

        pdf.addImage(imgData, 'PNG', 0, position, pdfWidth, imgHeight);
        heightLeft -= pdfHeight;

        while (heightLeft >= 0) {
          position = heightLeft - imgHeight;
          pdf.addPage();
          pdf.addImage(imgData, 'PNG', 0, position, pdfWidth, imgHeight);
          heightLeft -= pdfHeight;
        }

        pdf.save(`sentio_report_${interviewType}_${new Date().toISOString().slice(0,10)}.pdf`);

    } catch (error) {
        console.error("PDF generation failed:", error);
        alert("Failed to generate PDF. Please try using the Print button instead.");
    } finally {
        setIsGeneratingPdf(false);
    }
  };

  const printReport = () => {
    window.print();
  };
  
  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-900 to-purple-900/30 p-4 sm:p-6 md:p-8 print:bg-white print:text-black">
      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-8 relative">
          <h1 className="text-4xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-blue-400 print:text-black">
            Interview Performance Report
          </h1>
          <p className="text-gray-400 mt-2 print:text-gray-700">Here's the breakdown of your {interviewType} interview session.</p>
          
          <div className="mt-4 md:mt-0 md:absolute md:top-0 md:right-0 flex justify-center gap-2 print:hidden">
              <button 
                onClick={printReport}
                className="flex items-center gap-2 px-4 py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-lg transition-colors border border-gray-700"
                title="Print Report"
              >
                  {PRINT_ICON} Print
              </button>
              <button 
                onClick={handleDownloadPDF}
                disabled={isGeneratingPdf}
                className="flex items-center gap-2 px-4 py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-lg transition-colors border border-gray-700 disabled:opacity-50"
                title="Download PDF"
              >
                  {isGeneratingPdf ? <Loader text="" /> : DOWNLOAD_ICON} 
                  {isGeneratingPdf ? 'Generating...' : 'Download PDF'}
              </button>
          </div>
        </div>

        {/* Report Content Reference for PDF Capture */}
        <div ref={reportRef} className="grid grid-cols-1 lg:grid-cols-3 gap-6 p-1"> {/* p-1 prevents clipping */}
          {/* Left Column: Scores and Feedback */}
          <div className="lg:col-span-2 flex flex-col gap-6">
            <div className="bg-gray-800/50 border border-gray-700 rounded-xl p-6 print:border-gray-300 print:bg-white print:text-black">
              <h2 className="text-xl font-bold mb-4 text-white print:text-black">Performance Scores</h2>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <ScoreCard title="Clarity" score={feedback.clarity} />
                <ScoreCard title="Confidence" score={feedback.confidence} />
                <ScoreCard title="Engagement" score={feedback.engagement} />
                <ScoreCard title="Answer Quality" score={feedback.answerQuality} />
              </div>
            </div>

            <div className="bg-gray-800/50 border border-gray-700 rounded-xl p-6 print:border-gray-300 print:bg-white print:text-black">
                <h2 className="text-xl font-bold mb-4 text-white print:text-black">AI Coach Feedback</h2>
                <div className="space-y-6">
                    <div>
                        <h3 className="font-semibold text-purple-300 mb-2 print:text-purple-700">Overall Summary</h3>
                        <p className="text-gray-300 print:text-black">{feedback.overallFeedback}</p>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                            <h3 className="font-semibold text-green-400 mb-2 print:text-green-700">Strengths</h3>
                            <ul className="list-disc list-inside space-y-1 text-gray-300 print:text-black">
                                {feedback.strengths.map((s, i) => <li key={i}>{s}</li>)}
                            </ul>
                        </div>
                        <div>
                            <h3 className="font-semibold text-yellow-400 mb-2 print:text-yellow-700">Areas for Improvement</h3>
                            <ul className="list-disc list-inside space-y-1 text-gray-300 print:text-black">
                                {feedback.areasForImprovement.map((a, i) => <li key={i}>{a}</li>)}
                            </ul>
                        </div>
                    </div>
                </div>
            </div>
            
            <div className="bg-gray-800/50 border border-gray-700 rounded-xl p-6 print:hidden">
                 <h2 className="text-xl font-bold mb-4 text-white">Interview Transcript</h2>
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
          <div className="flex flex-col gap-6 print:hidden">
             <div className="bg-gray-800/50 border border-gray-700 rounded-xl p-6">
                <h2 className="text-xl font-bold mb-4 text-center text-white">Score Breakdown</h2>
                <ResponsiveContainer width="100%" height={250}>
                    <BarChart data={scoreData} layout="vertical" margin={{ top: 5, right: 20, left: 20, bottom: 5 }}>
                        <XAxis type="number" domain={[0, 10]} hide />
                        <YAxis type="category" dataKey="name" width={100} stroke="#9CA3AF" tick={{ fill: '#D1D5DB' }} />
                        <Tooltip cursor={{fill: 'rgba(139, 92, 246, 0.1)'}} contentStyle={{ backgroundColor: '#1F2937', border: '1px solid #4B5563', color: '#fff' }} />
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
                    <h2 className="text-xl font-bold mb-4 text-center text-white">Emotion Distribution</h2>
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
                            <Tooltip cursor={{fill: 'rgba(139, 92, 246, 0.1)'}} contentStyle={{ backgroundColor: '#1F2937', border: '1px solid #4B5563', color: '#fff' }}/>
                        </PieChart>
                    </ResponsiveContainer>
                </div>
            )}
          </div>
        </div>

        <div className="text-center mt-8 print:hidden">
            <Button onClick={() => navigateTo('interview', 'Job')}>Practice Again</Button>
        </div>
      </div>
    </div>
  );
};

export default ReportPage;
