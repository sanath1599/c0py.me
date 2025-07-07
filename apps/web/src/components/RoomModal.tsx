import React, {
  useState,
  useEffect,
  useCallback,
  useRef,
  type ChangeEvent,
  type FormEvent,
} from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Globe, Lock, RefreshCw, Copy } from 'lucide-react';
import { GlassCard } from './GlassCard';
import { trackRoomEvents } from '../utils/analytics';

/* ------------------------------------------------------------------ */
/* helpers                                                            */
/* ------------------------------------------------------------------ */

const ROOM_ID_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789' as const;
const DEFAULT_LENGTH = 8;

function generateRandomRoomId(length: number = DEFAULT_LENGTH): string {
  return Array.from({ length }, () =>
    ROOM_ID_CHARS[Math.floor(Math.random() * ROOM_ID_CHARS.length)]
  ).join('');
}

export function isValidRoomId(id: string): boolean {
  return /^[A-Z0-9]{5,10}$/.test(id);
}

/* ------------------------------------------------------------------ */
/* types                                                              */
/* ------------------------------------------------------------------ */

export interface RoomModalProps {
  isOpen: boolean;
  onClose(): void;
  onJoinRoom(roomId: string): void;
}

/* ------------------------------------------------------------------ */
/* component                                                          */
/* ------------------------------------------------------------------ */

export const RoomModal: React.FC<RoomModalProps> = ({
  isOpen,
  onClose,
  onJoinRoom,
}) => {
  const [tab, setTab] = useState<'create' | 'join'>('create');
  const [roomId, setRoomId] = useState('');
  const [touched, setTouched] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [copied, setCopied] = useState(false);

  // refs for autofocus
  const createInputRef = useRef<HTMLInputElement>(null);
  const joinInputRef = useRef<HTMLInputElement>(null);

  /* ---------------------------------- */
  /* reset state when tab or modal flips */
  /* ---------------------------------- */
  useEffect(() => {
    if (!isOpen) return;

    // WHEN OPENING THE MODAL:
    // create → start empty, join → start empty as well
    setRoomId('');
    setTouched(false);
    setCopied(false);

    // give the correct field focus after the next paint
    setTimeout(() => {
      (tab === 'create' ? createInputRef : joinInputRef).current?.focus();
    }, 0);
  }, [isOpen, tab]);

  /* ---------------------------------- */
  /* handlers                           */
  /* ---------------------------------- */

  const handleRandom = useCallback(() => {
    const newRoomId = generateRandomRoomId();
    setRoomId(newRoomId);
    setTouched(true);
    setCopied(false);
    trackRoomEvents.created(newRoomId);
  }, []);

  const handleCopy = useCallback(() => {
    if (!roomId) return;

    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(roomId).then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 1200);
        trackRoomEvents.copied(roomId);
      });
    }
  }, [roomId]);

  const handleInput = (e: ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '');
    setRoomId(value);
    setTouched(true);
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const trimmed = roomId.trim();

    if (!isValidRoomId(trimmed)) {
      setTouched(true);
      return;
    }

    setSubmitting(true);
    await new Promise((res) => setTimeout(res, 700)); // fake latency
    setSubmitting(false);

    onJoinRoom(trimmed);
    onClose();
  };

  const showError = touched && !isValidRoomId(roomId);

  /* ------------------------------------------------------------------ */
  /* render                                                              */
  /* ------------------------------------------------------------------ */
  return (
    <AnimatePresence>
      {isOpen && (
      <motion.div
          className="fixed inset-0 z-50 flex items-center justify-center"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        >
          {/* overlay */}
          <div className="absolute inset-0 bg-black/50 backdrop-blur-md z-0" />

          {/* card */}
          <motion.div
            className="w-full max-w-md mx-4 z-10"
            initial={{ scale: 0.96, opacity: 0, y: 32 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.96, opacity: 0, y: 32 }}
            transition={{ type: 'spring', damping: 22, stiffness: 260 }}
          >
            <GlassCard className="pt-10 pb-8 px-6 min-h-[540px] relative overflow-visible flex flex-col items-center">
              {/* Lion logo and branding */}
              <div className="flex flex-col items-center mb-6">
                <div className="w-24 h-24 rounded-full flex items-center justify-center shadow-2xl border-4 border-white/40 bg-white/20 backdrop-blur-md">
                  <motion.img
                    src="/logo.png"
                    alt="c0py.me Lion Logo"
                    className="w-16 h-16 rounded-full"
                    style={{ filter: 'drop-shadow(0 4px 24px #A6521B66)' }}
                    initial={{ scale: 0.8, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ duration: 0.5 }}
                  />
                </div>
                <span className="mt-2 text-xs font-bold tracking-widest text-orange-700 drop-shadow-sm">
                  c0py.me
                </span>
              </div>

              {/* Close button */}
                <button
                  type="button"
                onClick={onClose}
                aria-label="Close room modal"
                className="absolute top-5 right-5 p-2 rounded-full hover:bg-white/30 focus:bg-white/40 transition-colors focus:outline-none border border-white/30 shadow focus:ring-2 focus:ring-orange-400"
              >
                <X size={22} />
              </button>

              {/* Tabs */}
              <div className="flex gap-2 mb-8 w-full max-w-xs mx-auto justify-center">
                <TabButton
                  active={tab === 'create'}
                  onClick={() => setTab('create')}
                  icon={<Globe size={18} />}
                >
                  Create New
                </TabButton>
                <TabButton
                  active={tab === 'join'}
                  onClick={() => setTab('join')}
                  icon={<Lock size={18} />}
                >
                  Join Existing
                </TabButton>
              </div>

              {/* Form */}
              <form onSubmit={handleSubmit} className="w-full max-w-sm mx-auto flex flex-col gap-6">
                {tab === 'create' ? (
                  <CreateSection
                    roomId={roomId}
                    handleInput={handleInput}
                    inputRef={createInputRef}
                    handleRandom={handleRandom}
                    handleCopy={handleCopy}
                    copied={copied}
                    showError={showError}
                  />
                ) : (
                  <JoinSection
                    roomId={roomId}
                    handleInput={handleInput}
                    handleRandom={handleRandom}
                    showError={showError}
                    inputRef={joinInputRef}
                  />
                )}

                <SubmitButton
                  disabled={submitting || !isValidRoomId(roomId)}
                  submitting={submitting}
                  icon={tab === 'create' ? <Globe size={18} /> : <Lock size={18} />}
                >
                  {tab === 'create' ? 'Create Room' : 'Join Room'}
                </SubmitButton>
            </form>

              {/* Privacy info */}
              <div className="mt-8 p-3 rounded-lg border border-orange-100/60 bg-white/40 backdrop-blur-[6px] shadow-sm w-full max-w-sm mx-auto">
                <p className="text-xs text-center font-medium text-orange-700/90">
                  <strong>Room Privacy:</strong> Only users with the room code can join. Files are shared directly between room members.
              </p>
            </div>
          </GlassCard>
        </motion.div>
      </motion.div>
      )}
    </AnimatePresence>
  );
};

