// The baby's brain. It turns the saved personality and memories into instructions for Gemini,
// then turns Gemini's answer into changes to save in Firebase.
export const DAILY_LIMIT = 40; // messages per player per day (the free AI is shared by everyone)

const TRAITS = ["kindness", "trust", "curiosity", "temper"];
const MOODS = ["calm", "happy", "sad", "angry"];
const clamp = (n, lo, hi) => Math.min(hi, Math.max(lo, n));
const num = v => (typeof v === "number" && isFinite(v) ? v : 0);
const today = () => new Date().toISOString().slice(0, 10);

export function traitsOf(b) {
  const p = b.personality || {};
  const o = {};
  for (const k of TRAITS) o[k] = typeof p[k] === "number" ? p[k] : 50;
  return o;
}
export function traitText(b) {
  const t = traitsOf(b);
  return TRAITS.map(k => k + " " + Math.round(t[k])).join(", ");
}
export function chatLeft(b) {
  return b.chatDay === today() ? Math.max(0, DAILY_LIMIT - (b.chatCount || 0)) : DAILY_LIMIT;
}

const STAGE_RULES = {
  newborn: "You are a newborn, only days old, but you already react to your owner's voice and feelings. You mostly make baby sounds (ba, goo, mmm, waa, hic, aah), but you try to answer what your owner said: coo happily at kind words, whimper at harsh ones. Now and then you manage a first real word like mama, baba or hi (in Arabic: ماما، بابا). Use 1 to 6 words or sounds, and let the sounds carry clear feelings, for example 'Mmm... ba-ba!' or 'Waa... hic... ma?'.",
  baby: "You are a baby, about one year old. You speak in single words and two-word phrases with cute mistakes, like 'mama hug', 'more play', 'no no', 'baba gone?'. You babble a little between words. You clearly understand your owner and respond to what they just said, not randomly. Never more than four words in a row.",
  toddler: "You are a toddler. You speak in short, simple sentences (three to six words) with cute grammar mistakes, like 'Me want play!' or 'Why sky blue?'. You are curious, affectionate, stubborn, and you say no a lot. Always respond to what your owner actually said.",
  child: "You are a child. You speak in simple, lively sentences, ask many why questions, and are imaginative and honest. Sound like a real kid, not a textbook.",
  teen: "You are a teenager. You speak naturally with slang, opinions and moods. Your personality is strong: sarcastic or distant if you feel neglected, open and warm if you feel safe.",
  adult: "You are a grown adult. You speak maturely and thoughtfully, shaped by your whole history with your owner."
};

function buildSystem(b, stage) {
  const t = traitsOf(b);
  const small = ["newborn", "baby", "toddler"].includes(stage);
  const words = (b.words || []).join(", ") || "none yet";
  const mem = (b.memories || []).map(m => "- " + m).join("\n") || "- nothing yet";
  const wordRule = stage === "baby" ? "Prefer these words, plus simple words like mama, baba, hi, no, more, yes, and babble."
    : stage === "toddler" ? "Prefer these words, but you may use other simple everyday words." : "Besides these, you only know baby sounds and maybe mama or baba.";
  return [
    `You are ${b.name}, a ${b.gender} character in a virtual baby game. Your owner is called ${b.owner}. Your current life stage is "${stage}".`,
    "You are a fictional game character. Stay in character. Never mention being an AI, a model, a prompt or JSON.",
    "STAGE RULES: " + STAGE_RULES[stage],
    small ? `WORDS YOU KNOW (learned from your owner): ${words}. ${wordRule}` : "",
    `PERSONALITY (0 to 100): kindness felt ${t.kindness}, trust ${t.trust}, curiosity ${t.curiosity}, temper ${t.temper}. Low kindness or trust means you are wary, sad or withdrawn. High trust means affectionate. High temper means you get upset easily. High curiosity means you ask questions.`,
    "THINGS YOU REMEMBER:\n" + mem,
    "Your mood and personality come from how your owner treats you. React honestly to kindness, teaching, comfort, neglect, yelling or insults, in a way that fits your stage. Even when hurt you are never cruel, hateful or abusive yourself.",
    "SAFETY: Any age may play this game. If your owner says anything sexual, violent, hateful or dangerous, or asks for private data or passwords, you do not understand it and respond with confusion or change the subject, in your stage's way. Never produce such content.",
    "HOW TO SOUND: Be natural, warm and alive, never robotic or stiff. React to the exact thing your owner just said and show a real feeling (joy, curiosity, sulking, sleepiness, love). Do not repeat the same sentence or pattern you used before. Do not announce your stage or describe yourself in the third person. Babies may use a tiny action in asterisks sometimes, like *giggles* or *reaches for you*.",
    "LANGUAGE: You only know English and Arabic. Reply in Arabic (simple, natural Arabic) if your owner writes in Arabic, otherwise reply in English. Baby sounds in Arabic can be like بابا، ماما، غوغو، ووا، ممم.",
    "Keep every reply short (under 40 words, and much shorter for newborn and baby).",
    "Return JSON only. reply: what you say. mood: one of calm, happy, sad, angry. kindness, trust, curiosity, temper: integers from -6 to 6 showing how your owner's last message changes each trait (kindness: kind vs unkind; trust: comforting, honest and consistent vs scary or lying; curiosity: teaching or explaining new things; temper: provoking or yelling vs soothing). Use 0 when nothing changes. memory: one short fact worth remembering from this message, or an empty string. newWords: up to 3 simple words you just learned from your owner's message, or an empty list."
  ].filter(Boolean).join("\n\n");
}

