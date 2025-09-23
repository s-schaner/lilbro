import React, {
  ChangeEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { Download, PauseCircle, PlayCircle, RefreshCcw, Trash2 } from 'lucide-react';
import { LogEntry, LogFilters } from '../data/types';
import { useLogsFeed } from '../hooks/useLogsFeed';

interface LogsTabProps {
  apiBase: string;
  filters: LogFilters;
  onFiltersChange: React.Dispatch<React.SetStateAction<LogFilters>>;
}

const LOG_LIMIT = 400;

const normalizeLevel = (value?: string) => value?.toUpperCase();

const COMMON_LEVELS = ['TRACE', 'DEBUG', 'INFO', 'WARN', 'WARNING', 'ERROR', 'CRITICAL'];

const levelTheme: Record<string, string> = {
  TRACE: 'border-slate-700 bg-slate-900/40',
  DEBUG: 'border-indigo-500/40 bg-indigo-500/5',
  INFO: 'border-sky-500/40 bg-sky-500/5',
  WARN: 'border-amber-500/50 bg-amber-500/10',
  WARNING: 'border-amber-500/50 bg-amber-500/10',
  ERROR: 'border-rose-500/60 bg-rose-500/10',
  CRITICAL: 'border-red-600/70 bg-red-600/10',
};

const levelLabelClass: Record<string, string> = {
  TRACE: 'text-slate-300',
  DEBUG: 'text-indigo-200',
  INFO: 'text-sky-200',
  WARN: 'text-amber-200',
  WARNING: 'text-amber-200',
  ERROR: 'text-rose-200',
  CRITICAL: 'text-red-200',
};

const formatTimestamp = (value: LogEntry['ts']) => {
  if (typeof value === 'number') {
    const millis = value > 1e12 ? value : value * 1000;
    const date = new Date(millis);
    if (!Number.isNaN(date.getTime())) {
      return date.toLocaleString(undefined, {
        hour12: false,
      });
    }
  } else if (typeof value === 'string') {
    const date = new Date(value);
    if (!Number.isNaN(date.getTime())) {
      return date.toLocaleString(undefined, {
        hour12: false,
      });
    }
  }
  return String(value);
};

const formatMetaTooltip = (meta: LogEntry['meta']) => {
  if (!meta) {
    return 'No additional metadata';
  }
  if (typeof meta === 'string') {
    return meta;
  }
  try {
    return JSON.stringify(meta, null, 2);
  } catch (error) {
    return String(meta);
  }
};

export const LogsTab: React.FC<LogsTabProps> = ({ apiBase, filters, onFiltersChange }) => {
  const { entries, status, error, clear, reconnect } = useLogsFeed(apiBase, filters, {
    limit: LOG_LIMIT,
  });

  const [autoScroll, setAutoScroll] = useState(true);
  const containerRef = useRef<HTMLDivElement>(null);
  const previousCount = useRef(0);

  const normalizedBase = useMemo(() => apiBase.replace(/\/$/, ''), [apiBase]);

  useEffect(() => {
    if (!autoScroll) {
      previousCount.current = entries.length;
      return;
    }
    if (entries.length > previousCount.current) {
      window.requestAnimationFrame(() => {
        const container = containerRef.current;
        if (container) {
          container.scrollTop = container.scrollHeight;
        }
      });
    }
    previousCount.current = entries.length;
  }, [autoScroll, entries]);

  const levelOptions = useMemo(() => {
    const set = new Set(COMMON_LEVELS);
    entries.forEach((entry) => {
      const normalized = normalizeLevel(entry.level);
      if (normalized) {
        set.add(normalized);
      }
    });
    if (filters.level) {
      set.add(normalizeLevel(filters.level) ?? filters.level);
    }
    return Array.from(set).sort();
  }, [entries, filters.level]);

  const sourceOptions = useMemo(() => {
    const set = new Set<string>();
    entries.forEach((entry) => {
      if (entry.source) {
        set.add(entry.source);
      }
    });
    if (filters.source) {
      set.add(filters.source);
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [entries, filters.source]);

  const downloadUrl = useMemo(() => {
    const params = new URLSearchParams();
    params.set('limit', String(LOG_LIMIT));
    params.set('n', String(LOG_LIMIT));
    if (filters.level) {
      params.set('level', normalizeLevel(filters.level) ?? filters.level);
    }
    if (filters.source) {
      params.set('source', filters.source);
    }
    if (filters.search) {
      params.set('search', filters.search);
    }
    return `${normalizedBase}/logs/download?${params.toString()}`;
  }, [filters.level, filters.search, filters.source, normalizedBase]);

  const handleLevelChange = (event: ChangeEvent<HTMLSelectElement>) => {
    const value = event.target.value;
    onFiltersChange((prev) => ({
      ...prev,
      level: value ? value : undefined,
    }));
  };

  const handleSourceChange = (event: ChangeEvent<HTMLSelectElement>) => {
    const value = event.target.value;
    onFiltersChange((prev) => ({
      ...prev,
      source: value ? value : undefined,
    }));
  };

  const handleSearchChange = (event: ChangeEvent<HTMLInputElement>) => {
    const value = event.target.value;
    onFiltersChange((prev) => ({
      ...prev,
      search: value || undefined,
    }));
  };

  const toggleAutoScroll = useCallback(() => {
    setAutoScroll((prev) => {
      const next = !prev;
      if (next) {
        window.requestAnimationFrame(() => {
          const container = containerRef.current;
          if (container) {
            container.scrollTop = container.scrollHeight;
          }
        });
      }
      return next;
    });
  }, []);

  const handleScroll = useCallback(() => {
    if (!autoScroll) {
      return;
    }
    const container = containerRef.current;
    if (!container) {
      return;
    }
    const distanceFromBottom =
      container.scrollHeight - (container.scrollTop + container.clientHeight);
    if (distanceFromBottom > 64) {
      setAutoScroll(false);
    }
  }, [autoScroll]);

  const handleClear = () => {
    clear();
    previousCount.current = 0;
    setAutoScroll(true);
    window.requestAnimationFrame(() => {
      const container = containerRef.current;
      if (container) {
        container.scrollTop = 0;
      }
    });
  };

  const levelValue = normalizeLevel(filters.level) ?? '';

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3">
        <label className="flex flex-col text-xs text-slate-400">
          Level
          <select
            className="mt-1 rounded-md border border-slate-700 bg-slate-900 px-2 py-1 text-sm text-slate-100"
            value={levelValue}
            onChange={handleLevelChange}
          >
            <option value="">All</option>
            {levelOptions.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col text-xs text-slate-400">
          Source
          <select
            className="mt-1 min-w-[10rem] rounded-md border border-slate-700 bg-slate-900 px-2 py-1 text-sm text-slate-100"
            value={filters.source ?? ''}
            onChange={handleSourceChange}
          >
            <option value="">All</option>
            {sourceOptions.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-1 flex-col text-xs text-slate-400">
          Search
          <input
            className="mt-1 rounded-md border border-slate-700 bg-slate-900 px-3 py-1 text-sm text-slate-100"
            value={filters.search ?? ''}
            onChange={handleSearchChange}
            placeholder="message or metadata"
            type="search"
          />
        </label>
        <div className="ml-auto flex items-center gap-2 text-xs">
          <span
            className={`inline-flex items-center gap-2 rounded-full border px-2 py-1 ${
              status === 'streaming'
                ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-200'
                : status === 'polling'
                ? 'border-amber-400/40 bg-amber-500/10 text-amber-200'
                : 'border-slate-600 bg-slate-800 text-slate-300'
            }`}
          >
            <span className="h-2 w-2 rounded-full bg-current" />
            {status === 'streaming'
              ? 'Live stream'
              : status === 'polling'
              ? 'Polling backup'
              : status === 'connecting'
              ? 'Connecting…'
              : 'Idle'}
          </span>
          <button
            type="button"
            className="inline-flex items-center gap-1 rounded-md border border-slate-700 bg-slate-900 px-2 py-1 text-xs text-slate-200 hover:border-slate-500"
            onClick={reconnect}
            title="Retry connection"
          >
            <RefreshCcw className="h-3 w-3" /> Retry
          </button>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <button
          type="button"
          onClick={toggleAutoScroll}
          className={`inline-flex items-center gap-2 rounded-md border px-3 py-1 text-xs font-medium transition ${
            autoScroll
              ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-100'
              : 'border-slate-600 bg-slate-800 text-slate-200'
          }`}
        >
          {autoScroll ? (
            <>
              <PauseCircle className="h-4 w-4" /> Auto-scroll on
            </>
          ) : (
            <>
              <PlayCircle className="h-4 w-4" /> Auto-scroll paused
            </>
          )}
        </button>
        <button
          type="button"
          onClick={handleClear}
          className="inline-flex items-center gap-2 rounded-md border border-slate-700 bg-slate-900 px-3 py-1 text-xs text-slate-200 hover:border-slate-500"
        >
          <Trash2 className="h-4 w-4" /> Clear view
        </button>
        <a
          href={downloadUrl}
          className="inline-flex items-center gap-2 rounded-md border border-slate-700 bg-slate-900 px-3 py-1 text-xs text-slate-200 hover:border-slate-500"
          download
        >
          <Download className="h-4 w-4" /> Download
        </a>
      </div>
      {error && (
        <div className="rounded-md border border-red-500/40 bg-red-500/10 p-3 text-xs text-red-100">
          {error}
        </div>
      )}
      <div
        ref={containerRef}
        onScroll={handleScroll}
        className="max-h-[28rem] overflow-y-auto rounded-md border border-slate-800 bg-slate-950/40"
      >
        {entries.length === 0 ? (
          <div className="px-4 py-8 text-center text-sm text-slate-500">No log entries match the current filters.</div>
        ) : (
          <ul className="divide-y divide-slate-800/70">
            {entries.map((entry, index) => {
              const level = normalizeLevel(entry.level) ?? entry.level;
              const theme = levelTheme[level] ?? 'border-slate-800 bg-slate-900/40';
              const labelClass = levelLabelClass[level] ?? 'text-slate-200';
              return (
                <li
                  key={`${entry.ts}-${index}`}
                  className={`group border-l-2 px-3 py-2 text-xs transition-colors hover:bg-slate-900/60 ${theme}`}
                  title={formatMetaTooltip(entry.meta)}
                >
                  <div className="flex flex-wrap items-baseline gap-3">
                    <span className={`font-semibold uppercase tracking-wide ${labelClass}`}>
                      {level}
                    </span>
                    <span className="text-[11px] text-slate-400">{formatTimestamp(entry.ts)}</span>
                    <span className="truncate text-[11px] text-slate-400">{entry.source}</span>
                  </div>
                  <div className="mt-1 text-sm text-slate-200">{entry.msg}</div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
};

export default LogsTab;