/* ================================================================== */
/* tiny sub-components                                                 */
/* ================================================================== */

interface TabButtonProps {
  active: boolean;
  onClick(): void;
  icon: React.ReactNode;
  children: React.ReactNode;
}

const TabButton: React.FC<TabButtonProps> = ({
  active,
  onClick,
  icon,
  children,
}) => (
  <button
    type="button"
    onClick={onClick}
    className={`flex-1 py-3 px-4 rounded-xl font-semibold flex items-center justify-center gap-2 transition-all border-2 focus:outline-none focus:ring-2 focus:ring-orange-300 shadow-lg ${
      active
        ? 'bg-white/60 border-orange-400 text-orange-700 shadow-orange-200'
        : 'bg-white/30 border-white/40 text-gray-600 hover:bg-white/50'
    }`}
  >
    {icon}
    {children}
  </button>
);

interface CreateSectionProps {
  roomId: string;
  handleInput(e: ChangeEvent<HTMLInputElement>): void;
  inputRef: React.RefObject<HTMLInputElement>;
  handleRandom(): void;
  handleCopy(): void;
  copied: boolean;
  showError: boolean;
}

const CreateSection: React.FC<CreateSectionProps> = ({
  roomId,
  handleInput,
  inputRef,
  handleRandom,
  handleCopy,
  copied,
  showError,
}) => (
  <div className="flex flex-col gap-4 items-center w-full">
    <label className="block text-sm font-semibold mb-1 text-orange-900/90 self-start">
      Room Code
    </label>
    <input
      ref={inputRef}
      type="text"
      value={roomId}
      onChange={handleInput}
      placeholder="Enter room code (5–10 characters)"
      className={`w-full px-4 py-3 rounded-xl border bg-white/60 shadow focus:outline-none focus:ring-2 text-lg font-mono text-center tracking-widest ${
        showError
          ? 'border-red-400 ring-2 ring-red-200'
          : 'border-orange-200 focus:ring-orange-300'
      }`}
      maxLength={10}
      minLength={5}
    />
    <button
      type="button"
      onClick={handleRandom}
      className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-white/60 border border-orange-200 shadow hover:bg-orange-100/80 active:bg-orange-200/80 transition-all backdrop-blur-[6px] focus:outline-none focus:ring-2 focus:ring-orange-400 text-orange-800 font-semibold text-base"
      style={{ marginTop: 4 }}
    >
      <RefreshCw size={20} className="mr-1" />
      Generate Random Room Code
    </button>
    <button
      type="button"
      onClick={handleCopy}
      className={`w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-white/60 border border-orange-200 shadow hover:bg-green-100/80 active:bg-green-200/80 transition-all backdrop-blur-[6px] focus:outline-none focus:ring-2 focus:ring-green-400 text-green-800 font-semibold text-base ${copied ? 'ring-2 ring-green-400' : ''}`}
      style={{ marginTop: 4 }}
      disabled={!roomId}
    >
      <Copy size={18} className={copied ? 'text-green-600' : undefined} />
      {copied ? 'Copied!' : 'Copy Room Code'}
    </button>
    {showError && (
      <p className="text-xs mt-2 text-center font-medium text-red-600">
        Room code must be 5-10 letters or numbers (A-Z, 0-9)
      </p>
    )}
  </div>
);

