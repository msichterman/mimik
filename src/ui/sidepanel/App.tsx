import { ExternalLink, Library, MessageSquare, Search, Settings, Square, Video } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { browser, i18n } from '#imports';
import { CaptureState } from '@/core/capture/machine';
import type { GuideMeSession } from '@/core/guideme/session';
import { SESSION_KEY } from '@/core/guideme/session';
import {
  createTab,
  focusWindow,
  getActiveTab,
  getExtensionURL,
  queryTabs,
  requestHostPermissions,
  updateTab,
} from '@/lib/browser-api';
import { logger } from '@/lib/logger';
import { sendMessage } from '@/lib/messaging';
import { connectToBackground } from '@/lib/port';
import { Button } from '@/ui/components/button';
import { Input } from '@/ui/components/input';
import SettingsView from '@/ui/shared/SettingsView';
import ChatView from './ChatView';
import GuideEditor from './GuideEditor';
import GuideMeCompletion from './GuideMeCompletion';
import GuideMeView from './GuideMeView';
import LibraryView from './LibraryView';
import RecordingView from './RecordingView';

type Tab = 'library' | 'chat' | 'settings';

type Overlay =
  | { name: 'editor'; guideId: string }
  | {
      name: 'insert-recording';
      guideId: string;
      afterStepIndex: number;
      afterStepDescription: string;
      startedAt: number;
    }
  | { name: 'guideme'; guideId: string }
  | { name: 'guideme-done'; guideId: string }
  | null;

function MascotIcon({ size = 44 }: { size?: number }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200" width={size} height={size}>
      <defs>
        <clipPath id="cc">
          <circle cx="100" cy="100" r="95" />
        </clipPath>
        <clipPath id="ds">
          <path d="M30 95 L170 60 L170 95 Z" />
        </clipPath>
      </defs>
      <g clipPath="url(#cc)">
        <rect x="-50" y="-50" width="300" height="300" className="fill-lavender" />
        <rect
          x="30"
          y="-80"
          width="50"
          height="400"
          className="fill-accent"
          transform="rotate(45, 100, 100)"
          opacity="0.15"
        />
        <rect x="90" y="-80" width="50" height="400" fill="#818CF8" transform="rotate(45, 100, 100)" opacity="0.12" />
        <rect x="-30" y="-80" width="50" height="400" fill="#93C5FD" transform="rotate(45, 100, 100)" opacity="0.15" />
        <rect x="150" y="-80" width="50" height="400" fill="#A5B4FC" transform="rotate(45, 100, 100)" opacity="0.1" />
      </g>
      <rect x="30" y="95" width="140" height="68" rx="5" className="fill-primary" />
      <path d="M30 95 L30 80 Q30 60, 100 60 Q170 60, 170 80 L170 95 Z" className="fill-violet-mid" />
      <path d="M30 95 L30 80 Q30 60, 100 60 Q170 60, 170 80 L170 95 Z" className="fill-accent" clipPath="url(#ds)" />
      <rect x="30" y="93" width="140" height="3" className="fill-lavender" />
      <path d="M68 122 Q76 112 84 122" className="stroke-lavender" strokeWidth="5" fill="none" strokeLinecap="round" />
      <path
        d="M116 122 Q124 112 132 122"
        className="stroke-lavender"
        strokeWidth="5"
        fill="none"
        strokeLinecap="round"
      />
      <path
        d="M84 138 Q100 148 116 138"
        className="stroke-lavender"
        strokeWidth="3.5"
        fill="none"
        strokeLinecap="round"
      />
    </svg>
  );
}

