import type { ReactNode } from 'react';

function phaseNumber(fase: string): string {
  const m = String(fase || '').trim().match(/^(\d{1,2})\s*-/);
  if (!m?.[1]) return '';
  return m[1].padStart(2, '0');
}

export function getPhaseIcon(fase: string): ReactNode {
  // Ícones globais por número da fase (01..). Mantém consistente no app todo.
  const n = phaseNumber(fase);
  const map: Record<string, string> = {
    '01': '🏡',
    '02': '📐',
    '03': '📑',
    '04': '👷',
    '05': '🏛️',
    '06': '🌱',
    '07': '🚰',
    '08': '🇧🇷',
    '09': '🦺',
    '10': '📊',
    '11': '🔌',
    '12': '🏗️',
    '13': '📜',
  };
  return <span aria-hidden="true">{map[n] || '📌'}</span>;
}