interface JoinSectionProps {
  roomId: string;
  handleInput(e: ChangeEvent<HTMLInputElement>): void;
  handleRandom(): void;
  showError: boolean;
  inputRef: React.RefObject<HTMLInputElement>;
}

const JoinSection: React.FC<JoinSectionProps> = ({
  roomId,
  handleInput,
  handleRandom,
  showError,
  inputRef,
}) => (
  <div className="flex flex-col gap-4 items-center w-full">
    <label className="block text-sm font-semibold mb-1 text-orange-900/90 self-start">
      Room Code
    </label>
    <input
      ref={inputRef}
      type="text"
      value={roomId}
      onChange={handleInput}
      placeholder="Enter room code (5–10 characters)"
      className={`w-full px-4 py-3 rounded-xl border bg-white/60 shadow focus:outline-none focus:ring-2 text-lg font-mono text-center tracking-widest ${
        showError
          ? 'border-red-400 ring-2 ring-red-200'
          : 'border-orange-200 focus:ring-orange-300'
      }`}
      maxLength={10}
      minLength={5}
      autoFocus
    />
    <button
      type="button"
      onClick={handleRandom}
      className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-white/60 border border-orange-200 shadow hover:bg-orange-100/80 active:bg-orange-200/80 transition-all backdrop-blur-[6px] focus:outline-none focus:ring-2 focus:ring-orange-400 text-orange-800 font-semibold text-base"
      style={{ marginTop: 4 }}
    >
      <RefreshCw size={20} className="mr-1" />
      Generate Random Room Code
    </button>
    {showError && (
      <p className="text-xs mt-2 text-center font-medium text-red-600">
        Room code must be 5-10 letters or numbers (A-Z, 0-9)
      </p>
    )}
  </div>
);

interface IconButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  ring?: string;
}

const IconButton: React.FC<IconButtonProps> = ({
  ring,
  className = '',
  ...rest
}) => (
  <button
    type="button"
    className={`w-9 h-9 flex items-center justify-center rounded-full bg-white/60 border border-white/40 shadow hover:bg-orange-100/80 active:bg-orange-200/80 transition-all backdrop-blur-[6px] focus:outline-none focus:ring-2 focus:ring-orange-400 disabled:opacity-40 disabled:cursor-not-allowed ${ring ?? ''} ${className}`}
    {...rest}
  />
);

interface SubmitButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  submitting: boolean;
  icon: React.ReactNode;
  children: React.ReactNode;
}

const SubmitButton: React.FC<SubmitButtonProps> = ({
  submitting,
  icon,
  children,
  ...rest
}) => (
  <button
    type="submit"
    className="w-full py-3 text-white rounded-xl font-bold flex items-center justify-center gap-2 transition-colors shadow-lg focus:outline-none focus:ring-2 focus:ring-orange-300 text-lg disabled:opacity-60 disabled:cursor-not-allowed"
    style={{
      background: 'linear-gradient(90deg, #F6C148 60%, #A6521B 100%)',
    }}
    {...rest}
  >
    {submitting ? (
      <svg
        className="animate-spin h-6 w-6 text-white"
        xmlns="http://www.w3.org/2000/svg"
        fill="none"
        viewBox="0 0 24 24"
      >
        <circle
          className="opacity-25"
          cx="12"
          cy="12"
          r="10"
          stroke="currentColor"
          strokeWidth="4"
        />
        <path
          className="opacity-75"
          fill="currentColor"
          d="M4 12a8 8 0 018-8v8z"
        />
      </svg>
    ) : (
      <>
        {icon}
        {children}
      </>
    )}
  </button>
);
