// ============================================================
// Calendar Widget — Expanded View
// Shows upcoming calendar events with time remaining,
// styled for the Dynamic Island expanded state.
// ============================================================

import React from 'react';
import { motion } from 'framer-motion';

function CalendarWidget({ events }) {
  if (!events || events.length === 0) {
    return (
      <div className="calendar-widget calendar-empty">
        <div className="calendar-empty-icon">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
            <line x1="16" y1="2" x2="16" y2="6" />
            <line x1="8" y1="2" x2="8" y2="6" />
            <line x1="3" y1="10" x2="21" y2="10" />
          </svg>
        </div>
        <span className="calendar-empty-text">No upcoming events</span>
      </div>
    );
  }

  // Show at most 3 events in the expanded view
  const visibleEvents = events.slice(0, 3);

  return (
    <div className="calendar-widget">
      <div className="calendar-header">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <rect x="3" y="4" width="18" height="18" rx="2" />
          <line x1="16" y1="2" x2="16" y2="6" />
          <line x1="8" y1="2" x2="8" y2="6" />
          <line x1="3" y1="10" x2="21" y2="10" />
        </svg>
        <span>Upcoming</span>
      </div>

      <div className="calendar-list">
        {visibleEvents.map((event, i) => (
          <motion.div
            key={i}
            className="calendar-event"
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: i * 0.08 }}
          >
            {/* Color accent bar */}
            <div
              className="calendar-event-accent"
              style={{
                backgroundColor: getEventColor(i),
              }}
            />

            <div className="calendar-event-info">
              <span className="calendar-event-title">{event.title}</span>
              <span className="calendar-event-time">
                {formatEventTime(event.start)} — {getTimeRemaining(event.start)}
              </span>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}

// Color palette for event accent bars
function getEventColor(index) {
  const colors = ['#6366f1', '#f59e0b', '#10b981', '#ef4444', '#8b5cf6'];
  return colors[index % colors.length];
}

// Format ISO date to a readable time string
function formatEventTime(isoString) {
  try {
    const date = new Date(isoString);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  } catch {
    return '';
  }
}

// Get human-readable time remaining
function getTimeRemaining(isoString) {
  const now = new Date();
  const target = new Date(isoString);
  const diffMs = target - now;

  if (diffMs <= 0) return 'happening now';

  const mins = Math.floor(diffMs / 60000);
  if (mins < 60) return `in ${mins}m`;

  const hours = Math.floor(mins / 60);
  const remainMins = mins % 60;
  return remainMins > 0 ? `in ${hours}h ${remainMins}m` : `in ${hours}h`;
}

export default CalendarWidget;
