"use client";

import React, { useState, useMemo, useEffect, useRef, useLayoutEffect } from "react";

const fitTextarea = (el: HTMLTextAreaElement | null) => {
  if (!el) return;
  el.style.height = 'auto';
  el.style.height = el.scrollHeight + 'px';
};
import { motion, AnimatePresence } from "framer-motion";
import { Plus, Minus, X, Globe, Calendar, Edit2, ExternalLink, Link2 } from "lucide-react";
import styles from "./EventList.module.css";

const TODAY = new Date();
TODAY.setHours(0, 0, 0, 0);

const isPersonal = !process.env.NEXT_PUBLIC_VERCEL_ENV;

type TagType =
  | "grants" | "residencies" | "fellowship" | "competitions" | "exhibitions" | "conference"
  | "funded"
  | "text" | "images" | "video" | "code" | "portfolio" | "cv" | "proposal"
  | "admin";

interface TodoItem {
  id: string;
  text: string;
  completed: boolean;
  createdAt?: string;
  completedAt?: string | null;
}

// Recurring opportunity (residency / grant / competition). Presence of this
// object marks an event as a recurring template instance. State (watching/open)
// is never stored — it's computed from openDate − leadDays vs today, so it
// can't drift. Only dateStatus (a real user action) is persisted.
interface Recurrence {
  openDate: string;                          // YYYY-MM-DD — this cycle's application-open date (guess or verified)
  leadDays: number;                          // surface this many days before openDate
  dateStatus: 'provisional' | 'confirmed';   // provisional = guessed from last cycle; confirmed = verified on source
  eligibilityNote?: string;                  // free text shown on the surfaced card
  cycleLabel?: string;                       // optional display label, e.g. "2026"
}

interface EventItem {
  id: string;
  name: string;
  dueDate: string;
  description: string;
  url?: string;
  tags: TagType[];
  todos: TodoItem[];
  status: 'active' | 'completed' | 'incomplete';
  nextAction?: string;
  createdAt?: string;
  completedAt?: string | null;
  closingNote?: string;   // optional note left when marking complete/incomplete
  gardenedAt?: string | null;
  starred?: boolean;
  recurrence?: Recurrence;
}

interface DailyTask {
  id: string;
  text: string;
  completed: boolean;
  date: string;
  linkedEventId?: string;
  linkedTodoId?: string;
  rheiItemId?: string;
  createdAt?: string;
  completedAt?: string | null;
  changes?: string[];
  carriedFrom?: string;
}

interface RheiItem {
  id: string;
  text: string;
  createdAt: string;
  engagements: Array<{
    date: string;
    addedAt: string;
    removedAt?: string;
  }>;
  scheduledTasks?: Array<{
    text: string;
    days: number[];  // 0=Sun, 1=Mon, 2=Tue, 3=Wed, 4=Thu, 5=Fri, 6=Sat
  }>;
}

interface PomodoroSession {
  id: string;
  taskId: string | null;
  taskText: string | null;
  eventId: string | null;
  eventName: string | null;
  nowId: string | null;
  startedAt: string;
  completedAt: string;
  durationSeconds: number;
  outcome?: 'completed' | 'fresh' | 'forceMajeure' | 'postponed' | 'aborted';
  forceMajeureReason?: string;
}

const AVAILABLE_TAGS: TagType[] = [
  "grants", "residencies", "fellowship", "competitions", "exhibitions", "conference",
  "funded",
  "text", "images", "video", "code", "portfolio", "cv", "proposal",
  "admin",
];

const now = () => new Date().toISOString();

const formatDate = (dateStr: string) => {
  const [year, month, day] = dateStr.split('-').map(Number);
  const d = new Date(year, month - 1, day);
  return d.toLocaleDateString("en-US", { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
};

const getDaysData = (dateStr: string) => {
  const [year, month, day] = dateStr.split('-').map(Number);
  const target = new Date(year, month - 1, day);
  target.setHours(0, 0, 0, 0);

  const diffTime = target.getTime() - TODAY.getTime();
  const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));
  const weekday = target.toLocaleDateString("en-US", { weekday: 'long' });

  let daysText = "";
  if (diffDays === 0) daysText = "Today";
  else if (diffDays === 1) daysText = "1 day";
  else if (diffDays === -1) daysText = "Yesterday";
  else if (diffDays < 0) daysText = `${Math.abs(diffDays)} days ago`;
  else daysText = `${diffDays} days`;

  return { daysText, weekday };
};

const parseLocalDate = (dateStr: string) => {
  const [year, month, day] = dateStr.split('-').map(Number);
  return new Date(year, month - 1, day);
};

