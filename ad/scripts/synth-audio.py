#!/usr/bin/env python3
"""
Original-synth music + SFX bed for the Converge ad.

Vibe: drum-driven beatbox / mouth-percussion groove. 112 BPM in A minor.
Heavy layered percussion is the song — "boots and cats" vocal-style hits
(kick-formant ~350 Hz, snare-formant ~1200 Hz), tongue-click hats, and a
simple sub-bass pulse that serves the rhythm instead of carrying melody.
Sword-swipe katana SFX punctuate scene cuts. Brief drum-only drop at
22.8–25.0 s, then a riser → impact for the lockup.

Output: ad/public/audio/track.wav (stereo, 44.1kHz, 50s)
Zero copyright risk: everything below is synthesized from NumPy primitives.
"""

from __future__ import annotations

import math
import wave
from pathlib import Path
import numpy as np
import librosa

SR = 44100
BPM = 110               # matches the NCS song "Bad Pitch For You"
BAR_S = 60.0 / BPM * 4   # ≈ 2.182 s
BEAT_S = 60.0 / BPM      # ≈ 0.5455 s

# A sign-to-text accessibility scene was inserted at 38.0s, pushing the
# convergence (qa6) + lockup later by EXACTLY 13 beats so the katana wipe and
# lockup impact stay locked to the song's beat grid. Mirrors src/theme.ts.
POST_SHIFT = 13 * BEAT_S  # ≈ 7.0909 s
DURATION_S = 57.1
N = int(SR * DURATION_S)

KEY_A = 220.0  # A3

# Real music bed: the licensed NCS track. We window a 50s slice whose drop
# (≈47.2s into the song) lands on the video's drop at 6.0s, then layer our
# storyboard SFX (booms / katana / clicks / impacts) on the song's beats.
SONG_PATH = Path.home() / "Downloads" / "ruindkid - Bad Pitch For You [NCS Release].mp3"
SONG_OFFSET_S = 41.206   # window start; SONG_OFFSET_S + 6.0 = song drop downbeat

# Real katana-slash sample, placed so its transient lands as the Converge logo
# punches in at the lockup (~52.49s after the +13-beat shift).
SLASH_PATH = Path.home() / "Downloads" / "54427377-sword-slash-476148.mp3"
LOGO_PUNCH_S = 45.40 + POST_SHIFT

ROOT = Path(__file__).resolve().parent.parent
OUT_PATH = ROOT / "public" / "audio" / "track.wav"


# ── helpers ──────────────────────────────────────────────────────────────────
def t_array(samples: int) -> np.ndarray:
    return np.arange(samples) / SR


def adsr(samples: int, a: float, d: float, s_level: float, r: float, sus: float = 0.5) -> np.ndarray:
    env = np.zeros(samples)
    na = int(a * SR)
    nd = int(d * SR)
    nr = int(r * SR)
    total = na + nd + nr
    if total > samples:
        scale = samples / max(total, 1)
        na = int(na * scale)
        nd = int(nd * scale)
        nr = int(nr * scale)
    ns = samples - na - nd - nr
    idx = 0
    if na > 0:
        env[idx:idx + na] = np.linspace(0, 1, na)
        idx += na
    if nd > 0:
        env[idx:idx + nd] = np.linspace(1, sus, nd)
        idx += nd
    if ns > 0:
        env[idx:idx + ns] = sus
        idx += ns
    if nr > 0:
        end = min(idx + nr, samples)
        env[idx:end] = np.linspace(sus, 0, end - idx)
    return env[:samples]


def freq_from(root_hz: float, semis: int) -> float:
    return root_hz * (2 ** (semis / 12))


def one_pole_lp(signal: np.ndarray, cutoff_hz: float) -> np.ndarray:
    alpha = 1 - math.exp(-2 * math.pi * cutoff_hz / SR)
    out = np.zeros_like(signal)
    acc = 0.0
    for i, x in enumerate(signal):
        acc += alpha * (x - acc)
        out[i] = acc
    return out


