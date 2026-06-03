import { ArrowLeft, Bug, Check, ChevronRight, EyeOff, Globe, Shield, Sparkles, Star } from 'lucide-react';
import { useEffect, useState } from 'react';
import { i18n } from '#imports';
import { PRESET_LABELS, type PresetKey } from '@/core/blur/regexes';
import { AI_PROVIDERS, type AIProviderKey } from '@/core/capture/ai/models';
import { AI_LANGUAGES, type AILanguageCode } from '@/core/capture/ai/prompts';
import { localStorage } from '@/lib/browser-api';
import { Button } from '@/ui/components/button';
import { Input } from '@/ui/components/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/ui/components/select';
import { Switch } from '@/ui/components/switch';

interface SettingsViewProps {
  onBack?: () => void;
  hideHeader?: boolean;
}

export default function SettingsView({ onBack, hideHeader }: SettingsViewProps) {
  const [provider, setProvider] = useState<AIProviderKey>('openai');
  const [model, setModel] = useState(AI_PROVIDERS.openai.defaultModel);
  const [apiKey, setApiKey] = useState('');
  const [saved, setSaved] = useState(false);
  const [aiLanguage, setAiLanguage] = useState<AILanguageCode>('en');
  const [blurPresets, setBlurPresets] = useState<Record<PresetKey, boolean>>({
    email: true,
    phone: true,
    ssn: false,
    creditCard: false,
    ipAddress: false,
    macAddress: false,
  });

  useEffect(() => {
    localStorage.get(['aiApiKey', 'aiProvider', 'aiModel', 'aiLanguage', 'blurPresets']).then((result) => {
      const p = (result.aiProvider as AIProviderKey) || 'openai';
      setProvider(p);
      setModel((result.aiModel as string) || AI_PROVIDERS[p].defaultModel);
      if (result.aiApiKey) setApiKey(result.aiApiKey as string);
      if (result.aiLanguage) setAiLanguage(result.aiLanguage as AILanguageCode);
      if (result.blurPresets) setBlurPresets(result.blurPresets as Record<PresetKey, boolean>);
    });
  }, []);

  const handleProviderChange = (newProvider: AIProviderKey) => {
    setProvider(newProvider);
    setModel(AI_PROVIDERS[newProvider].defaultModel);
  };

  const handleSave = async () => {
    await localStorage.set({ aiApiKey: apiKey, aiProvider: provider, aiModel: model, aiLanguage, blurPresets });
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const providerConfig = AI_PROVIDERS[provider];

  const BLUR_PRESET_I18N: Record<PresetKey, string> = {
    email: 'blurPresets.email',
    phone: 'blurPresets.phoneNumbers',
    ssn: 'blurPresets.ssn',
    creditCard: 'blurPresets.creditCard',
    ipAddress: 'blurPresets.ipAddress',
    macAddress: 'blurPresets.macAddress',
  };

  return (
    <div className="bg-card flex flex-col">
      {!hideHeader && (
        <div className="flex items-center gap-3 px-4 py-3 border-b border-border">
          {onBack && (
            <button
              onClick={onBack}
              className="w-7 h-7 rounded-lg flex items-center justify-center hover:bg-secondary transition-colors"
            >
              <ArrowLeft size={16} />
            </button>
          )}
          <h1 className="text-[15px] font-bold text-foreground">{i18n.t('settings.title')}</h1>
        </div>
      )}

      <div className="flex-1 px-3 py-4 space-y-3">
        <div className="border border-border rounded-[10px] p-3.5 space-y-3">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-secondary flex items-center justify-center">
              <Sparkles size={14} className="text-accent" />
            </div>
            <span className="text-xs font-bold text-foreground">{i18n.t('settings.aiDescriptions')}</span>
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-foreground mb-1">
              {i18n.t('settings.provider')}
            </label>
            <Select value={provider} onValueChange={(v) => handleProviderChange(v as AIProviderKey)}>
              <SelectTrigger className="w-full text-[13px]">
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
            <label className="block text-[11px] font-semibold text-foreground mb-1">{i18n.t('settings.model')}</label>
            <Select value={model} onValueChange={setModel}>
              <SelectTrigger className="w-full text-[13px]">
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
            <label className="block text-[11px] font-semibold text-foreground mb-1">{i18n.t('settings.apiKey')}</label>
            <Input type="password" value={apiKey} onChange={(e) => setApiKey(e.target.value)} placeholder="sk-..." />
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-foreground mb-1">
              <Globe size={11} className="inline mr-1 -mt-px" />
              {i18n.t('settings.aiLanguage')}
            </label>
            <Select value={aiLanguage} onValueChange={(v) => setAiLanguage(v as AILanguageCode)}>
              <SelectTrigger className="w-full text-[13px]">
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

        <div className="border border-border rounded-[10px] p-3.5 space-y-1">
          <div className="flex items-center gap-2.5 mb-2">
            <div className="w-7 h-7 rounded-lg bg-secondary flex items-center justify-center">
              <EyeOff size={14} className="text-accent" />
            </div>
            <span className="text-xs font-bold text-foreground">{i18n.t('settings.smartBlur')}</span>
          </div>

          {(Object.keys(PRESET_LABELS) as PresetKey[]).map((key, i, arr) => (
            <div
              key={key}
              className={`flex items-center justify-between py-2 ${i < arr.length - 1 ? 'border-b border-secondary' : ''}`}
            >
              <span className="text-xs font-medium text-foreground">{i18n.t(BLUR_PRESET_I18N[key])}</span>
              <Switch
                checked={blurPresets[key]}
                onCheckedChange={(checked) =>
                  setBlurPresets((prev) => {
                    const next = { ...prev, [key]: checked };
                    localStorage.set({ blurPresets: next });
                    return next;
                  })
                }
              />
            </div>
          ))}
        </div>

        <Button
          onClick={handleSave}
          disabled={saved}
          className="w-full transition-all duration-300"
          style={saved ? { backgroundColor: 'var(--color-success)', color: '#fff', opacity: 0.9 } : undefined}
        >
          {saved && <Check size={16} />}
          {saved ? i18n.t('settings.saved') : i18n.t('settings.saveSettings')}
        </Button>

        <div className="flex items-start gap-2 px-3 py-2.5 rounded-lg bg-secondary text-[10px] text-muted-foreground leading-relaxed">
          <Shield size={12} className="shrink-0 mt-0.5 text-accent" />
          <span>{i18n.t('settings.privacyNotice')}</span>
        </div>

        <a
          href="https://github.com/westpoint-io/mimik/issues"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-2.5 px-3 py-2.5 rounded-lg border border-border text-[11px] font-medium text-muted-foreground hover:text-foreground hover:border-accent transition-colors"
        >
          <Bug size={13} className="shrink-0" />
          <span>{i18n.t('settings.bugReport')}</span>
        </a>

        <div className="flex items-center gap-3.5 border border-border rounded-[10px] p-3.5">
          <svg width="44" height="44" viewBox="20 55 160 108" className="shrink-0">
            <rect x="30" y="95" width="140" height="68" rx="8" fill="#1E1B4B" />
            <path d="M30 95 L30 80 Q30 58, 100 58 Q170 58, 170 80 L170 95 Z" fill="#3730A3" />
            <rect x="30" y="93" width="140" height="3" fill="#C7D2FE" />
            <path d="M68 122 Q76 112 84 122" stroke="#C7D2FE" strokeWidth="5" fill="none" strokeLinecap="round" />
            <path d="M116 122 Q124 112 132 122" stroke="#C7D2FE" strokeWidth="5" fill="none" strokeLinecap="round" />
            <path d="M84 138 Q100 148 116 138" stroke="#C7D2FE" strokeWidth="3.5" fill="none" strokeLinecap="round" />
          </svg>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-bold text-foreground mb-0.5">{i18n.t('settings.starCtaTitle')}</p>
            <p className="text-[10px] text-muted-foreground leading-relaxed mb-2">
              {i18n.t('settings.starCtaMessage')}
            </p>
            <a
              href="https://github.com/westpoint-io/mimik"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-secondary text-[10px] font-semibold text-accent hover:bg-accent hover:text-white transition-colors"
            >
              <Star size={11} fill="#FBBF24" className="text-[#FBBF24]" />
              {i18n.t('settings.starOnGithub')}
              <ChevronRight size={11} />
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
