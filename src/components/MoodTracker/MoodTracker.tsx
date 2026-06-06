import React, { useState } from 'react';
import { useDiary } from '../../context/DiaryContext';
import { Smile, TrendingUp, Calendar, AlertCircle } from 'lucide-react';


export const MoodTracker: React.FC = () => {
  const { entries } = useDiary();
  const [timeframe, setTimeframe] = useState<'weekly' | 'monthly'>('weekly');

  const moodsList = [
    { value: 'happy', label: 'Happy', emoji: '😀', color: 'bg-green-500' },
    { value: 'calm', label: 'Calm', emoji: '😌', color: 'bg-teal-500' },
    { value: 'sad', label: 'Sad', emoji: '😢', color: 'bg-blue-500' },
    { value: 'angry', label: 'Angry', emoji: '😡', color: 'bg-red-500' },
    { value: 'tired', label: 'Tired', emoji: '😴', color: 'bg-amber-600' },
    { value: 'excited', label: 'Excited', emoji: '🤩', color: 'bg-pink-500' },
  ] as const;

  // Filter entries within timeframe
  const getFilteredEntries = () => {
    const now = new Date();
    const daysLimit = timeframe === 'weekly' ? 7 : 30;
    const limitDate = new Date(now.getTime() - daysLimit * 24 * 60 * 60 * 1000);

    return entries.filter(e => new Date(e.created_at) >= limitDate);
  };

  const filtered = getFilteredEntries();

  // Count moods
  const moodCounts = filtered.reduce((acc, entry) => {
    acc[entry.mood] = (acc[entry.mood] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const totalFiltered = filtered.length;

  // Calculate percentages and sort moods by count
  const moodAnalytics = moodsList.map(moodInfo => {
    const count = moodCounts[moodInfo.value] || 0;
    const percentage = totalFiltered > 0 ? Math.round((count / totalFiltered) * 100) : 0;
    return {
      ...moodInfo,
      count,
      percentage
    };
  }).sort((a, b) => b.count - a.count);

  // Find dominant mood
  const dominantMood = moodAnalytics[0]?.count > 0 ? moodAnalytics[0] : null;

  return (
    <div className="w-full max-w-md mx-auto bg-[var(--bg-paper)] border border-stone-200 dark:border-stone-850 p-6 rounded-2xl shadow-sm flex flex-col justify-between">
      <div>
        {/* Header */}
        <div className="flex items-center justify-between mb-6 border-b border-[var(--color-lines)] pb-3">
          <h2 className="text-md font-bold text-[var(--color-text)] flex items-center gap-1.5">
            <Smile className="w-4.5 h-4.5 text-[var(--color-accent)]" />
            Mood Analytics
          </h2>
          {/* Timeframe selector */}
          <div className="flex bg-[var(--bg-paper-back)] p-0.5 rounded-lg border border-[var(--color-lines)]">
            <button
              onClick={() => setTimeframe('weekly')}
              className={`text-[10px] font-bold px-2 py-1 rounded-md transition cursor-pointer
                ${timeframe === 'weekly'
                  ? 'bg-[var(--bg-paper)] text-[var(--color-text)] shadow-sm'
                  : 'text-[var(--color-text-muted)] hover:text-[var(--color-text)]'
                }`}
            >
              7 Days
            </button>
            <button
              onClick={() => setTimeframe('monthly')}
              className={`text-[10px] font-bold px-2 py-1 rounded-md transition cursor-pointer
                ${timeframe === 'monthly'
                  ? 'bg-[var(--bg-paper)] text-[var(--color-text)] shadow-sm'
                  : 'text-[var(--color-text-muted)] hover:text-[var(--color-text)]'
                }`}
            >
              30 Days
            </button>
          </div>
        </div>

        {/* Empty State */}
        {totalFiltered === 0 ? (
          <div className="flex flex-col items-center justify-center text-center py-10 text-[var(--color-text-muted)]">
            <AlertCircle className="w-10 h-10 text-[var(--color-lines)] mb-2" />
            <p className="text-xs">No entries found for this period.</p>
            <p className="text-[10px] max-w-xs mt-1 text-[var(--color-text-muted)]/80">
              Add your mood to daily journal pages to see mood analytics charts and logs!
            </p>
          </div>
        ) : (
          /* Analytics Charts & Details */
          <div className="space-y-5">
            
            {/* Dominant Mood Highlights */}
            {dominantMood && (
              <div className="bg-[var(--bg-paper-back)] p-4 rounded-xl border border-[var(--color-lines)] flex items-center gap-3">
                <div className="text-3xl bg-[var(--bg-paper)] p-2 rounded-xl shadow-sm border border-[var(--color-lines)]">
                  {dominantMood.emoji}
                </div>
                <div>
                  <div className="flex items-center gap-1 text-[10px] uppercase tracking-wider text-[var(--color-text-muted)] font-bold">
                    <TrendingUp className="w-3.5 h-3.5 text-[var(--color-accent)]" />
                    Dominant Mood
                  </div>
                  <h4 className="text-sm font-bold mt-0.5 text-[var(--color-text)]">
                    Feeling {dominantMood.label}
                  </h4>
                  <p className="text-[10px] text-[var(--color-text-muted)] mt-0.5">
                    You felt {dominantMood.label.toLowerCase()} in {dominantMood.percentage}% of your logs.
                  </p>
                </div>
              </div>
            )}

            {/* Graphical Analytics (Visual Bar Ratios) */}
            <div className="space-y-3">
              <h3 className="text-[10px] uppercase font-bold text-[var(--color-text-muted)] tracking-wider flex items-center gap-1">
                <Calendar className="w-3 h-3" /> Mood Frequency Chart
              </h3>
              <div className="space-y-2.5">
                {moodAnalytics.map(mood => (
                  <div key={mood.value} className="space-y-1">
                    <div className="flex justify-between text-xs font-semibold">
                      <span className="flex items-center gap-1 text-[var(--color-text)]">
                        <span>{mood.emoji}</span>
                        <span>{mood.label}</span>
                      </span>
                      <span className="text-[var(--color-text-muted)]">
                        {mood.count} {mood.count === 1 ? 'log' : 'logs'} ({mood.percentage}%)
                      </span>
                    </div>
                    {/* Bar container */}
                    <div className="w-full h-2.5 bg-[var(--bg-paper-back)] rounded-full overflow-hidden border border-[var(--color-lines)]">
                      <div
                        className={`h-full ${mood.color} rounded-full transition-all duration-500`}
                        style={{ width: `${mood.percentage}%` }}
                      ></div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

          </div>
        )}
      </div>

      {/* Summary Footer */}
      {totalFiltered > 0 && (
        <div className="mt-6 pt-4 border-t border-[var(--color-lines)] text-[10px] text-[var(--color-text-muted)] text-center italic">
          Based on {totalFiltered} journal entries recorded in the past {timeframe === 'weekly' ? 'week' : 'month'}.
        </div>
      )}
    </div>
  );
};