function TabItem({
  active,
  icon,
  label,
  onClick,
}: {
  active: boolean;
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex-1 flex flex-col items-center gap-0.5 py-2.5 transition-colors ${
        active ? 'text-accent' : 'text-muted-foreground hover:text-foreground'
      }`}
    >
      {icon}
      <span className="text-[10px] font-medium">{label}</span>
    </button>
  );
}

export default function App() {
  const [isAlive, setIsAlive] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [stepCount, setStepCount] = useState(0);
  const [tab, setTab] = useState<Tab>('library');
  const [overlay, setOverlay] = useState<Overlay>(null);
  const [search, setSearch] = useState('');

  // Ref so stop handler always has the latest guide ID without being in dependency arrays
  const recordingGuideIdRef = useRef<string | null>(null);

  useEffect(() => {
    const disconnect = connectToBackground({
      onConnect: () => setIsAlive(true),
      onDisconnect: () => setIsAlive(false),
      onStateUpdate: (update) => {
        const recording = update.state === CaptureState.RECORDING;
        setIsRecording(recording);
        setStepCount(update.stepCount);
        if (update.currentGuideId) recordingGuideIdRef.current = update.currentGuideId;
        if (!recording) recordingGuideIdRef.current = null;
      },
    });
    return disconnect;
  }, []);

  useEffect(() => {
    browser.storage.local.get([SESSION_KEY]).then((data: Record<string, unknown>) => {
      const session = data[SESSION_KEY] as GuideMeSession | null;
      if (session?.active) setOverlay({ name: 'guideme', guideId: session.guideId });
    });

    const handler = (changes: Record<string, { newValue?: unknown }>) => {
      if (!changes[SESSION_KEY]) return;
      const session = changes[SESSION_KEY].newValue as GuideMeSession | null;
      if (session?.active) setOverlay({ name: 'guideme', guideId: session.guideId });
    };

    browser.storage.local.onChanged.addListener(handler);
    return () => browser.storage.local.onChanged.removeListener(handler);
  }, []);

  const handleStartRecording = useCallback(async () => {
    const granted = await requestHostPermissions();
    if (!granted) {
      logger.warn('Host permissions not granted');
      return;
    }
    const activeTab = await getActiveTab();
    const url = activeTab?.url || '';
    try {
      const res = await sendMessage('startRecording', { url });
      if (res.guideId) recordingGuideIdRef.current = res.guideId;
    } catch (err) {
      logger.error('START_RECORDING error', err);
    }
  }, []);

  const handleStopRecording = useCallback(async () => {
    try {
      const res = await sendMessage('stopRecording', undefined);
      if (res.success && res.guideId) {
        const url = getExtensionURL(`/fullview.html?guideId=${res.guideId}`);
        const tabs = await queryTabs({ url: getExtensionURL('/fullview.html') });
        if (tabs.length > 0 && tabs[0].id) {
          await updateTab(tabs[0].id, { active: true, url });
          if (tabs[0].windowId) await focusWindow(tabs[0].windowId);
        } else {
          await createTab({ url });
        }
      }
    } catch (err) {
      logger.error('STOP_RECORDING error', err);
    }
  }, []);

  const openFullview = useCallback(async () => {
    const url = getExtensionURL('/fullview.html');
    const tabs = await queryTabs({ url });
    if (tabs.length > 0 && tabs[0].id) {
      await updateTab(tabs[0].id, { active: true });
      if (tabs[0].windowId) await focusWindow(tabs[0].windowId);
    } else {
      await createTab({ url });
    }
  }, []);

  if (overlay?.name === 'insert-recording') {
    const { guideId: insertGuideId, afterStepIndex, afterStepDescription, startedAt } = overlay;
    return (
      <RecordingView
        guideId={insertGuideId}
        insertMode={{ afterStepIndex, afterStepDescription, startedAt }}
        onStop={async () => {
          try {
            await sendMessage('stopRecording', undefined);
          } catch {}
          setIsRecording(false);
          setOverlay({ name: 'editor', guideId: insertGuideId });
        }}
      />
    );
  }

  // Full-screen overlays (editor, guideme) still take over
  if (overlay?.name === 'guideme') {
    return (
      <GuideMeView
        guideId={overlay.guideId}
        onExit={() => {
          sendMessage('guideMeCancel', undefined).catch(() => {});
          setOverlay(null);
        }}
        onComplete={(id) => setOverlay({ name: 'guideme-done', guideId: id })}
      />
    );
  }
  if (overlay?.name === 'guideme-done') {
    return (
      <GuideMeCompletion
        guideId={overlay.guideId}
        onDone={() => setOverlay(null)}
        onRunAgain={async (id) => {
          await sendMessage('startGuideMe', { guideId: id });
          setOverlay({ name: 'guideme', guideId: id });
        }}
      />
    );
  }
  if (overlay?.name === 'editor') {
    return (
      <GuideEditor
        guideId={overlay.guideId}
        onBack={() => setOverlay(null)}
        onGuideMe={(id) => setOverlay({ name: 'guideme', guideId: id })}
        onInsertStep={({ guideId, afterStepIndex, afterStepDescription, startedAt }) =>
          setOverlay({ name: 'insert-recording', guideId, afterStepIndex, afterStepDescription, startedAt })
        }
      />
    );
  }

  return (
    <div className="flex flex-col h-screen bg-card">
      {/* ── Library tab ── */}
      <div className={`flex-1 min-h-0 flex flex-col overflow-hidden ${tab === 'library' ? '' : 'hidden'}`}>
        <div className="relative overflow-hidden px-6 pt-5 pb-6 bg-gradient-to-br from-violet to-violet-light shrink-0">
          <div className="absolute -top-12 -right-8 w-44 h-44 rounded-full opacity-15 blur-[40px] bg-gradient-to-br from-lavender to-white" />
          <div className="relative flex items-center justify-between mb-5">
            <span className="text-[17px] font-bold tracking-tight text-foreground">{i18n.t('app.name')}</span>
            <span
              className={`text-[10px] font-medium px-2.5 py-0.5 rounded-full ${isAlive ? 'text-foreground bg-white/30' : 'text-deep/50 bg-white/15'}`}
            >
              {isAlive ? i18n.t('sidepanel.connected') : i18n.t('sidepanel.connecting')}
            </span>
          </div>
          <div className="relative text-center mb-4">
            <div className="flex justify-center mb-2">
              <MascotIcon size={40} />
            </div>
            <h3 className="text-sm font-medium text-foreground">{i18n.t('sidepanel.heroTitle')}</h3>
            <p className="text-xs mt-0.5 text-violet-dark">{i18n.t('sidepanel.heroSubtitle')}</p>
          </div>
          <Button
            onClick={isRecording ? handleStopRecording : handleStartRecording}
            disabled={!isAlive}
            variant={isRecording ? 'destructive' : 'default'}
            className="w-full py-2.5 px-4 h-auto rounded-lg font-semibold text-sm hover:-translate-y-px shadow-lg"
          >
            {isRecording ? (
              <>
                <Square size={15} className="fill-white" />
                Stop Recording
              </>
            ) : (
              <>
                <Video size={16} />
                {i18n.t('sidepanel.startCapture')}
              </>
            )}
          </Button>
        </div>
        <div className="flex-1 overflow-y-auto px-5 pt-4">
          <div className="relative mb-4">
            <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-purple pointer-events-none" />
            <Input
              type="text"
              placeholder={i18n.t('sidepanel.searchPlaceholder')}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-3 rounded-xl border-border bg-card !text-[13px]"
            />
          </div>
          <p className="text-[11px] font-semibold uppercase tracking-wider mb-2.5 text-muted-foreground">
            {i18n.t('sidepanel.recentLabel')}
          </p>
          <LibraryView
            onOpen={(guideId) => setOverlay({ name: 'editor', guideId })}
            isAlive={isAlive}
            searchQuery={search}
          />
        </div>
      </div>

      {/* ── Chat tab ── */}
      <div className={`flex-1 min-h-0 flex flex-col overflow-hidden ${tab === 'chat' ? '' : 'hidden'}`}>
        <div className="px-4 py-3 border-b border-border shrink-0">
          <p className="text-[15px] font-bold text-foreground">Chat</p>
        </div>
        <ChatView onStartRecording={handleStartRecording} />
      </div>

      {/* ── Settings tab ── */}
      <div className={`flex-1 min-h-0 overflow-y-auto ${tab === 'settings' ? '' : 'hidden'}`}>
        <SettingsView hideHeader />
      </div>

      {/* ── Recording banner (all tabs) ── */}
      {isRecording && (
        <div className="flex items-center gap-2.5 px-4 py-2 bg-destructive/8 border-t border-destructive/15 shrink-0">
          <span className="relative flex h-2 w-2 shrink-0">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-destructive opacity-60" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-destructive" />
          </span>
          <span className="text-xs font-semibold text-destructive flex-1">
            Recording · {stepCount} {stepCount === 1 ? 'step' : 'steps'} captured
          </span>
          <button
            onClick={handleStopRecording}
            className="text-xs font-semibold text-destructive/80 hover:text-destructive transition-colors underline underline-offset-2"
          >
            Stop
          </button>
        </div>
      )}

      {/* ── Bottom tab bar ── */}
      <div className="flex items-end border-t border-border bg-card shrink-0">
        {/* Left pair — Feed + Open Full View */}
        <TabItem
          active={tab === 'library'}
          icon={<Library size={18} />}
          label="Feed"
          onClick={() => setTab('library')}
        />
        <button
          onClick={openFullview}
          className="flex-1 flex flex-col items-center gap-0.5 py-2.5 text-muted-foreground hover:text-foreground transition-colors"
        >
          <ExternalLink size={18} className="-rotate-90" />
          <span className="text-[10px] font-medium">Full View</span>
        </button>

        {/* Capture / Stop — center */}
        <button
          onClick={isRecording ? handleStopRecording : handleStartRecording}
          disabled={!isAlive && !isRecording}
          className="flex-1 flex flex-col items-center py-2 transition-opacity disabled:opacity-40"
        >
          <div
            className={`w-11 h-11 rounded-full flex items-center justify-center shadow-md mb-0.5 transition-colors ${
              isRecording ? 'bg-destructive animate-pulse' : 'bg-accent'
            }`}
          >
            {isRecording ? (
              <Square size={14} className="text-white fill-white" />
            ) : (
              <Video size={18} className="text-white" />
            )}
          </div>
        </button>

        {/* Right pair — Chat + Settings */}
        <TabItem
          active={tab === 'chat'}
          icon={<MessageSquare size={18} />}
          label="Chat"
          onClick={() => setTab('chat')}
        />
        <TabItem
          active={tab === 'settings'}
          icon={<Settings size={18} />}
          label="Settings"
          onClick={() => setTab('settings')}
        />
      </div>
    </div>
  );
}
