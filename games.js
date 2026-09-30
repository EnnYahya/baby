// The baby does not write code. It picks one of four game types and fills in its own
// title, theme and words. This file plays those games, all in plain text.

const pick = a => a[Math.floor(Math.random() * a.length)];
const el = (tag, text, cls) => { const e = document.createElement(tag); if (text) e.textContent = text; if (cls) e.className = cls; return e; };
const button = (label, fn) => { const b = el("button", label); b.type = "button"; b.onclick = fn; return b; };

// What the baby says, by life stage.
const R = {
  win:   { toddler: "Me win! Yay yay!", child: "I win! Ha ha!", teen: "Called it. Too easy.", adult: "I won this round. Well played, though." },
  lose:  { toddler: "Oh no... you win.", child: "Aw, you got me!", teen: "Fine. You win. Whatever.", adult: "You won. Nicely done." },
  tie:   { toddler: "Same same!", child: "We picked the same!", teen: "Great minds, I guess.", adult: "A draw. Again?" },
  found: { toddler: "You find me!", child: "You found me!", teen: "Okay, you found me.", adult: "You found me. Sharp eyes." },
  hid:   { toddler: "Me hide! Find me!", child: "I'm hiding! Where am I?", teen: "Find me. If you can.", adult: "I've hidden. Take your time." },
  miss:  { toddler: "Not here! Try!", child: "Not here! Try again!", teen: "Nope. Not there.", adult: "Not there. Try again." },
  high:  { toddler: "Bigger!", child: "Higher!", teen: "Higher, genius.", adult: "Higher." },
  low:   { toddler: "Smaller!", child: "Lower!", teen: "Lower. Come on.", adult: "Lower." }
};

export function playGame(game, area, stage, onDone) {
  const run = {};
  area._run = run;
  const alive = () => area._run === run;
  const t = R.win[stage] ? stage : "toddler";
  const say = k => R[k][t];
  const L = Math.min(3, Math.max(1, game.level || 1));

  area.textContent = "";
  const title = el("p", game.title); title.style.color = "var(--glow)";
  const intro = el("p", game.intro || "");
  const log = el("p");
  const controls = el("div", "", "bar");
  area.append(title, intro, log, controls);

  const finish = msg => {
    log.textContent = msg;
    controls.textContent = "";
    controls.append(button("Play again", () => playGame(game, area, stage, onDone)));
    onDone();
  };

  const games = {
    // Hide and seek: find where the baby is hiding.
    hide() {
      const spots = game.items.slice(0, 3 + L);
      const rounds = 2 + L;
      let round = 0, tries = 0, spot = 0;
      const next = () => {
        round++;
        spot = Math.floor(Math.random() * spots.length);
        log.textContent = "Round " + round + " of " + rounds + ". " + say("hid");
        controls.textContent = "";
        spots.forEach((name, i) => {
          const b = button(name, () => {
            tries++;
            if (i !== spot) { b.disabled = true; log.textContent = say("miss"); return; }
            if (round === rounds) return finish(say("found") + " You found me " + rounds + " times in " + tries + " tries.");
            controls.textContent = "";
            log.textContent = say("found");
            setTimeout(() => alive() && next(), 900);
          });
          controls.append(b);
        });
      };
      next();
    },

    // Guess the baby's secret number.
    guess() {
      const max = [10, 20, 50][L - 1];
      const secret = 1 + Math.floor(Math.random() * max);
      let tries = 0;
      log.textContent = "I am thinking of a number from 1 to " + max + ".";
      const input = el("input");
      input.type = "number"; input.min = 1; input.max = max;
      input.setAttribute("aria-label", "Your guess");
      controls.append(input, button("Guess", () => {
        const n = parseInt(input.value, 10);
        if (!(n >= 1 && n <= max)) { log.textContent = "Pick a number from 1 to " + max + "."; return; }
        tries++;
        input.value = "";
        if (n === secret) return finish("Yes, it was " + secret + "! You needed " + tries + " tries. " + say("lose"));
        log.textContent = n < secret ? say("high") : say("low");
      }));
    },

    // Rock paper scissors with the baby's own three items.
    rps() {
      const names = game.items.slice(0, 3);
      let me = 0, baby = 0, round = 0;
      log.textContent = names[0] + " beats " + names[1] + ", " + names[1] + " beats " + names[2] + ", " + names[2] + " beats " + names[0] + ". Best of 3.";
      names.forEach((name, i) => controls.append(button(name, () => {
        const bi = Math.floor(Math.random() * 3);
        round++;
        let res;
        if (i === bi) res = say("tie");
        else if ((i + 1) % 3 === bi) { me++; res = say("lose"); }
        else { baby++; res = say("win"); }
        const line = "You: " + name + ". Me: " + names[bi] + ". " + res;
        if (round < 3) { log.textContent = line; return; }
        finish(line + " Final score: you " + me + ", me " + baby + ". " + (me > baby ? say("lose") : baby > me ? say("win") : say("tie")));
      })));
    },

    // Repeat a growing sequence of words.
    memory() {
      const words = game.items.slice(0, 4);
      const need = 3 + L;
      const seq = [];
      const ask = () => {
        let pos = 0;
        controls.textContent = "";
        log.textContent = "Your turn!";
        words.forEach(w => controls.append(button(w, () => {
          if (w !== seq[pos]) return finish("Oops! You remembered " + (seq.length - 1) + ". " + say("win"));
          pos++;
          if (pos < seq.length) return;
          if (seq.length === need) return finish("You remembered everything! " + say("lose"));
          controls.textContent = "";
          log.textContent = "Good!";
          setTimeout(() => alive() && round(), 800);
        })));
      };
      const round = () => {
        seq.push(pick(words));
        controls.textContent = "";
        let i = 0;
        const show = () => {
          if (!alive()) return;
          if (i >= seq.length) return ask();
          log.textContent = seq[i++];
          setTimeout(() => { if (alive()) log.textContent = "."; }, 500);
          setTimeout(show, 800);
        };
        log.textContent = "Watch! " + seq.length + " of " + need;
        setTimeout(show, 700);
      };
      round();
    }
  };

  (games[game.template] || games.guess)();
}
