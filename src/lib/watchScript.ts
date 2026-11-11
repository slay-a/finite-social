// Scene plans for Watch mode: every card becomes an ordered list of elements
// (title, body blocks, visual steps, figure, quiz parts) with reveal times
// spread across the narration, proportional to how much of the spoken text
// each element accounts for. Visual steps are not narrated, so they carry a
// reduced weight and land in the tail of the scene by construction.
import { SectionCardData } from '../types';
import { Block, parseBody } from '../components/SectionCard';

export interface SceneElement {
  key: string;
  weight: number;
}

const VISUAL_WEIGHT = 0.35; // unspoken elements reveal early-but-ordered, never late
const REVEAL_WINDOW = 0.92; // last reveal lands slightly before the voice ends

export function sceneBlocks(card: SectionCardData): Block[] {
  return card.kind === 'content' || !card.kind ? parseBody(card.body) : [];
}

export function visualStepTexts(card: SectionCardData): string[] {
  const v = card.visual;
  if (!v || card.kind === 'quiz' || card.kind === 'figure') return [];
  if ((v.type === 'flow' || v.type === 'cycle') && v.steps?.length) return v.steps;
  if (v.type === 'compare' && v.left && v.right) {
    return [v.left.label + v.left.points.join(' '), v.right.label + v.right.points.join(' ')];
  }
  if (v.items?.length) return v.items.map((it) => `${it.label ?? ''} ${it.text ?? it.value ?? ''}`);
  return [];
}

export function buildScenePlan(card: SectionCardData): SceneElement[] {
  const elements: SceneElement[] = [{ key: 'title', weight: Math.max(card.title.length, 20) }];

  if (card.kind === 'quiz' && card.quiz) {
    elements.push({ key: 'question', weight: Math.max(card.quiz.question.length, 30) });
    card.quiz.options.forEach((opt, i) => {
      elements.push({ key: `option:${i}`, weight: Math.max(opt.length, 15) });
    });
    return elements;
  }

  if (card.kind === 'figure') {
    elements.push({ key: 'figure', weight: 60 });
    return elements;
  }

  sceneBlocks(card).forEach((block, i) => {
    elements.push({ key: `block:${i}`, weight: Math.max(block.text.length, 20) });
  });
  visualStepTexts(card).forEach((text, i) => {
    elements.push({ key: `vstep:${i}`, weight: Math.max(text.length, 20) * VISUAL_WEIGHT });
  });
  return elements;
}

/** Map of element key -> reveal time in ms, spread across the narration. */
export function scheduleFor(plan: SceneElement[], durationMs: number): Record<string, number> {
  const total = plan.reduce((sum, el) => sum + el.weight, 0) || 1;
  const schedule: Record<string, number> = {};
  let cumulative = 0;
  for (const el of plan) {
    schedule[el.key] = (cumulative / total) * durationMs * REVEAL_WINDOW;
    cumulative += el.weight;
  }
  return schedule;
}
