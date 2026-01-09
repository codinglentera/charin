// Simple pixelated Mario-like platformer
// Renders to a low-res buffer then scales up with nearest-neighbor for chunky pixels.
// Controls: Left/Right arrows or A/D to move, Up or W or Space to jump
(() => {
  // Display (actual canvas) size in pixels
  const DISPLAY_W = 900;
  const DISPLAY_H = 500;

  // Pixel scale (how many display pixels per game pixel).
  // Choose a divisor so BUFFER_W and BUFFER_H are integers.
  const SCALE = 5;

  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d');
  canvas.width = DISPLAY_W;
  canvas.height = DISPLAY_H;

  // Low-res buffer (virtual resolution)
  const BW = DISPLAY_W / SCALE; // e.g., 180
  const BH = DISPLAY_H / SCALE; // e.g., 100
  const buffer = document.createElement('canvas');
  buffer.width = BW;
  buffer.height = BH;
  const bctx = buffer.getContext('2d');

  const W = BW, H = BH; // virtual game width/height

  // Physics constants (scaled to virtual coords)
  const gravity = 0.9 / SCALE;
  const friction = 0.9;
  const keys = {};

  // Player (virtual coordinates)
  const player = {
    x: 48 / SCALE, y: (H * SCALE - 140) / SCALE, // start vertically same place as before but scaled
    w: Math.round(34 / SCALE), h: Math.round(40 / SCALE),
    vx: 0, vy: 0,
    speed: 3.8 / SCALE,
    jumpPower: 16 / SCALE,
    onGround: false,
    lives: 3
  };
  const startPos = { x: player.x, y: player.y };

  // Original level geometry (in display coords) - will be scaled down programmatically
  const rawPlatforms = [
    {x: 0, y: 500 - 24, w: 900, h: 24}, // ground
    {x: 120, y: 380, w: 160, h: 18},
    {x: 340, y: 320, w: 120, h: 18},
    {x: 520, y: 260, w: 120, h: 18},
    {x: 700, y: 340, w: 160, h: 18},
    {x: 420, y: 440, w: 120, h: 18}
  ];

  let rawCoins = [
    {x: 160, y: 340, r: 8},
    {x: 380, y: 280, r: 8},
    {x: 560, y: 220, r: 8},
    {x: 740, y: 300, r: 8},
    {x: 460, y: 400, r: 8}
  ];

  let rawEnemies = [
    {x: 260, y: 356, w: 30, h: 24, vx: 1.2, left: 120, right: 280},
    {x: 620, y: 316, w: 30, h: 24, vx: 0.9, left: 520, right: 660}
  ];

  // Scale helper: convert raw arrays (display coords) to virtual coords
  function scalePlatforms(list) {
    return list.map(p => ({
      x: p.x / SCALE,
      y: p.y / SCALE,
      w: p.w / SCALE,
      h: p.h / SCALE
    }));
  }
  function scaleCoins(list) {
    return list.map(c => ({
      x: c.x / SCALE,
      y: c.y / SCALE,
      r: c.r / SCALE
    }));
  }
  function scaleEnemies(list) {
    return list.map(e => ({
      x: e.x / SCALE,
      y: e.y / SCALE,
      w: e.w / SCALE,
      h: e.h / SCALE,
      vx: e.vx / SCALE,
      left: e.left / SCALE,
      right: e.right / SCALE
    }));
  }

  const platforms = scalePlatforms(rawPlatforms);
  let coins = scaleCoins(rawCoins);
  let enemies = scaleEnemies(rawEnemies);

  let score = 0;
  let gameOver = false;
  let win = false;

  // Input
  window.addEventListener('keydown', e => {
    keys[e.key.toLowerCase()] = true;
    if ([" ", "arrowup", "w"].includes(e.key.toLowerCase())) e.preventDefault();
  });
  window.addEventListener('keyup', e => { keys[e.key.toLowerCase()] = false; });

  function rectsOverlap(a, b) {
    return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
  }

  function circleRectOverlap(c, r) {
    const closestX = Math.max(r.x, Math.min(c.x, r.x + r.w));
    const closestY = Math.max(r.y, Math.min(c.y, r.y + r.h));
    const dx = c.x - closestX;
    const dy = c.y - closestY;
    return (dx * dx + dy * dy) <= (c.r * c.r);
  }

  function resetPlayer(dead = false) {
    player.x = startPos.x;
    player.y = startPos.y;
    player.vx = player.vy = 0;
    player.onGround = false;
    if (dead) {
      player.lives--;
      if (player.lives <= 0) {
        gameOver = true;
      }
    }
  }

  function update() {
    if (gameOver || win) return;

    // input
    let left = keys['arrowleft'] || keys['a'];
    let right = keys['arrowright'] || keys['d'];
    let jump = keys['arrowup'] || keys['w'] || keys[' '];

    if (left) player.vx = Math.max(player.vx - 0.6 / SCALE, -player.speed);
    if (right) player.vx = Math.min(player.vx + 0.6 / SCALE, player.speed);
    if (!left && !right) player.vx *= friction;

    // Jump
    if (jump && player.onGround) {
      player.vy = -player.jumpPower;
      player.onGround = false;
    }

    // gravity
    player.vy += gravity;
    const maxVy = 24 / SCALE;
    if (player.vy > maxVy) player.vy = maxVy;

    // Move & collisions (axis separation)
    // Horizontal
    player.x += player.vx;
    for (const p of platforms) {
      if (rectsOverlap(player, p)) {
        const dx = (player.x + player.w/2) - (p.x + p.w/2);
        const overlapX = (player.w + p.w)/2 - Math.abs(dx);
        const dy = (player.y + player.h/2) - (p.y + p.h/2);
        const overlapY = (player.h + p.h)/2 - Math.abs(dy);
        if (overlapX < overlapY) {
          if (dx > 0) player.x += overlapX; else player.x -= overlapX;
          player.vx = 0;
        }
      }
    }

    // Vertical
    player.y += player.vy;
    player.onGround = false;
    for (const p of platforms) {
      if (rectsOverlap(player, p)) {
        const dx = (player.x + player.w/2) - (p.x + p.w/2);
        const overlapX = (player.w + p.w)/2 - Math.abs(dx);
        const dy = (player.y + player.h/2) - (p.y + p.h/2);
        const overlapY = (player.h + p.h)/2 - Math.abs(dy);
        if (overlapY <= overlapX) {
          if (dy > 0) {
            player.y += overlapY;
            player.vy = 0;
          } else {
            player.y -= overlapY;
            player.vy = 0;
            player.onGround = true;
          }
        }
      }
    }

    // Keep in bounds horizontally
    if (player.x < 0) player.x = 0;
    if (player.x + player.w > W) player.x = W - player.w;

    // Coins collection
    coins = coins.filter(c => {
      const coinRect = {x: c.x - c.r, y: c.y - c.r, w: c.r*2, h: c.r*2};
      if (rectsOverlap(player, coinRect)) {
        score++;
        return false;
      }
      return true;
    });

    // Update enemies
    for (let i = enemies.length - 1; i >= 0; i--) {
      const e = enemies[i];
      e.x += e.vx;
      if (e.x < e.left || e.x + e.w > e.right) e.vx *= -1;

      if (rectsOverlap(player, e)) {
        const landing = (player.vy > 0) && (player.y + player.h - e.y < 2 * (1 / SCALE) + 2);
        if (landing) {
          enemies.splice(i, 1);
          player.vy = -10 / SCALE;
          score += 2;
        } else {
          resetPlayer(true);
        }
      }
    }

    // Win condition: collect all coins
    if (coins.length === 0) {
      win = true;
    }
  }

  function draw() {
    // Draw to buffer (virtual resolution)
    bctx.clearRect(0,0,W,H);

    // background (simple two-tone)
    const skyGrad = bctx.createLinearGradient(0, 0, 0, H);
    skyGrad.addColorStop(0, '#87ceeb');
    skyGrad.addColorStop(1, '#b0e0e6');
    bctx.fillStyle = skyGrad;
    bctx.fillRect(0, 0, W, H);

    // ground tint
    bctx.fillStyle = '#4ca64a';
    bctx.fillRect(0, Math.floor(H*0.6), W, Math.floor(H*0.4));

    // platforms
    for (const p of platforms) {
      bctx.fillStyle = '#8B5A2B';
      bctx.fillRect(Math.floor(p.x), Math.floor(p.y), Math.ceil(p.w), Math.ceil(p.h));
      bctx.fillStyle = '#c28b5a';
      bctx.fillRect(Math.floor(p.x), Math.floor(p.y), Math.ceil(p.w), Math.max(1, Math.floor(6 / SCALE)));
    }

    // coins
    for (const c of coins) {
      bctx.beginPath();
      bctx.fillStyle = '#ffd700';
      bctx.arc(c.x, c.y, Math.max(1, c.r), 0, Math.PI*2);
      bctx.fill();
      bctx.strokeStyle = '#b8860b';
      bctx.stroke();
    }

    // enemies
    for (const e of enemies) {
      bctx.fillStyle = '#a0522d';
      bctx.fillRect(Math.floor(e.x), Math.floor(e.y), Math.ceil(e.w), Math.ceil(e.h));
      bctx.fillStyle = '#3b2f2f';
      bctx.fillRect(Math.floor(e.x)+1, Math.floor(e.y)+1, Math.max(1, Math.floor(2 / SCALE)), Math.max(1, Math.floor(2 / SCALE)));
    }

    // player (pixel-art-ish)
    bctx.save();
    bctx.translate(Math.floor(player.x), Math.floor(player.y));
    bctx.fillStyle = '#d22';
    bctx.fillRect(0, 0, Math.max(1, player.w), Math.max(1, player.h));
    bctx.fillStyle = '#900';
    bctx.fillRect(0, -Math.max(1, Math.floor(6 / SCALE)), Math.max(1, player.w), Math.max(1, Math.floor(8 / SCALE)));
    // simple eyes
    bctx.fillStyle = '#fff';
    bctx.fillRect(Math.floor(2 / SCALE)+2, Math.floor(4 / SCALE)+2, 1, 1);
    bctx.fillRect(Math.floor(12 / SCALE)+2, Math.floor(4 / SCALE)+2, 1, 1);
    bctx.fillStyle = '#000';
    bctx.fillRect(Math.floor(3 / SCALE)+2, Math.floor(5 / SCALE)+2, 1, 1);
    bctx.restore();

    // HUD (draw on buffer so it's pixelated)
    bctx.fillStyle = 'rgba(0,0,0,0.6)';
    bctx.fillRect(1, 1, Math.min(40, W-2), Math.min(6, H-2));
    bctx.fillStyle = '#fff';
    bctx.font = `${Math.max(4, Math.floor(8 / SCALE * SCALE))}px monospace`; // make readable in buffer
    bctx.fillText(`S:${score}`, 2, 5);
    bctx.fillText(`L:${player.lives}`, 18, 5);

    // game over / win overlays (in buffer coords)
    if (gameOver) {
      bctx.fillStyle = 'rgba(0,0,0,0.7)';
      bctx.fillRect(0, 0, W, H);
      bctx.fillStyle = '#fff';
      bctx.font = `${Math.max(8, Math.floor(24 / SCALE * SCALE))}px monospace`;
      bctx.textAlign = 'center';
      bctx.fillText('Game Over', W/2, H/2 - 2);
      bctx.font = `${Math.max(4, Math.floor(8 / SCALE * SCALE))}px monospace`;
      bctx.fillText('Refresh to try again', W/2, H/2 + 6);
    }

    if (win) {
      bctx.fillStyle = 'rgba(255,255,255,0.95)';
      bctx.fillRect(0, 0, W, H);
      bctx.fillStyle = '#153f06';
      bctx.font = `${Math.max(10, Math.floor(28 / SCALE * SCALE))}px monospace`;
      bctx.textAlign = 'center';
      bctx.fillText('You Win!', W/2, H/2 - 2);
      bctx.font = `${Math.max(6, Math.floor(12 / SCALE * SCALE))}px monospace`;
      bctx.fillText(`Score: ${score}`, W/2, H/2 + 6);
    }

    // Draw buffer scaled up to visible canvas with nearest-neighbor (no smoothing)
    ctx.imageSmoothingEnabled = false;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(buffer, 0, 0, canvas.width, canvas.height);
  }

  function loop() {
    update();
    draw();
    requestAnimationFrame(loop);
  }

  // Start
  loop();
})();
