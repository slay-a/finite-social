import React from 'react';
import { Text, TextStyle, StyleProp } from 'react-native';

/**
 * Renders the constrained markup the card generator emits: **bold** spans and
 * inline math between $...$ (minimal LaTeX: _{} subscripts, ^{} superscripts,
 * Greek letters, common operators). Math becomes Unicode sub/superscripts, so
 * $s_{i+1}$ renders as sᵢ₊₁ natively, with no WebView in the paged feed.
 */

const SUB: Record<string, string> = {
  '0': '₀', '1': '₁', '2': '₂', '3': '₃', '4': '₄', '5': '₅', '6': '₆', '7': '₇', '8': '₈', '9': '₉',
  '+': '₊', '-': '₋', '=': '₌', '(': '₍', ')': '₎',
  a: 'ₐ', e: 'ₑ', h: 'ₕ', i: 'ᵢ', j: 'ⱼ', k: 'ₖ', l: 'ₗ', m: 'ₘ', n: 'ₙ',
  o: 'ₒ', p: 'ₚ', r: 'ᵣ', s: 'ₛ', t: 'ₜ', u: 'ᵤ', v: 'ᵥ', x: 'ₓ',
};

const SUP: Record<string, string> = {
  '0': '⁰', '1': '¹', '2': '²', '3': '³', '4': '⁴', '5': '⁵', '6': '⁶', '7': '⁷', '8': '⁸', '9': '⁹',
  '+': '⁺', '-': '⁻', '=': '⁼', '(': '⁽', ')': '⁾',
  a: 'ᵃ', b: 'ᵇ', c: 'ᶜ', d: 'ᵈ', e: 'ᵉ', f: 'ᶠ', g: 'ᵍ', h: 'ʰ', i: 'ⁱ', j: 'ʲ', k: 'ᵏ',
  l: 'ˡ', m: 'ᵐ', n: 'ⁿ', o: 'ᵒ', p: 'ᵖ', r: 'ʳ', s: 'ˢ', t: 'ᵗ', u: 'ᵘ', v: 'ᵛ',
  w: 'ʷ', x: 'ˣ', y: 'ʸ', z: 'ᶻ', T: 'ᵀ',
};

const COMMANDS: Record<string, string> = {
  alpha: 'α', beta: 'β', gamma: 'γ', delta: 'δ', epsilon: 'ε', zeta: 'ζ', eta: 'η',
  theta: 'θ', iota: 'ι', kappa: 'κ', lambda: 'λ', mu: 'μ', nu: 'ν', xi: 'ξ', pi: 'π',
  rho: 'ρ', sigma: 'σ', tau: 'τ', phi: 'φ', chi: 'χ', psi: 'ψ', omega: 'ω',
  Gamma: 'Γ', Delta: 'Δ', Theta: 'Θ', Lambda: 'Λ', Xi: 'Ξ', Pi: 'Π', Sigma: 'Σ',
  Phi: 'Φ', Psi: 'Ψ', Omega: 'Ω',
  infty: '∞', times: '×', cdot: '·', pm: '±', le: '≤', leq: '≤', ge: '≥', geq: '≥',
  ne: '≠', neq: '≠', approx: '≈', sim: '~', in: '∈', notin: '∉', subset: '⊂',
  rightarrow: '→', to: '→', leftarrow: '←', Rightarrow: '⇒', mapsto: '↦',
  sum: 'Σ', prod: 'Π', int: '∫', sqrt: '√', partial: '∂', nabla: '∇', ell: 'ℓ',
  log: 'log', ln: 'ln', max: 'max', min: 'min', exp: 'exp',
  // Structural commands that should disappear or become plain glyphs: without
  // these, "\text{yes}" rendered as "textyes" and "\ldots" as "ldots".
  text: '', mathrm: '', mathbf: '', mathit: '', operatorname: '',
  ldots: '…', dots: '…', cdots: '⋯', vdots: '⋮', ddots: '⋱',
  quad: ' ', qquad: '  ', mid: '|', vert: '|',
};

function mapChars(body: string, table: Record<string, string>): string {
  return [...body].map((ch) => table[ch] ?? table[ch.toLowerCase()] ?? ch).join('');
}

/** $...$ contents -> plain Unicode string. */
export function renderMath(src: string): string {
  let out = '';
  let i = 0;
  while (i < src.length) {
    const ch = src[i];
    if (ch === '\\') {
      const m = src.slice(i + 1).match(/^[a-zA-Z]+/);
      if (m) {
        out += COMMANDS[m[0]] ?? m[0];
        i += 1 + m[0].length;
        continue;
      }
      const next = src[i + 1];
      // Spacing commands (\, \; \: \!) vanish; escaped literals keep the char.
      if (next === ',' || next === ';' || next === ':' || next === '!') { i += 2; continue; }
      if (next === '{' || next === '}' || next === '$' || next === '\\' || next === '%' || next === '&') {
        out += next;
        i += 2;
        continue;
      }
      i++;
      continue;
    }
    if (ch === '_' || ch === '^') {
      const table = ch === '_' ? SUB : SUP;
      let body = '';
      if (src[i + 1] === '{') {
        const close = src.indexOf('}', i + 2);
        body = close === -1 ? src.slice(i + 2) : src.slice(i + 2, close);
        i = close === -1 ? src.length : close + 1;
      } else {
        body = src[i + 1] ?? '';
        i += 2;
      }
      // Resolve any \commands inside the script first, then map to sub/sup.
      out += mapChars(renderMath(body), table);
      continue;
    }
    if (ch === '{' || ch === '}' || ch === '$') { i++; continue; }
    out += ch;
    i++;
  }
  return out;
}

interface Segment {
  text: string;
  bold: boolean;
  math: boolean;
}

/**
 * A line that is one formula (allowing $$ display delimiters and trailing
 * punctuation) renders as display math. Returns null when it is ordinary text.
 */
export function asDisplayMath(line: string): string | null {
  const m = line.trim().match(/^\${1,2}(.+?)\${1,2}([.,;:])?$/);
  if (!m || m[1].includes('$')) return null;
  return renderMath(m[1]) + (m[2] ?? '');
}

/** Splits a line on **bold** and $math$ markers. */
export function parseInline(line: string): Segment[] {
  const segments: Segment[] = [];
  // $$ inline is display syntax misused inline; treat it as $ so delimiters
  // never leak onto the screen. Then tokenize $...$ first, **bold** second.
  const mathParts = line.replace(/\$\$/g, '$').split(/(\$[^$]+\$)/g);
  for (const part of mathParts) {
    if (part.startsWith('$') && part.endsWith('$') && part.length > 2) {
      segments.push({ text: renderMath(part.slice(1, -1)), bold: false, math: true });
    } else {
      const boldParts = part.split(/\*\*/g);
      boldParts.forEach((chunk, i) => {
        if (chunk) segments.push({ text: chunk, bold: i % 2 === 1, math: false });
      });
    }
  }
  return segments;
}

interface Props {
  text: string;
  style?: StyleProp<TextStyle>;
  boldStyle?: StyleProp<TextStyle>;
  mathStyle?: StyleProp<TextStyle>;
  numberOfLines?: number;
}

export default function RichText({ text, style, boldStyle, mathStyle, numberOfLines }: Props) {
  const segments = parseInline(text);
  return (
    <Text style={style} numberOfLines={numberOfLines}>
      {segments.map((seg, i) => (
        <Text
          key={i}
          style={[seg.bold ? boldStyle : undefined, seg.math ? (mathStyle ?? { fontStyle: 'italic' }) : undefined]}
        >
          {seg.text}
        </Text>
      ))}
    </Text>
  );
}