def soft_limit(signal: np.ndarray, drive: float = 1.0) -> np.ndarray:
    return np.tanh(signal * drive) / np.tanh(drive)


def place(buffer: np.ndarray, seconds: float, sound: np.ndarray, gain: float = 1.0) -> None:
    start = int(seconds * SR)
    end = min(start + len(sound), len(buffer))
    if start >= len(buffer) or end <= start:
        return
    buffer[start:end] += sound[: end - start] * gain


# ── instruments ──────────────────────────────────────────────────────────────
def kick(length: float = 0.42) -> np.ndarray:
    """Punchy modern pop kick — fat 808-style body with click + long sub-tail."""
    n = int(length * SR)
    t = t_array(n)
    # Pitch envelope drops further for more weight (60 → 42 Hz)
    pitch = 150 * np.exp(-36 * t) + 44
    body = np.sin(2 * np.pi * np.cumsum(pitch) / SR)
    env = np.exp(-5.5 * t)  # longer body tail
    # Extra sub layer for chest impact
    sub = np.sin(2 * np.pi * (50 + 80 * np.exp(-20 * t)) * t) * np.exp(-4 * t) * 0.5
    click = (np.random.RandomState(7).randn(n) * np.exp(-220 * t)) * 0.42
    return (body * env + sub + click) * 1.05


def eight_oh_eight(freq: float, length: float = 0.5) -> np.ndarray:
    """Pure 808 sub — sine with slight pitch slide + soft saturation."""
    n = int(length * SR)
    t = t_array(n)
    pitch = freq * (1 + 0.4 * np.exp(-30 * t))
    sig = np.sin(2 * np.pi * np.cumsum(pitch) / SR)
    env = np.exp(-3.5 * t)
    return np.tanh(sig * 1.4) * env * 0.5


def saw_lead(freq: float, length: float = 0.4, velocity: float = 1.0) -> np.ndarray:
    """Fat detuned saw lead — kept for rhythmic stabs only."""
    n = int(length * SR)
    t = t_array(n)
    saw1 = 2 * ((freq * t) % 1) - 1
    saw2 = 2 * ((freq * 1.007 * t) % 1) - 1
    saw3 = 2 * ((freq * 0.993 * t) % 1) - 1
    sig = (saw1 + saw2 + saw3) / 3
    sig = one_pole_lp(sig, 3200)
    env = adsr(n, 0.004, 0.06, 0.45, 0.20)
    return sig * env * velocity * 0.18


def tom(freq: float = 90.0, length: float = 0.22) -> np.ndarray:
    """Floor tom for fills — pitch drop + body."""
    n = int(length * SR)
    t = t_array(n)
    pitch = freq * (1 + 0.5 * np.exp(-25 * t))
    body = np.sin(2 * np.pi * np.cumsum(pitch) / SR)
    env = np.exp(-12 * t)
    click = (np.random.RandomState(41).randn(n) * np.exp(-220 * t)) * 0.18
    return (body * env + click) * 0.6


def reverse_swell(length: float = 1.0) -> np.ndarray:
    """Reverse-cymbal-ish noise swell — rises into a cut/transition."""
    n = int(length * SR)
    t = t_array(n)
    noise = np.random.RandomState(53).randn(n)
    hp = noise - one_pole_lp(noise, 5500)
    # Envelope ramps up to a hard cut at the end
    env = (np.linspace(0, 1, n)) ** 2.2
    return hp * env * 0.32


