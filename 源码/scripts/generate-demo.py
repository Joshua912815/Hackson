"""生成本站原创演示器乐与 SVG 封面；仅使用 Python 标准库。"""
from pathlib import Path
import math
import random
import struct
import wave

ROOT = Path(__file__).resolve().parents[1] / "public"
(ROOT / "audio").mkdir(parents=True, exist_ok=True)
(ROOT / "covers").mkdir(parents=True, exist_ok=True)
RATE, SECONDS = 16000, 48
PRESETS = [
    ("slow", 48, [48, 55, 60, 64], [72, 76, 79, 76, 74, 72, 67, 71], 7),
    ("light", 80, [53, 60, 65, 69], [77, 81, 84, 81, 79, 77, 76, 72], 11),
    ("breathe", 40, [50, 57, 62, 65], [74, 77, 81, 77, 76, 74, 69, 72], 19),
]
def hz(note):
    return 440 * 2 ** ((note - 69) / 12)
for name, bpm, chord, melody, seed in PRESETS:
    rng = random.Random(seed)
    samples = [0.0] * (RATE * SECONDS)
    beat = 60 / bpm
    def note(start, length, midi, level, pad=False):
        freq = hz(midi)
        for j in range(min(int(length * RATE), len(samples) - int(start * RATE))):
            t = j / RATE
            tail = min(1, max(0, (length - t) / .7))
            env = (1 - math.exp(-t * (2 if pad else 90))) * math.exp(-t * (.12 if pad else 1.6)) * tail
            sound = math.sin(2 * math.pi * freq * t) + .17 * math.sin(4 * math.pi * freq * t) + .05 * math.sin(6 * math.pi * freq * t)
            samples[int(start * RATE) + j] += level * env * sound
    for bar in range(math.ceil(SECONDS / (beat * 4))):
        start = bar * beat * 4
        shift = [0, -2, -5, -3][bar % 4]
        for midi in chord:
            note(start, beat * 4.5, midi + shift, .035, True)
        for step in range(4):
            at = start + step * beat + rng.uniform(0, .018)
            if at < SECONDS:
                note(at, beat * 2, melody[(bar * 4 + step) % len(melody)] + shift, .12)
    # Gentle stereo-free echo, deterministic and normalized; fade both ends.
    delay = int(.31 * RATE)
    for i in range(delay, len(samples)):
        samples[i] += .16 * samples[i - delay]
    peak = max(abs(x) for x in samples) or 1
    frames = bytearray()
    for i, value in enumerate(samples):
        fade = min(1, i / (RATE * 1.5), (len(samples) - i) / (RATE * 3))
        frames.extend(struct.pack("<h", int(value / peak * fade * 24000)))
    with wave.open(str(ROOT / "audio" / (name + ".wav")), "wb") as out:
        out.setnchannels(1); out.setsampwidth(2); out.setframerate(RATE); out.writeframes(frames)

art = {
"slow": """<rect width="600" height="600" fill="#d7ddd1"/><circle cx="435" cy="156" r="77" fill="#f4e6b9"/><path d="M0 340Q160 185 350 335T650 270V600H0" fill="#849a79"/><path d="M0 430Q150 275 330 390T600 365V600H0" fill="#456953"/><path d="M0 510Q220 320 610 470V600H0" fill="#234a3c"/><path d="M270 600Q415 505 315 425Q230 357 359 310" fill="none" stroke="#bccab1" stroke-width="17"/><text x="45" y="83" fill="#305140" font-size="15" letter-spacing="5">TAKE YOUR TIME</text><text x="42" y="150" fill="#305140" font-size="48">慢慢来</text>""",
"light": """<rect width="600" height="600" fill="#ead8bf"/><circle cx="300" cy="287" r="180" fill="#ca7950"/><circle cx="300" cy="287" r="123" fill="#dcab70"/><circle cx="300" cy="287" r="69" fill="#f7e7bc"/><path d="M0 453Q180 365 360 446T600 410V600H0" fill="#8c6e56"/><path d="M0 520Q200 430 600 500V600H0" fill="#664e40"/><text x="40" y="65" fill="#704e39" font-size="15" letter-spacing="5">KEEP A LITTLE LIGHT</text><text x="40" y="128" fill="#704e39" font-size="44">把光留住</text>""",
"breathe": """<rect width="600" height="600" fill="#d0dadd"/><circle cx="428" cy="149" r="65" fill="#eef0dc"/><path d="M0 300Q120 235 300 320T600 275V600H0" fill="#97aeb1"/><path d="M0 385Q160 300 350 390T600 345V600H0" fill="#688a91"/><path d="M0 470Q180 380 380 465T600 420V600H0" fill="#426970"/><path d="M0 555Q130 470 340 540T600 510V600H0" fill="#284d56"/><path d="M315 280h90m-170 80h110m-10 90h140" stroke="#cadbd7" opacity=".7" stroke-width="3"/><text x="40" y="65" fill="#385c63" font-size="15" letter-spacing="5">A MOMENT TO BREATHE</text><text x="40" y="128" fill="#385c63" font-size="44">先深呼吸</text>"""
}
for name, body in art.items():
    (ROOT / "covers" / (name + ".svg")).write_text('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 600"><defs><filter id="grain"><feTurbulence type="fractalNoise" baseFrequency=".65" numOctaves="3" stitchTiles="stitch"/><feColorMatrix type="saturate" values="0"/><feComponentTransfer><feFuncA type="linear" slope=".07"/></feComponentTransfer><feBlend in="SourceGraphic" mode="multiply"/></filter></defs><g filter="url(#grain)">' + body + '</g></svg>', encoding="utf-8")
(ROOT / "covers" / "mark.svg").write_text('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="32" fill="#365b47"/><circle cx="32" cy="32" r="19" fill="none" stroke="#faf7ed" stroke-width="2"/><circle cx="32" cy="32" r="6" fill="#faf7ed"/><path d="M32 4v10M32 50v10" stroke="#d8b582" stroke-width="3"/></svg>')
print("已生成 3 段 48 秒原创合成器乐和 4 个 SVG。")
