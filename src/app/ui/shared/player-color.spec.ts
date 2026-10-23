import { describe, expect, it } from 'vitest';
import { PLAYER_COLORS } from '../../net/protocol';
import { pieceImage } from './piece-art';
import { uiColor } from './player-color';

describe('Spielerfarben', () => {
  it('jede Lobbyfarbe hat eigene Figuren', () => {
    const files = PLAYER_COLORS.map((c) => pieceImage('settlement', c.hex));
    expect(files.every((f) => f !== null)).toBe(true);
    expect(new Set(files).size).toBe(PLAYER_COLORS.length);
  });

  it('gespeicherte Spiele in Braun und Gold behalten ihre Figuren', () => {
    expect(pieceImage('city', '#7b4a2a')).toBe('web/pieces/papiercollage-organic-v2/city-brown.png');
    expect(pieceImage('road', '#d5a824')).toBe('web/pieces/papiercollage/road-gold.png');
  });

  it('hellt in der Oberfläche nur Schwarz auf', () => {
    for (const { hex } of PLAYER_COLORS.filter((c) => c.name !== 'Schwarz')) expect(uiColor(hex)).toBe(hex);
    expect(uiColor('#7b4a2a')).toBe('#7b4a2a');
    expect(uiColor('#2e2b2f')).not.toBe('#2e2b2f');
  });
});