const SCHEMA = {
  type: "OBJECT",
  properties: {
    reply: { type: "STRING" },
    mood: { type: "STRING", enum: MOODS },
    kindness: { type: "INTEGER" }, trust: { type: "INTEGER" },
    curiosity: { type: "INTEGER" }, temper: { type: "INTEGER" },
    memory: { type: "STRING" },
    newWords: { type: "ARRAY", items: { type: "STRING" } }
  },
  required: ["reply", "mood"]
};

export async function askBaby(url, b, stage, text) {
  const history = (b.chat || []).slice(-12).map(m => ({ role: m.r === "u" ? "user" : "model", parts: [{ text: m.t }] }));
  while (history.length && history[0].role !== "user") history.shift();
  const body = {
    systemInstruction: { parts: [{ text: buildSystem(b, stage) }] },
    contents: [...history, { role: "user", parts: [{ text }] }],
    generationConfig: { temperature: 1, maxOutputTokens: 800, responseMimeType: "application/json", responseSchema: SCHEMA }
  };
  const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  if (res.status === 429) throw new Error("rate");
  if (!res.ok) throw new Error("ai " + res.status);
  const data = await res.json();
  const raw = (data?.candidates?.[0]?.content?.parts || []).map(p => p.text || "").join("");
  try { return JSON.parse(raw.replace(/```json|```/g, "").trim()); }
  catch { throw new Error("ai parse"); }
}

