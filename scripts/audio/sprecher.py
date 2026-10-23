"""Erzeugt einen Sprachclip über die ElevenLabs-API und legt ihn angeglichen nach public/audio/<sprecher>/<id>.m4a.

python3 scripts/audio/sprecher.py <friend|enemy|herald> <id> "<[anweisung] Text>"

Beispiel: python3 scripts/audio/sprecher.py herald neues-land "[excited] Neues Land in Sicht!"

Der Key steht in ~/.config/elevenlabs/key (nur für den eigenen Benutzer lesbar) und wird nie ausgegeben.
Danach den Satz in src/app/ui/shared/voice.ts eintragen, siehe docs/AUDIO.md. Braucht macOS (afconvert).
"""
import array
import json
import math
import os
import subprocess
import sys
import tempfile
import urllib.error
import urllib.request
import wave

VOICES = {'friend': 'mfbXirTOYDINV6HYQlDt', 'enemy': 'JAIrHyjUQDal47JfzrGN', 'herald': 'mqmmohuekBTiQHiRCjQM'}
MODEL = 'eleven_v4'
SETTINGS = {'stability': 0.5, 'similarity_boost': 0.75, 'style': 0, 'use_speaker_boost': True, 'speed': 1.0}
# Wie die ersten Aufnahmen: lautester 50-ms-Abschnitt bei -8,5 dBFS, Spitzen nie über -1 dBFS.
LOUDNESS, KNEE, CEILING = -8.5, -4.0, -1.0
ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))


def synthesize(speaker: str, text: str, mp3: str) -> None:
    key = open(os.path.expanduser('~/.config/elevenlabs/key')).read().strip()
    body = json.dumps({'text': text, 'model_id': MODEL, 'voice_settings': SETTINGS}).encode()
    req = urllib.request.Request(
        f'https://api.elevenlabs.io/v1/text-to-speech/{VOICES[speaker]}?output_format=mp3_44100_128',
        data=body,
        headers={'xi-api-key': key, 'Content-Type': 'application/json'},
    )
    try:
        with urllib.request.urlopen(req, timeout=60) as r:
            open(mp3, 'wb').write(r.read())
    except urllib.error.HTTPError as e:
        sys.exit(f'ElevenLabs: {e.code} {e.read()[:300]!r}')


def level(src: str, dest: str) -> None:
    """Gleicht die Lautstärke an, rundet Spitzen weich ab und schneidet Stille am Ende ab."""
    w = wave.open(src)
    sr, ch = w.getframerate(), w.getnchannels()
    pcm = array.array('h', w.readframes(w.getnframes()))
    mix = [x / 32768 for x in pcm[::ch]]
    end = len(mix)
    while end > 0 and abs(mix[end - 1]) < 10 ** (-70 / 20):
        end -= 1
    mix = mix[:end]
    win = int(sr * 0.05)
    loud = max(math.sqrt(sum(v * v for v in mix[i:i + win]) / win) for i in range(0, max(1, len(mix) - win), win)) or 1
    gain = 10 ** (LOUDNESS / 20) / loud
    knee, ceiling = 10 ** (KNEE / 20), 10 ** (CEILING / 20)

    def soft(v: float) -> float:
        v *= gain
        m = abs(v)
        return v if m <= knee else math.copysign(knee + (ceiling - knee) * math.tanh((m - knee) / (ceiling - knee)), v)

    out = wave.open(dest, 'wb')
    out.setnchannels(1)
    out.setsampwidth(2)
    out.setframerate(sr)
    out.writeframes(array.array('h', (int(soft(v) * 32767) for v in mix)).tobytes())
    out.close()


def main() -> None:
    if len(sys.argv) != 4 or sys.argv[1] not in VOICES:
        sys.exit(__doc__)
    speaker, cid, text = sys.argv[1:]
    dest = os.path.join(ROOT, 'public', 'audio', speaker, f'{cid}.m4a')
    os.makedirs(os.path.dirname(dest), exist_ok=True)
    with tempfile.TemporaryDirectory() as tmp:
        mp3, wav, leveled = (os.path.join(tmp, n) for n in ('clip.mp3', 'clip.wav', 'level.wav'))
        synthesize(speaker, text, mp3)
        subprocess.run(['afconvert', '-f', 'WAVE', '-d', 'LEI16', mp3, wav], check=True)
        level(wav, leveled)
        subprocess.run(['afconvert', '-f', 'm4af', '-d', 'aac', '-b', '128000', leveled, dest], check=True)
        # Für die Rückschrift (scripts/audio/transcribe.swift kann kein AAC): MP3 neben der Ausgabe ablegen.
        keep = os.environ.get('SPRECHER_MP3_DIR')
        if keep:
            os.makedirs(keep, exist_ok=True)
            subprocess.run(['cp', mp3, os.path.join(keep, f'{speaker}-{cid}.mp3')], check=True)
    print(os.path.relpath(dest, ROOT))


if __name__ == '__main__':
    main()
