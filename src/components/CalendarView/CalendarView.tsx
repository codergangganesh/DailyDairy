import React, { useState } from 'react';
import { useDiary, type DecryptedEntry } from '../../context/DiaryContext';
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon } from 'lucide-react';


interface CalendarViewProps {
  onSelectEntry?: (pageNumber: number) => void;
}

export const CalendarView: React.FC<CalendarViewProps> = ({ onSelectEntry }) => {
  const { entries, setActivePage } = useDiary();
  const [currentDate, setCurrentDate] = useState(new Date());

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  const handlePrevMonth = () => {
    setCurrentDate(new Date(year, month - 1, 1));
  };

  const handleNextMonth = () => {
    setCurrentDate(new Date(year, month + 1, 1));
  };

  // Get days in the month
  const getDaysInMonth = (y: number, m: number) => {
    return new Date(y, m + 1, 0).getDate();
  };

  // Get weekday offset of first day in month (0 = Sunday, 6 = Saturday)
  const getFirstDayOffset = (y: number, m: number) => {
    return new Date(y, m, 1).getDay();
  };

  const daysInMonth = getDaysInMonth(year, month);
  const firstDayOffset = getFirstDayOffset(year, month);

  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  // Map entries by day for quick lookup
  const getEntriesForDay = (day: number) => {
    return entries.filter(e => {
      const entryDate = new Date(e.created_at);
      return (
        entryDate.getFullYear() === year &&
        entryDate.getMonth() === month &&
        entryDate.getDate() === day
      );
    });
  };

  const daysGrid = [];
  // Add empty offsets
  for (let i = 0; i < firstDayOffset; i++) {
    daysGrid.push(null);
  }
  // Add actual days
  for (let d = 1; d <= daysInMonth; d++) {
    daysGrid.push(d);
  }

  const handleDayClick = (dayEntries: DecryptedEntry[]) => {
    if (dayEntries.length === 0) return;
    
    // Select the first entry written on that day
    const pageNum = dayEntries[0].page_number;
    setActivePage(pageNum);
    
    if (onSelectEntry) {
      onSelectEntry(pageNum);
    }
  };

  const getMoodEmoji = (mood: DecryptedEntry['mood']) => {
    switch (mood) {
      case 'happy': return '😀';
      case 'calm': return '😌';
      case 'sad': return '😢';
      case 'angry': return '😡';
      case 'tired': return '😴';
      case 'excited': return '🤩';
      default: return '📝';
    }
  };

  return (
    <div className="w-full max-w-md mx-auto bg-[var(--bg-paper)] border border-[var(--color-lines)] p-6 rounded-2xl shadow-sm">
      {/* Calendar Header */}
      <div className="flex items-center justify-between mb-6 border-b border-[var(--color-lines)] pb-3">
        <h2 className="text-md font-bold text-[var(--color-text)] flex items-center gap-1.5">
          <CalendarIcon className="w-4 h-4 text-[var(--color-accent)]" />
          {monthNames[month]} {year}
        </h2>
        <div className="flex gap-1">
          <button
            onClick={handlePrevMonth}
            className="p-1.5 hover:bg-[var(--bg-paper-back)] rounded-lg text-[var(--color-text-muted)] transition cursor-pointer"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <button
            onClick={handleNextMonth}
            className="p-1.5 hover:bg-[var(--bg-paper-back)] rounded-lg text-[var(--color-text-muted)] transition cursor-pointer"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Weekday Labels */}
      <div className="grid grid-cols-7 gap-1 text-center text-[10px] uppercase font-bold text-[var(--color-text-muted)] tracking-wider mb-2">
        <span>Sun</span>
        <span>Mon</span>
        <span>Tue</span>
        <span>Wed</span>
        <span>Thu</span>
        <span>Fri</span>
        <span>Sat</span>
      </div>

      {/* Days Grid */}
      <div className="grid grid-cols-7 gap-2">
        {daysGrid.map((day, idx) => {
          if (day === null) {
            return <div key={`empty-${idx}`} className="aspect-square bg-transparent"></div>;
          }
 
          const dayEntries = getEntriesForDay(day);
          const hasEntries = dayEntries.length > 0;
          const hasDream = dayEntries.some(e => e.category === 'Dream Journal');
          const primaryMood = hasEntries ? dayEntries[0].mood : null;

          return (
            <button
              key={`day-${day}`}
              disabled={!hasEntries}
              onClick={() => handleDayClick(dayEntries)}
              className={`aspect-square rounded-xl p-1 relative flex flex-col justify-between items-center transition border
                ${hasEntries
                  ? 'bg-[var(--color-accent)]/5 border-[var(--color-accent)]/20 hover:scale-105 active:scale-95 cursor-pointer hover:border-[var(--color-accent)]'
                  : 'bg-[var(--bg-paper-back)]/30 border-transparent text-[var(--color-text-muted)]/40'
                }`}
            >
              {/* Day Number */}
              <span className={`text-xs font-bold ${hasEntries ? 'text-[var(--color-text)]' : ''}`}>
                {day}
              </span>

              {/* Indicators */}
              <div className="flex items-center gap-0.5 justify-center w-full min-h-[16px]">
                {hasEntries && (
                  <span className="text-xs" title={`Mood: ${primaryMood}`}>
                    {getMoodEmoji(primaryMood!)}
                  </span>
                )}
                {hasDream && (
                  <span className="text-[10px] text-indigo-500" title="Contains Dream Journal">
                    🌙
                  </span>
                )}
              </div>

              {/* Dot decorator */}
              {dayEntries.length > 1 && (
                <span className="absolute top-1 right-1 w-1.5 h-1.5 bg-[var(--color-accent)] rounded-full"></span>
              )}
            </button>
          );
        })}
      </div>

      {/* Legend */}
      <div className="mt-6 pt-4 border-t border-[var(--color-lines)] flex items-center justify-between text-[10px] text-[var(--color-text-muted)] font-medium">
        <div className="flex items-center gap-1">
          <span className="w-2.5 h-2.5 bg-[var(--color-accent)]/10 border border-[var(--color-accent)]/35 rounded"></span>
          <span>Written Entry</span>
        </div>
        <div className="flex items-center gap-1">
          <span>🌙</span>
          <span>Dream Logged</span>
        </div>
        <div className="flex items-center gap-1">
          <span className="w-1.5 h-1.5 bg-[var(--color-accent)] rounded-full"></span>
          <span>Multiple Pages</span>
        </div>
      </div>
    </div>
  );
};
