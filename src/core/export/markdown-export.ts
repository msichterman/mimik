import { i18n } from '#imports';
import { blobToBase64, extractDomain, formatDate } from '@/core/export/utils';
import type { Guide, Screenshot, Step } from '@/core/guides/types';

export async function exportGuideAsMarkdown(
  guide: Guide,
  steps: Step[],
  screenshots: Map<string, Screenshot>,
): Promise<string> {
  const domain = extractDomain(steps);
  const meta = [
    i18n.t('export.stepsCount', [String(steps.length)]),
    i18n.t('export.createdLabel', [formatDate(guide.createdAt)]),
    ...(domain ? [i18n.t('export.sourceLabel', [domain])] : []),
  ].join(' · ');

  const imageData = await Promise.all(
    steps.map(async (step) => {
      const screenshot = screenshots.get(step.id);
      if (!screenshot) return null;
      const b64 = await blobToBase64(screenshot.blob);
      return { stepId: step.id, b64, mimeType: screenshot.mimeType };
    }),
  );
  const imageMap = new Map(imageData.filter(Boolean).map((img) => [img!.stepId, img!]));

  const lines: string[] = [`# ${guide.title}`, '', `*${meta}*`, '', '---', ''];

  for (const step of steps) {
    const num = String(step.index + 1).padStart(2, '0');
    lines.push(`## ${i18n.t('export.stepLabel', [num])}: ${step.description}`, '');

    const img = imageMap.get(step.id);
    if (img) {
      lines.push(`![${i18n.t('export.stepLabel', [num])}](data:${img.mimeType};base64,${img.b64})`, '');
    }
  }

  return lines.join('\n');
}