def snare(length: float = 0.45) -> np.ndarray:
    n = int(length * SR)
    t = t_array(n)
    noise = np.random.RandomState(13).randn(n)
    env_n = np.exp(-18 * t)
    body = np.sin(2 * np.pi * 220 * t) * np.exp(-22 * t) * 0.5
    # Longer, layered reverb tail — multiple delayed copies with high-pass
    tail = np.zeros(n)
    for d_s, gain, decay in [(0.012, 0.55, 13), (0.034, 0.32, 9), (0.06, 0.18, 6)]:
        d = int(d_s * SR)
        if n > d:
            hp = noise[: n - d] - one_pole_lp(noise[: n - d], 1600)
            tail[d:] += hp * np.exp(-decay * t[: n - d]) * gain
    return (noise * env_n + body + tail) * 0.7


def hat_closed(length: float = 0.06) -> np.ndarray:
    n = int(length * SR)
    t = t_array(n)
    noise = np.random.RandomState(11).randn(n)
    hp = noise - one_pole_lp(noise, 6500)
    env = np.exp(-45 * t)
    return hp * env * 0.18


def hat_open(length: float = 0.22) -> np.ndarray:
    n = int(length * SR)
    t = t_array(n)
    noise = np.random.RandomState(19).randn(n)
    hp = noise - one_pole_lp(noise, 5500)
    env = np.exp(-12 * t)
    return hp * env * 0.16


def clap(length: float = 0.18) -> np.ndarray:
    """Layered handclap for the off-snare hits."""
    n = int(length * SR)
    t = t_array(n)
    noise = np.random.RandomState(23).randn(n)
    hp = noise - one_pole_lp(noise, 1800)
    delays = [0, int(0.008 * SR), int(0.018 * SR)]
    out = np.zeros(n)
    for d in delays:
        if d < n:
            out[d:] += hp[: n - d] * np.exp(-26 * t[: n - d]) * 0.55
    return out * 0.42


def plucky_bass(freq: float, length: float = 0.5) -> np.ndarray:
    n = int(length * SR)
    t = t_array(n)
    saw = 2 * ((freq * t) % 1) - 1
    sub = np.sin(2 * np.pi * (freq / 2) * t) * 0.7
    env = adsr(n, 0.003, 0.08, 0.45, 0.18)
    sig = saw * 0.5 + sub * 0.6
    sig = one_pole_lp(sig, 520)
    return sig * env * 0.45


def bell_pluck(freq: float, length: float = 0.5, velocity: float = 1.0) -> np.ndarray:
    """Bright bell-pluck lead — kept for rare, very quiet accent stabs only."""
    n = int(length * SR)
    t = t_array(n)
    s = (
        np.sin(2 * np.pi * freq * t) * 1.0
        + np.sin(2 * np.pi * freq * 2 * t) * 0.45
        + np.sin(2 * np.pi * freq * 3.5 * t) * 0.18
        + np.sin(2 * np.pi * freq * 5.7 * t) * 0.08
    )
    env = np.exp(-7 * t)
    attack = np.exp(-180 * t) * 0.3
    return (s * env + attack) * velocity * 0.22


def vox_pad(freqs: list[float], length: float, vowel: str = "ahh") -> np.ndarray:
    """Synthesized 'ahh' vox pad — sawtooth filtered by formant-like bandpasses."""
    n = int(length * SR)
    t = t_array(n)
    s = np.zeros(n)
    for f in freqs:
        saw = 2 * ((f * t) % 1) - 1
        saw2 = 2 * ((f * 1.007 * t) % 1) - 1
        s += (saw + saw2) * 0.5
    s /= max(1, len(freqs))
    lp1 = one_pole_lp(s, 1500)
    lp2 = one_pole_lp(s, 700)
    voiced = lp1 - lp2 * 0.6
    env_in = np.minimum(1.0, np.linspace(0, 1, n) * 4)
    env_out = np.minimum(1.0, np.linspace(1, 0, n) * 4)
    env = np.minimum(env_in, env_out)
    vib = 1 + 0.005 * np.sin(2 * np.pi * 4.5 * t)
    return voiced * env * vib * 0.18


