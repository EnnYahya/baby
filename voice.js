// Voice uses features already built into the browser. No account, no cost, no extra key.
// Listening: Chrome and Edge. Speaking: most browsers.

const STAGE_VOICE = {
  newborn: { p: 2, r: 0.7 }, baby: { p: 1.9, r: 0.8 }, toddler: { p: 1.7, r: 0.9 },
  child: { p: 1.4, r: 1 }, teen: { p: 1.1, r: 1.05 }, adult: { p: 0.9, r: 1 }
};
const MOOD_VOICE = {
  happy: { p: 0.15, r: 0.05 }, sad: { p: -0.2, r: -0.12 }, angry: { p: -0.1, r: 0.12 }, calm: { p: 0, r: 0 }
};
const clamp = (n, lo, hi) => Math.min(hi, Math.max(lo, n));

export function voiceInputOK() {
  return !!(window.SpeechRecognition || window.webkitSpeechRecognition);
}

export function stopSpeaking() {
  if ("speechSynthesis" in window) speechSynthesis.cancel();
}

// The baby's voice gets higher and slower when younger, and shifts with its mood.
export function speak(text, stage, gender, mood, lang) {
  if (!("speechSynthesis" in window)) return;
  const clean = String(text).replace(/[*_~#]/g, "").trim();
  if (!clean) return;
  speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(clean);
  const s = STAGE_VOICE[stage] || STAGE_VOICE.child;
  const m = MOOD_VOICE[mood] || MOOD_VOICE.calm;
  u.lang = lang;
  u.pitch = clamp(s.p + m.p + (gender === "male" ? -0.15 : 0.1), 0, 2);
  u.rate = clamp(s.r + m.r, 0.5, 2);
  const voices = speechSynthesis.getVoices().filter(v => v.lang.toLowerCase().startsWith(lang.slice(0, 2).toLowerCase()));
  if (voices.length) u.voice = voices.find(v => v.localService) || voices[0];
  speechSynthesis.speak(u);
}

// Listens once, then calls onText with what the player said.
export function listen(lang, onText, onError, onEnd) {
  const R = window.SpeechRecognition || window.webkitSpeechRecognition;
  const rec = new R();
  rec.lang = lang;
  rec.interimResults = false;
  rec.maxAlternatives = 1;
  rec.onresult = e => {
    const t = (e.results[0][0].transcript || "").trim();
    if (t) onText(t);
  };
  rec.onerror = e => {
    if (e.error === "not-allowed" || e.error === "service-not-allowed") onError("Microphone blocked. Allow it with the icon in the address bar.");
    else if (e.error === "no-speech") onError("I did not hear anything. Try again.");
    else if (e.error !== "aborted") onError("Voice input problem: " + e.error);
  };
  rec.onend = onEnd;
  rec.start();
  return rec;
}
