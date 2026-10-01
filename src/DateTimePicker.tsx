import { useEffect, useRef, useState } from 'react';
import { CalendarDays, ChevronLeft, ChevronRight, Clock3 } from 'lucide-react';

type DateTimePickerProps = {
  label: string;
  name: string;
  defaultValue: string;
};

const weekDays = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S'];

function formatTimePart(value: number) {
  return String(value).padStart(2, '0');
}

function isSameCalendarDay(firstDate: Date, secondDate: Date) {
  return firstDate.getFullYear() === secondDate.getFullYear()
    && firstDate.getMonth() === secondDate.getMonth()
    && firstDate.getDate() === secondDate.getDate();
}

export function DateTimePicker({ label, name, defaultValue }: DateTimePickerProps) {
  const [selectedDate, setSelectedDate] = useState(() => {
    const parsedDate = new Date(defaultValue);
    return Number.isNaN(parsedDate.getTime()) ? new Date() : parsedDate;
  });
  const [displayedMonth, setDisplayedMonth] = useState(() => new Date(selectedDate.getFullYear(), selectedDate.getMonth(), 1));
  const [isOpen, setIsOpen] = useState(false);
  const pickerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;

    function closeOnOutsideInteraction(event: PointerEvent) {
      if (!pickerRef.current?.contains(event.target as Node)) setIsOpen(false);
    }

    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') setIsOpen(false);
    }

    document.addEventListener('pointerdown', closeOnOutsideInteraction);
    document.addEventListener('keydown', closeOnEscape);
    return () => {
      document.removeEventListener('pointerdown', closeOnOutsideInteraction);
      document.removeEventListener('keydown', closeOnEscape);
    };
  }, [isOpen]);

  const firstVisibleDate = new Date(displayedMonth.getFullYear(), displayedMonth.getMonth(), 1 - displayedMonth.getDay());
  const calendarDays = Array.from({ length: 42 }, (_, dayIndex) => new Date(
    firstVisibleDate.getFullYear(),
    firstVisibleDate.getMonth(),
    firstVisibleDate.getDate() + dayIndex,
  ));
  const today = new Date();
  const monthLabel = new Intl.DateTimeFormat('pt-BR', { month: 'long', year: 'numeric' }).format(displayedMonth);
  const dateLabel = new Intl.DateTimeFormat('pt-BR', { dateStyle: 'long' }).format(selectedDate);
  const timeValue = `${formatTimePart(selectedDate.getHours())}:${formatTimePart(selectedDate.getMinutes())}`;

  function selectCalendarDay(calendarDay: Date) {
    setSelectedDate((currentDate) => new Date(
      calendarDay.getFullYear(),
      calendarDay.getMonth(),
      calendarDay.getDate(),
      currentDate.getHours(),
      currentDate.getMinutes(),
    ));
    setDisplayedMonth(new Date(calendarDay.getFullYear(), calendarDay.getMonth(), 1));
  }

  function updateTime(value: string) {
    const [hours, minutes] = value.split(':').map(Number);
    if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return;
    setSelectedDate((currentDate) => new Date(
      currentDate.getFullYear(),
      currentDate.getMonth(),
      currentDate.getDate(),
      hours,
      minutes,
    ));
  }

  return (
    <div className="field date-time-field" ref={pickerRef}>
      <span>{label}</span>
      <button
        type="button"
        className="date-time-trigger"
        aria-expanded={isOpen}
        aria-label={`${label}: ${dateLabel} às ${timeValue}`}
        onClick={() => setIsOpen((current) => !current)}
      >
        <CalendarDays size={16} />
        <span className="date-time-trigger-copy">
          <strong>{dateLabel}</strong>
          <small>{timeValue}</small>
        </span>
      </button>
      <input type="hidden" name={name} value={selectedDate.toISOString()} />

      {isOpen && (
        <div className="date-picker-panel">
          <div className="date-picker-header">
            <button type="button" className="date-picker-month-button" aria-label="Mês anterior" onClick={() => setDisplayedMonth((month) => new Date(month.getFullYear(), month.getMonth() - 1, 1))}>
              <ChevronLeft size={16} />
            </button>
            <strong>{monthLabel}</strong>
            <button type="button" className="date-picker-month-button" aria-label="Próximo mês" onClick={() => setDisplayedMonth((month) => new Date(month.getFullYear(), month.getMonth() + 1, 1))}>
              <ChevronRight size={16} />
            </button>
          </div>

          <div className="date-picker-weekdays" aria-hidden="true">
            {weekDays.map((weekDay, dayIndex) => <span key={`${weekDay}-${dayIndex}`}>{weekDay}</span>)}
          </div>
          <div className="date-picker-days">
            {calendarDays.map((calendarDay) => {
              const isCurrentMonth = calendarDay.getMonth() === displayedMonth.getMonth();
              const isSelected = isSameCalendarDay(calendarDay, selectedDate);
              const isToday = isSameCalendarDay(calendarDay, today);
              const dayLabel = new Intl.DateTimeFormat('pt-BR', { dateStyle: 'full' }).format(calendarDay);
              return (
                <button
                  key={calendarDay.toISOString()}
                  type="button"
                  className={`date-picker-day ${isCurrentMonth ? '' : 'outside-month'} ${isSelected ? 'selected' : ''} ${isToday ? 'today' : ''}`}
                  aria-label={dayLabel}
                  aria-pressed={isSelected}
                  onClick={() => selectCalendarDay(calendarDay)}
                >
                  {calendarDay.getDate()}
                </button>
              );
            })}
          </div>

          <label className="date-picker-time">
            <span><Clock3 size={14} /> Horário</span>
            <input type="time" value={timeValue} onChange={(event) => updateTime(event.target.value)} />
          </label>
        </div>
      )}
    </div>
  );
}