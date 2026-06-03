import { ArrowLeft, MessageSquare, Settings2 } from 'lucide-react';
import { useState } from 'react';
import SettingsView from '@/ui/shared/SettingsView';
import ChatView from './ChatView';

interface SettingsChatPageProps {
  onBack: () => void;
  onStartRecording?: () => void;
}

type Tab = 'chat' | 'settings';

export default function SettingsChatPage({ onBack, onStartRecording }: SettingsChatPageProps) {
  const [tab, setTab] = useState<Tab>('chat');

  return (
    <div className="flex flex-col h-screen bg-card">
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-3 border-b border-border shrink-0">
        <button
          onClick={onBack}
          className="w-7 h-7 rounded-lg flex items-center justify-center hover:bg-secondary transition-colors"
        >
          <ArrowLeft size={16} />
        </button>

        <div className="flex items-center gap-1 ml-1">
          <TabButton active={tab === 'chat'} onClick={() => setTab('chat')}>
            <MessageSquare size={12} />
            Chat
          </TabButton>
          <TabButton active={tab === 'settings'} onClick={() => setTab('settings')}>
            <Settings2 size={12} />
            Settings
          </TabButton>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 min-h-0 overflow-hidden">
        {tab === 'chat' ? (
          <ChatView onStartRecording={onStartRecording} />
        ) : (
          <div className="h-full overflow-y-auto">
            <SettingsView hideHeader />
          </div>
        )}
      </div>
    </div>
  );
}

function TabButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-semibold transition-colors ${
        active ? 'bg-accent text-white' : 'text-muted-foreground hover:text-foreground hover:bg-secondary'
      }`}
    >
      {children}
    </button>
  );
}
