import { ArrowRight } from 'lucide-react';
import { useEffect, useState } from 'react';
import { browser, i18n } from '#imports';
import { PRESET_LABELS, type PresetKey } from '@/core/blur/regexes';
import { AI_PROVIDERS, type AIProviderKey } from '@/core/capture/ai/models';
import { AI_LANGUAGES, type AILanguageCode } from '@/core/capture/ai/prompts';
import { localStorage, requestHostPermissions } from '@/lib/browser-api';
import { Button } from '@/ui/components/button';
import { Input } from '@/ui/components/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/ui/components/select';
import { Switch } from '@/ui/components/switch';

const BLUR_PRESET_I18N: Record<PresetKey, string> = {
  email: 'email',
  phone: 'phoneNumbers',
  ssn: 'ssn',
  creditCard: 'creditCard',
  ipAddress: 'ipAddress',
  macAddress: 'macAddress',
};

function MascotLarge({ size = 280 }: { size?: number }) {
  return (
    <svg viewBox="0 0 200 200" width={size} height={size}>
      <circle cx="40" cy="70" r="4" fill="#818CF8" style={{ animation: 'sparkle 1.5s ease-in-out infinite' }} />
      <circle cx="165" cy="60" r="3.5" fill="#818CF8" style={{ animation: 'sparkle 1.5s ease-in-out infinite 0.3s' }} />
      <circle cx="42" cy="155" r="3" fill="#A5B4FC" style={{ animation: 'sparkle 1.5s ease-in-out infinite 0.6s' }} />
      <circle
        cx="162"
        cy="150"
        r="3.5"
        fill="#818CF8"
        style={{ animation: 'sparkle 1.5s ease-in-out infinite 0.9s' }}
      />
      <circle cx="100" cy="110" r="55" fill="#C7D2FE" />
      <rect x="55" y="110" width="90" height="44" rx="5" fill="#1E1B4B" />
      <path d="M55 110 L55 98 Q55 80 100 80 Q145 80 145 98 L145 110Z" fill="#3730A3" />
      <path d="M55 110 L55 98 Q55 80 100 80 Q145 80 145 98 L145 110Z" fill="#4F46E5" />
      <rect x="55" y="109" width="90" height="2" fill="#C7D2FE" />
      <path d="M80 128 Q86 120 92 128" stroke="#C7D2FE" strokeWidth="3.5" fill="none" strokeLinecap="round" />
      <path d="M108 128 Q114 120 120 128" stroke="#C7D2FE" strokeWidth="3.5" fill="none" strokeLinecap="round" />
      <path d="M90 140 Q100 148 110 140" stroke="#C7D2FE" strokeWidth="2.5" fill="none" strokeLinecap="round" />
      <style>{`@keyframes sparkle{0%,100%{opacity:.3;transform:scale(.8)}50%{opacity:1;transform:scale(1.1)}}@keyframes float{0%,100%{transform:translateY(0)}50%{transform:translateY(-8px)}}`}</style>
    </svg>
  );
}

function ProgressDots({ current }: { current: number }) {
  return (
    <div className="flex items-center gap-2">
      {[1, 2, 3].map((i) => (
        <div
          key={i}
          className={`h-2 rounded-full transition-all duration-300 ${
            i === current ? 'w-8 bg-accent' : i < current ? 'w-2 bg-accent/40' : 'w-2 bg-border'
          }`}
        />
      ))}
    </div>
  );
}

function WelcomeStep({ onNext }: { onNext: () => void }) {
  return (
    <div className="flex h-screen">
      <div className="flex-1 flex flex-col justify-center" style={{ padding: '80px 64px' }}>
        <div className="max-w-lg">
          <span className="inline-flex text-xs font-semibold text-accent bg-secondary px-3.5 py-1.5 rounded-full mb-6">
            {i18n.t('onboarding.welcomeBadge')}
          </span>
          <h1 className="text-4xl font-extrabold text-foreground leading-tight mb-3 tracking-tight">
            {i18n.t('onboarding.welcomeTitle')}
          </h1>
          <p className="text-base text-muted-foreground leading-relaxed mb-10 max-w-md">
            {i18n.t('onboarding.welcomeMessage')}
          </p>
          <Button onClick={onNext} className="gap-2 px-7 h-auto py-3 rounded-xl text-sm">
            {i18n.t('onboarding.getStarted')}
            <ArrowRight size={16} />
          </Button>
        </div>
      </div>
      <div className="w-1/2 bg-deep flex items-center justify-center relative overflow-hidden">
        <div className="absolute w-[500px] h-[500px] bg-[radial-gradient(circle,rgba(79,70,229,0.2),transparent_70%)] top-[10%] right-[-10%]" />
        <div className="absolute w-[400px] h-[400px] bg-[radial-gradient(circle,rgba(56,189,248,0.1),transparent_70%)] bottom-[10%] left-[10%]" />
        <div className="animate-[float_3s_ease-in-out_infinite]">
          <MascotLarge size={280} />
        </div>
      </div>
    </div>
  );
}

