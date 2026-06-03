import { Check, EyeOff, Loader2, Plus, X } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { i18n } from '#imports';
import { deleteStep, getScreenshotsForSteps, getStepsForGuide } from '@/core/guides/service';
import type { Screenshot, Step } from '@/core/guides/types';
import { getActiveTab } from '@/lib/browser-api';
import { sendMessage } from '@/lib/messaging';
import { extractDomain } from '@/lib/utils';
import { Button } from '@/ui/components/button';
import ZoomScreenshot from './ZoomScreenshot';

interface RecordingViewProps {
  guideId: string;
  onStop: () => void;
  insertMode?: { afterStepIndex: number; afterStepDescription: string; startedAt: number };
}

function timeAgo(createdAt: number): string {
  const diff = Math.floor((Date.now() - createdAt) / 1000);
  if (diff < 3) return i18n.t('recording.justNow');
  if (diff < 60) return i18n.t('recording.secondsAgo', [String(diff)]);
  return i18n.t('recording.minutesAgo', [String(Math.floor(diff / 60))]);
}

interface LiveStep {
  step: Step;
  screenshot?: Screenshot;
}

export default function RecordingView({ guideId, onStop, insertMode }: RecordingViewProps) {
  const [steps, setSteps] = useState<LiveStep[]>([]);
  const [siteUrl, setSiteUrl] = useState('');
  const [isBlurring, setIsBlurring] = useState(false);
  const [isStopping, setIsStopping] = useState(false);
  const [, setTick] = useState(0);
  const bottomRef = useRef<HTMLDivElement>(null);

  const loadSteps = useCallback(async () => {
    const allSteps = await getStepsForGuide(guideId);
    const filtered = insertMode ? allSteps.filter((s) => s.timestamp >= insertMode.startedAt) : allSteps;
    const screenshotIds = filtered.map((s) => s.screenshotId).filter(Boolean) as string[];
    const screenshotMap = await getScreenshotsForSteps(screenshotIds);

    setSteps(
      filtered.map((step) => ({
        step,
        screenshot: screenshotMap.get(step.id),
      })),
    );

    if (filtered.length > 0 && !siteUrl) {
      setSiteUrl(filtered[0].url || '');
    }
  }, [guideId, insertMode, siteUrl]);

  useEffect(() => {
    loadSteps();
    const interval = setInterval(loadSteps, 800);
    return () => clearInterval(interval);
  }, [loadSteps]);

  useEffect(() => {
    const interval = setInterval(() => setTick((t) => t + 1), 5000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (steps.length === 0) return;
    const scroll = () => bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    scroll();
    const t = setTimeout(scroll, 300);
    return () => clearTimeout(t);
  }, [steps.length]);

  useEffect(() => {
    getActiveTab().then((tab) => {
      if (tab?.url) setSiteUrl(tab.url);
    });
  }, []);

  const handleBlur = useCallback(async () => {
    await sendMessage('enterBlurMode', undefined);
    setIsBlurring(true);
  }, []);

  useEffect(() => {
    const handler = (changes: Record<string, chrome.storage.StorageChange>) => {
      if ('mimikBlurMode' in changes && changes.mimikBlurMode.newValue === false) {
        setIsBlurring(false);
      }
    };
    chrome.storage.onChanged.addListener(handler);
    return () => chrome.storage.onChanged.removeListener(handler);
  }, []);

  const handleDeleteStep = useCallback(
    async (stepId: string) => {
      await deleteStep(guideId, stepId);
      await loadSteps();
    },
    [guideId, loadSteps],
  );

  const handleStop = useCallback(async () => {
    if (isStopping) return;
    setIsStopping(true);
    onStop();
  }, [isStopping, onStop]);

  const _domain = extractDomain(siteUrl);

  const pillText = () => {
    if (isBlurring) return i18n.t('recording.capturePaused');
    if (isStopping) return 'Saving…';
    if (insertMode) {
      if (steps.length === 0) return 'Waiting for action…';
      return steps.length === 1 ? '1 step inserted' : `${steps.length} steps inserted`;
    }
    return steps.length === 1
      ? i18n.t('recording.recording', [String(steps.length)])
      : i18n.t('recording.recordingPlural', [String(steps.length)]);
  };

  return (
    <div className="flex flex-col h-screen bg-card relative">
      {/* Floating recording pill */}
      <div className="absolute top-3 left-1/2 -translate-x-1/2 z-10 flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/90 backdrop-blur-sm border border-border shadow-sm max-w-[90%]">
        <span
          className={`shrink-0 w-2 h-2 rounded-full ${isBlurring ? 'bg-accent' : isStopping ? 'bg-muted-foreground' : 'bg-destructive animate-pulse'}`}
        />
        <span className="text-xs font-semibold text-foreground truncate">{pillText()}</span>
      </div>

      {/* Feed */}
      <div className="flex-1 overflow-y-auto pt-12">
        {/* Insert mode context banner */}
        {insertMode && (
          <div className="mx-4 mt-2 mb-1 px-3 py-2 rounded-lg bg-secondary border border-border">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-0.5">
              Inserting after step {insertMode.afterStepIndex + 1}
            </p>
            <p className="text-xs text-foreground leading-snug line-clamp-2">
              {insertMode.afterStepDescription || 'Navigate the page, then perform an action to insert it here.'}
            </p>
          </div>
        )}

        {steps.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-[calc(100%-5rem)] gap-3 px-6">
            {insertMode ? (
              <>
                <div className="w-12 h-12 rounded-full bg-secondary flex items-center justify-center">
                  <Plus size={22} className="text-accent" />
                </div>
                <div className="text-center">
                  <p className="text-sm font-semibold text-foreground">Ready to insert</p>
                  <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                    The page is loading. Perform an action and it will appear here.
                  </p>
                </div>
              </>
            ) : (
              <>
                <svg width="64" height="64" viewBox="0 0 200 200" fill="none">
                  <rect x="30" y="105" width="140" height="68" rx="5" fill="#1E1B4B" />
                  <path d="M30 105 L30 90 Q30 70, 100 70 Q170 70, 170 90 L170 105 Z" fill="#3730A3" />
                  <rect x="30" y="103" width="140" height="3" fill="#C7D2FE" />
                  <path d="M68 132 Q76 122 84 132" stroke="#C7D2FE" strokeWidth="5" fill="none" strokeLinecap="round" />
                  <path
                    d="M116 132 Q124 122 132 132"
                    stroke="#C7D2FE"
                    strokeWidth="5"
                    fill="none"
                    strokeLinecap="round"
                  />
                  <path
                    d="M84 148 Q100 158 116 148"
                    stroke="#C7D2FE"
                    strokeWidth="3.5"
                    fill="none"
                    strokeLinecap="round"
                  />
                  <rect x="60" y="38" width="80" height="50" rx="8" fill="#3730A3" stroke="#3730A3" strokeWidth="2" />
                  <circle cx="100" cy="62" r="16" fill="#1E1B4B" stroke="#3730A3" strokeWidth="2" />
                  <circle cx="100" cy="62" r="9" fill="#080818" />
                  <circle cx="100" cy="62" r="4" fill="#C7D2FE" opacity="0.4" />
                  <rect x="112" y="42" width="18" height="8" rx="3" fill="#C7D2FE" opacity="0.7" />
                  <circle cx="121" cy="38" r="20" fill="#C7D2FE" className="animate-[cam-flash_3s_ease_infinite]" />
                  <circle cx="80" cy="42" r="5" fill="#4F46E5" />
                  <ellipse cx="54" cy="64" rx="10" ry="8" fill="#1E1B4B" />
                  <ellipse cx="146" cy="64" rx="10" ry="8" fill="#1E1B4B" />
                </svg>
                <div className="text-center">
                  <p className="text-sm font-semibold text-foreground">{i18n.t('recording.readyTitle')}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{i18n.t('recording.readySub')}</p>
                </div>
              </>
            )}
          </div>
        ) : (
          <div className={insertMode ? 'mt-2' : ''}>
            {steps.map((liveStep, idx) => (
              <div key={liveStep.step.id}>
                <div className="px-4 pb-4 group">
                  {liveStep.screenshot && (
                    <div className="mb-2">
                      <ZoomScreenshot
                        screenshot={liveStep.screenshot}
                        alt={liveStep.step.description}
                        className="shadow-sm"
                        crop
                        animate
                      />
                    </div>
                  )}
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="text-[13px] font-medium leading-snug text-foreground">
                        {liveStep.step.description}
                      </p>
                      <span className="text-[10px] text-purple">
                        {timeAgo(liveStep.step.timestamp)} · {extractDomain(liveStep.step.url || siteUrl)}
                      </span>
                    </div>
                    <button
                      onClick={() => handleDeleteStep(liveStep.step.id)}
                      className="opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded text-border hover:text-destructive"
                      title={i18n.t('recording.deleteStep')}
                    >
                      <X size={13} />
                    </button>
                  </div>
                </div>
                {idx < steps.length - 1 && <div className="mx-4 mb-4 h-px bg-border" />}
              </div>
            ))}
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Bottom bar */}
      <div className="shrink-0 border-t border-border px-4 py-2.5 flex items-center gap-2">
        <Button
          onClick={handleStop}
          disabled={isStopping}
          className="flex-1 h-10 rounded-full font-semibold text-[13px]"
        >
          {isStopping ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} strokeWidth={3} />}
          {insertMode ? 'Done inserting' : i18n.t('recording.finishRecording')}
        </Button>
        {!insertMode && (
          <button
            onClick={handleBlur}
            disabled={isBlurring || isStopping}
            className="w-10 h-10 rounded-full border border-border flex items-center justify-center transition-colors text-muted-foreground hover:border-accent hover:text-accent disabled:opacity-50 disabled:cursor-not-allowed"
            title={i18n.t('recording.smartBlur')}
          >
            <EyeOff size={16} />
          </button>
        )}
        <button
          onClick={handleStop}
          disabled={isStopping}
          className="w-10 h-10 rounded-full border border-border flex items-center justify-center transition-colors text-purple hover:border-destructive/30 hover:text-destructive disabled:opacity-50 disabled:cursor-not-allowed"
          title={insertMode ? 'Cancel' : i18n.t('recording.discard')}
        >
          <X size={16} />
        </button>
      </div>
    </div>
  );
}