def chord_pad(freqs: list[float], length: float) -> np.ndarray:
    n = int(length * SR)
    t = t_array(n)
    s = np.zeros(n)
    for f in freqs:
        s += np.sin(2 * np.pi * f * t) * 0.45
        s += np.sin(2 * np.pi * f * 1.005 * t) * 0.3
    s /= max(1, len(freqs))
    env_in = np.minimum(1.0, np.linspace(0, 1, n) * 5)
    env_out = np.minimum(1.0, np.linspace(1, 0, n) * 5)
    env = np.minimum(env_in, env_out)
    return one_pole_lp(s, 1100) * env * 0.18


def sub_bass(freq: float, length: float = 1.5) -> np.ndarray:
    n = int(length * SR)
    t = t_array(n)
    sig = np.sin(2 * np.pi * freq * t)
    env = adsr(n, 0.005, 0.3, 0.6, 0.25)
    return sig * env * 0.35


def riser(length: float = 1.2) -> np.ndarray:
    """Multi-layered riser: noise sweep + tonal sweep + tremolo modulation."""
    n = int(length * SR)
    t = t_array(n)
    noise = np.random.RandomState(29).randn(n)
    cutoffs = np.linspace(400, 8000, n)
    out = np.zeros(n)
    acc = 0.0
    for i in range(n):
        alpha = 1 - math.exp(-2 * math.pi * cutoffs[i] / SR)
        acc += alpha * (noise[i] - acc)
        out[i] = noise[i] - acc  # HP-ish
    pitch1 = 220 + 1200 * (t / length) ** 2
    pitch2 = 110 + 600 * (t / length) ** 2
    tonal = (
        np.sin(2 * np.pi * np.cumsum(pitch1) / SR) * 0.3
        + np.sin(2 * np.pi * np.cumsum(pitch2) / SR) * 0.22
    )
    tremolo_rate = 4 + 22 * (t / length) ** 2
    tremolo = 0.7 + 0.3 * np.sin(2 * np.pi * np.cumsum(tremolo_rate) / SR)
    env = (np.linspace(0, 1, n)) ** 1.6
    return (out * 0.7 + tonal) * env * tremolo * 0.75


def impact(length: float = 1.1) -> np.ndarray:
    """Big cinematic boom — sub-thud + noise crash + tonal body."""
    n = int(length * SR)
    t = t_array(n)
    sub = np.sin(2 * np.pi * (44 + 260 * np.exp(-12 * t)) * t)
    body = sub * np.exp(-3.0 * t)
    noise = np.random.RandomState(67).randn(n)
    crash = (noise - one_pole_lp(noise, 3500)) * np.exp(-4.5 * t) * 0.35
    hum = np.sin(2 * np.pi * 55 * t) * np.exp(-1.6 * t) * 0.25
    return (body * 0.95 + crash + hum) * 0.85


def chime(freq: float = 1320, length: float = 0.55) -> np.ndarray:
    n = int(length * SR)
    t = t_array(n)
    partials = [(1, 1.0), (2, 0.5), (3, 0.25), (5.4, 0.15)]
    s = np.zeros(n)
    for mult, amp in partials:
        s += np.sin(2 * np.pi * freq * mult * t) * amp
    env = np.exp(-3.5 * t)
    return s * env * 0.18


def whoosh(length: float = 0.45) -> np.ndarray:
    n = int(length * SR)
    noise = np.random.RandomState(29).randn(n)
    out = one_pole_lp(noise, 2400)
    env_in = np.minimum(1.0, np.linspace(0, 1, n) * 4)
    env_out = np.minimum(1.0, np.linspace(1, 0, n) * 4)
    env = np.minimum(env_in, env_out)
    return out * env * 0.32


def soft_tick(length: float = 0.04) -> np.ndarray:
    n = int(length * SR)
    noise = np.random.RandomState(31).randn(n)
    t = t_array(n)
    return noise * np.exp(-100 * t) * 0.28


