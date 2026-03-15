import { useEffect, useRef, useState, useCallback } from "react";
import "./Game.css";
import cakeImg from "./assets/cake.png";
import bowImg from "./assets/bow.png";
import balloonImg from "./assets/balloon.png";
// ── Constants ──────────────────────────────────────────────────────────────
const CW = 420;
const CH = 240;
const GY = CH - 44;
const GRAV = 0.6;
const JUMP_FORCE = -12.5;
const CAKE_SCORE = 30;

const CANDLE_COLORS  = ["#ff66aa", "#66aaff", "#aa55ff", "#ff8844"];
const BALLOON_COLORS = ["#ff3366", "#ffaa00", "#44cc88", "#ee44cc", "#4499ff"];

const STARS = Array.from({ length: 30 }, () => ({
  x: Math.random() * CW * 3,
  y: Math.random() * (CH * 0.5),
  s: Math.random() < 0.3 ? 2 : 1,
  p: Math.random() * 6.28,
}));

function overlap(a, b) {
  return (
    a.x < b.x + b.w &&
    a.x + a.w > b.x &&
    a.y < b.y + b.h &&
    a.y + a.h > b.y
  );
}

function makeInitialState() {
  return {
    gameState: "idle",       // idle | running | dead | win
    score: 0,
    coinsGot: 0,
    lives: 3,
    speed: 2,
    frameCount: 0,
    bgOffset: 0,
    hillOffset: 0,
    obstacleTimer: 0,
    nextObstacleIn: 150,
    coinTimer: 0,
    nextCoinIn: 45,
    cakeSpawned: false,
    obstacles: [],
    coins: [],
    cake: null,
    player: {
      x: 60,
      y: GY - 36,
      w: 24,
      h: 36,
      vy: 0,
      grounded: true,
      fr: 0,
      ft: 0,
    },
  };
}

