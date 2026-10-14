"use client";

import { useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { MiniMonthGrid } from "./MiniMonthGrid";
import { getMonthCells, isSameDay, isWeekend, MONTH_NAMES, WEEKDAY_NAMES } from "./monthGrid";

interface CalendarPanelProps {
    isOpen: boolean;
    onClose: () => void;
}

const today = new Date();
const YEAR_RANGE = Array.from({ length: 21 }, (_, i) => today.getFullYear() - 10 + i);

export function CalendarPanel({ isOpen, onClose }: CalendarPanelProps) {
    const [currentDate, setCurrentDate] = useState(new Date());
    // null = calendar view; a real date = activities view for that date.
    const [selectedDate, setSelectedDate] = useState<Date | null>(null);

    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();

    // Modal's own close (X / backdrop click) always exits fully, from either
    // view, and resets so reopening always starts back on the current month.
    const handleClose = () => {
        onClose();
        setSelectedDate(null);
        setCurrentDate(new Date());
    };

    const goToPrevMonth = () => setCurrentDate(new Date(year, month - 1, 1));
    const goToNextMonth = () => setCurrentDate(new Date(year, month + 1, 1));
    const handleMonthChange = (e: React.ChangeEvent<HTMLSelectElement>) =>
        setCurrentDate(new Date(year, parseInt(e.target.value, 10), 1));
    const handleYearChange = (e: React.ChangeEvent<HTMLSelectElement>) =>
        setCurrentDate(new Date(parseInt(e.target.value, 10), month, 1));

    const cells = getMonthCells(year, month);
    const prevMonthDate = new Date(year, month - 1, 1);
    const nextMonthDate = new Date(year, month + 1, 1);

    const title = selectedDate
        ? `Activities — ${MONTH_NAMES[selectedDate.getMonth()]} ${selectedDate.getDate()}, ${selectedDate.getFullYear()}`
        : "Calendar";

    return (
        <Modal isOpen={isOpen} onClose={handleClose} title={title} size="xl">
            {selectedDate ? (
                <div className="space-y-4">
                    <button
                        type="button"
                        onClick={() => setSelectedDate(null)}
                        className="inline-flex items-center gap-1 text-sm font-semibold text-primary hover:text-primary/80 transition-colors"
                    >
                        <ChevronLeft className="h-4 w-4" />
                        Back to calendar
                    </button>
                    <div className="rounded-xl border border-dashed border-gray-300 p-10 text-center text-gray-500">
                        Activities for this date — coming soon.
                    </div>
                </div>
            ) : (
                <div className="grid grid-cols-3 gap-6">
                    {/* Main month -- 2/3 width */}
                    <div className="col-span-2">
                        <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
                            <h3 className="text-2xl font-extrabold text-gray-800">
                                {MONTH_NAMES[month]} {year}
                            </h3>
                            <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-1">
                                <button
                                    type="button"
                                    onClick={goToPrevMonth}
                                    aria-label="Previous month"
                                    className="p-1.5 hover:bg-white hover:shadow-sm rounded-md transition-all"
                                >
                                    <ChevronLeft className="h-4 w-4 text-gray-600" />
                                </button>
                                <select
                                    value={month}
                                    onChange={handleMonthChange}
                                    className="bg-transparent text-sm font-semibold text-gray-700 focus:outline-none cursor-pointer py-1 px-2 min-w-28"
                                >
                                    {MONTH_NAMES.map((m, i) => (
                                        <option key={m} value={i}>{m}</option>
                                    ))}
                                </select>
                                <select
                                    value={year}
                                    onChange={handleYearChange}
                                    className="bg-transparent text-sm font-semibold text-gray-700 focus:outline-none cursor-pointer py-1 px-2 min-w-18"
                                >
                                    {YEAR_RANGE.map((y) => (
                                        <option key={y} value={y}>{y}</option>
                                    ))}
                                </select>
                                <button
                                    type="button"
                                    onClick={goToNextMonth}
                                    aria-label="Next month"
                                    className="p-1.5 hover:bg-white hover:shadow-sm rounded-md transition-all"
                                >
                                    <ChevronRight className="h-4 w-4 text-gray-600" />
                                </button>
                            </div>
                        </div>

                        <div className="grid grid-cols-7 border-b border-gray-200 mb-1">
                            {WEEKDAY_NAMES.map((day, i) => (
                                <div
                                    key={day}
                                    className={`relative text-center text-[11px] font-extrabold uppercase tracking-widest pb-2 ${i === 0 || i === 6 ? "text-red-600" : "text-gray-800"
                                        }`}
                                >
                                    {day}
                                </div>
                            ))}
                        </div>

                        <div className="grid grid-cols-7 gap-1">
                            {cells.map((date, i) => {
                                if (!date) return <div key={`empty-${i}`} />;
                                const weekend = isWeekend(date);
                                const isToday = isSameDay(date, today);
                                return (
                                    <button
                                        key={date.toISOString()}
                                        type="button"
                                        onClick={() => setSelectedDate(date)}
                                        className={`h-12 rounded-lg text-left pl-2 pt-1 text-lg font-extrabold transition-colors hover:bg-primary/10 ${isToday
                                                ? "bg-blue-50 ring-2 ring-primary text-primary"
                                                : weekend
                                                    ? "bg-gray-100 text-red-600"
                                                    : "bg-gray-100 text-gray-800"
                                            }`}
                                    >
                                        {date.getDate()}
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    {/* Mini reference months -- 1/3 width, relative to currentDate */}
                    <div className="col-span-1 flex flex-col gap-6 border-l border-gray-200 pl-6">
                        <MiniMonthGrid
                            year={prevMonthDate.getFullYear()}
                            month={prevMonthDate.getMonth()}
                            label="Previous"
                        />
                        <MiniMonthGrid
                            year={nextMonthDate.getFullYear()}
                            month={nextMonthDate.getMonth()}
                            label="Next"
                        />
                    </div>
                </div>
            )}
        </Modal>
    );
}