def paper_flip(length: float = 0.3) -> np.ndarray:
    n = int(length * SR)
    t = t_array(n)
    noise = np.random.RandomState(37).randn(n)
    out = one_pole_lp(noise, 5000) - one_pole_lp(noise, 800)
    env = np.exp(-9 * t)
    swoosh = np.sin(2 * np.pi * (300 + 700 * np.exp(-4 * t)) * t) * 0.18
    return (out * 0.7 + swoosh) * env * 0.42


def success_arpeggio() -> np.ndarray:
    """Three bright bell notes ascending — A C E (Am chord) — quiz beat resolve."""
    semis = [0, 3, 7]
    parts = []
    for i, semi in enumerate(semis):
        seg = bell_pluck(freq_from(KEY_A * 2, semi), 0.4, velocity=0.95)
        gap = int(0.08 * SR)
        if i > 0:
            parts.append(np.zeros(gap))
        parts.append(seg)
    return np.concatenate(parts)


def sidechain_envelope(times_seconds: list[float], n_samples: int, attack: float = 0.005, release: float = 0.18) -> np.ndarray:
    """Builds a 1.0-ducked-to-0.32 envelope that dips on each kick time."""
    env = np.ones(n_samples)
    DEEP = 0.32
    nr = int(release * SR)
    na = int(attack * SR)
    for t_hit in times_seconds:
        i0 = int(t_hit * SR)
        if i0 >= n_samples:
            break
        end = min(i0 + nr, n_samples)
        ramp = np.linspace(DEEP, 1.0, end - i0)
        env[i0:end] = np.minimum(env[i0:end], ramp)
        i_pre = max(0, i0 - na)
        if i_pre < i0:
            pre = np.linspace(1.0, DEEP, i0 - i_pre)
            env[i_pre:i0] = np.minimum(env[i_pre:i0], pre)
    return env


# ── beatbox / vocal-percussion helpers ──────────────────────────────────────
def vocal_kick(length: float = 0.18) -> np.ndarray:
    """Mouth-percussion 'B' / 'boots' kick — sub-thumping sine + HP transient +
    midband resonance at ~350 Hz formant peak. Sounds like a vocal 'BOO' hit."""
    n = int(length * SR)
    t = t_array(n)
    # Sub thump — slight pitch drop like a real kick but lighter
    pitch = 90 * np.exp(-40 * t) + 55
    sub = np.sin(2 * np.pi * np.cumsum(pitch) / SR) * np.exp(-9 * t)
    # ~350 Hz formant resonance — short ringing tone shaped by a fast envelope
    formant = np.sin(2 * np.pi * 350 * t) * np.exp(-22 * t) * 0.55
    # Light HP-noise lip transient at the front
    rng = np.random.RandomState(71)
    noise = rng.randn(n)
    hp = noise - one_pole_lp(noise, 1800)
    transient = hp * np.exp(-90 * t) * 0.35
    out = (sub * 0.9 + formant + transient) * 0.85
    return out


def vocal_snare(length: float = 0.15) -> np.ndarray:
    """Mouth-percussion 'CHK' / 'cat' snare — noise burst + ~1200 Hz sine ping."""
    n = int(length * SR)
    t = t_array(n)
    rng = np.random.RandomState(83)
    noise = rng.randn(n)
    # Bandpass-ish: HP for sizzle, LP cap to keep it from being too hissy
    hp = noise - one_pole_lp(noise, 2200)
    body_noise = one_pole_lp(hp, 5500) * np.exp(-30 * t) * 0.9
    # ~1200 Hz formant ping for the "ch/k" tone
    ping = np.sin(2 * np.pi * 1200 * t) * np.exp(-45 * t) * 0.4
    # Tiny 'k'-attack click
    click = rng.randn(n) * np.exp(-220 * t) * 0.18
    return (body_noise + ping + click) * 0.75


