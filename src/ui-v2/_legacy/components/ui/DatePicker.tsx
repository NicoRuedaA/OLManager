import { useState, useEffect, useRef, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { ChevronDown, Check } from "lucide-react";

interface DatePickerProps {
  value: string; // YYYY-MM-DD
  onChange: (date: string) => void;
  error?: boolean;
  nextFieldId?: string; // id del elemento a enfocar con Tab desde el año
}

interface DateParts {
  day: string;
  month: string;
  year: string;
}

interface MonthOption {
  value: string;
  label: string;
}

function parseDateValue(value: string): DateParts | null {
  const parts = value.split("-");
  if (parts.length !== 3) {
    return null;
  }

  const [year, month, day] = parts;
  return { day, month, year };
}

function formatDateValue(day: string, month: string, year: string) {
  return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
}

function getDaysInMonth(month: number, year: number) {
  return new Date(year, month, 0).getDate();
}

function clampDayValue(dayValue: string, monthValue: string, yearValue: string) {
  if (!dayValue || parseInt(dayValue) <= 0) {
    return dayValue;
  }

  const monthNumber = parseInt(monthValue) || 1;
  const yearNumber = parseInt(yearValue) || 2000;
  const maxDays = getDaysInMonth(monthNumber, yearNumber);
  return Math.min(parseInt(dayValue), maxDays).toString();
}

function normaliseDayOnBlur(dayValue: string) {
  if (dayValue && parseInt(dayValue) > 0) {
    return parseInt(dayValue).toString().padStart(2, "0");
  }

  return "";
}

function normaliseYearOnBlur(yearValue: string, currentYear: number) {
  if (yearValue.length === 0 || yearValue.length === 4) {
    return yearValue;
  }

  const parsedYear = parseInt(yearValue);
  if (Number.isNaN(parsedYear) || parsedYear >= 100) {
    return yearValue;
  }

  const currentCentury = Math.floor(currentYear / 100) * 100;
  return currentCentury + parsedYear > currentYear
    ? (currentCentury - 100 + parsedYear).toString()
    : (currentCentury + parsedYear).toString();
}

function createMonths(language: string): MonthOption[] {
  return Array.from({ length: 12 }, (_, i) => {
    const d = new Date(2000, i, 1);
    return {
      value: (i + 1).toString(),
      label: d.toLocaleString(language, { month: "long" }),
    };
  });
}

function getSelectedMonthLabel(monthValue: string, months: MonthOption[], fallback: string) {
  if (!monthValue) {
    return fallback;
  }

  return months.find(m => m.value === monthValue || m.value === parseInt(monthValue).toString())?.label ?? fallback;
}

export function DatePicker({ value, onChange, error, nextFieldId }: DatePickerProps) {
  const { t, i18n } = useTranslation();
  
  // Parse initial value or use current date components
  const [day, setDay] = useState<string>("");
  const [month, setMonth] = useState<string>("");
  const [year, setYear] = useState<string>("");
  
  const [monthOpen, setMonthOpen] = useState(false);
  const [monthFocusIdx, setMonthFocusIdx] = useState(0);
  const monthRef = useRef<HTMLDivElement>(null);
  const monthBtnRef = useRef<HTMLButtonElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const dayRef = useRef<HTMLInputElement>(null);
  const yearRef = useRef<HTMLInputElement>(null);

  // Initialize from value prop
  useEffect(() => {
    const nextValue = parseDateValue(value);
    if (nextValue) {
      setYear(nextValue.year);
      setMonth(nextValue.month);
      setDay(nextValue.day);
    }
  }, [value]);

  // Handle outside click for month dropdown
  useEffect(() => {
    if (!monthOpen || !monthRef.current) {
      return;
    }

    // Focus the dropdown and reset highlight to current month
    const currentIdx = months.findIndex(
      m => m.value === month || m.value.padStart(2, '0') === month
    )
    setMonthFocusIdx(currentIdx >= 0 ? currentIdx : 0)
    dropdownRef.current?.focus()

    const monthElement = monthRef.current;

    const handleClickOutside = (e: MouseEvent) => {
      const targetNode = e.target instanceof Node ? e.target : null;
      const eventPath =
        typeof e.composedPath === "function" ? e.composedPath() : [];
      const clickedInside =
        eventPath.includes(monthElement as EventTarget) ||
        (targetNode ? monthElement.contains(targetNode) : false);

      if (!clickedInside) {
        setMonthOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [monthOpen]);

  // Update parent when any component changes, if valid
  useEffect(() => {
    if (day && month && year && year.length === 4) {
      const nextDate = formatDateValue(day, month, year);
      // Avoid feedback loops when parent already has the same value.
      if (nextDate !== value) {
        onChange(nextDate);
      }
    }
  }, [day, month, year, onChange, value]);

  // Generate month names based on current locale
  const months = useMemo(() => createMonths(i18n.language), [i18n.language]);

  const handleDayChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let newDay = e.target.value.replace(/\D/g, '');
    if (newDay.length > 2) newDay = newDay.slice(0, 2);

    setDay(clampDayValue(newDay, month, year));
  };

  const handleYearChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let newYear = e.target.value.replace(/\D/g, '');
    if (newYear.length > 4) newYear = newYear.slice(0, 4);
    setYear(newYear);

    // Re-validate day if year changes (leap years)
    if (day && month && newYear.length === 4) {
      setDay(clampDayValue(day, month, newYear));
    }
  };

  const selectedMonthLabel = getSelectedMonthLabel(month, months, t('date.month', 'Month'));

  return (
    <div className="flex gap-2 w-full">
      {/* Day */}
      <div className="flex-1">
        <input
          ref={dayRef}
          type="text"
          inputMode="numeric"
          placeholder={t('date.day', 'DD')}
          value={day}
          onChange={handleDayChange}
          onBlur={() => setDay(normaliseDayOnBlur(day))}
          onKeyDown={(e) => {
            if (e.key === "Tab" && !e.shiftKey) {
              const btn = document.getElementById("dp-month-btn");
              if (btn) {
                e.preventDefault();
                btn.focus();
              }
            }
          }}
          className={`w-full bg-white/5 border text-white rounded-lg p-3 outline-none focus:ring-2 transition-all placeholder:text-gray-500 text-center ${
            error
              ? "border-red-400 dark:border-red-500 focus:border-red-500 focus:ring-red-500/20"
              : "border-white/15 focus:border-accent-400 focus:ring-accent-400/20"
          }`}
        />
      </div>

      {/* Month Dropdown */}
      <div className="flex-[2] relative" ref={monthRef}>
        <button
          id="dp-month-btn"
          ref={monthBtnRef}
          type="button"
          tabIndex={0}
          onClick={() => setMonthOpen(!monthOpen)}
          onKeyDown={(e) => {
            if (e.key === "Tab" && !e.shiftKey) {
              const next = document.getElementById("dp-year-input");
              if (next) {
                e.preventDefault();
                if (monthOpen) setMonthOpen(false);
                next.focus();
              }
              return
            }
            if (e.key === "Tab" && e.shiftKey) {
              e.preventDefault();
              if (monthOpen) setMonthOpen(false);
              dayRef.current?.focus();
              return
            }
            if (e.key === "ArrowDown" || e.key === "ArrowUp") {
              e.preventDefault();
              const dir = e.key === "ArrowDown" ? 1 : -1;
              const currentIdx = months.findIndex(
                m => m.value === month || m.value.padStart(2, '0') === month
              );
              let nextIdx = currentIdx < 0 ? 0 : currentIdx + dir;
              if (nextIdx < 0) nextIdx = months.length - 1;
              if (nextIdx >= months.length) nextIdx = 0;
              const m = months[nextIdx];
              const nextMonth = m.value.padStart(2, '0');
              setMonth(nextMonth);
              if (day && year.length === 4) {
                const clampedDay = clampDayValue(day, nextMonth, year);
                if (clampedDay !== day) {
                  setDay(clampedDay.padStart(2, '0'));
                }
              }
            }
          }}
          className={`w-full flex items-center justify-between bg-white/5 border text-left rounded-lg p-3 outline-none transition-all focus:border-accent-400 focus:ring-2 focus:ring-accent-400/20 ${
            error
              ? "border-red-400 dark:border-red-500"
              : monthOpen
                ? "border-accent-400 ring-2 ring-accent-400/20"
                : "border-white/15"
          }`}
        >
          <span className={month ? "text-white" : "text-gray-400"}>
            {selectedMonthLabel}
          </span>
          <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${monthOpen ? "rotate-180" : ""}`} />
        </button>

        {monthOpen && (
          <div
            ref={dropdownRef}
            tabIndex={-1}
            className="absolute z-50 top-full mt-1 left-0 right-0 bg-navy-800 rounded-lg shadow-xl border border-white/10 overflow-hidden outline-none"
            onKeyDown={(e) => {
              if (e.key === "Tab") {
                e.preventDefault();
                setMonthOpen(false);
                if (e.shiftKey) {
                  dayRef.current?.focus();
                } else {
                  yearRef.current?.focus();
                }
                return
              }
              if (e.key === "ArrowDown" || e.key === "ArrowUp") {
                e.preventDefault()
                const dir = e.key === "ArrowDown" ? 1 : -1
                setMonthFocusIdx(i => {
                  const next = i + dir
                  if (next < 0) return months.length - 1
                  if (next >= months.length) return 0
                  return next
                })
              }
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault()
                const m = months[monthFocusIdx]
                if (!m) return
                const nextMonth = m.value.padStart(2, '0')
                setMonth(nextMonth)
                setMonthOpen(false)
                if (day && year.length === 4) {
                  const clampedDay = clampDayValue(day, nextMonth, year)
                  if (clampedDay !== day) {
                    setDay(clampedDay.padStart(2, '0'))
                  }
                }
                monthBtnRef.current?.focus()
              }
            }}
          >
            <div className="max-h-48 overflow-y-auto">
              {months.map((m, i) => (
                <button
                  key={m.value}
                  type="button"
                  onMouseEnter={() => setMonthFocusIdx(i)}
                  onClick={() => {
                    const nextMonth = m.value.padStart(2, '0');
                    setMonth(nextMonth);
                    setMonthOpen(false);
                    if (day && year.length === 4) {
                      const clampedDay = clampDayValue(day, nextMonth, year);
                      if (clampedDay !== day) {
                        setDay(clampedDay.padStart(2, '0'));
                      }
                    }
                    monthBtnRef.current?.focus()
                  }}
                  className={`w-full text-left px-3 py-2 text-sm flex items-center justify-between transition-colors ${
                    (month === m.value || month === m.value.padStart(2, '0'))
                      ? "bg-accent-400/10 text-accent-400"
                      : monthFocusIdx === i
                        ? "bg-white/15 text-gray-200"
                        : "text-gray-200 hover:bg-white/10"
                  }`}
                >
                  <span>{m.label}</span>
                  {(month === m.value || month === m.value.padStart(2, '0')) && <Check className="w-4 h-4 text-accent-400" />}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Year */}
      <div className="flex-[1.5]">
        <input
          id="dp-year-input"
          type="text"
          inputMode="numeric"
          placeholder={t('date.year', 'YYYY')}
          value={year}
          onChange={handleYearChange}
          onBlur={() => {
            if (year.length > 0 && year.length < 4) {
              const normalisedYear = normaliseYearOnBlur(year, new Date().getFullYear());
              if (normalisedYear !== year) {
                setYear(normalisedYear);
              }
            }
          }}
          onKeyDown={(e) => {
            if (e.key === "Tab" && !e.shiftKey) {
              if (nextFieldId) {
                const next = document.getElementById(nextFieldId);
                if (next) {
                  e.preventDefault();
                  next.focus();
                  return;
                }
              }
              e.preventDefault();
              dayRef.current?.focus();
            }
            if (e.key === "Tab" && e.shiftKey) {
              e.preventDefault();
              monthBtnRef.current?.focus();
            }
          }}
          className={`w-full bg-white/5 border text-white rounded-lg p-3 outline-none focus:ring-2 transition-all placeholder:text-gray-500 text-center ${
            error
              ? "border-red-400 dark:border-red-500 focus:border-red-500 focus:ring-red-500/20"
              : "border-white/15 focus:border-accent-400 focus:ring-accent-400/20"
          }`}
        />
      </div>
    </div>
  );
}
