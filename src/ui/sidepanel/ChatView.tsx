import { stepCountIs, streamText, tool } from 'ai';
import { Send } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { z } from 'zod';
import {
  Conversation,
  ConversationContent,
  ConversationEmptyState,
  ConversationScrollButton,
} from '@/components/ai-elements/conversation';
import { Message, MessageContent, MessageResponse } from '@/components/ai-elements/message';
import { Tool, ToolContent, ToolHeader } from '@/components/ai-elements/tool';
import { createModel } from '@/core/capture/ai/provider';
import {
  deleteStep,
  getGuide,
  getGuides,
  softDeleteGuide,
  updateGuideTitle,
  updateStepDescription,
} from '@/core/guides/service';
import { localStorage } from '@/lib/browser-api';
import { Button } from '@/ui/components/button';
import { Input } from '@/ui/components/input';

interface ToolEvent {
  name: string;
  status: 'running' | 'done';
}

interface DisplayMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  toolEvents?: ToolEvent[];
}

interface ChatViewProps {
  onStartRecording?: () => void;
}

const SYSTEM_PROMPT = `You are a helpful assistant inside the Mimik browser extension. Mimik captures browser workflows as step-by-step guides with screenshots.

You can help users:
- Browse and inspect their captured guides and steps
- Edit guide titles and step descriptions
- Delete unwanted steps or entire guides
- Start a new capture session

When listing guides, show their title, step count, and ID. When showing steps, include their index number and description. After making any changes, confirm what you did. Be concise.`;

const TOOL_LABELS: Record<string, string> = {
  listGuides: 'List Guides',
  getGuideDetails: 'Read Guide',
  renameGuide: 'Rename Guide',
  editStep: 'Edit Step',
  removeStep: 'Remove Step',
  deleteGuide: 'Delete Guide',
  startCapture: 'Start Capture',
};

let msgCounter = 0;
const nextId = () => String(++msgCounter);