def mouth_hat(length: float = 0.04) -> np.ndarray:
    """Tongue-click 'tk' hat — very short 6500 Hz HP-noise burst."""
    n = int(length * SR)
    t = t_array(n)
    rng = np.random.RandomState(97)
    noise = rng.randn(n)
    hp = noise - one_pole_lp(noise, 6500)
    env = np.exp(-130 * t)
    return hp * env * 0.32


def sword_swipe(length: float = 0.25) -> np.ndarray:
    """Katana swipe SFX — fast metallic HP-noise sweep + ringing ping at the end."""
    n = int(length * SR)
    t = t_array(n)
    rng = np.random.RandomState(103)
    noise = rng.randn(n)
    # Time-varying HP — cutoff sweeps high → mid → high for a 'shhwiff'
    cutoffs = 2000 + 8000 * np.exp(-6 * t) + 4000 * (t / length)
    out = np.zeros(n)
    acc = 0.0
    for i in range(n):
        alpha = 1 - math.exp(-2 * math.pi * cutoffs[i] / SR)
        acc += alpha * (noise[i] - acc)
        out[i] = noise[i] - acc  # HP component
    # Bell-shaped amplitude envelope — quick swell + fast fall
    swipe_env = np.exp(-((t - length * 0.45) ** 2) / (2 * (length * 0.12) ** 2))
    swipe = out * swipe_env * 0.55
    # Metallic ping at ~75% in — short inharmonic chime
    ping_start = int(length * 0.72 * SR)
    ping_n = n - ping_start
    if ping_n > 0:
        tp = t_array(ping_n)
        ping = (
            np.sin(2 * np.pi * 2800 * tp) * 1.0
            + np.sin(2 * np.pi * 4200 * tp) * 0.55
            + np.sin(2 * np.pi * 6100 * tp) * 0.3
        ) * np.exp(-22 * tp) * 0.22
        swipe[ping_start:] += ping
    return swipe


# ── click + boom SFX (UI clicks and cold-open word "booms") ─────────────────
def ui_click(length: float = 0.05) -> np.ndarray:
    """Crisp UI click — short HP-noise tick + a tiny high ping. Used at every
    cursor click moment (NOT the katana, which only fires on 2 cuts)."""
    n = int(length * SR)
    t = t_array(n)
    rng = np.random.RandomState(131)
    noise = rng.randn(n)
    hp = noise - one_pole_lp(noise, 4200)
    env = np.exp(-120 * t)
    ping = np.sin(2 * np.pi * 2600 * t) * np.exp(-90 * t) * 0.3
    return (hp * env * 0.55 + ping) * 0.7


def word_boom(length: float = 0.5) -> np.ndarray:
    """Punchy boom for each cold-open punchline word ('Too.' 'many.' 'steps.')
    — fat sub thump with a transient so words feel like they slam on."""
    n = int(length * SR)
    t = t_array(n)
    pitch = 185 * np.exp(-30 * t) + 48
    body = np.sin(2 * np.pi * np.cumsum(pitch) / SR) * np.exp(-6 * t)
    sub = np.sin(2 * np.pi * 52 * t) * np.exp(-4 * t) * 0.55
    rng = np.random.RandomState(151)
    click = (rng.randn(n) * np.exp(-200 * t)) * 0.4
    return (body * 0.95 + sub + click) * 1.0


