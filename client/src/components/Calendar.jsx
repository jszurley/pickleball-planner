import { useState } from 'react';
import './Calendar.css';

export default function Calendar({ events, onEventClick, onDateClick }) {
  const [currentDate, setCurrentDate] = useState(new Date());

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  const firstDayOfMonth = new Date(year, month, 1);
  const lastDayOfMonth = new Date(year, month + 1, 0);
  const startingDayOfWeek = firstDayOfMonth.getDay();
  const daysInMonth = lastDayOfMonth.getDate();

  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  const prevMonth = () => {
    setCurrentDate(new Date(year, month - 1, 1));
  };

  const nextMonth = () => {
    setCurrentDate(new Date(year, month + 1, 1));
  };

  const goToToday = () => {
    setCurrentDate(new Date());
  };

  const getEventsForDate = (date) => {
    const dateStr = formatDateForComparison(date);
    return events.filter((event) => {
      const eventDate = event.event_date.split('T')[0];
      return eventDate === dateStr;
    });
  };

  const formatDateForComparison = (date) => {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  };

  const isToday = (date) => {
    const today = new Date();
    return (
      date.getDate() === today.getDate() &&
      date.getMonth() === today.getMonth() &&
      date.getFullYear() === today.getFullYear()
    );
  };

  const isPast = (date) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return date < today;
  };

  const renderCalendarDays = () => {
    const days = [];

    // Empty cells for days before the first day of month
    for (let i = 0; i < startingDayOfWeek; i++) {
      days.push(<div key={`empty-${i}`} className="calendar-day empty" />);
    }

    // Days of the month
    for (let day = 1; day <= daysInMonth; day++) {
      const date = new Date(year, month, day);
      const dayEvents = getEventsForDate(date);
      const todayClass = isToday(date) ? 'today' : '';
      const pastClass = isPast(date) ? 'past' : '';

      days.push(
        <div
          key={day}
          className={`calendar-day ${todayClass} ${pastClass}`}
          onClick={() => onDateClick && onDateClick(date)}
        >
          <span className="day-number">{day}</span>
          <div className="day-events">
            {dayEvents.slice(0, 3).map((event) => (
              <div
                key={event.id}
                className={`event-dot ${event.is_reserved ? 'reserved' : ''} ${
                  parseInt(event.reservation_count) >= event.max_spots ? 'full' : ''
                }`}
                onClick={(e) => {
                  e.stopPropagation();
                  onEventClick && onEventClick(event);
                }}
                title={event.title}
              >
                <span className="event-time">
                  {formatTime(event.start_time)}
                </span>
                <span className="event-title">
                  {event.title.length > 8 ? event.title.substring(0, 8) + '...' : event.title}
                </span>
              </div>
            ))}
            {dayEvents.length > 3 && (
              <div className="more-events">+{dayEvents.length - 3} more</div>
            )}
          </div>
        </div>
      );
    }

    return days;
  };

  const formatTime = (timeStr) => {
    const [hours, minutes] = timeStr.split(':');
    const hour = parseInt(hours);
    const ampm = hour >= 12 ? 'p' : 'a';
    const hour12 = hour % 12 || 12;
    return `${hour12}${ampm}`;
  };

  return (
    <div className="calendar">
      <div className="calendar-header">
        <button className="btn btn-outline btn-sm" onClick={prevMonth}>
          &larr;
        </button>
        <div className="calendar-title">
          <h2>{monthNames[month]} {year}</h2>
          <button className="btn btn-outline btn-sm" onClick={goToToday}>
            Today
          </button>
        </div>
        <button className="btn btn-outline btn-sm" onClick={nextMonth}>
          &rarr;
        </button>
      </div>

      <div className="calendar-weekdays">
        {dayNames.map((day) => (
          <div key={day} className="weekday">{day}</div>
        ))}
      </div>

      <div className="calendar-grid">
        {renderCalendarDays()}
      </div>

      <div className="calendar-legend">
        <div className="legend-item">
          <span className="legend-dot reserved"></span>
          <span>You're registered</span>
        </div>
        <div className="legend-item">
          <span className="legend-dot full"></span>
          <span>Event full</span>
        </div>
        <div className="legend-item">
          <span className="legend-dot"></span>
          <span>Spots available</span>
        </div>
      </div>
    </div>
  );
}