export default function ChatView({ onStartRecording }: ChatViewProps) {
  const [displayMessages, setDisplayMessages] = useState<DisplayMessage[]>([]);
  const [input, setInput] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [apiKey, setApiKey] = useState<string | null>(null);
  const [provider, setProvider] = useState('openai');
  const [model, setModel] = useState('gpt-4o-mini');

  const historyRef = useRef<{ role: string; content: unknown }[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    localStorage.get(['aiApiKey', 'aiProvider', 'aiModel']).then((s) => {
      setApiKey((s.aiApiKey as string) || null);
      setProvider((s.aiProvider as string) || 'openai');
      setModel((s.aiModel as string) || 'gpt-4o-mini');
    });
  }, []);

  const buildTools = useCallback(
    () => ({
      listGuides: tool({
        description: 'List all captured guides with title, step count, and ID',
        inputSchema: z.object({}),
        execute: async () => {
          const guides = await getGuides();
          return guides.map((g) => ({
            id: g.id,
            title: g.title,
            steps: g.stepIds.length,
            createdAt: new Date(g.createdAt).toLocaleDateString(),
          }));
        },
      }),
      getGuideDetails: tool({
        description: 'Get the full step list for a specific guide',
        inputSchema: z.object({ guideId: z.string().describe('The guide ID') }),
        execute: async ({ guideId }) => {
          const result = await getGuide(guideId);
          if (!result) return { error: 'Guide not found' };
          return {
            id: result.guide.id,
            title: result.guide.title,
            steps: result.steps.map((s) => ({
              id: s.id,
              index: s.index + 1,
              description: s.description,
              action: s.action,
              url: s.url,
            })),
          };
        },
      }),
      renameGuide: tool({
        description: 'Update the title of a guide',
        inputSchema: z.object({
          guideId: z.string().describe('The guide ID'),
          title: z.string().describe('The new title'),
        }),
        execute: async ({ guideId, title }) => {
          await updateGuideTitle(guideId, title);
          return { success: true, newTitle: title };
        },
      }),
      editStep: tool({
        description: 'Update the description of a step',
        inputSchema: z.object({
          stepId: z.string().describe('The step ID'),
          description: z.string().describe('The new description text'),
        }),
        execute: async ({ stepId, description }) => {
          await updateStepDescription(stepId, description);
          return { success: true };
        },
      }),
      removeStep: tool({
        description: 'Delete a step from a guide',
        inputSchema: z.object({
          guideId: z.string().describe('The guide ID'),
          stepId: z.string().describe('The step ID to delete'),
        }),
        execute: async ({ guideId, stepId }) => {
          await deleteStep(guideId, stepId);
          return { success: true };
        },
      }),
      deleteGuide: tool({
        description: 'Move a guide to the trash',
        inputSchema: z.object({ guideId: z.string().describe('The guide ID to delete') }),
        execute: async ({ guideId }) => {
          await softDeleteGuide(guideId);
          return { success: true };
        },
      }),
      startCapture: tool({
        description: 'Start a new recording session to capture a workflow',
        inputSchema: z.object({}),
        execute: async () => {
          onStartRecording?.();
          return { message: 'Recording started — navigate to the page you want to capture.' };
        },
      }),
    }),
    [onStartRecording],
  );

  const handleSend = useCallback(async () => {
    const text = input.trim();
    if (!text || isStreaming || !apiKey) return;

    setInput('');
    const updatedHistory = [...historyRef.current, { role: 'user' as const, content: text }];
    const userMsgId = nextId();
    const assistantMsgId = nextId();

    setDisplayMessages((prev) => [
      ...prev,
      { id: userMsgId, role: 'user', content: text },
      { id: assistantMsgId, role: 'assistant', content: '', toolEvents: [] },
    ]);
    setIsStreaming(true);

    try {
      const result = streamText({
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        model: createModel(provider, model, apiKey) as any,
        system: SYSTEM_PROMPT,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        messages: updatedHistory as any,
        tools: buildTools(),
        stopWhen: stepCountIs(6),
        abortSignal: AbortSignal.timeout(60000),
      });

      let accText = '';
      const toolEvents: ToolEvent[] = [];

      for await (const part of result.fullStream) {
        if (part.type === 'text-delta') {
          accText += part.text;
          setDisplayMessages((prev) => [
            ...prev.slice(0, -1),
            { id: assistantMsgId, role: 'assistant', content: accText, toolEvents: [...toolEvents] },
          ]);
        } else if (part.type === 'tool-call') {
          toolEvents.push({ name: part.toolName, status: 'running' });
          setDisplayMessages((prev) => [
            ...prev.slice(0, -1),
            { id: assistantMsgId, role: 'assistant', content: accText, toolEvents: [...toolEvents] },
          ]);
        } else if (part.type === 'tool-result') {
          for (let i = toolEvents.length - 1; i >= 0; i--) {
            if (toolEvents[i].name === part.toolName && toolEvents[i].status === 'running') {
              toolEvents[i] = { ...toolEvents[i], status: 'done' };
              break;
            }
          }
          setDisplayMessages((prev) => [
            ...prev.slice(0, -1),
            { id: assistantMsgId, role: 'assistant', content: accText, toolEvents: [...toolEvents] },
          ]);
        }
      }

      const { messages: responseMessages } = await result.response;
      historyRef.current = [...updatedHistory, ...(responseMessages as { role: string; content: unknown }[])];
    } catch {
      setDisplayMessages((prev) => [
        ...prev.slice(0, -1),
        { id: assistantMsgId, role: 'assistant', content: 'Something went wrong. Please try again.' },
      ]);
    } finally {
      setIsStreaming(false);
      setTimeout(() => inputRef.current?.focus(), 0);
    }
  }, [input, isStreaming, apiKey, provider, model, buildTools]);

  if (!apiKey) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center px-8 gap-2">
        <p className="text-sm font-semibold text-foreground">No API key configured</p>
        <p className="text-xs text-muted-foreground leading-relaxed">
          Add your OpenAI or Anthropic API key in Settings to use Chat.
        </p>
      </div>
    );
  }

  const lastIdx = displayMessages.length - 1;

  return (
    <div className="flex flex-col h-full">
      <Conversation className="flex-1 min-h-0">
        <ConversationContent className="px-4 py-4">
          {displayMessages.length === 0 && (
            <ConversationEmptyState
              title="What can I help with?"
              description="List guides, edit steps, rename a guide, or start a new recording."
            />
          )}

          {displayMessages.map((msg, i) => (
            <Message key={msg.id} from={msg.role}>
              <MessageContent>
                {msg.role === 'assistant' && msg.toolEvents && msg.toolEvents.length > 0 && (
                  <div className="space-y-1.5 mb-2">
                    {msg.toolEvents.map((ev) => (
                      <Tool key={`${msg.id}-${ev.name}`}>
                        <ToolHeader
                          title={TOOL_LABELS[ev.name] ?? ev.name}
                          type="dynamic-tool"
                          state={ev.status === 'running' ? 'input-available' : 'output-available'}
                          toolName={ev.name}
                        />
                        <ToolContent />
                      </Tool>
                    ))}
                  </div>
                )}

                {(msg.content || (isStreaming && i === lastIdx)) && (
                  <MessageResponse isAnimating={isStreaming && i === lastIdx}>{msg.content || ' '}</MessageResponse>
                )}
              </MessageContent>
            </Message>
          ))}
        </ConversationContent>

        <ConversationScrollButton />
      </Conversation>

      <div className="border-t border-border px-3 py-3 shrink-0">
        <div className="flex gap-2 items-center">
          <Input
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
            placeholder="Ask about your guides…"
            disabled={isStreaming}
            className="flex-1 text-[13px] rounded-xl border-border"
          />
          <Button
            onClick={handleSend}
            disabled={!input.trim() || isStreaming}
            size="icon"
            className="h-9 w-9 rounded-xl shrink-0"
          >
            <Send size={14} />
          </Button>
        </div>
      </div>
    </div>
  );
}