function AISetupStep({ onNext, onSkip }: { onNext: () => void; onSkip: () => void }) {
  const [provider, setProvider] = useState<AIProviderKey>('openai');
  const [model, setModel] = useState(AI_PROVIDERS.openai.defaultModel);
  const [apiKey, setApiKey] = useState('');
  const [aiLanguage, setAiLanguage] = useState<AILanguageCode>('en');

  const providerConfig = AI_PROVIDERS[provider];

  const handleProviderChange = (newProvider: AIProviderKey) => {
    setProvider(newProvider);
    setModel(AI_PROVIDERS[newProvider].defaultModel);
  };

  const handleContinue = async () => {
    await localStorage.set({
      ...(apiKey ? { aiApiKey: apiKey, aiProvider: provider, aiModel: model } : {}),
      aiLanguage,
    });
    onNext();
  };

  return (
    <div className="flex h-screen">
      <div className="flex-1 flex flex-col justify-center" style={{ padding: '80px 64px' }}>
        <div className="max-w-md">
          <p className="text-xs font-semibold text-accent mb-2 tracking-wide uppercase">
            {i18n.t('onboarding.aiStepLabel')}
          </p>
          <h1 className="text-3xl font-extrabold text-foreground leading-tight mb-2">{i18n.t('onboarding.aiTitle')}</h1>
          <p className="text-sm text-muted-foreground leading-relaxed mb-8">{i18n.t('onboarding.aiMessage')}</p>

          <div className="space-y-4 mb-8">
            <div>
              <label className="block text-xs font-semibold text-foreground mb-1.5">
                {i18n.t('settings.provider')}
              </label>
              <Select value={provider} onValueChange={(v) => handleProviderChange(v as AIProviderKey)}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(AI_PROVIDERS).map(([key, cfg]) => (
                    <SelectItem key={key} value={key}>
                      {cfg.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-foreground mb-1.5">{i18n.t('settings.model')}</label>
              <Select value={model} onValueChange={setModel}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {providerConfig.models.map((m) => (
                    <SelectItem key={m.id} value={m.id}>
                      {m.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-foreground mb-1.5">{i18n.t('settings.apiKey')}</label>
              <Input type="password" value={apiKey} onChange={(e) => setApiKey(e.target.value)} placeholder="sk-..." />
            </div>

            <div>
              <label className="block text-xs font-semibold text-foreground mb-1.5">
                {i18n.t('settings.aiLanguage')}
              </label>
              <Select value={aiLanguage} onValueChange={(v) => setAiLanguage(v as AILanguageCode)}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {AI_LANGUAGES.map((lang) => (
                    <SelectItem key={lang.code} value={lang.code}>
                      {lang.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Button onClick={handleContinue} className="px-8 h-auto py-3 rounded-xl">
              {i18n.t('common.continue')}
            </Button>
            <Button variant="ghost" onClick={onSkip} className="px-6 h-auto py-3 rounded-xl">
              {i18n.t('common.skip')}
            </Button>
          </div>

          <div className="mt-6">
            <ProgressDots current={1} />
          </div>
        </div>
      </div>
      <div className="w-1/2 bg-secondary flex items-center justify-center relative overflow-hidden">
        <div className="absolute w-[400px] h-[400px] bg-[radial-gradient(circle,rgba(79,70,229,0.06),transparent_70%)] top-[20%] left-[30%]" />
        <div className="animate-[float_4s_ease-in-out_infinite] relative">
          <svg
            className="absolute -top-4 right-6 w-6 h-6 text-violet-light opacity-40"
            style={{ animation: 'sparkle 2s ease-in-out infinite' }}
            viewBox="0 0 24 24"
            fill="currentColor"
          >
            <path d="M12 2L14 10L22 12L14 14L12 22L10 14L2 12L10 10Z" />
          </svg>
          <svg
            className="absolute bottom-3 -left-3 w-4 h-4 text-violet-light opacity-40"
            style={{ animation: 'sparkle 2s ease-in-out infinite 0.5s' }}
            viewBox="0 0 24 24"
            fill="currentColor"
          >
            <path d="M12 2L14 10L22 12L14 14L12 22L10 14L2 12L10 10Z" />
          </svg>
          <div className="bg-white rounded-2xl p-9 shadow-lg max-w-sm">
            <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest mb-4">
              {i18n.t('onboarding.aiGeneratedDescription')}
            </p>
            <div className="flex gap-3 mb-5">
              <div className="w-7 h-7 rounded-full bg-accent text-white text-xs font-bold flex items-center justify-center shrink-0">
                3
              </div>
              <div>
                <p className="text-sm text-foreground leading-relaxed">
                  Click on the{' '}
                  <span className="bg-accent/10 text-accent font-semibold px-1 rounded">Pull requests</span> tab in the
                  repository navigation
                </p>
                <span className="inline-flex items-center gap-1 text-[9px] font-semibold text-accent bg-secondary px-2 py-0.5 rounded mt-2">
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12 2L14 10L22 12L14 14L12 22L10 14L2 12L10 10Z" />
                  </svg>
                  {i18n.t('onboarding.aiGenerated')}
                </span>
              </div>
            </div>
            <div className="border-t border-border my-4" />
            <div className="flex gap-3">
              <div className="w-7 h-7 rounded-full bg-accent text-white text-xs font-bold flex items-center justify-center shrink-0">
                4
              </div>
              <div>
                <p className="text-sm text-foreground leading-relaxed">
                  Click on <span className="bg-accent/10 text-accent font-semibold px-1 rounded">Sort</span> dropdown to
                  change the ordering
                </p>
                <span className="inline-flex items-center gap-1 text-[9px] font-semibold text-accent bg-secondary px-2 py-0.5 rounded mt-2">
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12 2L14 10L22 12L14 14L12 22L10 14L2 12L10 10Z" />
                  </svg>
                  {i18n.t('onboarding.aiGenerated')}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function SmartBlurStep({ onNext, onSkip }: { onNext: () => void; onSkip: () => void }) {
  const [blurPresets, setBlurPresets] = useState<Record<PresetKey, boolean>>({
    email: true,
    phone: true,
    ssn: false,
    creditCard: false,
    ipAddress: false,
    macAddress: false,
  });

  const _handleToggle = (key: PresetKey) => {
    setBlurPresets((prev) => {
      const next = { ...prev, [key]: !prev[key] };
      localStorage.set({ blurPresets: next });
      return next;
    });
  };

  return (
    <div className="flex h-screen">
      <div className="flex-1 flex flex-col justify-center" style={{ padding: '80px 64px' }}>
        <div className="max-w-md">
          <p className="text-xs font-semibold text-accent mb-2 tracking-wide uppercase">
            {i18n.t('onboarding.blurStepLabel')}
          </p>
          <h1 className="text-3xl font-extrabold text-foreground leading-tight mb-2">
            {i18n.t('onboarding.blurTitle')}
          </h1>
          <p className="text-sm text-muted-foreground leading-relaxed mb-8">{i18n.t('onboarding.blurMessage')}</p>

          <div className="space-y-1 mb-8 border border-border rounded-2xl p-4">
            {(Object.keys(PRESET_LABELS) as PresetKey[]).map((key, i, arr) => (
              <div
                key={key}
                className={`flex items-center justify-between py-3 ${i < arr.length - 1 ? 'border-b border-secondary' : ''}`}
              >
                <span className="text-sm font-medium text-foreground">
                  {i18n.t(`blurPresets.${BLUR_PRESET_I18N[key]}`)}
                </span>
                <Switch
                  checked={blurPresets[key]}
                  onCheckedChange={(checked) => {
                    setBlurPresets((prev) => {
                      const next = { ...prev, [key]: checked };
                      localStorage.set({ blurPresets: next });
                      return next;
                    });
                  }}
                />
              </div>
            ))}
          </div>

          <div className="flex items-center gap-3">
            <Button onClick={onNext} className="px-8 h-auto py-3 rounded-xl">
              {i18n.t('common.continue')}
            </Button>
            <Button variant="ghost" onClick={onSkip} className="px-6 h-auto py-3 rounded-xl">
              {i18n.t('common.skip')}
            </Button>
          </div>

          <div className="mt-6">
            <ProgressDots current={2} />
          </div>
        </div>
      </div>
      <div className="w-1/2 bg-deep flex items-center justify-center relative overflow-hidden">
        <div className="absolute w-[350px] h-[350px] bg-[radial-gradient(circle,rgba(79,70,229,0.25),transparent_70%)] bottom-[20%] right-[20%]" />
        <div className="animate-[float_4s_ease-in-out_infinite] relative z-10">
          <div className="bg-white rounded-2xl p-7 shadow-lg" style={{ minWidth: 320 }}>
            <p className="text-xs font-semibold text-foreground mb-4">{i18n.t('onboarding.screenshotPreview')}</p>
            {[
              { icon: '@', label: i18n.t('blurPresets.email'), value: 'luis@company.com', blurred: true },
              { icon: '#', label: i18n.t('blurPresets.phoneNumbers'), value: '(555) 867-5309', blurred: true },
              { icon: 'ID', label: i18n.t('blurPresets.ssn'), value: i18n.t('onboarding.notEnabled'), blurred: false },
              {
                icon: '$',
                label: i18n.t('blurPresets.creditCard'),
                value: i18n.t('onboarding.notEnabled'),
                blurred: false,
              },
              {
                icon: 'IP',
                label: i18n.t('blurPresets.ipAddress'),
                value: i18n.t('onboarding.notEnabled'),
                blurred: false,
              },
            ].map((row, i, arr) => (
              <div
                key={row.label}
                className={`flex items-center gap-3 py-2.5 ${i < arr.length - 1 ? 'border-b border-border' : ''}`}
              >
                <div className="w-6 h-6 rounded-md bg-secondary flex items-center justify-center text-[10px] font-semibold text-accent">
                  {row.icon}
                </div>
                <span className="text-xs text-muted-foreground flex-1">{row.label}</span>
                <span
                  className={`text-xs font-semibold ${row.blurred ? 'text-foreground blur-[4px] select-none' : 'text-muted-foreground font-normal'}`}
                >
                  {row.value}
                </span>
              </div>
            ))}
            <div className="inline-flex items-center gap-1.5 text-[10px] font-semibold text-success bg-success/10 px-2.5 py-1 rounded mt-3">
              <svg
                width="13"
                height="13"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
              >
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
              </svg>
              {i18n.t('onboarding.categoriesProtected', ['2'])}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function PinExtensionStep({ onNext, onSkip }: { onNext: () => void; onSkip: () => void }) {
  return (
    <div className="flex h-screen">
      <div className="flex-1 flex flex-col justify-center" style={{ padding: '80px 64px' }}>
        <div className="max-w-md">
          <p className="text-xs font-semibold text-accent mb-2 tracking-wide uppercase">
            {i18n.t('onboarding.pinStepLabel')}
          </p>
          <h1 className="text-3xl font-extrabold text-foreground leading-tight mb-2">
            {i18n.t('onboarding.pinTitle')}
          </h1>
          <p className="text-sm text-muted-foreground leading-relaxed mb-8">{i18n.t('onboarding.pinMessage')}</p>

          <ol className="space-y-4 mb-8">
            <li className="flex items-start gap-3">
              <div className="w-7 h-7 rounded-lg bg-accent/10 flex items-center justify-center shrink-0 mt-0.5">
                <span className="text-accent text-xs font-bold">1</span>
              </div>
              <div>
                <p className="text-sm font-medium text-foreground">{i18n.t('onboarding.pinStep1Title')}</p>
                <p className="text-xs text-muted-foreground">{i18n.t('onboarding.pinStep1Sub')}</p>
              </div>
            </li>
            <li className="flex items-start gap-3">
              <div className="w-7 h-7 rounded-lg bg-accent/10 flex items-center justify-center shrink-0 mt-0.5">
                <span className="text-accent text-xs font-bold">2</span>
              </div>
              <div>
                <p className="text-sm font-medium text-foreground">{i18n.t('onboarding.pinStep2Title')}</p>
                <p className="text-xs text-muted-foreground">{i18n.t('onboarding.pinStep2Sub')}</p>
              </div>
            </li>
            <li className="flex items-start gap-3">
              <div className="w-7 h-7 rounded-lg bg-accent/10 flex items-center justify-center shrink-0 mt-0.5">
                <span className="text-accent text-xs font-bold">3</span>
              </div>
              <div>
                <p className="text-sm font-medium text-foreground">{i18n.t('onboarding.pinStep3Title')}</p>
                <p className="text-xs text-muted-foreground">{i18n.t('onboarding.pinStep3Sub')}</p>
              </div>
            </li>
          </ol>

          <div className="flex items-center gap-3">
            <Button onClick={onNext} className="px-8 h-auto py-3 rounded-xl">
              {i18n.t('common.continue')}
            </Button>
            <Button variant="ghost" onClick={onSkip} className="px-6 h-auto py-3 rounded-xl">
              {i18n.t('common.skip')}
            </Button>
          </div>

          <div className="mt-6">
            <ProgressDots current={3} />
          </div>
        </div>
      </div>
      <div className="w-1/2 bg-deep flex items-center justify-center relative overflow-hidden">
        <div className="absolute w-[400px] h-[400px] bg-[radial-gradient(circle,rgba(79,70,229,0.2),transparent_70%)] top-[10%] right-[-10%]" />
        <div className="animate-[float_4s_ease-in-out_infinite] relative z-10">
          <img
            src="/pin-screenshot.png"
            alt={i18n.t('onboarding.pinScreenshotAlt')}
            className="rounded-xl shadow-2xl max-w-[400px]"
          />
        </div>
      </div>
    </div>
  );
}

function DoneStep() {
  const handleOpen = async () => {
    const permissionsPromise = requestHostPermissions();
    await permissionsPromise;
    browser.tabs.create({ url: browser.runtime.getURL('/fullview.html') });
  };

  return (
    <div className="flex h-screen items-center justify-center">
      <div className="text-center max-w-lg">
        <div className="flex justify-center mb-8 animate-[float_3s_ease-in-out_infinite]">
          <MascotLarge size={120} />
        </div>
        <h1 className="text-4xl font-extrabold text-foreground mb-3 tracking-tight">
          {i18n.t('onboarding.doneTitle')}
        </h1>
        <p className="text-base text-muted-foreground mb-8 max-w-md mx-auto leading-relaxed">
          {i18n.t('onboarding.doneMessage')}
        </p>

        <div className="flex gap-4 justify-center mb-8">
          {[
            {
              label: i18n.t('onboarding.featureAutoCapture'),
              icon: (
                <svg
                  width="28"
                  height="28"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                >
                  <rect x="2" y="3" width="20" height="14" rx="2" />
                  <path d="M8 21h8M12 17v4" />
                </svg>
              ),
            },
            {
              label: i18n.t('onboarding.featureAIDescriptions'),
              icon: (
                <svg
                  width="28"
                  height="28"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                >
                  <path d="M12 2L14 10L22 12L14 14L12 22L10 14L2 12L10 10Z" />
                </svg>
              ),
            },
            {
              label: i18n.t('onboarding.featureSmartBlur'),
              icon: (
                <svg
                  width="28"
                  height="28"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                >
                  <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                  <circle cx="12" cy="12" r="3" />
                </svg>
              ),
            },
          ].map((f) => (
            <div key={f.label} className="bg-secondary rounded-xl p-5 flex-1 max-w-[140px] text-center">
              <div className="text-accent flex justify-center mb-2">{f.icon}</div>
              <p className="text-xs font-semibold text-foreground">{f.label}</p>
            </div>
          ))}
        </div>

        <Button onClick={handleOpen} className="gap-2 px-7 h-auto py-3 rounded-xl text-sm">
          {i18n.t('onboarding.openMimik')}
          <ArrowRight size={16} />
        </Button>
      </div>
    </div>
  );
}

export default function OnboardingApp() {
  const [step, setStep] = useState(0);

  useEffect(() => {
    localStorage.set({ onboardingCompleted: true });
  }, []);

  const next = () => setStep((s) => Math.min(s + 1, 4));
  const skip = () => setStep((s) => Math.min(s + 1, 4));

  return (
    <div className="min-h-screen bg-card text-foreground">
      <style>{`@keyframes float{0%,100%{transform:translateY(0)}50%{transform:translateY(-8px)}}@keyframes sparkle{0%,100%{opacity:.3;transform:scale(.8)}50%{opacity:1;transform:scale(1.1)}}`}</style>
      {step === 0 && <WelcomeStep onNext={next} />}
      {step === 1 && <AISetupStep onNext={next} onSkip={skip} />}
      {step === 2 && <SmartBlurStep onNext={next} onSkip={skip} />}
      {step === 3 && <PinExtensionStep onNext={next} onSkip={skip} />}
      {step === 4 && <DoneStep />}
    </div>
  );
}