// ── Component ──────────────────────────────────────────────────────────────
export default function Game() {
  const canvasRef  = useRef(null);
  const gRef       = useRef(makeInitialState());
  const rafRef     = useRef(null);
  const jumpQueued = useRef(false);

  const [screen,     setScreen]     = useState("idle");   // idle | running | dead | win
  const [hudCoins,   setHudCoins]   = useState(0);
  const [hudScore,   setHudScore]   = useState(0);
  const [,   setHudLives]   = useState(3);
  const [deathTitle, setDeathTitle] = useState("");
  const [deathSub,   setDeathSub]   = useState("");
  const [showLetter, setShowLetter] = useState(false);
  function startGame() {
    const g = gRef.current;
    Object.assign(g, makeInitialState(), { gameState: "running" });
    setScreen("running");
    setHudCoins(0);
    setHudScore(0);
    setHudLives(3);
  }

  function restartGame() {
    startGame();
  }
  // ── Jump handler ─────────────────────────────────────────────────────────
  const handleJump = useCallback(() => {
    const g = gRef.current;
    if (g.gameState === "idle") {
      startGame();
    } else if (g.gameState === "dead") {
      restartGame();
    } else if (g.gameState === "running") {
      jumpQueued.current = true;
    }
  }, []);

  // ── Keyboard ─────────────────────────────────────────────────────────────
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === " " || e.key === "ArrowUp") {
        e.preventDefault();
        handleJump();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [handleJump]);

  // ── Game control ─────────────────────────────────────────────────────────


  function triggerDeath() {
    const g = gRef.current;
    g.lives--;
    g.gameState = "dead";
    if (g.lives <= 0) {
      setDeathTitle("GAME OVER!");
      setDeathSub(`Score: ${g.score}\nTap or SPACE to retry`);
    } else {
      setDeathTitle("OOPS! 😵");
      setDeathSub(`Lives: ${g.lives}\nTap or SPACE to continue`);
    }
    setHudLives(Math.max(0, g.lives));
    setScreen("dead");
  }

  function triggerWin() {
    gRef.current.gameState = "win";
    setScreen("win");
  }

  // ── Spawn helpers ─────────────────────────────────────────────────────────
  function spawnObstacle(g) {
    const kind  = Math.random() < 0.5 ? "candle" : "balloon";
    const color = kind === "candle"
      ? CANDLE_COLORS[Math.floor(Math.random() * CANDLE_COLORS.length)]
      : BALLOON_COLORS[Math.floor(Math.random() * BALLOON_COLORS.length)];
    if (kind === "candle") {
      g.obstacles.push({ kind, color, x: CW + 20, y: GY - 28, w: 14, h: 28 });
    } else {
      g.obstacles.push({ kind, color, x: CW + 20, y: GY - 50, w: 22, h: 34 });
    }
  }

  function spawnCoin(g) {
    g.coins.push({
      x: CW + 20,
      y: GY - 28,
      w: 14,
      h: 14,
      t: Math.random() * 6.28,
      collected: false,
    });
  }

  // ── Update ────────────────────────────────────────────────────────────────
  function update(g) {
    if (g.gameState !== "running") return;

    g.frameCount++;
    if (g.frameCount % 400 === 0) g.speed = Math.min(g.speed + 0.3, 7);

    // Jump
    if (jumpQueued.current && g.player.grounded) {
      g.player.vy = JUMP_FORCE;
      g.player.grounded = false;
    }
    jumpQueued.current = false;

    // Player physics
    const p = g.player;
    if (!p.grounded) {
      p.vy += GRAV;
      p.y  += p.vy;
      if (p.y >= GY - p.h) {
        p.y = GY - p.h;
        p.vy = 0;
        p.grounded = true;
      }
    }

    // Walk anim
    if (p.grounded) {
      p.ft++;
      if (p.ft > 7) { p.fr = (p.fr + 1) % 4; p.ft = 0; }
    }

    // Scroll
    g.bgOffset   = (g.bgOffset   + g.speed * 0.5)  % (CW * 3);
    g.hillOffset = (g.hillOffset + g.speed * 0.15) % (CW + 200);

    // Obstacle spawn
    if (!g.cakeSpawned) {
      g.obstacleTimer++;
      if (g.obstacleTimer >= g.nextObstacleIn) {
        g.obstacleTimer   = 0;
        g.nextObstacleIn  = 80 + Math.floor(Math.random() * 80);
        spawnObstacle(g);
      }

      // Coin spawn
      g.coinTimer++;
      if (g.coinTimer >= g.nextCoinIn) {
        g.coinTimer   = 0;
        g.nextCoinIn  = 35 + Math.floor(Math.random() * 30);
        spawnCoin(g);
      }
    }

    // Cake spawn
    if (!g.cakeSpawned && g.coinsGot >= CAKE_SCORE) {
      g.cakeSpawned = true;
      g.obstacles   = [];
      g.coins       = [];
      g.cake        = { x: CW + 60, y: GY - 50, w: 42, h: 50 };
    }

    // Move objects
    g.obstacles = g.obstacles
      .map(o => ({ ...o, x: o.x - g.speed }))
      .filter(o => o.x > -60);

    g.coins = g.coins
      .map(c => ({ ...c, x: c.x - g.speed, t: c.t + 0.07 }))
      .filter(c => c.x > -30);

    if (g.cake) g.cake = { ...g.cake, x: g.cake.x - g.speed * 0.8 };

    // Obstacle collision
    for (const o of g.obstacles) {
      if (overlap(p, { x: o.x + 3, y: o.y, w: o.w - 6, h: o.h })) {
        triggerDeath();
        return;
      }
    }

    // Coin collection
    let gotOne = false;
    g.coins = g.coins.map(c => {
      if (!c.collected && overlap(p, c)) { gotOne = true; g.coinsGot++; g.score++; return { ...c, collected: true }; }
      return c;
    }).filter(c => !c.collected);
    if (gotOne) {
      setHudCoins(g.coinsGot);
      setHudScore(g.score);
    }

    // Cake collision
    if (g.cake && overlap(p, g.cake)) {
      triggerWin();
    }
  }

  // ── Draw helpers ──────────────────────────────────────────────────────────
  function drawBg(ctx, g, now) {
    const grad = ctx.createLinearGradient(0, 0, 0, CH);
    grad.addColorStop(0, "#1a0a2e");
    grad.addColorStop(0.65, "#2d0a5e");
    grad.addColorStop(1, "#0a0018");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, CW, CH);

    STARS.forEach((s) => {
      const sx = (s.x - g.bgOffset * 0.3) % (CW * 3);
      if (sx < -2 || sx > CW + 2) return;
      ctx.fillStyle = `rgba(255,255,210,${0.35 + Math.sin(now * 0.002 + s.p) * 0.3})`;
      ctx.fillRect(sx, s.y, s.s, s.s);
    });

    ctx.fillStyle = "#231048";
    for (let i = 0; i < 8; i++) {
      const hx = ((i * 200) - g.hillOffset) % (CW + 200) - 100;
      const hh = 40 + (i % 3) * 20;
      ctx.beginPath();
      ctx.moveTo(hx, GY);
      ctx.lineTo(hx + 70, GY - hh);
      ctx.lineTo(hx + 140, GY);
      ctx.fill();
    }
  }

  function drawGround(ctx, g) {
    ctx.fillStyle = "#3a2060";
    ctx.fillRect(0, GY, CW, 44);
    ctx.fillStyle = "#7a50c0";
    ctx.fillRect(0, GY, CW, 5);
    ctx.fillStyle = "#2a1045";
    const gStep = 36;
    const gOff  = g.bgOffset % gStep;
    for (let bx = -gOff; bx < CW; bx += gStep) ctx.fillRect(bx, GY + 6, 1, 38);
    for (let r = 0; r < 3; r++) ctx.fillRect(0, GY + 6 + r * 12, CW, 1);
  }

  function drawCandle(ctx, h, now) {
    const fl = Math.sin(now * 0.016 + h.x) * 1.3;
    ctx.fillStyle = h.color;
    ctx.beginPath();
    ctx.roundRect(h.x, h.y + 8, h.w, h.h - 8, 2);
    ctx.fill();
    ctx.fillStyle = "rgba(255,255,255,0.28)";
    ctx.fillRect(h.x + 2, h.y + 10, 4, h.h - 12);
    ctx.strokeStyle = "#444";
    ctx.lineWidth   = 1.5;
    ctx.beginPath();
    ctx.moveTo(h.x + h.w / 2, h.y + 9);
    ctx.lineTo(h.x + h.w / 2, h.y + 3);
    ctx.stroke();
    // Flame yellow
    ctx.fillStyle = "#ffe033";
    ctx.beginPath();
    ctx.moveTo(h.x + h.w / 2, h.y + 4);
    ctx.bezierCurveTo(h.x + h.w / 2 + 5, h.y - 3  + fl, h.x + h.w / 2 + 4, h.y - 13 + fl, h.x + h.w / 2, h.y - 17 + fl);
    ctx.bezierCurveTo(h.x + h.w / 2 - 4, h.y - 13 + fl, h.x + h.w / 2 - 5, h.y - 3  + fl, h.x + h.w / 2, h.y + 4);
    ctx.fill();
    // Flame orange
    ctx.fillStyle = "#ff7700";
    ctx.beginPath();
    ctx.moveTo(h.x + h.w / 2, h.y + 4);
    ctx.bezierCurveTo(h.x + h.w / 2 + 3, h.y - 2  + fl, h.x + h.w / 2 + 2, h.y - 10 + fl, h.x + h.w / 2, h.y - 13 + fl);
    ctx.bezierCurveTo(h.x + h.w / 2 - 2, h.y - 10 + fl, h.x + h.w / 2 - 3, h.y - 2  + fl, h.x + h.w / 2, h.y + 4);
    ctx.fill();
    // White core
    ctx.fillStyle = "rgba(255,255,240,0.85)";
    ctx.beginPath();
    ctx.ellipse(h.x + h.w / 2, h.y - 4 + fl, 1.8, 3, 0, 0, Math.PI * 2);
    ctx.fill();
    // Wax drip
    ctx.fillStyle = "rgba(255,210,230,0.7)";
    ctx.fillRect(h.x + 1, h.y + 8, 3, 5);
  }

  function drawBalloon(ctx, h, now) {
    const bob  = Math.sin(now * 0.003 + h.x * 0.01) * 4;
    const cx   = h.x + h.w / 2;
    const cy   = h.y + h.h / 2 + bob;
    const rw   = h.w / 2;
    const rh   = h.h / 2;
    const knotY = h.y + h.h + bob;
    // String
    ctx.strokeStyle = "rgba(210,210,180,0.85)";
    ctx.lineWidth   = 1.5;
    ctx.beginPath();
    ctx.moveTo(cx, knotY + 4);
    ctx.quadraticCurveTo(cx + 8, (knotY + GY) / 2, cx, GY);
    ctx.stroke();
    // Shadow
    ctx.fillStyle = "rgba(0,0,0,0.2)";
    ctx.beginPath();
    ctx.ellipse(cx + 2, cy + 3, rw, rh, 0, 0, Math.PI * 2);
    ctx.fill();
    // Body
    ctx.fillStyle = h.color;
    ctx.beginPath();
    ctx.ellipse(cx, cy, rw, rh, 0, 0, Math.PI * 2);
    ctx.fill();
    // Shine
    ctx.fillStyle = "rgba(255,255,255,0.38)";
    ctx.beginPath();
    ctx.ellipse(cx - rw * 0.35, cy - rh * 0.3, rw * 0.28, rh * 0.35, Math.PI / 5, 0, Math.PI * 2);
    ctx.fill();
    // Outline
    ctx.strokeStyle = "rgba(0,0,0,0.18)";
    ctx.lineWidth   = 1.2;
    ctx.beginPath();
    ctx.ellipse(cx, cy, rw, rh, 0, 0, Math.PI * 2);
    ctx.stroke();
    // Knot
    ctx.fillStyle = h.color;
    ctx.beginPath();
    ctx.moveTo(cx - 3, knotY);
    ctx.lineTo(cx + 3, knotY);
    ctx.lineTo(cx, knotY + 6);
    ctx.fill();
  }

  function drawCoin(ctx, c, now) {
    const bob = Math.sin(c.t) * 2.5;
    const sh  = Math.abs(Math.sin(now * 0.004 + c.t));
    ctx.fillStyle = `hsl(45,100%,${45 + sh * 20}%)`;
    ctx.beginPath();
    ctx.arc(c.x + 7, c.y + bob + 7, 7, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "rgba(255,255,180,0.55)";
    ctx.beginPath();
    ctx.ellipse(c.x + 4, c.y + bob + 4, 3, 4, -0.3, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "rgba(160,100,0,0.75)";
    ctx.font      = "bold 8px serif";
    ctx.fillText("★", c.x + 2, c.y + bob + 12);
  }

  function drawCake(ctx, cake, now) {
    if (!cake) return;
    const rx = cake.x;
    ctx.fillStyle = "#c8607a"; ctx.fillRect(rx, cake.y + 26, cake.w, 22);
    ctx.fillStyle = "#e080a0"; ctx.fillRect(rx + 2, cake.y + 14, cake.w - 4, 14);
    ctx.fillStyle = "#f8c8dc"; ctx.fillRect(rx + 6, cake.y, cake.w - 12, 16);
    ctx.fillStyle = "#fff";
    [2, 10, 18, 26].forEach((ox) => ctx.fillRect(rx + ox, cake.y + 14, 5, 5));
    ["#ff4444", "#44cc44", "#4488ff", "#ffcc00"].forEach((col, i) => {
      ctx.fillStyle = col;
      ctx.fillRect(rx + 5 + i * 9, cake.y - 9, 4, 10);
      ctx.fillStyle = "rgba(255,220,0,0.9)";
      ctx.beginPath();
      ctx.ellipse(rx + 7 + i * 9, cake.y - 11, 2, 3.5 + Math.sin(now * 0.01 + i) * 0.5, 0, 0, Math.PI * 2);
      ctx.fill();
    });
    ctx.fillStyle = "rgba(255,220,100,0.12)";
    ctx.beginPath();
    ctx.ellipse(rx + cake.w / 2, GY, cake.w * 0.8, 10, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#ffdd00";
    ctx.font      = "bold 7px monospace";
    ctx.fillText("GOAL!", rx + 4, cake.y - 14);
  }

  function drawPlayer(ctx, p) {
    const la = p.grounded ? [0, 4, 7, 4][p.fr] : 0;
    // Legs
    ctx.fillStyle = "#2244cc";
    ctx.fillRect(p.x + 3,  p.y + 22, 8, 12 + la);
    ctx.fillRect(p.x + 12, p.y + 22, 8, 12 + (p.grounded ? 7 - la : 0));
    // Shoes
    ctx.fillStyle = "#111";
    ctx.fillRect(p.x + 1,  p.y + 33 + la,                    11, 5);
    ctx.fillRect(p.x + 10, p.y + 33 + (p.grounded ? 7 - la : 0), 11, 5);
    // Body
    ctx.fillStyle = "#ff6622"; ctx.fillRect(p.x + 2, p.y + 12, 18, 12);
    // Head
    ctx.fillStyle = "#ffccaa"; ctx.fillRect(p.x + 3, p.y + 2,  16, 12);
    // Hat brim
    ctx.fillStyle = "#dd0044"; ctx.fillRect(p.x + 2, p.y - 1,  18,  5);
    // Hat top
    ctx.fillStyle = "#ee1155"; ctx.fillRect(p.x + 6, p.y - 9,  10,  9);
    // Hat pom
    ctx.fillStyle = "#ffdd00";
    ctx.beginPath();
    ctx.arc(p.x + 11, p.y - 10, 3, 0, Math.PI * 2);
    ctx.fill();
    // Eyes
    ctx.fillStyle = "#222";
    ctx.fillRect(p.x + 6,  p.y + 4, 3, 3);
    ctx.fillRect(p.x + 13, p.y + 4, 3, 3);
    // Smile
    ctx.fillStyle = "#cc4400";
    ctx.fillRect(p.x + 8, p.y + 9, 7, 2);
  }

  function drawProgress(ctx, g) {
    if (g.cakeSpawned) return;
    const prog = Math.min(g.coinsGot / CAKE_SCORE, 1);
    const bw = 100, bh = 6;
    const bx = CW / 2 - bw / 2;
    const by = CH - 12;
    ctx.fillStyle = "rgba(0,0,0,0.4)"; ctx.fillRect(bx, by, bw, bh);
    ctx.fillStyle = "#ffdd00";         ctx.fillRect(bx, by, bw * prog, bh);
    ctx.strokeStyle = "rgba(255,255,255,0.3)";
    ctx.lineWidth   = 1;
    ctx.strokeRect(bx, by, bw, bh);
    ctx.fillStyle = "rgba(255,255,255,0.6)";
    ctx.font      = "5px monospace";
    ctx.fillText("🎂", bx + bw + 4, by + 5);
  }

  // ── Game loop ─────────────────────────────────────────────────────────────
  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx    = canvas.getContext("2d");

    function loop() {
      const g   = gRef.current;
      const now = Date.now();
      update(g);
      ctx.clearRect(0, 0, CW, CH);
      drawBg(ctx, g, now);
      drawGround(ctx, g);
      g.coins.forEach((c)     => drawCoin(ctx, c, now));
      g.obstacles.forEach((o) => o.kind === "candle" ? drawCandle(ctx, o, now) : drawBalloon(ctx, o, now));
      drawCake(ctx, g.cake, now);
      drawPlayer(ctx, g.player);
      drawProgress(ctx, g);
      rafRef.current = requestAnimationFrame(loop);
    }

    rafRef.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(rafRef.current);
  }, []);

  // ── Render ────────────────────────────────────────────────────────────────
  if (screen === "win") {
    return (
      <div className="bday-screen">
        <h1 className="bday-title">HAPPY<br />BIRTHDAY <br />Babyyy!! </h1>
        <div className="big-cake">
          <img src={cakeImg} alt="Cake" />
        </div>
        <p className="bday-sub">
          You jumped over every<br />balloon &amp; candle! 
        </p>
         <div className="crow">
          <img src={bowImg} alt="bow" />
          </div> 
        <button className="open-btn" onClick={() => setShowLetter(true)}>
          Open Your Letter.
        </button>
        {/* <div className="crow">✨⭐💫🌟✨</div> */}

        {showLetter && (
          <div
            className="letter-overlay"
            onClick={(e) =>
              e.target.classList.contains("letter-overlay") && setShowLetter(false)
            }
          >
            <div className="letter-paper">
              <button className="close-btn" onClick={() => setShowLetter(false)}>✕</button>
              <div className="letter-head">~ A Special Letter ~</div>
              <div className="letter-body">
  Dear Bubbu,
  <br /><br />

  Happy Birthday muuuhhhh!  
  I love you so much. I truly hope this year brings you happiness,
  success, and makes all your dreams come true.

  <br /><br />

  You are someone very special, and you deserve all the good
  things life has to offer. I hope today is filled with laughter,
  smiles, and little moments that make you really happy.

  <br /><br />

  I want to always be on your side supporting you,
  celebrating your wins, and standing with you through
  everything life brings.

  <br /><br />

  Your special day will always be on my list to celebrate,
  because someone as amazing as you deserves to feel
  appreciated and loved.

  <br /><br />

  Keep believing in yourself, keep chasing your dreams,
  and never forget how capable and wonderful you are.

  <br /><br />

  Once again, Happy Birthday Bubbu!  
  I hope this year becomes one of the happiest chapters
  of your life. 
</div>
              <div className="letter-sig">— Your babiee</div>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="game-root">
      <div className="game-wrap">
        <canvas
          ref={canvasRef}
          width={CW}
          height={CH}
          className="game-canvas"
          onClick={handleJump}
          onTouchStart={(e) => { e.preventDefault(); handleJump(); }}
        />

        {/* HUD */}
        <div className="hud">
          <span>COINS: {hudCoins}/{CAKE_SCORE}</span>
          <span>SCORE: {hudScore}</span>
        </div>

        {/* Idle / start screen */}
        {screen === "idle" && (
          <div className="start-msg">
            <h2>BIRTHDAY QUEST!</h2>
            <p>TAP or PRESS SPACE<br />to start &amp; jump!</p>
          </div>
        )}

        {/* Death screen */}
        {screen === "dead" && (
          <div className="death-msg">
            <h2>{deathTitle}</h2>
            <p>
              {deathSub.split("\n").map((line, i) => (
                <span key={i}>{line}<br /></span>
              ))}
            </p>
          </div>
        )}
      </div>

      {/* Jump button */}
      <div className="controls">
        <button
          className="jump-btn"
          onTouchStart={(e) => { e.preventDefault(); handleJump(); }}
          onMouseDown={handleJump}
        >
          ▲ TAP TO JUMP
        </button>
      </div>
    </div>
  );
}