// Roll a YYYY-MM-DD date forward by n years, for re-arming recurring cycles.
const addYears = (dateStr: string, n: number) => {
  const [year, month, day] = dateStr.split('-').map(Number);
  return `${year + n}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
};

// surfaceTime for a recurring item: it wakes this many ms before its open date.
const recurrenceSurfaceTime = (rec: Recurrence) =>
  parseLocalDate(rec.openDate).getTime() - rec.leadDays * 86400000;

// A recurring item whose window hasn't opened yet but whose DUE date is already imminent
// (≤15 days out, or overdue). This happens when the user entered a future recurrence date
// against a near-term deadline: the current cycle is live, so show it as an ordinary active
// deadline instead of sleeping it into Watching. Far-future recurring items (window not open,
// deadline still distant) stay dormant in Watching as normal.
const RECURRENCE_IMMINENT_DAYS = 15;
const recurrenceImminentOverride = (ev: EventItem) => {
  if (!ev.recurrence) return false;
  if (TODAY.getTime() >= recurrenceSurfaceTime(ev.recurrence)) return false; // window already open
  const dueDiffDays = Math.ceil((parseLocalDate(ev.dueDate).getTime() - TODAY.getTime()) / 86400000);
  return dueDiffDays <= RECURRENCE_IMMINENT_DAYS;
};

// Local timestamp (ms) → YYYY-MM-DD, so it can be fed to formatDate.
const getDateStrFromTime = (ms: number) => {
  const d = new Date(ms);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

const getDateStr = (offset: number) => {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

// Compare a UTC ISO timestamp against a local YYYY-MM-DD string.
// Stored timestamps are UTC (toISOString); todayStr / tomorrow etc. are local.
// startsWith() silently breaks when local date != UTC date.
const isLocalDate = (iso: string | null | undefined, dateStr: string) => {
  if (!iso) return false;
  const d = new Date(iso);
  const local = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  return local === dateStr;
};

export default function EventList() {
  const [events, setEvents] = useState<EventItem[]>([]);
  const [expandedIds, setExpandedIds] = useState<string[]>([]);
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [activeFilters, setActiveFilters] = useState<TagType[]>([]);
  const [showFilters, setShowFilters] = useState(false);
  const [theme, setTheme] = useState<'light' | 'dark'>('light');
  const [mounted, setMounted] = useState(false);
  const [currentTab, setCurrentTab] = useState<'ongoing' | 'archive'>('ongoing');

  // Daily task states
  const [dailyTasks, setDailyTasks] = useState<DailyTask[]>([]);
  const [dailyDateTab, setDailyDateTab] = useState<'yesterday' | 'today' | 'tomorrow' | 'rhei'>('today');
  const [newDailyTaskText, setNewDailyTaskText] = useState("");
  const [hideCompletedTasks, setHideCompletedTasks] = useState(false);
  const [linkingTaskId, setLinkingTaskId] = useState<string | null>(null);

  // Rhei states
  const [rheiItems, setRheiItems] = useState<RheiItem[]>([]);
  const [newRheiText, setNewRheiText] = useState("");
  const [rheiConfirmDeleteId, setRheiConfirmDeleteId] = useState<string | null>(null);
  const [rheiAddendumText, setRheiAddendumText] = useState<Record<string, string>>({});
  const [editingRheiId, setEditingRheiId] = useState<string | null>(null);
  const [rheiFormText, setRheiFormText] = useState("");
  const [rheiEditSchedule, setRheiEditSchedule] = useState<Array<{ text: string; days: number[] }>>([]);
  const [rheiCreateSchedule, setRheiCreateSchedule] = useState<Array<{ text: string; days: number[] }>>([]);
  const [showRheiScheduleEditor, setShowRheiScheduleEditor] = useState(false);

  // Gardening session states
  const [gardeningMode, setGardeningMode] = useState(false);
  const [gardenIndex, setGardenIndex] = useState(0);
  const [gardenDesc, setGardenDesc] = useState("");
  const [gardenNextAction, setGardenNextAction] = useState("");
  const [gardenTodos, setGardenTodos] = useState<TodoItem[]>([]);
  const [gardenNewTodo, setGardenNewTodo] = useState("");
  const gardenDescRef = useRef<HTMLTextAreaElement>(null);
  const formDescRef = useRef<HTMLTextAreaElement>(null);

  useLayoutEffect(() => {
    fitTextarea(gardenDescRef.current);
  }, [gardenDesc, gardeningMode, gardenIndex]);

  // Pomodoro states
  const POMODORO_DURATION = 35 * 60; // 35 minutes in seconds
  const [pomodoroActive, setPomodoroActive] = useState(false);
  const [pomodoroSeconds, setPomodoroSeconds] = useState(0);
  const [pomodoroTaskId, setPomodoroTaskId] = useState<string | null>(null);
  const [pomodoroEventId, setPomodoroEventId] = useState<string | null>(null);
  const [pomodoroSelectingTask, setPomodoroSelectingTask] = useState(false);
  const [pomodoroSessions, setPomodoroSessions] = useState<PomodoroSession[]>([]);
  const [pomodoroStartedAt, setPomodoroStartedAt] = useState<string | null>(null);
  const [pomodoroNewTaskText, setPomodoroNewTaskText] = useState("");
  const [pomodoroCompletedAt, setPomodoroCompletedAt] = useState<string | null>(null);
  const pomodoroRef = React.useRef<ReturnType<typeof setInterval> | null>(null);
  const [forceMajeurePrompt, setForceMajeurePrompt] = useState(false);
  const [forceMajeureReason, setForceMajeureReason] = useState("");

  // Backfill nowId on existing pomodoro sessions once per load
  const nowIdBackfillRan = React.useRef(false);

  // Session-only fallback for the Worked Out button when there's no Exercise rhei item (Vercel/empty data).
  // Holds the date string the user last tapped Worked Out; resets on reload.
  const [workedOutFallback, setWorkedOutFallback] = useState<string | null>(null);

  // Rhei tap debounce: optimistic state per item + pending timers
  const [pendingRheiState, setPendingRheiState] = useState<Record<string, boolean>>({});
  const pendingRheiTimers = React.useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const RHEI_DEBOUNCE_MS = 2500;

  // Subtask promote tap debounce: optimistic state per todo + pending timers
  const [pendingPromoteState, setPendingPromoteState] = useState<Record<string, boolean>>({});
  const pendingPromoteTimers = React.useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  // Watching (dormant recurring items) collapsed group — hidden by default, auditable on expand
  const [showWatching, setShowWatching] = useState(false);
  // Long Horizon: always visible as a collapsible "Long Horizon (N)" header, folded by default
  const [showLongHorizon, setShowLongHorizon] = useState(false);

  // Minimize state
  const [minimized, setMinimized] = useState(true);
  const [showNextActions, setShowNextActions] = useState(false);
  const minimizedLockedRef = React.useRef(true);
  const nextActionsLockedRef = React.useRef(false);
  const shiftTapRef = React.useRef<number>(0);
  const spaceTapRef = React.useRef<number>(0);

  const selectedDate = useMemo(() => {
    if (dailyDateTab === 'yesterday') return getDateStr(-1);
    if (dailyDateTab === 'tomorrow') return getDateStr(1);
    return getDateStr(0); // 'today' and 'rhei' both use today
  }, [dailyDateTab]);

  // Form states
  const [formData, setFormData] = useState({
    name: "",
    dueDate: "",
    description: "",
    url: "",
    tags: [] as TagType[],
    todos: [] as TodoItem[],
    status: 'active' as 'active' | 'completed' | 'incomplete',
    nextAction: "",
    // Recurrence (helper fields; assembled into a recurrence object on save)
    isRecurring: false,
    openDate: "",
    leadDays: 14,
    eligibilityNote: "",
    dateStatus: 'provisional' as 'provisional' | 'confirmed',
  });

  const [newTodoText, setNewTodoText] = useState("");

  useLayoutEffect(() => {
    fitTextarea(formDescRef.current);
  }, [formData.description, isAdding, editingId]);

  useEffect(() => {
    setMounted(true);
    fetch("/api/events")
      .then(res => res.json())
      .then(data => setEvents(Array.isArray(data) ? data : []));

    fetch("/api/daily-tasks")
      .then(res => res.json())
      .then(data => setDailyTasks(Array.isArray(data) ? data : []));

    fetch("/api/pomodoro-sessions")
      .then(res => res.json())
      .then(data => setPomodoroSessions(Array.isArray(data) ? data : []));

    fetch("/api/rhei")
      .then(res => res.json())
      .then(data => setRheiItems(Array.isArray(data) ? data : []));

    if (typeof window !== 'undefined' && window.matchMedia("(prefers-color-scheme: dark)").matches) {
      setTheme('dark');
    }
  }, []);

  // Auto-minimize on window blur, revert to locked states
  useEffect(() => {
    const handleBlur = () => {
      minimizedLockedRef.current = true;
      setMinimized(true);
      setShowNextActions(nextActionsLockedRef.current);
    };
    window.addEventListener('blur', handleBlur);
    return () => window.removeEventListener('blur', handleBlur);
  }, []);

  // Spacebar: hold to peek (un-minimize), double-tap to lock toggle
  // Shift: hold to peek (show next actions), double-tap to lock toggle
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (document.activeElement !== document.body) return;
      if (e.code === 'Space') {
        e.preventDefault();
        const t = Date.now();
        if (t - spaceTapRef.current < 400) {
          // Double-tap: toggle locked state
          minimizedLockedRef.current = !minimizedLockedRef.current;
          setMinimized(minimizedLockedRef.current);
          spaceTapRef.current = 0;
        } else {
          // Hold: peek (un-minimize temporarily)
          spaceTapRef.current = t;
          setMinimized(false);
        }
      }
      if (e.key === 'Shift') {
        const t = Date.now();
        if (t - shiftTapRef.current < 400) {
          // Double-tap: toggle locked state
          nextActionsLockedRef.current = !nextActionsLockedRef.current;
          setShowNextActions(nextActionsLockedRef.current);
          shiftTapRef.current = 0;
        } else {
          // Hold: peek (show next actions temporarily)
          shiftTapRef.current = t;
          setShowNextActions(true);
        }
      }
    };
    const handleKeyUp = (e: KeyboardEvent) => {
      // On release, revert to locked state (unless it was a double-tap, where ref is 0)
      if (e.code === 'Space' && spaceTapRef.current !== 0) {
        setMinimized(minimizedLockedRef.current);
      }
      if (e.key === 'Shift' && shiftTapRef.current !== 0) {
        setShowNextActions(nextActionsLockedRef.current);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, []);

  useEffect(() => {
    if (mounted) {
      document.documentElement.setAttribute('data-theme', theme);
    }
  }, [theme, mounted]);

  const toggleTheme = () => {
    setTheme(prev => prev === 'light' ? 'dark' : 'light');
  };

  const saveEvents = async (newEvents: EventItem[]) => {
    setEvents(newEvents);
    await fetch("/api/events", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(newEvents),
    });
  };

  const saveDailyTasks = async (newTasks: DailyTask[]) => {
    setDailyTasks(newTasks);
    await fetch("/api/daily-tasks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(newTasks),
    });
  };

  const saveRheiItems = async (items: RheiItem[]) => {
    setRheiItems(items);
    await fetch("/api/rhei", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(items),
    });
  };

  const todayStr = useMemo(() => getDateStr(0), []);

  const isRheiEngagedToday = (itemId: string): boolean => {
    const item = rheiItems.find(r => r.id === itemId);
    return item?.engagements.some(e => e.date === todayStr && !e.removedAt) ?? false;
  };

  // Effective state respects an in-flight pending tap; falls back to committed state.
  const isRheiEngagedTodayEffective = (itemId: string): boolean => {
    if (itemId in pendingRheiState) return pendingRheiState[itemId];
    return isRheiEngagedToday(itemId);
  };

  const handleAddRheiItem = () => {
    if (!newRheiText.trim()) return;
    const newItem: RheiItem = {
      id: Math.random().toString(36).substr(2, 9),
      text: newRheiText.trim(),
      createdAt: now(),
      engagements: [],
      ...(rheiCreateSchedule.length > 0 && { scheduledTasks: rheiCreateSchedule.filter(s => s.text.trim() && s.days.length > 0) }),
    };
    saveRheiItems([...rheiItems, newItem]);
    setNewRheiText("");
    setRheiCreateSchedule([]);
    setShowRheiScheduleEditor(false);
  };

  const handleSaveRheiEdit = () => {
    if (!editingRheiId || !rheiFormText.trim()) return;
    const cleanSchedule = rheiEditSchedule.filter(s => s.text.trim() && s.days.length > 0);
    const updated = rheiItems.map(r =>
      r.id === editingRheiId
        ? { ...r, text: rheiFormText.trim(), scheduledTasks: cleanSchedule.length > 0 ? cleanSchedule : undefined }
        : r
    );
    saveRheiItems(updated);
    setEditingRheiId(null);
    setRheiFormText("");
    setRheiEditSchedule([]);
  };

  const startEditingRhei = (item: RheiItem) => {
    setEditingRheiId(item.id);
    setRheiFormText(item.text);
    setRheiEditSchedule(item.scheduledTasks || []);
    setShowRheiScheduleEditor(false);
  };

  const handleDeleteRheiItem = (itemId: string) => {
    // Also remove any daily task for today linked to this rhei item
    const updatedTasks = dailyTasks.filter(
      t => !(t.rheiItemId === itemId && t.date === todayStr)
    );
    if (updatedTasks.length !== dailyTasks.length) {
      saveDailyTasks(updatedTasks);
    }
    saveRheiItems(rheiItems.filter(r => r.id !== itemId));
  };

  const handleToggleRheiEngagement = (itemId: string) => {
    const committed = isRheiEngagedToday(itemId);
    const effective = isRheiEngagedTodayEffective(itemId);
    const next = !effective;

    // Clear any in-flight timer for this item — we're re-arming.
    const existingTimer = pendingRheiTimers.current[itemId];
    if (existingTimer) clearTimeout(existingTimer);
    delete pendingRheiTimers.current[itemId];

    if (next === committed) {
      // User reverted to committed state within window — drop pending entirely.
      setPendingRheiState(prev => {
        const { [itemId]: _, ...rest } = prev;
        return rest;
      });
      return;
    }

    setPendingRheiState(prev => ({ ...prev, [itemId]: next }));

    pendingRheiTimers.current[itemId] = setTimeout(() => {
      delete pendingRheiTimers.current[itemId];
      setPendingRheiState(prev => {
        const { [itemId]: _, ...rest } = prev;
        return rest;
      });
      commitRheiToggle(itemId);
    }, RHEI_DEBOUNCE_MS);
  };

  const commitRheiToggle = (itemId: string) => {
    const ts = now();
    const item = rheiItems.find(r => r.id === itemId);
    if (!item) return;

    const activeEngagement = item.engagements.find(e => e.date === todayStr && !e.removedAt);

    if (activeEngagement) {
      // Untap: mark engagement as removed, delete daily task
      const updatedRhei = rheiItems.map(r =>
        r.id === itemId
          ? { ...r, engagements: r.engagements.map(e =>
              e.date === todayStr && !e.removedAt ? { ...e, removedAt: ts } : e
            )}
          : r
      );
      saveRheiItems(updatedRhei);
      const updatedTasks = dailyTasks.filter(
        t => !(t.rheiItemId === itemId && t.date === todayStr)
      );
      saveDailyTasks(updatedTasks);
    } else {
      // Tap on: add fresh engagement, create daily task
      const updatedRhei = rheiItems.map(r =>
        r.id === itemId
          ? { ...r, engagements: [...r.engagements, { date: todayStr, addedAt: ts }] }
          : r
      );
      saveRheiItems(updatedRhei);
      // Only create daily task if one doesn't already exist
      const alreadyExists = dailyTasks.some(t => t.rheiItemId === itemId && t.date === todayStr);
      const newTasks: DailyTask[] = [];
      if (!alreadyExists) {
        newTasks.push({
          id: Math.random().toString(36).substr(2, 9),
          text: item.text,
          completed: false,
          date: todayStr,
          rheiItemId: itemId,
          createdAt: ts,
          completedAt: null,
          changes: [ts],
        });
      }
      // Auto-create scheduled tasks for today
      if (item.scheduledTasks) {
        const todayDay = new Date().getDay();
        item.scheduledTasks
          .filter(st => st.days.includes(todayDay))
          .forEach(st => {
            const fullText = `${item.text} - ${st.text}`;
            if (!dailyTasks.some(t => t.rheiItemId === itemId && t.date === todayStr && t.text === fullText)) {
              newTasks.push({
                id: Math.random().toString(36).substr(2, 9),
                text: fullText,
                completed: false,
                date: todayStr,
                rheiItemId: itemId,
                createdAt: ts,
                completedAt: null,
                changes: [ts],
              });
            }
          });
      }
      if (newTasks.length > 0) {
        saveDailyTasks([...dailyTasks, ...newTasks]);
      }
    }
  };

  // A subtask is "promoted today" when a daily task for today links back to it.
  const isTodoPromotedToday = (todoId: string): boolean =>
    dailyTasks.some(t => t.linkedTodoId === todoId && t.date === todayStr);

  // Effective state respects an in-flight pending tap; falls back to committed state.
  const isTodoPromotedTodayEffective = (todoId: string): boolean => {
    if (todoId in pendingPromoteState) return pendingPromoteState[todoId];
    return isTodoPromotedToday(todoId);
  };

  const handlePromoteTodo = (eventId: string, todo: TodoItem) => {
    const committed = isTodoPromotedToday(todo.id);
    const effective = isTodoPromotedTodayEffective(todo.id);
    const next = !effective;

    // Clear any in-flight timer for this todo — we're re-arming.
    const existingTimer = pendingPromoteTimers.current[todo.id];
    if (existingTimer) clearTimeout(existingTimer);
    delete pendingPromoteTimers.current[todo.id];

    if (next === committed) {
      // User reverted to committed state within window — drop pending entirely.
      setPendingPromoteState(prev => {
        const { [todo.id]: _, ...rest } = prev;
        return rest;
      });
      return;
    }

    setPendingPromoteState(prev => ({ ...prev, [todo.id]: next }));

    pendingPromoteTimers.current[todo.id] = setTimeout(() => {
      delete pendingPromoteTimers.current[todo.id];
      setPendingPromoteState(prev => {
        const { [todo.id]: _, ...rest } = prev;
        return rest;
      });
      commitPromoteTodo(eventId, todo);
    }, RHEI_DEBOUNCE_MS);
  };

  const commitPromoteTodo = (eventId: string, todo: TodoItem) => {
    const ts = now();
    const existing = dailyTasks.find(t => t.linkedTodoId === todo.id && t.date === todayStr);
    if (existing) {
      // Un-promote: remove the open linked task for today only — never drop a completed record.
      if (!existing.completed) {
        saveDailyTasks(dailyTasks.filter(t => t.id !== existing.id));
      }
    } else {
      // Promote: add a fresh open daily task linked to the subtask.
      const newTask: DailyTask = {
        id: Math.random().toString(36).substr(2, 9),
        text: todo.text,
        completed: false,
        date: todayStr,
        linkedEventId: eventId,
        linkedTodoId: todo.id,
        createdAt: ts,
        completedAt: null,
        changes: [ts],
      };
      saveDailyTasks([...dailyTasks, newTask]);
    }
  };

  const handleAddRheiAddendum = (itemId: string) => {
    const text = (rheiAddendumText[itemId] || '').trim();
    if (!text) return;
    const item = rheiItems.find(r => r.id === itemId);
    if (!item) return;
    const ts = now();
    const newTask: DailyTask = {
      id: Math.random().toString(36).substr(2, 9),
      text: `${item.text} - ${text}`,
      completed: false,
      date: todayStr,
      rheiItemId: itemId,
      createdAt: ts,
      completedAt: null,
      changes: [ts],
    };
    saveDailyTasks([...dailyTasks, newTask]);
    setRheiAddendumText(prev => ({ ...prev, [itemId]: '' }));
  };

  const savePomodoroSessions = async (sessions: PomodoroSession[]) => {
    setPomodoroSessions(sessions);
    await fetch("/api/pomodoro-sessions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(sessions),
    });
  };

  // One-shot backfill: when both sessions and rhei are loaded, link existing sessions to nowId by taskText match.
  useEffect(() => {
    if (nowIdBackfillRan.current) return;
    if (pomodoroSessions.length === 0 || rheiItems.length === 0) return;
    let patched = false;
    const updated = pomodoroSessions.map(s => {
      if (s.nowId !== undefined && s.nowId !== null) return s;
      if (!s.taskText) return { ...s, nowId: s.nowId ?? null };
      const match = rheiItems.find(r => r.text === s.taskText);
      if (match) {
        patched = true;
        return { ...s, nowId: match.id };
      }
      return { ...s, nowId: s.nowId ?? null };
    });
    nowIdBackfillRan.current = true;
    if (patched) savePomodoroSessions(updated);
  }, [pomodoroSessions, rheiItems]);

  const tasksForSelectedDate = useMemo(() => {
    return dailyTasks
      .filter(t => t.date === selectedDate)
      .sort((a, b) => Number(a.completed) - Number(b.completed));
  }, [dailyTasks, selectedDate]);

  const handleAddDailyTask = () => {
    if (!newDailyTaskText.trim()) return;
    const ts = now();
    const newTask: DailyTask = {
      id: Math.random().toString(36).substr(2, 9),
      text: newDailyTaskText.trim(),
      completed: false,
      date: selectedDate,
      createdAt: ts,
      completedAt: null,
      changes: [ts],
    };
    saveDailyTasks([...dailyTasks, newTask]);
    setNewDailyTaskText("");
  };

  const handleToggleDailyTask = (taskId: string) => {
    const ts = now();
    const task = dailyTasks.find(t => t.id === taskId);
    const toggled = !(task?.completed);
    const updated = dailyTasks.map(t => {
      if (t.id !== taskId) return t;
      return {
        ...t,
        completed: toggled,
        completedAt: toggled ? ts : null,
        changes: [...(t.changes || []), ts],
      };
    });
    saveDailyTasks(updated);

    // Two-way sync: mirror completion onto the linked horizon subtask.
    if (task?.linkedTodoId && task.linkedEventId) {
      const updatedEvents = events.map(ev => {
        if (ev.id !== task.linkedEventId) return ev;
        return {
          ...ev,
          todos: (ev.todos || []).map(td => td.id === task.linkedTodoId
            ? { ...td, completed: toggled, completedAt: toggled ? ts : null }
            : td),
        };
      });
      saveEvents(updatedEvents);
    }
  };

  const handleDeleteDailyTask = (taskId: string) => {
    saveDailyTasks(dailyTasks.filter(t => t.id !== taskId));
  };

  const handleLinkDailyTask = (taskId: string, eventId: string | undefined) => {
    const updated = dailyTasks.map(t =>
      t.id === taskId ? { ...t, linkedEventId: eventId } : t
    );
    saveDailyTasks(updated);
    setLinkingTaskId(null);
  };

  const uncheckedPrior = useMemo(() => {
    return dailyTasks.filter(t => t.date < todayStr && !t.completed && !(t.rheiItemId && rheiItems.some(r => r.id === t.rheiItemId && r.text === t.text)));
  }, [dailyTasks, todayStr, rheiItems]);

  const handleCarryForward = () => {
    const ts = now();
    const priorIds = new Set(uncheckedPrior.map(t => t.id));
    const copies = uncheckedPrior.map(t => ({
      ...t,
      id: Math.random().toString(36).substr(2, 9),
      date: selectedDate,
      carriedFrom: t.carriedFrom || t.date,
      changes: [...(t.changes || []), ts],
    }));
    const remaining = dailyTasks.filter(t => !priorIds.has(t.id));
    saveDailyTasks([...remaining, ...copies]);
  };

  const activeEvents = useMemo(() => {
    return events.filter(ev => (ev.status || 'active') === 'active');
  }, [events]);

  const toggleExpand = (id: string) => {
    setExpandedIds(prev =>
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  const handleToggleFilter = (tag: TagType) => {
    setActiveFilters(prev =>
      prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]
    );
  };

  const handleToggleFormTag = (tag: TagType) => {
    setFormData(prev => ({
      ...prev,
      tags: (prev.tags || []).includes(tag)
        ? (prev.tags || []).filter(t => t !== tag)
        : [...(prev.tags || []), tag]
    }));
  };

  const handleAddTodo = () => {
    if (!newTodoText.trim()) return;
    const newTodo: TodoItem = {
      id: Math.random().toString(36).substr(2, 9),
      text: newTodoText.trim(),
      completed: false,
      createdAt: now(),
      completedAt: null,
    };
    setFormData(prev => ({
      ...prev,
      todos: [...(prev.todos || []), newTodo]
    }));
    setNewTodoText("");
  };

  const handleRemoveTodo = (id: string) => {
    setFormData(prev => ({
      ...prev,
      todos: (prev.todos || []).filter(t => t.id !== id)
    }));
  };

  const toggleTodoCompletion = async (eventId: string, todoId: string) => {
    const ts = now();
    const event = events.find(ev => ev.id === eventId);
    const todo = event?.todos?.find(t => t.id === todoId);
    if (!todo) return;
    const nextCompleted = !todo.completed;

    const updatedEvents = events.map(ev => {
      if (ev.id === eventId) {
        return {
          ...ev,
          todos: (ev.todos || []).map(t => t.id === todoId ? { ...t, completed: nextCompleted, completedAt: nextCompleted ? ts : null } : t)
        };
      }
      return ev;
    });
    await saveEvents(updatedEvents);

    // Two-way sync: cancel any in-flight promote tap so we don't double-create.
    const pendingTimer = pendingPromoteTimers.current[todoId];
    if (pendingTimer) clearTimeout(pendingTimer);
    delete pendingPromoteTimers.current[todoId];
    if (todoId in pendingPromoteState) {
      setPendingPromoteState(prev => {
        const { [todoId]: _, ...rest } = prev;
        return rest;
      });
    }

    // Surface/sync a linked daily task for today (dedupe onto an existing one).
    const existing = dailyTasks.find(t => t.linkedTodoId === todoId && t.date === todayStr);
    if (existing) {
      saveDailyTasks(dailyTasks.map(t => t.id === existing.id
        ? { ...t, completed: nextCompleted, completedAt: nextCompleted ? ts : null, changes: [...(t.changes || []), ts] }
        : t));
    } else if (nextCompleted) {
      saveDailyTasks([...dailyTasks, {
        id: Math.random().toString(36).substr(2, 9),
        text: todo.text,
        completed: true,
        date: todayStr,
        linkedEventId: eventId,
        linkedTodoId: todoId,
        createdAt: ts,
        completedAt: ts,
        changes: [ts],
      }]);
    }
  };

  const handleNextActionChange = async (eventId: string, nextAction: string) => {
    const trimmed = nextAction.trim();
    const updatedEvents = events.map(ev => ev.id === eventId ? { ...ev, nextAction: trimmed || undefined } : ev);
    await saveEvents(updatedEvents);
  };

  const handleDelete = async (eventId: string) => {
    if (!confirm('Are you sure you want to delete this task?')) return;
    const updatedEvents = events.filter(ev => ev.id !== eventId);
    const deletedEvent = events.find(ev => ev.id === eventId);
    if (deletedEvent) {
      // Send the deleted event info so the API can rename the folder
      await fetch('/api/events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ events: updatedEvents, deleted: [deletedEvent] }),
      });
      setEvents(updatedEvents);
    }
  };

  const handleStarToggle = async (eventId: string) => {
    const updatedEvents = events.map(ev => ev.id === eventId ? { ...ev, starred: !ev.starred } : ev);
    await saveEvents(updatedEvents);
  };

  // Lock a recurring item's dates: provisional → confirmed (drops the "≈ guess" styling).
  const handleConfirmDates = async (eventId: string) => {
    const updatedEvents = events.map(ev =>
      ev.id === eventId && ev.recurrence
        ? { ...ev, recurrence: { ...ev.recurrence, dateStatus: 'confirmed' as const } }
        : ev
    );
    await saveEvents(updatedEvents);
  };

  const handleStatusChange = async (eventId: string, status: 'active' | 'completed' | 'incomplete', note?: string) => {
    const ts = now();
    const spawned: EventItem[] = [];
    const updatedEvents = events.map(ev => {
      if (ev.id !== eventId) return ev;
      // Re-arm: marking a recurring item done freezes this instance (untouched but for
      // status/completedAt) and spawns next cycle's provisional instance from the template.
      if (ev.recurrence && (status === 'completed' || status === 'incomplete')) {
        const label = ev.recurrence.cycleLabel;
        spawned.push({
          ...ev,
          id: Math.random().toString(36).substr(2, 9),
          status: 'active',
          dueDate: addYears(ev.dueDate, 1),
          todos: [],
          starred: false,
          nextAction: undefined,
          createdAt: ts,
          completedAt: null,
          closingNote: undefined,
          gardenedAt: null,
          recurrence: {
            ...ev.recurrence,
            openDate: addYears(ev.recurrence.openDate, 1),
            dateStatus: 'provisional',
            ...(label && /^\d{4}$/.test(label) ? { cycleLabel: String(Number(label) + 1) } : {}),
          },
        });
      }
      return {
        ...ev,
        status,
        // Preserve completedAt when only the note is being edited on an already-completed item.
        completedAt: status === 'completed' ? (ev.status === 'completed' ? ev.completedAt : ts) : (status === 'active' ? null : ev.completedAt),
        // undefined note = leave the existing note untouched; empty string clears it.
        closingNote: note !== undefined ? (note.trim() || undefined) : ev.closingNote,
      };
    });
    await saveEvents([...updatedEvents, ...spawned]);
  };

  const resetForm = () => {
    setFormData({ name: "", dueDate: "", description: "", url: "", tags: [], todos: [], status: 'active', nextAction: "", isRecurring: false, openDate: "", leadDays: 14, eligibilityNote: "", dateStatus: 'provisional' });
    setIsAdding(false);
    setEditingId(null);
    setNewTodoText("");
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name || !formData.dueDate) return;

    // Peel the recurrence helper fields off formData and assemble the recurrence object.
    const { isRecurring, openDate, leadDays, eligibilityNote, dateStatus, ...rest } = formData;
    const cleanedFormData = { ...rest, nextAction: rest.nextAction?.trim() || undefined };
    const recurrence: Recurrence | undefined = isRecurring
      ? {
          openDate: openDate || rest.dueDate,
          leadDays: Number(leadDays) || 14,
          dateStatus,
          ...(eligibilityNote.trim() ? { eligibilityNote: eligibilityNote.trim() } : {}),
        }
      : undefined;

    let updatedEvents;
    if (editingId) {
      updatedEvents = events.map(ev => ev.id === editingId ? { ...ev, ...cleanedFormData, recurrence, id: editingId } : ev);
      setExpandedIds(prev => prev.filter(i => i !== editingId));
    } else {
      const newEvent: EventItem = {
        ...cleanedFormData,
        recurrence,
        id: Math.random().toString(36).substr(2, 9),
        status: 'active',
        createdAt: now(),
        completedAt: null,
        gardenedAt: null,
      };
      updatedEvents = [...events, newEvent];
    }

    await saveEvents(updatedEvents);
    resetForm();
  };

  const startEdit = (e: React.MouseEvent, event: EventItem) => {
    e.stopPropagation();
    setFormData({
      ...event,
      url: event.url || "",
      tags: event.tags || [],
      todos: event.todos || [],
      status: event.status || 'active',
      nextAction: event.nextAction || "",
      isRecurring: !!event.recurrence,
      openDate: event.recurrence?.openDate || "",
      leadDays: event.recurrence?.leadDays ?? 14,
      eligibilityNote: event.recurrence?.eligibilityNote || "",
      dateStatus: event.recurrence?.dateStatus || 'provisional',
    });
    setEditingId(event.id);
    setIsAdding(false);
  };

  const filteredEvents = useMemo(() => {
    let result = events;
    if (activeFilters.length > 0) {
      result = result.filter(ev => activeFilters.every(f => (ev.tags || []).includes(f)));
    }
    return result;
  }, [events, activeFilters]);

  const groupedEvents = useMemo(() => {
    const active = filteredEvents.filter(ev => (ev.status || 'active') === 'active').sort((a, b) => parseLocalDate(a.dueDate).getTime() - parseLocalDate(b.dueDate).getTime());
    const archived = filteredEvents.filter(ev => (ev.status || 'active') !== 'active').sort((a, b) => parseLocalDate(b.dueDate).getTime() - parseLocalDate(a.dueDate).getTime());

    const thisWeek: EventItem[] = [];
    const later: EventItem[] = [];
    const longHorizon: EventItem[] = [];
    const overTheHorizon: EventItem[] = [];
    const watching: EventItem[] = [];     // recurring, dormant (today < openDate − leadDays)
    const openingSoon: EventItem[] = [];  // recurring, surfaced but still provisional — "check the date"

    active.forEach(ev => {
      // Recurring items sleep into Watching until their window opens. Exception:
      // recurrenceImminentOverride items have a near-term deadline (current cycle is live),
      // so they fall through to normal dueDate grouping instead of being parked.
      if (ev.recurrence && !recurrenceImminentOverride(ev)) {
        if (TODAY.getTime() < recurrenceSurfaceTime(ev.recurrence)) { watching.push(ev); return; }
        if (ev.recurrence.dateStatus === 'provisional') { openingSoon.push(ev); return; }
        // confirmed recurring items fall through to normal dueDate horizon logic
      }
      const diffTime = parseLocalDate(ev.dueDate).getTime() - TODAY.getTime();
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      if (diffDays < 0) overTheHorizon.push(ev);
      else if (diffDays <= 15) thisWeek.push(ev);
      else if (diffDays > 180) longHorizon.push(ev);
      else later.push(ev);
    });

    watching.sort((a, b) => recurrenceSurfaceTime(a.recurrence!) - recurrenceSurfaceTime(b.recurrence!));
    openingSoon.sort((a, b) => parseLocalDate(a.recurrence!.openDate).getTime() - parseLocalDate(b.recurrence!.openDate).getTime());

    return { thisWeek, later, longHorizon, overTheHorizon, watching, openingSoon, archived };
  }, [filteredEvents]);

  // --- Gardening session ---
  const gardenEvents = useMemo(() => {
    return events
      .filter(ev => (ev.status || 'active') === 'active')
      // Skip dormant recurring items — they're intentionally parked until their window opens.
      // (Imminent-deadline overrides are a live current cycle, so they stay gardenable.)
      .filter(ev => !ev.recurrence || recurrenceImminentOverride(ev) || TODAY.getTime() >= recurrenceSurfaceTime(ev.recurrence))
      .sort((a, b) => parseLocalDate(a.dueDate).getTime() - parseLocalDate(b.dueDate).getTime());
  }, [events]);

  const currentGardenEvent = gardeningMode && gardenIndex < gardenEvents.length ? gardenEvents[gardenIndex] : null;

  const startGardening = () => {
    if (gardenEvents.length === 0) return;
    setGardenIndex(0);
    loadGardenEvent(gardenEvents[0]);
    setGardeningMode(true);
  };

  const loadGardenEvent = (ev: EventItem) => {
    setGardenDesc(ev.description || "");
    setGardenNextAction(ev.nextAction || "");
    setGardenTodos([...(ev.todos || [])]);
    setGardenNewTodo("");
  };

  const gardenSaveAndNext = async () => {
    if (!currentGardenEvent) return;
    const ts = now();
    const updatedEvents = events.map(ev => {
      if (ev.id !== currentGardenEvent.id) return ev;
      return {
        ...ev,
        description: gardenDesc,
        nextAction: gardenNextAction.trim() || undefined,
        todos: gardenTodos,
        gardenedAt: ts,
      };
    });
    await saveEvents(updatedEvents);
    advanceGarden(updatedEvents);
  };

  const gardenSkip = async () => {
    if (!currentGardenEvent) return;
    const ts = now();
    const updatedEvents = events.map(ev =>
      ev.id === currentGardenEvent.id ? { ...ev, gardenedAt: ts } : ev
    );
    await saveEvents(updatedEvents);
    advanceGarden(updatedEvents);
  };

  const advanceGarden = (latestEvents: EventItem[]) => {
    const nextIndex = gardenIndex + 1;
    const activeSorted = latestEvents
      .filter(ev => (ev.status || 'active') === 'active')
      .sort((a, b) => parseLocalDate(a.dueDate).getTime() - parseLocalDate(b.dueDate).getTime());
    if (nextIndex >= activeSorted.length) {
      setGardeningMode(false);
      return;
    }
    setGardenIndex(nextIndex);
    loadGardenEvent(activeSorted[nextIndex]);
  };

  // --- Pomodoro logic ---
  const logPomodoroSession = (durationSeconds: number, outcome: PomodoroSession['outcome'] = 'completed', forceMajeureReason?: string) => {
    const dailyTask = pomodoroTaskId ? dailyTasks.find(t => t.id === pomodoroTaskId) : null;
    const event = pomodoroEventId ? events.find(e => e.id === pomodoroEventId) : null;
    const subtask = (event && pomodoroTaskId) ? event.todos?.find(t => t.id === pomodoroTaskId) : null;
    const taskText = dailyTask?.text || subtask?.text || null;
    const resolvedEventId = pomodoroEventId || dailyTask?.linkedEventId || null;
    const resolvedEventName = event?.name || (dailyTask?.linkedEventId ? events.find(e => e.id === dailyTask.linkedEventId)?.name : null) || null;
    // Propagate rhei link if the source daily task was created from a Now item, else fall back to text match.
    const resolvedNowId = dailyTask?.rheiItemId
      || (taskText ? rheiItems.find(r => r.text === taskText)?.id : null)
      || null;
    // Auto-mark anything under 60s as aborted (unless it was deliberately categorized).
    const finalOutcome: PomodoroSession['outcome'] =
      outcome === 'completed' && durationSeconds < 60 ? 'aborted' : outcome;
    const session: PomodoroSession = {
      id: Math.random().toString(36).substr(2, 9),
      taskId: pomodoroTaskId,
      taskText,
      eventId: resolvedEventId,
      eventName: resolvedEventName,
      nowId: resolvedNowId,
      startedAt: pomodoroStartedAt || now(),
      completedAt: now(),
      durationSeconds,
      outcome: finalOutcome,
      ...(forceMajeureReason && { forceMajeureReason }),
    };
    savePomodoroSessions([...pomodoroSessions, session]);
  };

  const startPomodoro = () => {
    // When resuming after postpone, adjust startedAt to account for already-elapsed time
    const resumeOffset = pomodoroSeconds > 0 ? pomodoroSeconds * 1000 : 0;
    setPomodoroStartedAt(new Date(Date.now() - resumeOffset).toISOString());
    setPomodoroCompletedAt(null);
    setPomodoroActive(true);
  };

  const completePomodoro = () => {
    setPomodoroActive(false);
    if (pomodoroRef.current) clearInterval(pomodoroRef.current);
    pomodoroRef.current = null;
    if (pomodoroStartedAt && pomodoroSeconds > 0) {
      logPomodoroSession(pomodoroSeconds);
    }
    // Mark the associated task as complete
    if (pomodoroTaskId) {
      const isDailyTask = dailyTasks.some(t => t.id === pomodoroTaskId);
      if (isDailyTask) {
        const task = dailyTasks.find(t => t.id === pomodoroTaskId);
        if (task && !task.completed) {
          handleToggleDailyTask(pomodoroTaskId);
        }
      } else if (pomodoroEventId) {
        const ev = events.find(e => e.id === pomodoroEventId);
        const todo = ev?.todos?.find(t => t.id === pomodoroTaskId);
        if (todo && !todo.completed) {
          toggleTodoCompletion(pomodoroEventId, pomodoroTaskId);
        }
      }
    }
    setPomodoroSeconds(0);
    setPomodoroStartedAt(null);
    setPomodoroCompletedAt(null);
  };

  const postponePomodoro = () => {
    setPomodoroActive(false);
  };

  const freshPomodoro = () => {
    // Log the interrupted session as a distraction signal
    if (pomodoroStartedAt && pomodoroSeconds > 0) {
      logPomodoroSession(pomodoroSeconds, 'fresh');
    }
    // Reset timer but keep same task
    if (pomodoroRef.current) clearInterval(pomodoroRef.current);
    pomodoroRef.current = null;
    setPomodoroSeconds(0);
    setPomodoroStartedAt(now());
    setPomodoroCompletedAt(null);
    setPomodoroActive(true);
  };

  const forceMajeurePomodoro = (reason: string) => {
    setPomodoroActive(false);
    if (pomodoroRef.current) clearInterval(pomodoroRef.current);
    pomodoroRef.current = null;
    if (pomodoroStartedAt && pomodoroSeconds > 0) {
      logPomodoroSession(pomodoroSeconds, 'forceMajeure', reason);
    } else {
      const session: PomodoroSession = {
        id: Math.random().toString(36).substr(2, 9),
        taskId: null, taskText: null, eventId: null, eventName: null, nowId: null,
        startedAt: now(), completedAt: now(), durationSeconds: 0,
        outcome: 'forceMajeure',
        forceMajeureReason: reason,
      };
      savePomodoroSessions([...pomodoroSessions, session]);
    }
    setPomodoroSeconds(0);
    setPomodoroStartedAt(null);
    setPomodoroCompletedAt(null);
    setForceMajeurePrompt(false);
    setForceMajeureReason("");
  };

  const newPomodoro = () => {
    setPomodoroActive(false);
    setPomodoroSeconds(0);
    setPomodoroStartedAt(null);
    setPomodoroCompletedAt(null);
    if (pomodoroRef.current) clearInterval(pomodoroRef.current);
    pomodoroRef.current = null;
    setPomodoroTaskId(null);
    setPomodoroEventId(null);
    setPomodoroSelectingTask(true);
  };

  useEffect(() => {
    if (pomodoroActive && pomodoroStartedAt) {
      const startTime = new Date(pomodoroStartedAt).getTime();
      pomodoroRef.current = setInterval(() => {
        const elapsed = Math.floor((Date.now() - startTime) / 1000);
        if (elapsed >= POMODORO_DURATION) {
          setPomodoroActive(false);
          if (pomodoroRef.current) clearInterval(pomodoroRef.current);
          pomodoroRef.current = null;
          setPomodoroSeconds(POMODORO_DURATION);
        } else {
          setPomodoroSeconds(elapsed);
        }
      }, 1000);
    }
    return () => {
      if (pomodoroRef.current) clearInterval(pomodoroRef.current);
    };
  }, [pomodoroActive, pomodoroStartedAt]);

  // Log session when timer completes
  useEffect(() => {
    if (pomodoroSeconds >= POMODORO_DURATION && pomodoroStartedAt) {
      logPomodoroSession(POMODORO_DURATION);
      setPomodoroCompletedAt(now());
    }
  }, [pomodoroSeconds]);

  const pomodoroProgress = pomodoroSeconds / POMODORO_DURATION;
  const pomodoroMinutes = Math.floor(pomodoroSeconds / 60);
  const pomodoroSecs = pomodoroSeconds % 60;
  const pomodoroComplete = pomodoroSeconds >= POMODORO_DURATION;

  const pomodoroTask = pomodoroTaskId
    ? dailyTasks.find(t => t.id === pomodoroTaskId)
      || (pomodoroEventId
        ? (() => {
            const ev = events.find(e => e.id === pomodoroEventId);
            const todo = ev?.todos?.find(t => t.id === pomodoroTaskId);
            return todo ? { id: todo.id, text: todo.text, completed: todo.completed, date: '', _isSubtask: true } : null;
          })()
        : null)
    : null;

  const pomodoroEvent = pomodoroEventId
    ? events.find(e => e.id === pomodoroEventId)
    : null;

  const pomodoroHasSelection = !!(pomodoroTask || pomodoroEvent);

  const handlePomodoroCreateTask = () => {
    if (!pomodoroNewTaskText.trim()) return;
    const ts = now();
    const newTask: DailyTask = {
      id: Math.random().toString(36).substr(2, 9),
      text: pomodoroNewTaskText.trim(),
      completed: false,
      date: getDateStr(0),
      linkedEventId: pomodoroEventId || undefined,
      createdAt: ts,
      completedAt: null,
      changes: [ts],
    };
    saveDailyTasks([...dailyTasks, newTask]);
    setPomodoroTaskId(newTask.id);
    setPomodoroNewTaskText("");
    setPomodoroSelectingTask(false);
    startPomodoro();
  };

  const handlePomodoroSelectEvent = (eventId: string) => {
    setPomodoroEventId(eventId);
    setPomodoroTaskId(null);
    // Don't auto-start — user may want to pick a subtask
  };

  const handlePomodoroSelectTask = (taskId: string) => {
    const task = dailyTasks.find(t => t.id === taskId);
    setPomodoroTaskId(taskId);
    setPomodoroEventId(task?.linkedEventId || null);
    setPomodoroSelectingTask(false);
    startPomodoro();
  };

  const handlePomodoroSelectSubtask = (eventId: string, todo: TodoItem) => {
    setPomodoroEventId(eventId);
    setPomodoroTaskId(todo.id);
    setPomodoroSelectingTask(false);
    startPomodoro();
  };

  const handlePomodoroClearSelection = () => {
    setPomodoroTaskId(null);
    setPomodoroEventId(null);
    setPomodoroSelectingTask(false);
  };

  const gardenAddTodo = () => {
    if (!gardenNewTodo.trim()) return;
    setGardenTodos(prev => [...prev, {
      id: Math.random().toString(36).substr(2, 9),
      text: gardenNewTodo.trim(),
      completed: false,
      createdAt: now(),
      completedAt: null,
    }]);
    setGardenNewTodo("");
  };

  const gardenToggleTodo = (todoId: string) => {
    setGardenTodos(prev => prev.map(t => t.id === todoId ? { ...t, completed: !t.completed, completedAt: !t.completed ? now() : null } : t));
  };

  if (!mounted) return null;

  // --- Gardening mode UI ---
  if (gardeningMode && currentGardenEvent) {
    const { daysText } = getDaysData(currentGardenEvent.dueDate);
    return (
      <div className={styles.container}>
        <div className={styles.gardenHeader}>
          <span className={styles.gardenProgress}>{gardenIndex + 1} / {gardenEvents.length}</span>
          <button className={styles.textBtn} onClick={() => setGardeningMode(false)}>Exit</button>
        </div>

        <div className={styles.gardenCard}>
          <div className={styles.gardenEventName}>{currentGardenEvent.name}</div>
          <div className={styles.gardenMeta}>
            {formatDate(currentGardenEvent.dueDate)} — {daysText}
          </div>

          {currentGardenEvent.url && (
            <a href={currentGardenEvent.url} target="_blank" rel="noopener noreferrer" className={styles.link}>
              {new URL(currentGardenEvent.url).hostname} <ExternalLink size={14} />
            </a>
          )}

          <div className={styles.gardenField}>
            <textarea
              ref={gardenDescRef}
              className={styles.gardenTextarea}
              placeholder="Description..."
              value={gardenDesc}
              onChange={e => setGardenDesc(e.target.value)}
              onInput={e => fitTextarea(e.currentTarget)}
            />
          </div>

          <div className={styles.gardenField}>
            <input
              type="text"
              className={styles.gardenInput}
              placeholder="Next Action"
              value={gardenNextAction}
              onChange={e => setGardenNextAction(e.target.value)}
            />
          </div>

          <div className={styles.gardenField}>
            <div className={styles.todoListTitle}>Tasks</div>
            {gardenTodos.map(todo => (
              <div key={todo.id} className={styles.todoItem} onClick={() => gardenToggleTodo(todo.id)}>
                <input type="checkbox" checked={todo.completed} readOnly className={styles.checkbox} />
                <span className={todo.completed ? styles.completedTodo : ""}>{todo.text}</span>
              </div>
            ))}
            <div className={styles.addTodoRow}>
              <input
                type="text"
                placeholder="Add item..."
                value={gardenNewTodo}
                onChange={e => setGardenNewTodo(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); gardenAddTodo(); } }}
                className={styles.todoInput}
              />
              <button type="button" onClick={gardenAddTodo} className={styles.addTodoBtn}>Add</button>
            </div>
          </div>

          {(currentGardenEvent.tags || []).length > 0 && (
            <div className={styles.itemTags}>
              {(currentGardenEvent.tags || []).map(tag => (
                <span key={tag} className={`${styles.tagLabel} ${styles[`tag-${tag}`]}`}>#{tag}</span>
              ))}
            </div>
          )}
        </div>

        <div className={styles.gardenActions}>
          <button className={styles.textBtn} onClick={gardenSkip}>Skip</button>
          <button className={styles.gardenSaveBtn} onClick={gardenSaveAndNext}>
            {gardenIndex + 1 >= gardenEvents.length ? "Save & Finish" : "Save & Next"}
          </button>
        </div>
      </div>
    );
  }

  // --- Main UI ---
  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div className={styles.headerTitle}>
          <div className={styles.currentDate}>
            {TODAY.toLocaleDateString("en-US", { weekday: 'long', month: 'long', day: 'numeric' })}
          </div>
        </div>
        <div className={styles.headerActions}>
          <button className={styles.textBtn} onClick={toggleTheme}>
            {theme === 'light' ? 'Night' : 'Day'}
          </button>
          <button className={styles.textBtn} onClick={() => setShowFilters(!showFilters)}>
            Filter
          </button>
        </div>
      </div>

      <AnimatePresence>
        {showFilters && (
          <motion.div
            className={styles.filterBar}
            initial={{ height: 0, opacity: 0, marginBottom: 0 }}
            animate={{ height: "auto", opacity: 1, marginBottom: "2rem" }}
            exit={{ height: 0, opacity: 0, marginBottom: 0 }}
            style={{ overflow: "hidden" }}
          >
            {AVAILABLE_TAGS.map(tag => (
              <button
                key={tag}
                className={`${styles.filterBtn} ${activeFilters.includes(tag) ? styles.filterActive : ""} ${styles[`tag-${tag}`]}`}
                onClick={() => handleToggleFilter(tag)}
                style={{ opacity: activeFilters.length > 0 && !activeFilters.includes(tag) ? 0.3 : 1 }}
              >
                {tag}
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {(isAdding || editingId) && (
          <motion.form
            className={styles.addForm}
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            onSubmit={handleSave}
          >
            <div className={styles.formHeader}>{editingId ? "Edit Horizon" : "New Horizon"}</div>
            <input type="text" placeholder="Horizon Name" value={formData.name} onChange={(e) => setFormData({...formData, name: e.target.value})} className={styles.input} required />
            <input type="date" value={formData.dueDate} onChange={(e) => setFormData({...formData, dueDate: e.target.value})} className={styles.input} required />

            <label className={styles.recurrenceToggle}>
              <input
                type="checkbox"
                checked={formData.isRecurring}
                onChange={(e) => setFormData({
                  ...formData,
                  isRecurring: e.target.checked,
                  openDate: e.target.checked && !formData.openDate ? formData.dueDate : formData.openDate,
                })}
              />
              Recurring opportunity
            </label>
            {formData.isRecurring && (
              <div className={styles.recurrenceFields}>
                <label className={styles.recurrenceLabel}>Opens (deadline above is the due date)</label>
                <input type="date" value={formData.openDate} onChange={(e) => setFormData({...formData, openDate: e.target.value})} className={styles.input} />
                <label className={styles.recurrenceLabel}>Surface this many days before it opens</label>
                <input type="number" min={0} value={formData.leadDays} onChange={(e) => setFormData({...formData, leadDays: Number(e.target.value)})} className={styles.input} />
                <input type="text" placeholder="Eligibility note (optional)" value={formData.eligibilityNote} onChange={(e) => setFormData({...formData, eligibilityNote: e.target.value})} className={styles.input} />
                <div className={styles.tagSelector}>
                  <button type="button" className={`${styles.tagButton} ${formData.dateStatus === 'provisional' ? styles.tagActive : ""}`} onClick={() => setFormData({...formData, dateStatus: 'provisional'})}>provisional (guess)</button>
                  <button type="button" className={`${styles.tagButton} ${formData.dateStatus === 'confirmed' ? styles.tagActive : ""}`} onClick={() => setFormData({...formData, dateStatus: 'confirmed'})}>confirmed</button>
                </div>
              </div>
            )}

            <input type="url" placeholder="Website (optional)" value={formData.url} onChange={(e) => setFormData({...formData, url: e.target.value})} className={styles.input} />
            <input type="text" placeholder="Next action… e.g. Send PDF to PurePrint" value={formData.nextAction} onChange={(e) => setFormData({...formData, nextAction: e.target.value})} className={styles.input} />
            <textarea ref={formDescRef} placeholder="Description" value={formData.description} onChange={(e) => setFormData({...formData, description: e.target.value})} onInput={(e) => fitTextarea(e.currentTarget)} className={styles.textarea} />

            <div className={styles.todoSection}>
              <div className={styles.todoHeader}>To-do List</div>
              {formData.todos.map(todo => (
                <div key={todo.id} className={styles.todoFormItem}>
                  <span>{todo.text}</span>
                  <button type="button" onClick={() => handleRemoveTodo(todo.id)} className={styles.removeTodoBtn}><X size={14} /></button>
                </div>
              ))}
              <div className={styles.addTodoRow}>
                <input
                  type="text"
                  placeholder="Add item..."
                  value={newTodoText}
                  onChange={(e) => setNewTodoText(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleAddTodo(); } }}
                  className={styles.todoInput}
                />
                <button type="button" onClick={handleAddTodo} className={styles.addTodoBtn}>Add</button>
              </div>
            </div>

            <div className={styles.tagSelector}>
              {AVAILABLE_TAGS.map(tag => (
                <button
                  key={tag}
                  type="button"
                  className={`${styles.tagButton} ${formData.tags.includes(tag) ? styles.tagActive : ""} ${styles[`tag-${tag}`]}`}
                  onClick={() => handleToggleFormTag(tag)}
                >
                  {tag}
                </button>
              ))}
            </div>
            <div className={styles.formActions}>
              <button type="button" onClick={resetForm} className={styles.cancelButton}>Cancel</button>
              <button type="submit" className={styles.submitButton}>{editingId ? "Update" : "Add"}</button>
            </div>
          </motion.form>
        )}
      </AnimatePresence>

      {/* Pomodoro Section */}
      <div className={styles.pomodoroSection}>
        <div className={styles.pomodoroTimeline}>
          <div className={`${styles.pomodoroTrack} ${pomodoroActive ? styles.pomodoroTrackActive : ''}`}>
            <div
              className={`${styles.pomodoroFill} ${pomodoroComplete ? styles.pomodoroComplete : ''} ${pomodoroActive ? styles.pomodoroFillActive : ''}`}
              style={{ width: `${pomodoroProgress * 100}%` }}
            />
            {pomodoroActive && !pomodoroComplete && (
              <div
                className={styles.pomodoroMarker}
                style={{ left: `${pomodoroProgress * 100}%` }}
              />
            )}
          </div>
          {/* 5-minute tick marks */}
          <div className={styles.pomodoroTicks}>
            {[5, 10, 15, 20, 25, 30].map(m => (
              <div key={m} className={styles.pomodoroTick} style={{ left: `${(m / 35) * 100}%` }} />
            ))}
          </div>
        </div>

        <div className={styles.pomodoroHeader}>
          <span className={styles.pomodoroTitle}>
            Pomodoro
            <span className={styles.pomodoroDuration}>
              {' '}{String(pomodoroMinutes).padStart(2, '0')}:{String(pomodoroSecs).padStart(2, '0')} / 35:00
            </span>
            {pomodoroComplete && pomodoroCompletedAt && (
              <span className={styles.pomodoroCompletedAt}>
                {' '}Completed at {new Date(pomodoroCompletedAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}
              </span>
            )}
          </span>
          <div className={styles.pomodoroControls}>
            {!pomodoroActive && !pomodoroComplete && (
              <button className={styles.textBtn} onClick={startPomodoro}>
                {pomodoroSeconds > 0 ? 'Resume' : 'Start'}
              </button>
            )}
            {pomodoroComplete && (
              <button className={styles.textBtn} onClick={completePomodoro}>
                Reset
              </button>
            )}
            {(pomodoroSeconds > 0 && !pomodoroComplete) && (
              <button className={styles.textBtn} onClick={completePomodoro}>
                Completed
              </button>
            )}
            {(pomodoroActive || (pomodoroSeconds > 0 && !pomodoroComplete)) && (
              <button className={styles.textBtn} onClick={postponePomodoro}>
                Postponed
              </button>
            )}
            {(pomodoroActive || (pomodoroSeconds > 0 && !pomodoroComplete)) && (
              <button className={styles.textBtn} onClick={freshPomodoro}>
                Fresh
              </button>
            )}
            <button
              className={`${styles.textBtn} ${pomodoroSelectingTask ? styles.pomodoroSelectActive : ''}`}
              onClick={newPomodoro}
            >
              New
            </button>
          </div>
        </div>

        {(pomodoroTask || pomodoroEvent) && (
          <div className={styles.pomodoroTaskLabel}>
            {pomodoroEvent && <span className={styles.pomodoroEventName}>{pomodoroEvent.name}</span>}
            {pomodoroEvent && pomodoroTask && <span className={styles.pomodoroLabelSep}> — </span>}
            {pomodoroTask && <span>{pomodoroTask.text}</span>}
          </div>
        )}

        <AnimatePresence>
          {pomodoroSelectingTask && (
            <motion.div
              className={styles.pomodoroTaskList}
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              style={{ overflow: 'hidden' }}
            >
              {pomodoroHasSelection && (
                <button
                  className={styles.pomodoroTaskOption}
                  onClick={handlePomodoroClearSelection}
                >
                  Clear selection
                </button>
              )}

              {tasksForSelectedDate.filter(t => !t.completed && !(t.rheiItemId && rheiItems.some(r => r.id === t.rheiItemId && r.text === t.text))).length > 0 && (
                <div className={styles.pomodoroGroupLabel}>Today&apos;s tasks</div>
              )}
              {tasksForSelectedDate.filter(t => !t.completed && !(t.rheiItemId && rheiItems.some(r => r.id === t.rheiItemId && r.text === t.text))).map(task => (
                <button
                  key={task.id}
                  className={`${styles.pomodoroTaskOption} ${task.id === pomodoroTaskId ? styles.pomodoroTaskSelected : ''}`}
                  onClick={() => handlePomodoroSelectTask(task.id)}
                >
                  {task.text}
                </button>
              ))}

              <div className={styles.pomodoroGroupLabel}>New task</div>
              <div className={styles.pomodoroCreateRow}>
                <input
                  type="text"
                  className={styles.pomodoroCreateInput}
                  placeholder="Create a task..."
                  value={pomodoroNewTaskText}
                  onChange={e => setPomodoroNewTaskText(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') handlePomodoroCreateTask(); }}
                />
                {pomodoroNewTaskText.trim() && (
                  <button className={styles.textBtn} onClick={handlePomodoroCreateTask}>Add</button>
                )}
              </div>

              <div className={styles.pomodoroGroupLabel}>Projects</div>
              {activeEvents.map(ev => (
                <div key={ev.id}>
                  <button
                    className={`${styles.pomodoroTaskOption} ${ev.id === pomodoroEventId ? styles.pomodoroTaskSelected : ''}`}
                    onClick={() => handlePomodoroSelectEvent(ev.id)}
                  >
                    {ev.name}
                  </button>
                  {ev.id === pomodoroEventId && (ev.todos || []).filter(t => !t.completed).length > 0 && (
                    <div className={styles.pomodoroSubtasks}>
                      {(ev.todos || []).filter(t => !t.completed).map(todo => (
                        <button
                          key={todo.id}
                          className={`${styles.pomodoroTaskOption} ${styles.pomodoroSubtaskOption} ${pomodoroTaskId === todo.id ? styles.pomodoroTaskSelected : ''}`}
                          onClick={() => handlePomodoroSelectSubtask(ev.id, todo)}
                        >
                          {todo.text}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <div className={styles.dailyTasksSection}>
        <div className={styles.dateNav}>
          <button
            className={`${styles.dateNavBtn} ${dailyDateTab === 'yesterday' ? styles.dateNavActive : ''}`}
            onClick={() => setDailyDateTab('yesterday')}
          >
            Yesterday
          </button>
          <button
            className={`${styles.dateNavBtn} ${dailyDateTab === 'today' ? styles.dateNavActive : ''}`}
            onClick={() => setDailyDateTab('today')}
          >
            Today
          </button>
          <button
            className={`${styles.dateNavBtn} ${dailyDateTab === 'tomorrow' ? styles.dateNavActive : ''}`}
            onClick={() => setDailyDateTab('tomorrow')}
          >
            Tomorrow
          </button>
          <button
            className={`${styles.dateNavBtn} ${dailyDateTab === 'rhei' ? styles.dateNavActive : ''}`}
            onClick={() => setDailyDateTab('rhei')}
          >
            Repeating
          </button>
        </div>

        {dailyDateTab === 'rhei' ? (
          <>
            <input
              type="text"
              className={styles.dailyTaskInput}
              placeholder="Add a recurring task..."
              value={newRheiText}
              onChange={e => setNewRheiText(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && !showRheiScheduleEditor) handleAddRheiItem(); }}
            />
            {newRheiText.trim() && (
              <button className={styles.rheiScheduleToggle} onClick={() => {
                const next = !showRheiScheduleEditor;
                setShowRheiScheduleEditor(next);
                if (next && rheiCreateSchedule.length === 0) setRheiCreateSchedule([{ text: '', days: [] }]);
              }}>
                {showRheiScheduleEditor ? 'hide schedule' : '+ add schedule'}
              </button>
            )}
            {showRheiScheduleEditor && (
              <div className={styles.rheiScheduleEditor}>
                {rheiCreateSchedule.map((st, idx) => (
                  <div key={idx} className={styles.rheiScheduleRow}>
                    <input
                      type="text"
                      className={styles.rheiScheduleInput}
                      placeholder="Task name..."
                      value={st.text}
                      onChange={e => {
                        const updated = [...rheiCreateSchedule];
                        updated[idx] = { ...st, text: e.target.value };
                        setRheiCreateSchedule(updated);
                      }}
                    />
                    <div className={styles.dayToggles}>
                      {['S','M','T','W','T','F','S'].map((label, dayIdx) => (
                        <button
                          key={dayIdx}
                          className={`${styles.dayToggle} ${st.days.includes(dayIdx) ? styles.dayToggleActive : ''}`}
                          onClick={() => {
                            const updated = [...rheiCreateSchedule];
                            const days = st.days.includes(dayIdx) ? st.days.filter(d => d !== dayIdx) : [...st.days, dayIdx];
                            updated[idx] = { ...st, days };
                            setRheiCreateSchedule(updated);
                          }}
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                    <button className={styles.taskActionBtn} onClick={() => setRheiCreateSchedule(rheiCreateSchedule.filter((_, i) => i !== idx))}>
                      <X size={12} />
                    </button>
                  </div>
                ))}
                <button className={styles.rheiScheduleToggle} onClick={() => setRheiCreateSchedule([...rheiCreateSchedule, { text: '', days: [] }])}>
                  + add task
                </button>
                <button className={styles.rheiScheduleSave} onClick={handleAddRheiItem}>
                  Create
                </button>
              </div>
            )}
            <AnimatePresence mode="popLayout">
              {rheiItems.map(item => (
                <motion.div
                  key={item.id}
                  className={styles.taskRow}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  layout="position"
                  transition={{ layout: { duration: 0.2 }, opacity: { duration: 0.15 } }}
                >
                  {editingRheiId === item.id ? (
                    <div className={styles.rheiEditForm}>
                      <input
                        type="text"
                        className={styles.dailyTaskInput}
                        value={rheiFormText}
                        onChange={e => setRheiFormText(e.target.value)}
                        autoFocus
                      />
                      {rheiEditSchedule.map((st, idx) => (
                        <div key={idx} className={styles.rheiScheduleRow}>
                          <input
                            type="text"
                            className={styles.rheiScheduleInput}
                            placeholder="Task name..."
                            value={st.text}
                            onChange={e => {
                              const updated = [...rheiEditSchedule];
                              updated[idx] = { ...st, text: e.target.value };
                              setRheiEditSchedule(updated);
                            }}
                          />
                          <div className={styles.dayToggles}>
                            {['S','M','T','W','T','F','S'].map((label, dayIdx) => (
                              <button
                                key={dayIdx}
                                className={`${styles.dayToggle} ${st.days.includes(dayIdx) ? styles.dayToggleActive : ''}`}
                                onClick={() => {
                                  const updated = [...rheiEditSchedule];
                                  const days = st.days.includes(dayIdx) ? st.days.filter(d => d !== dayIdx) : [...st.days, dayIdx];
                                  updated[idx] = { ...st, days };
                                  setRheiEditSchedule(updated);
                                }}
                              >
                                {label}
                              </button>
                            ))}
                          </div>
                          <button className={styles.taskActionBtn} onClick={() => setRheiEditSchedule(rheiEditSchedule.filter((_, i) => i !== idx))}>
                            <X size={12} />
                          </button>
                        </div>
                      ))}
                      <div className={styles.rheiEditActions}>
                        <button className={styles.rheiScheduleToggle} onClick={() => setRheiEditSchedule([...rheiEditSchedule, { text: '', days: [] }])}>
                          + add task
                        </button>
                        <div>
                          {rheiConfirmDeleteId === item.id ? (
                            <>
                              <button className={styles.rheiScheduleToggle} onClick={() => { handleDeleteRheiItem(item.id); setRheiConfirmDeleteId(null); setEditingRheiId(null); setRheiFormText(""); setRheiEditSchedule([]); }}>Confirm delete</button>
                              <button className={styles.rheiScheduleToggle} onClick={() => setRheiConfirmDeleteId(null)}>Undo</button>
                            </>
                          ) : (
                            <button className={styles.rheiScheduleToggle} onClick={() => setRheiConfirmDeleteId(item.id)}>Delete</button>
                          )}
                          <button className={styles.rheiScheduleSave} onClick={handleSaveRheiEdit}>Save</button>
                          <button className={styles.rheiScheduleToggle} onClick={() => { setEditingRheiId(null); setRheiFormText(""); setRheiEditSchedule([]); setRheiConfirmDeleteId(null); }}>Cancel</button>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div
                        className={`${styles.taskContent} ${styles.rheiItem}`}
                        onClick={() => handleToggleRheiEngagement(item.id)}
                      >
                        <div className={`${styles.taskText} ${isRheiEngagedTodayEffective(item.id) ? styles.rheiItemActive : ''}`}>
                          {item.text}
                          {item.scheduledTasks && item.scheduledTasks.length > 0 && <Calendar size={12} className={styles.rheiScheduledIcon} />}
                        </div>
                      </div>
                      <div className={styles.taskActions}>
                        <button className={styles.taskActionBtn} onClick={() => startEditingRhei(item)}>
                          <Edit2 size={14} />
                        </button>
                      </div>
                    </>
                  )}
                  {isRheiEngagedTodayEffective(item.id) && editingRheiId !== item.id && (() => {
                    const existingTasks = dailyTasks.filter(t => t.rheiItemId === item.id && t.date === todayStr && t.text !== item.text);
                    const isPending = pendingRheiState[item.id] === true && !isRheiEngagedToday(item.id);
                    const todayDay = new Date().getDay();
                    const previewScheduled = isPending && item.scheduledTasks
                      ? item.scheduledTasks
                          .filter(st => st.days.includes(todayDay))
                          .filter(st => !existingTasks.some(t => t.text === `${item.text} - ${st.text}`))
                          .map(st => ({ stText: st.text, fullText: `${item.text} - ${st.text}` }))
                      : [];
                    return (
                      <div className={styles.rheiAddenda}>
                        {existingTasks.map(task => (
                          <div key={task.id} className={styles.rheiAddendumRow}>
                            <input
                              type="checkbox"
                              checked={task.completed}
                              onChange={() => handleToggleDailyTask(task.id)}
                              className={styles.taskCheckbox}
                            />
                            <span
                              className={`${styles.rheiAddendumText} ${task.completed ? styles.taskTextCompleted : ''}`}
                              onClick={() => handleToggleDailyTask(task.id)}
                              style={{ cursor: 'pointer' }}
                            >
                              {task.text.replace(`${item.text} - `, '')}
                            </span>
                            <button className={styles.taskActionBtn} onClick={() => handleDeleteDailyTask(task.id)}>
                              <X size={14} />
                            </button>
                          </div>
                        ))}
                        {previewScheduled.map(p => (
                          <div key={`__preview_${p.stText}`} className={styles.rheiAddendumRow} style={{ opacity: 0.4 }}>
                            <input type="checkbox" checked={false} readOnly className={styles.taskCheckbox} />
                            <span className={styles.rheiAddendumText}>{p.stText}</span>
                          </div>
                        ))}
                        <input
                          type="text"
                          className={styles.rheiAddendumInput}
                          placeholder="Add sub-task..."
                          value={rheiAddendumText[item.id] || ''}
                          onChange={e => setRheiAddendumText(prev => ({ ...prev, [item.id]: e.target.value }))}
                          onKeyDown={e => { if (e.key === 'Enter') handleAddRheiAddendum(item.id); }}
                          onClick={e => e.stopPropagation()}
                        />
                      </div>
                    );
                  })()}
                </motion.div>
              ))}
            </AnimatePresence>
          </>
        ) : (
        <>
        <input
          type="text"
          className={styles.dailyTaskInput}
          placeholder="Add a task..."
          value={newDailyTaskText}
          onChange={e => setNewDailyTaskText(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') handleAddDailyTask(); }}
        />

        {(() => {
          const visibleTasks = tasksForSelectedDate.filter(t => !(t.rheiItemId && rheiItems.some(r => r.id === t.rheiItemId && r.text === t.text)));
          const incompleteTasks = visibleTasks.filter(t => !t.completed);
          const allCompleted = visibleTasks.filter(t => t.completed);
          const completedTasks = hideCompletedTasks ? [] : allCompleted;
          const renderTask = (task: DailyTask) => (
            <motion.div
              key={task.id}
              className={styles.taskRow}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              layout="position"
              transition={{ layout: { duration: 0.2 }, opacity: { duration: 0.15 } }}
            >
              <input
                type="checkbox"
                checked={task.completed}
                onChange={() => handleToggleDailyTask(task.id)}
                className={styles.taskCheckbox}
              />
              <div className={styles.taskContent} onClick={() => handleToggleDailyTask(task.id)}>
                <div className={`${styles.taskText} ${task.completed ? styles.taskTextCompleted : ""}`}>
                  {task.text}
                </div>
                {task.linkedEventId && (
                  <div className={styles.taskLinkedEvent}>
                    {events.find(e => e.id === task.linkedEventId)?.name}
                  </div>
                )}
              </div>
              <div className={styles.taskActions}>
                <div className={styles.linkDropdownWrapper}>
                  <button
                    className={styles.taskActionBtn}
                    onClick={() => setLinkingTaskId(linkingTaskId === task.id ? null : task.id)}
                  >
                    <Link2 size={14} />
                  </button>
                  {linkingTaskId === task.id && (
                    <div className={styles.linkDropdown}>
                      {task.linkedEventId && (
                        <button className={styles.linkDropdownItem} onClick={() => handleLinkDailyTask(task.id, undefined)}>
                          Remove link
                        </button>
                      )}
                      {activeEvents.map(ev => (
                        <button key={ev.id} className={styles.linkDropdownItem} onClick={() => handleLinkDailyTask(task.id, ev.id)}>
                          {ev.name}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                <button className={styles.taskActionBtn} onClick={() => handleDeleteDailyTask(task.id)}>
                  <X size={14} />
                </button>
              </div>
            </motion.div>
          );
          return (
            <>
              <AnimatePresence mode="popLayout">
                {incompleteTasks.map(renderTask)}
              </AnimatePresence>
              {allCompleted.length > 0 && (
                <div
                  className={styles.completedHeader}
                  onClick={() => setHideCompletedTasks(!hideCompletedTasks)}
                >
                  <span>Completed</span>
                  <span className={styles.completedToggle}>{hideCompletedTasks ? '|' : '–'}</span>
                </div>
              )}
              <AnimatePresence mode="popLayout">
                {completedTasks.map(renderTask)}
              </AnimatePresence>
            </>
          );
        })()}

        {dailyDateTab === 'today' && uncheckedPrior.length > 0 && (
          <button className={styles.carryForward} onClick={handleCarryForward}>
            Carry forward {uncheckedPrior.length} unchecked task{uncheckedPrior.length !== 1 ? 's' : ''}
          </button>
        )}
        </>
        )}
      </div>

      <div className={styles.tabs}>
        <button
          className={`${styles.tabBtn} ${currentTab === 'ongoing' ? styles.tabActive : ""}`}
          onClick={() => setCurrentTab('ongoing')}
        >
          On-going
        </button>
        <button
          className={`${styles.tabBtn} ${currentTab === 'archive' ? styles.tabActive : ""}`}
          onClick={() => setCurrentTab('archive')}
        >
          Archive
        </button>
        <button
          className={`${styles.tabBtn} ${styles.tabActive}`}
          onClick={() => { setIsAdding(!isAdding); setEditingId(null); }}
        >
          {isAdding ? '×' : 'New'}
        </button>
        <button
          className={`${styles.tabBtn} ${styles.tabActive}`}
          onClick={() => { minimizedLockedRef.current = !minimizedLockedRef.current; setMinimized(minimizedLockedRef.current); }}
        >
          {minimized ? 'Unfold' : 'Fold'}
        </button>
      </div>

      <div className={styles.list}>
        {currentTab === 'ongoing' && (
          <>
            {renderSection("Opening soon", groupedEvents.openingSoon, expandedIds, toggleExpand, startEdit, toggleTodoCompletion, handleStatusChange, handleNextActionChange, handleDelete, handleStarToggle, showNextActions, handleConfirmDates, handlePromoteTodo, isTodoPromotedTodayEffective)}
            {renderSection("Over The Horizon", groupedEvents.overTheHorizon, expandedIds, toggleExpand, startEdit, toggleTodoCompletion, handleStatusChange, handleNextActionChange, handleDelete, handleStarToggle, showNextActions, handleConfirmDates, handlePromoteTodo, isTodoPromotedTodayEffective)}
            {renderSection("Short Horizon", groupedEvents.thisWeek, expandedIds, toggleExpand, startEdit, toggleTodoCompletion, handleStatusChange, handleNextActionChange, handleDelete, handleStarToggle, showNextActions, handleConfirmDates, handlePromoteTodo, isTodoPromotedTodayEffective)}
            {groupedEvents.later.length > 0 && (
              <div className={styles.section}>
                <h3 className={styles.foldHeader} onClick={() => { minimizedLockedRef.current = !minimizedLockedRef.current; setMinimized(minimizedLockedRef.current); }}>
                  {minimized ? '▸' : '▾'} Horizon ({groupedEvents.later.length})
                </h3>
                {!minimized && renderSection("", groupedEvents.later, expandedIds, toggleExpand, startEdit, toggleTodoCompletion, handleStatusChange, handleNextActionChange, handleDelete, handleStarToggle, showNextActions, handleConfirmDates, handlePromoteTodo, isTodoPromotedTodayEffective)}
              </div>
            )}
            {groupedEvents.longHorizon.length > 0 && (
              <div className={styles.section}>
                <h3 className={styles.foldHeader} onClick={() => setShowLongHorizon(v => !v)}>
                  {showLongHorizon ? '▾' : '▸'} Long Horizon ({groupedEvents.longHorizon.length})
                </h3>
                {showLongHorizon && renderSection("", groupedEvents.longHorizon, expandedIds, toggleExpand, startEdit, toggleTodoCompletion, handleStatusChange, handleNextActionChange, handleDelete, handleStarToggle, showNextActions, handleConfirmDates, handlePromoteTodo, isTodoPromotedTodayEffective)}
              </div>
            )}
            {groupedEvents.watching.length > 0 && (
              <div className={styles.section}>
                <h3 className={styles.foldHeader} onClick={() => setShowWatching(v => !v)}>
                  {showWatching ? '▾' : '▸'} Watching ({groupedEvents.watching.length})
                </h3>
                {showWatching && renderSection("", groupedEvents.watching, expandedIds, toggleExpand, startEdit, toggleTodoCompletion, handleStatusChange, handleNextActionChange, handleDelete, handleStarToggle, showNextActions, handleConfirmDates, handlePromoteTodo, isTodoPromotedTodayEffective)}
              </div>
            )}
          </>
        )}
        {currentTab === 'archive' && (
          renderSection("Over The Horizon", groupedEvents.archived, expandedIds, toggleExpand, startEdit, toggleTodoCompletion, handleStatusChange, handleNextActionChange, handleDelete, handleStarToggle, showNextActions, handleConfirmDates, handlePromoteTodo, isTodoPromotedTodayEffective)
        )}
        {activeFilters.length > 0 && filteredEvents.length === 0 && <div className={styles.empty}>No matching horizons</div>}
      </div>

      <div className={styles.bottomButtons}>
        {(() => {
          const exercise = rheiItems.find(r => r.text === 'Exercise');
          const isMarked = exercise
            ? isRheiEngagedTodayEffective(exercise.id)
            : workedOutFallback === todayStr;
          const handleClick = () => {
            if (exercise) handleToggleRheiEngagement(exercise.id);
            else setWorkedOutFallback(prev => prev === todayStr ? null : todayStr);
          };
          return (
            <button
              className={styles.gardenButton}
              onClick={handleClick}
              style={isMarked ? { textDecoration: 'line-through' } : undefined}
            >
              Worked Out
            </button>
          );
        })()}
        <button className={styles.gardenButton} onClick={() => setForceMajeurePrompt(!forceMajeurePrompt)} style={pomodoroSessions.some(s => s.outcome === 'forceMajeure' && isLocalDate(s.completedAt, todayStr)) ? { textDecoration: 'line-through' } : undefined}>
          Force Majeure
        </button>
        {forceMajeurePrompt && (
          <div className={styles.forceMajeureInput}>
            <input
              type="text"
              placeholder="Reason (e.g. Spring Break, Sick...)"
              value={forceMajeureReason}
              list="fm-reasons"
              onChange={e => setForceMajeureReason(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && forceMajeureReason.trim()) forceMajeurePomodoro(forceMajeureReason.trim()); }}
              autoFocus
            />
            <datalist id="fm-reasons">
              {Array.from(new Set(pomodoroSessions.filter(s => s.forceMajeureReason).map(s => s.forceMajeureReason!))).map(r => (
                <option key={r} value={r} />
              ))}
            </datalist>
          </div>
        )}
        {gardenEvents.length > 0 && (
          <button className={styles.gardenButton} onClick={startGardening} style={gardenEvents.every(ev => isLocalDate(ev.gardenedAt, todayStr)) ? { textDecoration: 'line-through' } : undefined}>
            Garden
          </button>
        )}
      </div>
    </div>
  );
}

function renderSection(
  title: string,
  items: EventItem[],
  expandedIds: string[],
  onToggle: (id: string) => void,
  onEdit: (e: React.MouseEvent, ev: EventItem) => void,
  onToggleTodo: (eventId: string, todoId: string) => void,
  onStatusChange: (eventId: string, status: 'active' | 'completed' | 'incomplete', note?: string) => void,
  onNextActionChange: (eventId: string, nextAction: string) => void,
  onDelete: (eventId: string) => void,
  onStarToggle: (eventId: string) => void,
  showNextActions: boolean = false,
  onConfirmDates: (eventId: string) => void = () => {},
  onPromoteTodo: (eventId: string, todo: TodoItem) => void = () => {},
  isTodoPromoted: (todoId: string) => boolean = () => false
) {
  if (items.length === 0) return null;
  return (
    <div className={styles.section}>
      {title && <h3 className={`${styles.sectionTitle} ${title === "Over The Horizon" ? styles.sectionTitleBlue : ""}`}>{title}</h3>}
      {items.map((event) => {
        const { daysText, weekday } = getDaysData(event.dueDate);
        const isArchived = (event.status || 'active') !== 'active';
        const isExpanded = expandedIds.includes(event.id);
        const isOTH = title === "Over The Horizon";
        // Recurrence display: provisional recurring items get the "≈ guess" treatment;
        // dormant ones show when they'll wake, surfaced ones prompt "check the date".
        const rec = event.recurrence;
        // Imminent-deadline override: a recurring item surfaced early because its due date is
        // near — render it as an ordinary active item (no ≈ provisional / dormant treatment).
        const liveDeadline = rec ? recurrenceImminentOverride(event) : false;
        const isProvisional = rec?.dateStatus === 'provisional' && !liveDeadline;
        const isDormant = rec && !liveDeadline ? TODAY.getTime() < recurrenceSurfaceTime(rec) : false;
        const gardenAgeDays = event.gardenedAt
          ? Math.floor((Date.now() - new Date(event.gardenedAt).getTime()) / 86400000)
          : null;
        const gardenState: 'never' | 'stale' | 'fresh' = !event.gardenedAt
          ? 'never'
          : (gardenAgeDays !== null && gardenAgeDays > 14) ? 'stale' : 'fresh';
        const showGardenMark = isOTH && !event.starred && gardenState !== 'fresh';
        return (
          <div key={event.id} className={styles.itemWrapper}>
            {event.starred && <span className={styles.starMark} aria-label="starred">★</span>}
            {showGardenMark && (
              <span
                className={`${styles.gardenStateMark} ${gardenState === 'never' ? styles.gardenStateNever : styles.gardenStateStale}`}
                aria-label={gardenState === 'never' ? 'never gardened' : 'gardened long ago'}
              >
                ·
              </span>
            )}
            <div className={styles.item} onClick={() => onToggle(event.id)}>
              <div className={styles.itemMain}>
                <div className={styles.eventNameGroup}>
                  <span className={`${styles.eventName} ${isArchived ? styles.archivedName : ""}`}>{event.name}</span>
                  {showNextActions && (() => {
                    const trimmedNextAction = event.nextAction?.trim() || "";
                    const fallbackTodo = !trimmedNextAction ? event.todos?.find(t => !t.completed)?.text : undefined;
                    return (
                      <div className={styles.nextActionRow}>
                        {(trimmedNextAction || fallbackTodo) && <span className={styles.nextActionHyphen}>–</span>}
                        <input
                          type="text"
                          className={styles.nextActionInline}
                          placeholder={fallbackTodo || "Next Action"}
                          defaultValue={trimmedNextAction}
                          onClick={e => e.stopPropagation()}
                          onBlur={e => {
                            if (e.target.value !== (event.nextAction || "")) {
                              onNextActionChange(event.id, e.target.value);
                            }
                          }}
                          onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
                        />
                      </div>
                    );
                  })()}
                  {rec && isProvisional && (
                    <div className={styles.recurrenceHint}>
                      {isDormant
                        ? `≈ wakes ${formatDate(getDateStrFromTime(recurrenceSurfaceTime(rec)))}`
                        : `≈ opens ${formatDate(rec.openDate)} — check the date`}
                      {rec.eligibilityNote ? ` · ${rec.eligibilityNote}` : ""}
                    </div>
                  )}
                </div>
                <div className={`${styles.dateGroup} ${isProvisional ? styles.provisionalDate : ""}`}>
                  <span className={styles.daysUntil}>{isProvisional ? `≈ ${daysText}` : daysText}</span>
                  <span className={styles.weekdayLabel}>{weekday}</span>
                </div>
              </div>
            </div>
            <AnimatePresence>
              {isExpanded && (
                <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className={styles.descriptionWrapper}>
                  <div className={styles.description}>
                    <div className={styles.detailsRow}><Calendar size={18} /> <span>Due: {formatDate(event.dueDate)}{rec && isProvisional ? " (provisional)" : ""}</span></div>
                    {rec && (
                      <div className={styles.detailsRow}><Calendar size={18} /> <span>{isProvisional ? "≈ " : ""}Opens: {formatDate(rec.openDate)} · surfaces {rec.leadDays}d before</span></div>
                    )}
                    {event.url && (
                      <div className={styles.detailsRow}>
                        <Globe size={18} />
                        <a href={event.url} target="_blank" rel="noopener noreferrer" className={styles.link}>{new URL(event.url).hostname} <ExternalLink size={14} /></a>
                      </div>
                    )}
                    <p className={styles.descText}>{event.description}</p>

                    {event.todos && (event.todos || []).length > 0 && (
                      <div className={styles.todoListDisplay}>
                        <div className={styles.todoListTitle}>Tasks</div>
                        {(event.todos || []).map(todo => (
                          <div
                            key={todo.id}
                            className={`${styles.todoItem} ${isTodoPromoted(todo.id) ? styles.todoPromoted : ""}`}
                            onClick={() => onPromoteTodo(event.id, todo)}
                            title="Tap to send to today's tasks"
                          >
                            <input
                              type="checkbox"
                              checked={todo.completed}
                              onClick={(e) => { e.stopPropagation(); onToggleTodo(event.id, todo.id); }}
                              onChange={() => {}}
                              className={styles.checkbox}
                            />
                            <span className={todo.completed ? styles.completedTodo : ""}>{todo.text}</span>
                          </div>
                        ))}
                      </div>
                    )}

                    <div className={styles.itemTags}>
                      {(event.tags || []).map(tag => (
                        <span key={tag} className={`${styles.tagLabel} ${styles[`tag-${tag}`]}`}>#{tag}</span>
                      ))}
                    </div>

                    <div className={styles.archiveActions}>
                      <button className={styles.editBtn} onClick={(e) => onEdit(e, event)}><Edit2 size={16} /> Edit</button>
                      <button className={styles.editBtn} onClick={() => onStarToggle(event.id)}>{event.starred ? '★ Unstar' : '☆ Star'}</button>
                      {!isArchived && rec && isProvisional && (
                        <button onClick={() => onConfirmDates(event.id)} className={styles.completeBtn}>Confirm dates</button>
                      )}
                      {!isArchived ? (
                        <>
                          <button onClick={() => { const note = window.prompt('Closing note (optional):', event.closingNote || ''); onStatusChange(event.id, 'completed', note ?? undefined); }} className={styles.completeBtn}>Mark Complete</button>
                          <button onClick={() => { const note = window.prompt('Closing note (optional):', event.closingNote || ''); onStatusChange(event.id, 'incomplete', note ?? undefined); }} className={styles.incompleteBtn}>Mark Incomplete</button>
                        </>
                      ) : (
                        <button onClick={() => onStatusChange(event.id, 'active')} className={styles.completeBtn}>Re-activate</button>
                      )}
                      <button onClick={() => onDelete(event.id)} className={styles.deleteBtn}>Delete</button>
                    </div>
                    {isArchived && (
                      <div className={`${styles.statusBadge} ${styles[event.status || 'active']}`}>
                        Status: {event.status}
                      </div>
                    )}
                    {isArchived && (
                      <div
                        className={styles.closingNote}
                        onClick={() => { const note = window.prompt('Closing note (optional):', event.closingNote || ''); if (note !== null) onStatusChange(event.id, event.status as 'completed' | 'incomplete', note); }}
                      >
                        {event.closingNote || <span className={styles.closingNotePlaceholder}>+ add note</span>}
                      </div>
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        );
      })}
    </div>
  );
}