# ── compose ──────────────────────────────────────────────────────────────────
def main() -> None:
    OUT_PATH.parent.mkdir(parents=True, exist_ok=True)

    # Master timeline (mirrors src/theme.ts SCENE_TIMES). Big moments are
    # snapped to the song's 110-BPM beat grid (see the beat analysis).
    DROP = 6.0                      # the song drop lands here (first feature slams in)
    LOCKUP = 44.185 + POST_SHIFT    # ≈51.276 — song beat — logo lockup impact

    # Cold-open punchline word frames (30fps) — see src/scenes/ColdOpen.tsx.
    PUNCH_WORD_S = [98 / 30, 115 / 30, 131 / 30]    # 3.27 · 3.83 · 4.37 (beats)

    # Two katana swipes ONLY — qa1 reveal (8.17s) + qa6 reveal (shifted +13 beats).
    SWORD_S = [8.171 - 0.18, 40.366 + POST_SHIFT - 0.18]

    # Sign-to-text scene (38.0s): soft chimes as each sign locks into the
    # transcript — "yes" at local f64 (40.13s), "no" at local f138 (42.60s).
    SIGN_LOCK_S = [38.0 + 64 / 30, 38.0 + 138 / 30]

    # Cursor-click moments (answer-phase clicks; one per feature beat).
    CLICK_S = [9.03, 14.90, 20.90, 27.17, 33.67]

    # ── Real music bed — window the NCS song to 50s ────────────────────────
    if not SONG_PATH.exists():
        raise FileNotFoundError(
            f"Music bed not found: {SONG_PATH}\n"
            "Update SONG_PATH in scripts/synth-audio.py to the song's location."
        )
    song, _ = librosa.load(str(SONG_PATH), sr=SR, mono=False)
    song = np.atleast_2d(song)
    if song.shape[0] == 1:
        song = np.repeat(song, 2, axis=0)
    i0 = int(SONG_OFFSET_S * SR)
    seg = song[:2, i0:i0 + N].astype(np.float64)
    if seg.shape[1] < N:
        seg = np.pad(seg, ((0, 0), (0, N - seg.shape[1])))
    song_L, song_R = seg[0].copy(), seg[1].copy()
    # Short fades so the window edges don't click; long tail fade-out.
    nf = int(0.05 * SR)
    tail = int(1.6 * SR)
    for ch in (song_L, song_R):
        ch[:nf] *= np.linspace(0, 1, nf)
        ch[-tail:] *= np.linspace(1, 0, tail) ** 1.3

    # ── SFX storyboard hits go on a mono bus, layered over the song's beats ─
    bus = np.zeros(N)

    # ── SFX (storyboard hits) ──────────────────────────────────────────────
    # Cold-open punchline word booms — each word slams on.
    for i, tw in enumerate(PUNCH_WORD_S):
        place(bus, tw, word_boom(0.5), gain=0.9 + 0.04 * i)

    # The DROP — big impact + low end as the first feature lands.
    place(bus, DROP, impact(1.1), gain=0.95)
    place(bus, DROP, eight_oh_eight(48, 1.0), gain=0.7)
    place(bus, DROP, kick(), gain=1.05)

    # Two FULL katana swipes (qa1 + qa6 reveals only).
    for ts in SWORD_S:
        place(bus, ts - 0.18, sword_swipe(0.3), gain=1.05)

    # Lighter swipe as each scene's text slashes in (fade scenes). Text enters
    # at the scene boundary minus the 4-frame crossfade. 37.87 = sign-to-text
    # scene entry; 44.96 (= 37.87 + shift) = qa6 question entry.
    for ts in [11.87, 17.87, 23.87, 29.87, 37.87, 37.87 + POST_SHIFT]:
        place(bus, ts, sword_swipe(0.22), gain=0.5)

    # Cursor clicks at each scene's click moment.
    for ts in CLICK_S:
        place(bus, ts, ui_click(0.06), gain=0.85)

    # Texture detail: capture typing burst right after the qa1 click.
    rng_keys = np.random.RandomState(43)
    t_typing = 9.3
    while t_typing < 10.4:
        place(bus, t_typing, soft_tick(), gain=0.45)
        t_typing += 0.07 + rng_keys.rand() * 0.04
    # Flashcard paper flip just after the qa3 flip.
    place(bus, 21.4, paper_flip(), gain=0.6)
    # Quiz correct-answer chime right after the qa4 pick (~27.2s).
    place(bus, 27.3, success_arpeggio(), gain=0.5)
    # Sign-to-text — a bright two-note "recognised" chime as each word locks
    # into the live transcript ("yes", then "no"), plus a soft confirm tick.
    for ts in SIGN_LOCK_S:
        place(bus, ts, chime(1568, 0.4), gain=0.34)
        place(bus, ts + 0.11, chime(2093, 0.5), gain=0.30)
        place(bus, ts, ui_click(0.06), gain=0.5)
    # Canvas auto-generation — soft sparkle as notes + quizzes appear.
    for i, ts in enumerate([34.2, 34.9, 35.6]):
        place(bus, ts, chime(1320 + i * 220, 0.45), gain=0.32)

    # ── Riser into the lockup + snare roll ─────────────────────────────────
    place(bus, LOCKUP - 2.0, riser(2.0), gain=0.95)
    place(bus, LOCKUP - 1.4, reverse_swell(1.4), gain=0.6)
    for i, t_roll in enumerate(np.linspace(LOCKUP - 1.15, LOCKUP - 0.05, 18)):
        gain = 0.35 + 0.45 * (i / 17)
        place(bus, float(t_roll), snare(0.18), gain=gain * 0.75)

    # ── Lockup impact + resolve at LOCKUP ──────────────────────────────────
    place(bus, LOCKUP, impact(1.4), gain=1.05)
    place(bus, LOCKUP, eight_oh_eight(48, 1.2), gain=0.7)
    place(bus, LOCKUP, kick(), gain=1.1)
    place(bus, LOCKUP, vocal_kick(0.22), gain=0.9)
    # "Converge" resolve — bright ascending bells as the logo lands.
    place(bus, LOCKUP + 0.05, success_arpeggio(), gain=0.6)
    place(bus, LOCKUP + 0.8, chime(1760, 0.7), gain=0.5)

    # Real katana slash as the Converge logo punches in.
    if SLASH_PATH.exists():
        slash, _ = librosa.load(str(SLASH_PATH), sr=SR, mono=True)
        slash = slash[int(0.45 * SR):int(1.2 * SR)].astype(np.float64)  # trim to the hit
        if slash.size and np.max(np.abs(slash)) > 0:
            slash = slash / np.max(np.abs(slash)) * 0.95
            peak_i = int(np.argmax(np.abs(slash)))
            place(bus, LOGO_PUNCH_S - peak_i / SR, slash, gain=1.1)
    else:
        print(f"⚠ slash not found: {SLASH_PATH}")
    # Outro downbeat kicks so the tail isn't dead.
    for ts in [LOCKUP + 1.5, LOCKUP + 3.0, LOCKUP + 4.5]:
        place(bus, ts, kick(), gain=0.5)
        place(bus, ts, vocal_kick(), gain=0.45)

    # ── Mix: song bed + SFX, then master ───────────────────────────────────
    SONG_GAIN = 0.82
    SFX_GAIN = 0.9
    sfx = soft_limit(bus, drive=1.15)
    left = song_L * SONG_GAIN + sfx * SFX_GAIN
    right = song_R * SONG_GAIN + sfx * SFX_GAIN
    left = soft_limit(left, drive=1.05)
    right = soft_limit(right, drive=1.05)
    stereo = np.stack([left, right], axis=1)
    peak = float(np.max(np.abs(stereo))) or 1.0
    stereo = stereo * (10 ** (-1.5 / 20) / peak)
    pcm = (stereo * 32767).clip(-32768, 32767).astype(np.int16)
    with wave.open(str(OUT_PATH), "wb") as wf:
        wf.setnchannels(2)
        wf.setsampwidth(2)
        wf.setframerate(SR)
        wf.writeframes(pcm.tobytes())
    size_mb = OUT_PATH.stat().st_size / (1024 * 1024)
    print(f"✓ wrote {OUT_PATH} ({size_mb:.2f} MB, {DURATION_S:.1f}s, {SR}Hz stereo, song bed + SFX)")


if __name__ == "__main__":
    main()
