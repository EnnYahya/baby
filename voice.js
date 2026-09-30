// Voice uses features already built into the browser. No account, no cost, no extra key.
// Listening: Chrome and Edge. Speaking: most browsers.

const STAGE_VOICE = {
  newborn: { p: 1.6, r: 0.85 }, baby: { p: 1.5, r: 0.9 }, toddler: { p: 1.35, r: 0.95 },
  child: { p: 1.2, r: 1 }, teen: { p: 1.05, r: 1.05 }, adult: { p: 0.95, r: 1 }
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

// Ranks the voices installed on this device. Neural / "Natural" / Google voices sound far
// less robotic than the old default ones, so they are tried first.
function score(v) {
  const n = v.name.toLowerCase();
  let s = 0;
  if (/natural|neural/.test(n)) s += 10;
  if (/online/.test(n)) s += 6;
  if (/google/.test(n)) s += 5;
  if (/premium|enhanced|siri/.test(n)) s += 5;
  if (/espeak|compact/.test(n)) s -= 10;
  return s;
}

// Voices for a language (like "en-US" or "ar-SA"), best first.
export function voicesFor(lang) {
  if (!("speechSynthesis" in window)) return [];
  const base = lang.slice(0, 2).toLowerCase();
  return speechSynthesis.getVoices()
    .filter(v => v.lang.toLowerCase().startsWith(base))
    .sort((a, b) => score(b) - score(a) || a.name.localeCompare(b.name));
}

// Calls fn when the browser finishes loading its voice list (it loads late in Chrome and Edge).
export function onVoicesReady(fn) {
  if (!("speechSynthesis" in window)) return;
  speechSynthesis.addEventListener("voiceschanged", fn);
  fn();
}

// The baby's voice gets higher and slower when younger, and shifts with its mood.
// voiceName is optional: a voice the player picked from the list.
export function speak(text, stage, gender, mood, lang, voiceName) {
  if (!("speechSynthesis" in window)) return;
  // Remove little actions like *giggles* so they are not read aloud.
  const clean = String(text).replace(/\*[^*]*\*/g, " ").replace(/[_~#]/g, "").replace(/\s+/g, " ").trim();
  if (!clean) return;
  speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(clean);
  const s = STAGE_VOICE[stage] || STAGE_VOICE.child;
  const m = MOOD_VOICE[mood] || MOOD_VOICE.calm;
  u.lang = lang;
  u.pitch = clamp(s.p + m.p + (gender === "male" ? -0.15 : 0.1), 0, 2);
  u.rate = clamp(s.r + m.r, 0.5, 2);
  const list = voicesFor(lang);
  const chosen = list.find(v => v.name === voiceName) || list[0];
  if (chosen) u.voice = chosen;
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
