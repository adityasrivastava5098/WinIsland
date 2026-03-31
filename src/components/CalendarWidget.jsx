// ============================================================
// Calendar Widget — Monthly Grid View (Redesigned)
// Shows a mini monthly calendar grid with:
//   - Current month/year header with nav arrows
//   - Day-of-week headers
//   - Date grid with current day highlighted
//   - Event indicators on event days
// Only shown when user explicitly switches to calendar mode.
// ============================================================

import React, { useState, useMemo } from 'react';
import { motion } from 'framer-motion';

const DAYS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];
const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

function CalendarWidget({ events = [] }) {
  const today = new Date();
  const [viewMonth, setViewMonth] = useState(today.getMonth());
  const [viewYear, setViewYear] = useState(today.getFullYear());
  const [selectedDay, setSelectedDay] = useState(today.getDate());

  // Build the calendar grid for the current month
  const grid = useMemo(() => {
    const firstDay = new Date(viewYear, viewMonth, 1).getDay();
    const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
    const cells = [];

    // Empty cells before the 1st
    for (let i = 0; i < firstDay; i++) {
      cells.push(null);
    }
    // Day cells
    for (let d = 1; d <= daysInMonth; d++) {
      cells.push(d);
    }
    return cells;
  }, [viewMonth, viewYear]);

  // Determine which days have events
  const eventDays = useMemo(() => {
    const days = new Set();
    for (const ev of events) {
      try {
        const d = new Date(ev.start);
        if (d.getMonth() === viewMonth && d.getFullYear() === viewYear) {
          days.add(d.getDate());
        }
      } catch { /* skip invalid */ }
    }
    return days;
  }, [events, viewMonth, viewYear]);

  // Events for the selected day
  const selectedEvents = useMemo(() => {
    return events.filter((ev) => {
      try {
        const d = new Date(ev.start);
        return d.getDate() === selectedDay &&
               d.getMonth() === viewMonth &&
               d.getFullYear() === viewYear;
      } catch { return false; }
    });
  }, [events, selectedDay, viewMonth, viewYear]);

  const isToday = (day) => {
    return day === today.getDate() &&
           viewMonth === today.getMonth() &&
           viewYear === today.getFullYear();
  };

  const prevMonth = (e) => {
    e.stopPropagation();
    if (viewMonth === 0) {
      setViewMonth(11);
      setViewYear((y) => y - 1);
    } else {
      setViewMonth((m) => m - 1);
    }
  };

  const nextMonth = (e) => {
    e.stopPropagation();
    if (viewMonth === 11) {
      setViewMonth(0);
      setViewYear((y) => y + 1);
    } else {
      setViewMonth((m) => m + 1);
    }
  };

  return (
    <div className="calendar-widget" onClick={(e) => e.stopPropagation()}>
      {/* Month/year header */}
      <div className="cal-header">
        <button className="cal-nav-btn" onClick={prevMonth}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <polyline points="15 18 9 12 15 6" />
          </svg>
        </button>
        <span className="cal-month-label">
          {MONTHS[viewMonth]} {viewYear}
        </span>
        <button className="cal-nav-btn" onClick={nextMonth}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <polyline points="9 18 15 12 9 6" />
          </svg>
        </button>
      </div>

      {/* Day-of-week headers */}
      <div className="cal-day-headers">
        {DAYS.map((d) => (
          <span key={d} className="cal-day-header">{d}</span>
        ))}
      </div>

      {/* Date grid */}
      <div className="cal-grid">
        {grid.map((day, i) => (
          <motion.div
            key={i}
            className={[
              'cal-cell',
              day === null ? 'cal-cell-empty' : '',
              day === selectedDay ? 'cal-cell-selected' : '',
              day && isToday(day) ? 'cal-cell-today' : '',
            ].filter(Boolean).join(' ')}
            onClick={(e) => {
              e.stopPropagation();
              if (day) setSelectedDay(day);
            }}
            whileTap={{ scale: 0.9 }}
          >
            {day && (
              <>
                <span>{day}</span>
                {eventDays.has(day) && <div className="cal-event-dot" />}
              </>
            )}
          </motion.div>
        ))}
      </div>

      {/* Selected day events (if any) */}
      {selectedEvents.length > 0 && (
        <div className="cal-events">
          {selectedEvents.slice(0, 2).map((ev, i) => (
            <div key={i} className="cal-event-item">
              <div className="cal-event-accent" />
              <span className="cal-event-text">{ev.title}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default CalendarWidget;