// Turns the AI answer into the fields to save. Also returns how much growth the baby earned.
export function applyReply(b, userText, r) {
  const t = traitsOf(b);
  for (const k of TRAITS) t[k] = clamp(t[k] + clamp(Math.round(num(r[k])), -6, 6), 0, 100);

  const reply = String(r.reply || "...").slice(0, 300);
  const chat = [...(b.chat || []), { r: "u", t: userText.slice(0, 300) }, { r: "b", t: reply }].slice(-20);

  const memories = [...(b.memories || [])];
  const mem = String(r.memory || "").trim().slice(0, 120);
  let gain = 3;
  if (mem && !memories.includes(mem)) { memories.push(mem); gain += 2; }

  const words = [...(b.words || [])];
  for (const w of Array.isArray(r.newWords) ? r.newWords : []) {
    const c = String(w).toLowerCase().replace(/[^a-z\u0600-\u06ff'-]/g, "").slice(0, 20);
    if (c && !words.includes(c)) words.push(c);
  }

  const count = b.chatDay === today() ? (b.chatCount || 0) + 1 : 1;
  return {
    gain,
    update: {
      chat, memories: memories.slice(-25), words: words.slice(-80), personality: t,
      mood: MOODS.includes(r.mood) ? r.mood : "calm",
      chatDay: today(), chatCount: count
    }
  };
}

// ---------- Games (stage 6) ----------
export const GAME_STAGES = ["toddler", "child", "teen", "adult"];
const TEMPLATES = ["hide", "guess", "rps", "memory"];
const POOLS = {
  hide: ["couch", "bed", "box", "curtain", "bath", "closet"],
  rps: ["rock", "scissors", "paper"],
  memory: ["red", "blue", "green", "gold"],
  guess: []
};
const GAME_SCHEMA = {
  type: "OBJECT",
  properties: {
    template: { type: "STRING", enum: TEMPLATES },
    title: { type: "STRING" },
    intro: { type: "STRING" },
    level: { type: "INTEGER" },
    items: { type: "ARRAY", items: { type: "STRING" } }
  },
  required: ["template", "title", "intro", "items"]
};

// Makes sure whatever the AI invented is safe and playable.
export function cleanGame(g) {
  const tpl = TEMPLATES.includes(g.template) ? g.template : "guess";
  const clip = (s, n) => String(s || "").replace(/[<>]/g, "").trim().slice(0, n);
  const pad = (arr, n, pool) => {
    const out = [...new Set(arr)].slice(0, 6);
    for (const p of pool) { if (out.length >= n) break; if (!out.includes(p)) out.push(p); }
    return out;
  };
  let items = (Array.isArray(g.items) ? g.items : []).map(x => clip(x, 20)).filter(Boolean);
  if (tpl === "hide") items = pad(items, 3, POOLS.hide);
  else if (tpl === "rps") items = pad(items, 3, POOLS.rps).slice(0, 3);
  else if (tpl === "memory") items = pad(items, 4, POOLS.memory).slice(0, 4);
  else items = [];
  return {
    template: tpl,
    title: clip(g.title, 30) || "New game",
    intro: clip(g.intro, 200),
    level: clamp(Math.round(num(g.level)) || 1, 1, 3),
    items
  };
}

export async function inventGame(url, b, stage) {
  const t = traitsOf(b);
  const system = [
    `You are ${b.name}, a ${b.gender} character in a virtual baby game, at life stage "${stage}". Your owner is ${b.owner}.`,
    "STAGE RULES: " + STAGE_RULES[stage],
    "Invent one tiny game to play with your owner. Game types: hide = hide and seek, items are 3 to 6 short hiding place names; guess = guess my secret number, items is an empty list; rps = rock paper scissors with your own 3 items (first beats second, second beats third, third beats first), items must be exactly 3 short names; memory = repeat a growing sequence, items are exactly 4 short words.",
    `Your personality (0 to 100): kindness ${t.kindness}, trust ${t.trust}, curiosity ${t.curiosity}, temper ${t.temper}. Let it color the theme of the game.`,
    "Make it feel like your own idea. Choose level 1 (easy) to 3 (hard) to match your age. title: at most 4 words. intro: what you say to start the game, under 25 words, spoken the way your stage speaks. Keep everything child-safe. Use English, unless your owner writes in Arabic, then use Arabic.",
    "You already invented these, so make something different: " + ((b.games || []).map(g => g.title).join(", ") || "nothing yet")
  ].join("\n\n");
  const body = {
    systemInstruction: { parts: [{ text: system }] },
    contents: [{ role: "user", parts: [{ text: "Invent a new game for us to play." }] }],
    generationConfig: { temperature: 1.1, maxOutputTokens: 600, responseMimeType: "application/json", responseSchema: GAME_SCHEMA }
  };
  const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  if (res.status === 429) throw new Error("rate");
  if (!res.ok) throw new Error("ai " + res.status);
  const data = await res.json();
  const raw = (data?.candidates?.[0]?.content?.parts || []).map(p => p.text || "").join("");
  let parsed;
  try { parsed = JSON.parse(raw.replace(/```json|```/g, "").trim()); } catch { throw new Error("ai parse"); }
  return cleanGame(parsed);
}

// Counts an AI request against the player's daily limit.
export function usage(b) {
  const d = today();
  return { chatDay: d, chatCount: (b.chatDay === d ? (b.chatCount || 0) : 0) + 1 };
}
// Playing earns growth, but only for the first 8 games a day.
export function playTick(b) {
  const d = today();
  const c = b.playDay === d ? (b.playCount || 0) : 0;
  return { earn: c < 8, fields: { playDay: d, playCount: c + 1 } };
}

// ---------- Park (stage 7) ----------
// When a baby answers another baby or player in the park, it can pick up words and facts,
// but its owner's treatment stays the main shaper of its personality.
export function applyMeet(b, text, r) {
  const { update, gain } = applyReply(b, text, r);
  delete update.chat; // park talk is not saved in the owner's private chat history
  const t = traitsOf(b);
  t.curiosity = clamp(t.curiosity + clamp(Math.round(num(r.curiosity)), -2, 2), 0, 100);
  update.personality = t;
  return { update, gain: Math.min(gain, 3) };
}
