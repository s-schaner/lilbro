import { ChangeEvent, FC, useRef } from 'react';
import { HelpCircle, Settings, Upload } from 'lucide-react';
import clsx from 'clsx';

const matches = [
  { id: 'demo-1', name: 'Demo Match — Cougars vs Hawks' },
  { id: 'demo-2', name: 'Demo Match — Tigers vs Owls' }
];

type Props = {
  activeMatch: string;
  onMatchChange: (value: string) => void;
  onUpload?: (file: File) => void;
};

const TopBar: FC<Props> = ({ activeMatch, onMatchChange, onUpload }) => {
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const handleUploadClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file && onUpload) {
      onUpload(file);
    }
    event.target.value = '';
  };

  return (
    <header className="flex items-center justify-between bg-slate-900/60 px-6 py-4 shadow-lg shadow-slate-950/40">
      <div className="flex items-center gap-4">
        <span className="rounded-full bg-primary-500/20 px-3 py-1 text-sm font-semibold text-primary-500">
          VolleySense – Auto-Stats & Trainer
        </span>
        <div>
          <label htmlFor="match" className="sr-only">
            Select match
          </label>
          <select
            id="match"
            value={activeMatch}
            onChange={(event) => onMatchChange(event.target.value)}
            className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500"
          >
            {matches.map((match) => (
              <option key={match.id} value={match.id}>
                {match.name}
              </option>
            ))}
          </select>
        </div>
        <span className="flex items-center gap-2 rounded-full bg-green-500/10 px-3 py-1 text-xs font-semibold text-green-400">
          <span className="inline-block h-2 w-2 rounded-full bg-green-400" aria-hidden />
          Live
        </span>
      </div>
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={handleUploadClick}
          className="inline-flex items-center gap-2 rounded-lg border border-primary-500/40 bg-primary-500/10 px-4 py-2 text-sm font-medium text-primary-500 transition hover:bg-primary-500/20 focus:outline-none focus:ring-2 focus:ring-primary-500"
        >
          <Upload className="h-4 w-4" aria-hidden /> Upload Video
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept=".mp4,.mov,.mkv,.webm,.avi"
          onChange={handleFileChange}
          className="hidden"
        />
        <div className="flex items-center gap-2 text-slate-400">
          <button
            type="button"
            className={clsx(
              'rounded-lg border border-slate-700 bg-slate-800/60 p-2 transition hover:border-slate-500',
              'focus:outline-none focus:ring-2 focus:ring-primary-500'
            )}
            aria-label="Open settings"
          >
            <Settings className="h-5 w-5" />
          </button>
          <button
            type="button"
            className={clsx(
              'rounded-lg border border-slate-700 bg-slate-800/60 p-2 transition hover:border-slate-500',
              'focus:outline-none focus:ring-2 focus:ring-primary-500'
            )}
            aria-label="Open help"
          >
            <HelpCircle className="h-5 w-5" />
          </button>
        </div>
      </div>
    </header>
  );
};

export default TopBar;
