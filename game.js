(() => {
  const WIDTH = 1200;
  const HEIGHT = 800;
  const STORAGE_KEY = 'bachHighScore';
  const DEBUG = new URLSearchParams(window.location.search).has('debug');

  const dom = {
    menu: document.getElementById('menu-overlay'),
    gameOver: document.getElementById('gameover-overlay'),
    start: document.getElementById('start-button'),
    restart: document.getElementById('restart-button'),
    pause: document.getElementById('pause-button'),
    mute: document.getElementById('mute-button'),
    fullscreen: document.getElementById('fullscreen-button'),
    menuHighScore: document.getElementById('menu-high-score'),
    finalScore: document.getElementById('final-score'),
    finalWave: document.getElementById('final-wave'),
    finalHighScore: document.getElementById('final-high-score'),
    music: document.getElementById('bgmusic'),
    touchZone: document.getElementById('touch-zone'),
    touchKnob: document.getElementById('touch-knob'),
    touchFire: document.getElementById('touch-fire'),
    shell: document.getElementById('game-shell'),
    orientationStart: document.getElementById('orientation-start-button')
  };

  const state = {
    phase: 'menu',
    score: 0,
    lives: 3,
    wave: 1,
    combo: 0,
    highScore: Number(localStorage.getItem(STORAGE_KEY)) || 0,
    muted: false,
    lastFired: 0,
    invulnerableUntil: 0,
    rapidUntil: 0,
    spreadUntil: 0,
    shieldUntil: 0,
    nextEnemyAt: 0,
    nextItemAt: 0,
    nextBannerAt: 0,
    levelIndex: 0,
    bossWave: 0,
    pendingStart: false,
    tutorialSeen: new Set()
  };

  const input = {
    touchMove: { x: 0, y: 0 },
    touchFire: false
  };

  const mobileQuery = window.matchMedia('(pointer: coarse), (max-width: 760px), (max-height: 520px)');
  let sceneRef;
  let player;
  let cursors;
  let keys;
  let groups = {};
  let ui = {};
  let game;

  const enemyTypes = {
    counterpoint: { hp: 1, speed: 240, score: 25, size: 76, tint: 0xffffff, wobble: 0 },
    allegro: { hp: 1, speed: 365, score: 40, size: 58, tint: 0xffd28a, wobble: 0 },
    forte: { hp: 3, speed: 170, score: 90, size: 104, tint: 0xf07167, wobble: 0 },
    canon: { hp: 2, speed: 230, score: 70, size: 82, tint: 0x7fd8be, wobble: 58 }
  };

  const itemTypes = [
    {
      key: 'tercera',
      label: '+40',
      positive: true,
      tutorial: 'consonance',
      score: 40,
      message: 'Tercera: combo +1'
    },
    {
      key: 'sexta',
      label: '+75',
      positive: true,
      tutorial: 'consonance',
      score: 75,
      message: 'Sexta: escudo breve',
      apply(scene) {
        state.shieldUntil = scene.time.now + 5200;
      }
    },
    {
      key: 'cuarta',
      label: 'SPREAD',
      positive: true,
      tutorial: 'tritone',
      score: 20,
      message: 'Cuarta aumentada: disparo triple',
      banner: ['¡Disparo de Tritono!', 'Disparo triple activado por unos segundos.'],
      apply(scene) {
        state.spreadUntil = scene.time.now + 8200;
      }
    },
    {
      key: 'clefC',
      label: '+VIDA',
      positive: true,
      tutorial: 'clef',
      life: 1,
      message: 'Clave de do: +1 vida'
    },
    {
      key: 'quintas',
      label: '-50',
      positive: false,
      tutorial: 'parallels',
      score: -50,
      damage: 1,
      message: 'Quintas paralelas: -1 vida'
    },
    {
      key: 'octavas',
      label: '-80',
      positive: false,
      tutorial: 'parallels',
      score: -80,
      damage: 1,
      message: 'Octavas directas: -1 vida'
    }
  ];

  const levels = [
    {
      key: 'level1',
      name: 'Aula de contrapunto',
      subtitle: 'Calienta el pulso y busca consonancias.',
      image: 'assets/levels/level-1-aula.png',
      tint: 0x8f6b3f,
      flash: 0xe8c872,
      enemyDelay: 1,
      itemDelay: 1,
      speedBonus: 0,
      enemyBag: ['counterpoint', 'counterpoint', 'counterpoint', 'allegro']
    },
    {
      key: 'level2',
      name: 'Iglesia de Arnstadt',
      subtitle: 'El organo sube la presion.',
      image: 'assets/levels/level-2-arnstadt.png',
      tint: 0x334d7a,
      flash: 0x8ef6ff,
      enemyDelay: 0.94,
      itemDelay: 0.98,
      speedBonus: 14,
      enemyBag: ['counterpoint', 'counterpoint', 'allegro', 'canon', 'canon']
    },
    {
      key: 'level3',
      name: 'Corte de Weimar',
      subtitle: 'Mas voces, mas vigilancia.',
      image: 'assets/levels/level-3-weimar.png',
      tint: 0x7c2d3b,
      flash: 0xffd28a,
      enemyDelay: 0.88,
      itemDelay: 0.95,
      speedBonus: 26,
      enemyBag: ['counterpoint', 'allegro', 'canon', 'canon', 'forte']
    },
    {
      key: 'level4',
      name: 'Sala de la fuga',
      subtitle: 'Las entradas se cierran y los fuertes pesan.',
      image: 'assets/levels/level-5-fuga.png',
      tint: 0x2a174c,
      flash: 0xb991ff,
      enemyDelay: 0.8,
      itemDelay: 0.92,
      speedBonus: 38,
      enemyBag: ['allegro', 'allegro', 'counterpoint', 'canon', 'forte', 'forte']
    },
    {
      key: 'level5',
      name: 'Leipzig nocturna',
      subtitle: 'Final nocturno: sobrevive la ultima fuga.',
      image: 'assets/levels/level-4-leipzig.png',
      tint: 0x1c3f63,
      flash: 0x6fffe9,
      enemyDelay: 0.72,
      itemDelay: 0.88,
      speedBonus: 52,
      enemyBag: ['allegro', 'allegro', 'canon', 'canon', 'forte', 'forte', 'forte']
    }
  ];

  function show(element) {
    element.classList.add('is-visible');
  }

  function hide(element) {
    element.classList.remove('is-visible');
  }

  function updateDomScores() {
    dom.menuHighScore.textContent = String(state.highScore);
    dom.finalScore.textContent = String(state.score);
    dom.finalWave.textContent = String(state.wave);
    dom.finalHighScore.textContent = String(state.highScore);
  }

  function unlockMusic() {
    if (!dom.music || state.muted) return;
    dom.music.volume = 0.34;
    dom.music.muted = false;
    const playPromise = dom.music.play();
    if (playPromise && typeof playPromise.catch === 'function') {
      playPromise.catch(() => {});
    }
  }

  function pauseMusic() {
    if (dom.music) dom.music.pause();
  }

  function syncMute() {
    if (dom.music) dom.music.muted = state.muted;
    if (sceneRef && sceneRef.sound) sceneRef.sound.mute = state.muted;
    dom.mute.textContent = state.muted ? '×' : '♪';
  }

  function setPhase(phase) {
    state.phase = phase;
    dom.pause.textContent = phase === 'paused' ? '▶' : 'Ⅱ';
  }

  function startGame() {
    state.pendingStart = true;
    unlockMusic();

    if (!sceneRef || !player) return;

    hide(dom.menu);
    hide(dom.gameOver);

    state.score = 0;
    state.lives = 3;
    state.wave = 1;
    state.combo = 0;
    state.lastFired = 0;
    state.invulnerableUntil = 0;
    state.rapidUntil = 0;
    state.spreadUntil = 0;
    state.shieldUntil = 0;
    state.nextEnemyAt = sceneRef.time.now + 700;
    state.nextItemAt = sceneRef.time.now + 2400;
    state.nextBannerAt = 0;
    state.levelIndex = 0;
    state.bossWave = 0;
    state.pendingStart = false;
    state.tutorialSeen.clear();

    clearGroup(groups.bullets);
    clearGroup(groups.enemies);
    clearGroup(groups.items);
    clearGroup(groups.effects);

    player.enableBody(true, 118, HEIGHT / 2, true, true);
    player.setVelocity(0, 0);
    player.setAlpha(1);
    player.setTint(0xffffff);
    player.setFlipX(false);

    setPhase('playing');
    applyLevel(sceneRef, 0, false);
    updateHud();
    showBanner(sceneRef, 'Oleada 1', `${levels[0].name}: sobrevive y encadena intervalos consonantes`);
    sceneRef.physics.resume();
    unlockMusic();
    refreshViewportMode();
    resizeGame();
  }

  function endGame(scene) {
    setPhase('gameover');
    pauseMusic();
    scene.physics.pause();
    updateHighScore();
    updateDomScores();
    show(dom.gameOver);
  }

  function togglePause() {
    if (!sceneRef || state.phase === 'menu' || state.phase === 'gameover') return;

    if (state.phase === 'paused') {
      setPhase('playing');
      hide(dom.menu);
      sceneRef.physics.resume();
      unlockMusic();
      showBanner(sceneRef, 'Continua', 'La fuga sigue');
      return;
    }

    setPhase('paused');
    show(dom.menu);
    sceneRef.physics.pause();
    pauseMusic();
  }

  function clearGroup(group) {
    if (!group) return;
    group.children.each((child) => child.destroy());
    group.clear(true, true);
  }

  function updateHighScore() {
    if (state.score > state.highScore) {
      state.highScore = state.score;
      localStorage.setItem(STORAGE_KEY, String(state.highScore));
    }
    updateDomScores();
  }

  function safeSound(scene, key, volume = 0.7) {
    if (state.muted || !scene.sound) return;
    const sound = scene.sound.get(key) || scene.sound.add(key);
    sound.play({ volume });
  }

  function makeTexture(scene, key, drawer, width, height) {
    const graphics = scene.add.graphics();
    drawer(graphics);
    graphics.generateTexture(key, width, height);
    graphics.destroy();
  }

  function setHitboxFromDisplay(sprite, widthFactor, heightFactor) {
    if (!sprite.body) return;

    const scaleX = Math.abs(sprite.scaleX) || 1;
    const scaleY = Math.abs(sprite.scaleY) || 1;
    const bodyWidth = (sprite.displayWidth / scaleX) * widthFactor;
    const bodyHeight = (sprite.displayHeight / scaleY) * heightFactor;
    sprite.body.setSize(bodyWidth, bodyHeight, true);
  }

  function currentLevel() {
    return levels[state.levelIndex] || levels[0];
  }

  function levelIndexForWave(wave) {
    return Phaser.Math.Clamp(Math.floor((wave - 1) / 6), 0, levels.length - 1);
  }

  function applyLevel(scene, levelIndex, announce = true) {
    const level = levels[levelIndex] || levels[0];
    state.levelIndex = levelIndex;

    if (ui.levelBackground) {
      ui.levelBackground.setTexture(level.key).setDisplaySize(WIDTH, HEIGHT).setAlpha(0);
      scene.tweens.add({
        targets: ui.levelBackground,
        alpha: 0.84,
        duration: announce ? 620 : 0,
        ease: 'Quad.easeOut'
      });
    }

    if (ui.levelWash) {
      ui.levelWash.setFillStyle(level.tint, 0.18);
    }

    if (!announce) return false;
    flash(scene, level.flash, 0.22);
    scene.cameras.main.shake(160, 0.004);
    showBanner(scene, `Nivel ${levelIndex + 1}: ${level.name}`, level.subtitle, { large: true });
    return true;
  }

  function updateLevel(scene) {
    const nextLevelIndex = levelIndexForWave(state.wave);
    if (nextLevelIndex === state.levelIndex) return false;
    return applyLevel(scene, nextLevelIndex, true);
  }

  function preload() {
    this.load.image('background', 'assets/fondo.png');
    levels.forEach((level) => this.load.image(level.key, level.image));
    this.load.image('cover', 'assets/cover.png');
    this.load.image('bach', 'assets/bach.png');
    this.load.image('zombie', 'assets/zombie.png');
    this.load.image('dead_zombie', 'assets/dead_zombie.png');
    this.load.image('clefC', 'assets/clefC.png');
    this.load.image('cuarta', 'assets/cuarta_au.png');
    this.load.image('octavas', 'assets/octavas.png');
    this.load.image('quintas', 'assets/quintas.png');
    this.load.image('sexta', 'assets/sexta.png');
    this.load.image('tercera', 'assets/tercera.png');
    this.load.audio('laser', 'assets/laser_gun.mp3');
    this.load.audio('zombie_down', 'assets/zombie_down.mp3');
    this.load.audio('zombie_escaped', 'assets/zombie_escaped.mp3');
    this.load.audio('item_collected', 'assets/item_collected.mp3');
    this.load.audio('life_collected', 'assets/life_collected.mp3');
  }

  function create() {
    sceneRef = this;
    syncMute();

    makeTexture(this, 'bullet', (g) => {
      g.fillStyle(0xf3e37c, 1).fillRoundedRect(0, 0, 34, 8, 4);
      g.fillStyle(0x6fffe9, 0.6).fillRoundedRect(24, 2, 18, 4, 2);
    }, 44, 8);

    makeTexture(this, 'spark', (g) => {
      g.fillStyle(0xf3e37c, 1).fillCircle(12, 12, 12);
      g.fillStyle(0xffffff, 0.8).fillCircle(8, 8, 4);
    }, 24, 24);

    makeTexture(this, 'noteParticle', (g) => {
      g.fillStyle(0xf6f0df, 1).fillEllipse(8, 15, 12, 9);
      g.fillRect(13, 3, 3, 16);
      g.fillStyle(0xe8c872, 0.8).fillCircle(14, 4, 4);
    }, 22, 22);

    createWorld(this);
    createPlayer(this);
    createGroups(this);
    createInput(this);
    createHud(this);
    createCollisions(this);

    this.physics.pause();
    updateDomScores();
    updateHud();

    if (state.pendingStart) startGame();
    exposeDebugApi();
  }

  function createWorld(scene) {
    scene.cameras.main.setBackgroundColor('#101318');
    scene.add.image(WIDTH / 2, HEIGHT / 2, 'background')
      .setDisplaySize(WIDTH, HEIGHT)
      .setAlpha(0.18)
      .setDepth(-30);

    ui.levelBackground = scene.add.image(WIDTH / 2, HEIGHT / 2, levels[0].key)
      .setDisplaySize(WIDTH, HEIGHT)
      .setAlpha(0.84)
      .setDepth(-28);
    ui.levelWash = scene.add.rectangle(WIDTH / 2, HEIGHT / 2, WIDTH, HEIGHT, levels[0].tint, 0.18)
      .setDepth(-27);

    const backdrop = scene.add.graphics().setDepth(-26);
    backdrop.fillStyle(0x111318, 0.14).fillRect(0, 0, WIDTH, HEIGHT);
    backdrop.fillGradientStyle(0x000000, 0x000000, 0x111318, 0x111318, 0.24, 0.06, 0.01, 0.12)
      .fillRect(0, 0, WIDTH, HEIGHT);
    backdrop.fillStyle(0x000000, 0.28).fillRect(0, 0, WIDTH, 116);
    backdrop.fillStyle(0x000000, 0.2).fillRect(0, HEIGHT - 80, WIDTH, 80);
    scene.tweens.add({
      targets: backdrop,
      alpha: 0.92,
      yoyo: true,
      repeat: -1,
      duration: 3800,
      ease: 'Sine.easeInOut'
    });

    scene.add.text(WIDTH - 28, HEIGHT - 34, 'B / espacio: disparar   P: pausa   M: audio', {
      fontFamily: 'monospace',
      fontSize: '18px',
      color: '#e7dfc9'
    }).setOrigin(1, 0.5).setAlpha(0.72).setDepth(4);
  }

  function createPlayer(scene) {
    const img = scene.textures.get('bach').getSourceImage();
    const ratio = img.width / img.height;
    player = scene.physics.add.image(118, HEIGHT / 2, 'bach')
      .setDisplaySize(98 * ratio, 98)
      .setOrigin(0.5)
      .setDepth(6)
      .setCollideWorldBounds(true);
    setHitboxFromDisplay(player, 0.62, 0.78);
  }

  function createGroups(scene) {
    groups = {
      bullets: scene.physics.add.group({ maxSize: 80 }),
      enemies: scene.physics.add.group({ maxSize: 80 }),
      items: scene.physics.add.group({ maxSize: 20 }),
      effects: scene.add.group()
    };
  }

  function createInput(scene) {
    cursors = scene.input.keyboard.createCursorKeys();
    keys = scene.input.keyboard.addKeys({
      up: Phaser.Input.Keyboard.KeyCodes.W,
      down: Phaser.Input.Keyboard.KeyCodes.S,
      left: Phaser.Input.Keyboard.KeyCodes.A,
      right: Phaser.Input.Keyboard.KeyCodes.D,
      fire: Phaser.Input.Keyboard.KeyCodes.B,
      space: Phaser.Input.Keyboard.KeyCodes.SPACE,
      pause: Phaser.Input.Keyboard.KeyCodes.P,
      mute: Phaser.Input.Keyboard.KeyCodes.M
    });

    scene.input.keyboard.on('keydown-P', togglePause);
    scene.input.keyboard.on('keydown-M', () => {
      state.muted = !state.muted;
      syncMute();
    });
  }

  function createHud(scene) {
    ui.panel = scene.add.graphics().setDepth(20);
    ui.worldFx = scene.add.graphics().setDepth(9);
    ui.playerFx = scene.add.graphics().setDepth(8);
    ui.aimFx = scene.add.graphics().setDepth(4);
    ui.score = scene.add.text(26, 18, '', hudTextStyle(34, '#f6f0df')).setDepth(21);
    ui.lives = scene.add.text(26, 62, '', hudTextStyle(26, '#ff9188')).setDepth(21);
    ui.wave = scene.add.text(WIDTH / 2, 30, '', hudTextStyle(30, '#e8c872')).setOrigin(0.5, 0).setDepth(21);
    ui.combo = scene.add.text(WIDTH / 2, 68, '', hudTextStyle(20, '#c7f9cc')).setOrigin(0.5, 0).setDepth(21);
    ui.level = scene.add.text(WIDTH / 2, 92, '', hudTextStyle(15, '#f6f0df')).setOrigin(0.5, 0).setDepth(21);
    ui.power = scene.add.text(WIDTH - 26, 24, '', hudTextStyle(22, '#6fffe9')).setOrigin(1, 0).setDepth(21);
    ui.bannerTitle = scene.add.text(WIDTH / 2, 315, '', hudTextStyle(56, '#f6f0df')).setOrigin(0.5).setDepth(30).setAlpha(0);
    ui.bannerSub = scene.add.text(WIDTH / 2, 374, '', hudTextStyle(24, '#e8c872')).setOrigin(0.5).setDepth(30).setAlpha(0);
  }

  function hudTextStyle(size, color) {
    return {
      fontFamily: 'monospace',
      fontSize: `${size}px`,
      color,
      stroke: '#0b0d10',
      strokeThickness: 5
    };
  }

  function createCollisions(scene) {
    scene.physics.add.overlap(groups.bullets, groups.enemies, hitEnemy, null, scene);
    scene.physics.add.overlap(player, groups.enemies, hitPlayer, null, scene);
    scene.physics.add.overlap(player, groups.items, collectItem, null, scene);
  }

  function update(time, delta) {
    if (state.phase !== 'playing') return;

    movePlayer(time);
    updatePlayerEffects(time);
    fireIfNeeded(this, time);
    spawnLoop(this, time);
    updateEnemies(time, delta);
    cleanupObjects();
    updateWave(this);
    updateHud(time);
  }

  function movePlayer(time) {
    const left = cursors.left.isDown || keys.left.isDown;
    const right = cursors.right.isDown || keys.right.isDown;
    const up = cursors.up.isDown || keys.up.isDown;
    const down = cursors.down.isDown || keys.down.isDown;
    const x = (right ? 1 : 0) - (left ? 1 : 0) + input.touchMove.x;
    const y = (down ? 1 : 0) - (up ? 1 : 0) + input.touchMove.y;
    const length = Math.hypot(x, y) || 1;
    const speed = state.shieldUntil > time ? 650 : 575;

    player.setVelocity((x / length) * speed, (y / length) * speed);

    if (Math.abs(x) > 0.08) {
      player.setFlipX(x < 0);
    }

    const shielded = state.shieldUntil > time;
    if (time < state.invulnerableUntil) {
      player.setAlpha(0.55 + Math.sin(time / 55) * 0.28);
    } else {
      player.setAlpha(1);
    }
    player.setTint(shielded ? 0x8ef6ff : 0xffffff);
  }

  function fireIfNeeded(scene, time, force = false) {
    const firePressed = keys.fire.isDown || keys.space.isDown || input.touchFire;
    if (!firePressed && !force) return;

    const rapid = state.rapidUntil > time;
    const fireRate = rapid ? 85 : 145;
    if (time < state.lastFired + fireRate) return;

    const dir = player.flipX ? -1 : 1;
    const spread = state.spreadUntil > time;
    const offsets = spread ? [-18, 0, 18] : [0];

    offsets.forEach((offset) => {
      const bullet = groups.bullets.get(player.x + dir * 52, player.y + offset, 'bullet');
      if (!bullet) return;
      bullet.enableBody(true, player.x + dir * 52, player.y + offset, true, true);
      bullet.setDepth(5);
      bullet.setDisplaySize(44, 8);
      bullet.body.setSize(44, 14, true);
      bullet.setVelocity(1240 * dir, offset * 8);
      bullet.setData('damage', spread ? 1 : 1);
      bullet.setData('birth', time);
      bullet.body.allowGravity = false;
      bullet.setFlipX(dir < 0);
      bullet.setTint(spread ? 0x6fffe9 : 0xf3e37c);
    });

    state.lastFired = time;
    safeSound(scene, 'laser', 0.3);
    muzzleFlash(scene, player.x + dir * 58, player.y, dir, spread);
  }

  function spawnLoop(scene, time) {
    const level = currentLevel();
    const enemyDelay = Math.max(300, (1220 - state.wave * 78) * level.enemyDelay);
    const itemDelay = Math.max(1850, (5600 - state.wave * 160) * level.itemDelay);

    if (time >= state.nextEnemyAt) {
      spawnEnemy(scene, chooseEnemyType());
      state.nextEnemyAt = time + Phaser.Math.Between(enemyDelay * 0.7, enemyDelay * 1.25);
    }

    if (time >= state.nextItemAt) {
      spawnItem(scene);
      state.nextItemAt = time + Phaser.Math.Between(itemDelay * 0.72, itemDelay * 1.25);
    }

    if (state.wave % 5 === 0 && state.bossWave !== state.wave) {
      state.bossWave = state.wave;
      spawnEnemy(scene, 'boss');
      showBanner(scene, `Oleada ${state.wave}`, 'Zombie Mozart entra con partitura pesada');
    }
  }

  function chooseEnemyType() {
    const bag = [...currentLevel().enemyBag];
    if (state.wave >= 7) bag.push('allegro', 'canon');
    if (state.wave >= 9) bag.push('forte');
    return Phaser.Math.RND.pick(bag);
  }

  function spawnEnemy(scene, typeKey) {
    const boss = typeKey === 'boss';
    const type = boss
      ? { hp: 8 + state.wave * 2, speed: 105 + state.wave * 5, score: 450 + state.wave * 35, size: 154, tint: 0xe8c872, wobble: 24 }
      : enemyTypes[typeKey];
    const fromLeft = Math.random() < 0.5;
    const x = fromLeft ? -120 : WIDTH + 120;
    const y = Phaser.Math.Between(134, HEIGHT - 128);
    const velocity = (fromLeft ? 1 : -1) * (type.speed + currentLevel().speedBonus + Phaser.Math.Between(0, state.wave * 12));
    const enemy = groups.enemies.get(x, y, 'zombie');
    if (!enemy) return;

    const img = scene.textures.get('zombie').getSourceImage();
    const ratio = img.width / img.height;
    enemy.enableBody(true, x, y, true, true);
    enemy.setTexture('zombie');
    enemy.setDisplaySize(type.size * ratio, type.size);
    setHitboxFromDisplay(enemy, boss ? 0.82 : 0.76, boss ? 0.9 : 0.86);
    enemy.setDepth(boss ? 8 : 5);
    enemy.setVelocityX(velocity);
    enemy.setFlipX(velocity > 0);
    enemy.setTint(type.tint);
    enemy.setAlpha(boss ? 1 : 0.96);
    enemy.setData('visualTint', type.tint);
    enemy.setData({
      type: typeKey,
      hp: type.hp,
      maxHp: type.hp,
      score: type.score,
      baseY: y,
      wobble: type.wobble,
      wobbleSpeed: Phaser.Math.FloatBetween(0.004, 0.009),
      boss,
      dead: false
    });

    if (typeKey === 'allegro') {
      showBannerIfFree(scene, 'No dejes escapar a los pequeños!', 'Solo los zombies pequeños restan puntos si cruzan el escenario.');
    }

    return enemy;
  }

  function spawnItem(scene) {
    const itemType = Phaser.Math.RND.pick(itemTypes);
    const fromLeft = Math.random() < 0.5;
    const x = fromLeft ? -80 : WIDTH + 80;
    const y = Phaser.Math.Between(144, HEIGHT - 126);
    const speed = (fromLeft ? 1 : -1) * Phaser.Math.Between(115, 265);
    const item = groups.items.get(x, y, itemType.key);
    if (!item) return;

    const img = scene.textures.get(itemType.key).getSourceImage();
    const ratio = img.width / img.height;
    item.enableBody(true, x, y, true, true);
    item.setTexture(itemType.key);
    item.setDisplaySize(60 * ratio, 60);
    setHitboxFromDisplay(item, 1.28, 1.28);
    item.setDepth(5);
    item.setTint(itemType.positive ? 0xc7f9cc : 0xff9188);
    item.setAlpha(0.92);
    item.setBlendMode(Phaser.BlendModes.ADD);
    item.setData('baseScaleX', item.scaleX);
    item.setData('baseScaleY', item.scaleY);
    item.setData('auraColor', itemType.positive ? 0x7fd8be : 0xf07167);
    item.setVelocityX(speed);
    item.setData('itemType', itemType);
    item.setData('baseY', y);
    item.setData('spawnedAt', scene.time.now);
    item.body.allowGravity = false;
    maybeShowItemTutorial(scene, itemType);

    return item;
  }

  function updateEnemies(time, delta) {
    groups.enemies.children.each((enemy) => {
      if (!enemy.active || enemy.getData('dead')) return;
      const wobble = enemy.getData('wobble');
      if (wobble) {
        const baseY = enemy.getData('baseY');
        const speed = enemy.getData('wobbleSpeed');
        enemy.y = Phaser.Math.Clamp(baseY + Math.sin(time * speed) * wobble, 110, HEIGHT - 90);
      }
      enemy.rotation = Math.sin(time / 240) * 0.035;
      const pulse = 0.92 + Math.sin(time / (enemy.getData('boss') ? 150 : 210)) * 0.08;
      enemy.setAlpha(enemy.getData('boss') ? 1 : pulse);
    });

    ui.worldFx.clear();
    groups.items.children.each((item) => {
      if (!item.active) return;
      const baseY = item.getData('baseY');
      const spawnedAt = item.getData('spawnedAt');
      const pulse = 1 + Math.sin((time - spawnedAt) / 170) * 0.08;
      const baseScaleX = item.getData('baseScaleX') || item.scaleX;
      const baseScaleY = item.getData('baseScaleY') || item.scaleY;
      item.y = baseY + Math.sin((time - spawnedAt) / 280) * 16;
      item.rotation += delta * 0.0018;
      item.setScale(baseScaleX * pulse, baseScaleY * pulse);
      drawItemAura(item, time);
    });
  }

  function cleanupObjects() {
    groups.bullets.children.each((bullet) => {
      if (bullet.active && (bullet.x < -80 || bullet.x > WIDTH + 80 || bullet.y < -60 || bullet.y > HEIGHT + 60)) {
        bullet.disableBody(true, true);
      }
    });

    groups.items.children.each((item) => {
      if (item.active && (item.x < -130 || item.x > WIDTH + 130)) {
        item.disableBody(true, true);
      }
    });

    groups.enemies.children.each((enemy) => {
      if (!enemy.active || enemy.getData('dead')) return;
      if (enemy.x < -170 || enemy.x > WIDTH + 170) {
        const escapedType = enemy.getData('type');
        enemy.disableBody(true, true);
        state.combo = 0;
        safeSound(sceneRef, 'zombie_escaped', 0.5);
        flash(sceneRef, 0xb74135, 0.18);
        if (escapedType === 'allegro') {
          scoreDelta(sceneRef, -30, 0);
          floatText(sceneRef, WIDTH / 2, 130, '-30 pequeño escapó', '#ff9188');
        } else {
          floatText(sceneRef, WIDTH / 2, 130, 'escape', '#e8c872');
        }
      }
    });
  }

  function updateWave(scene) {
    const nextWave = Math.max(1, Math.floor(state.score / 420) + 1);
    if (nextWave !== state.wave) {
      state.wave = nextWave;
      state.rapidUntil = scene.time.now + 5200;
      const levelChanged = updateLevel(scene);
      if (!levelChanged) {
        showBanner(scene, `Oleada ${state.wave}`, 'Tempo arriba: disparo rapido temporal');
      } else {
        showMiniMessage(scene, 'Tempo arriba: disparo rapido temporal');
      }
      flash(scene, 0xe8c872, 0.14);
    }
  }

  function hitEnemy(bullet, enemy) {
    if (!enemy.active || enemy.getData('dead')) return;

    bullet.disableBody(true, true);
    const hp = enemy.getData('hp') - bullet.getData('damage');
    enemy.setData('hp', hp);
    flashSprite(this, enemy, 0xffffff);
    shakeOnHeavyHit(this, enemy);

    if (hp > 0) {
      floatText(this, enemy.x, enemy.y - 34, `${hp}/${enemy.getData('maxHp')}`, '#f6f0df');
      return;
    }

    enemy.setData('dead', true);
    enemy.setTexture('dead_zombie');
    enemy.setTint(0xffffff);
    enemy.setVelocity(0, 0);
    enemy.body.enable = false;
    enemy.rotation = 0;

    state.combo += 1;
    const comboBonus = Math.min(150, state.combo * 6);
    scoreDelta(this, enemy.getData('score') + comboBonus, enemy.getData('boss') ? 2 : 1);
    safeSound(this, 'zombie_down', enemy.getData('boss') ? 0.82 : 0.48);
    burst(this, enemy.x, enemy.y, enemy.getData('boss') ? 14 : 7, enemy.getData('boss') ? 0xe8c872 : 0xf3e37c);
    floatText(this, enemy.x, enemy.y - 44, `+${enemy.getData('score') + comboBonus}`, '#c7f9cc');

    this.time.delayedCall(420, () => {
      if (enemy.active) enemy.disableBody(true, true);
    });
  }

  function hitPlayer(playerSprite, enemy) {
    if (!enemy.active || enemy.getData('dead')) return;

    if (sceneRef.time.now < state.shieldUntil) {
      enemy.setData('dead', true);
      enemy.disableBody(true, true);
      scoreDelta(sceneRef, 45, 1);
      burst(sceneRef, enemy.x, enemy.y, 8, 0x6fffe9);
      floatText(sceneRef, enemy.x, enemy.y - 32, 'escudo', '#6fffe9');
      return;
    }

    if (sceneRef.time.now < state.invulnerableUntil) return;

    enemy.disableBody(true, true);
    state.lives -= enemy.getData('boss') ? 2 : 1;
    state.combo = 0;
    state.invulnerableUntil = sceneRef.time.now + 1800;
    safeSound(sceneRef, 'zombie_escaped', 0.64);
    flash(sceneRef, 0xb74135, 0.24);
    sceneRef.cameras.main.shake(170, 0.012);
    updateHud();

    if (state.lives <= 0) {
      state.lives = 0;
      updateHud();
      endGame(sceneRef);
    }
  }

  function collectItem(playerSprite, item) {
    const itemType = item.getData('itemType');
    item.disableBody(true, true);

    if (itemType.life) {
      state.lives = Math.min(7, state.lives + itemType.life);
      safeSound(sceneRef, 'life_collected', 0.7);
    }

    if (itemType.score) {
      if (itemType.score > 0) {
        state.combo += 1;
      } else {
        state.combo = 0;
      }
      scoreDelta(sceneRef, itemType.score, itemType.score > 0 ? 1 : 0);
    }

    if (itemType.damage) {
      if (sceneRef.time.now < state.shieldUntil) {
        showMiniMessage(sceneRef, 'Escudo bloquea la penalizacion');
      } else {
        state.lives = Math.max(0, state.lives - itemType.damage);
        state.invulnerableUntil = sceneRef.time.now + 900;
        sceneRef.cameras.main.shake(140, 0.01);
        if (state.lives <= 0) {
          updateHud();
          endGame(sceneRef);
          return;
        }
      }
    }

    if (typeof itemType.apply === 'function') {
      itemType.apply(sceneRef);
    }

    safeSound(sceneRef, itemType.positive ? 'item_collected' : 'zombie_escaped', itemType.positive ? 0.48 : 0.38);
    flash(sceneRef, itemType.positive ? 0x4fb286 : 0xb74135, 0.14);
    burst(sceneRef, item.x, item.y, 8, itemType.positive ? 0xc7f9cc : 0xff9188);
    floatText(sceneRef, item.x, item.y - 36, itemType.label, itemType.positive ? '#c7f9cc' : '#ff9188');
    if (itemType.banner) {
      showBanner(sceneRef, itemType.banner[0], itemType.banner[1], { large: true });
    } else {
      showMiniMessage(sceneRef, itemType.message);
    }
    updateHud();
  }

  function scoreDelta(scene, amount) {
    state.score = Math.max(0, state.score + amount);
    updateHighScore();
    updateHud(scene.time.now);
  }

  function updateHud(time = sceneRef ? sceneRef.time.now : 0) {
    if (!ui.score) return;

    ui.panel.clear();
    ui.panel.fillStyle(0x0b0d10, 0.52).fillRoundedRect(14, 12, 380, 96, 8);
    ui.panel.fillStyle(0x0b0d10, 0.45).fillRoundedRect(WIDTH / 2 - 170, 14, 340, 92, 8);
    ui.panel.fillStyle(0x0b0d10, 0.45).fillRoundedRect(WIDTH - 360, 14, 346, 92, 8);

    const livesText = 'Vidas: ' + 'I'.repeat(Math.max(0, state.lives));
    ui.score.setText(`Score: ${state.score}`);
    ui.lives.setText(livesText);
    ui.wave.setText(`Oleada ${state.wave}`);
    ui.combo.setText(state.combo > 1 ? `Combo x${state.combo}` : 'Combo listo');
    ui.level.setText(`Escenario ${state.levelIndex + 1}/${levels.length} · ${currentLevel().name}`);

    const powers = [];
    if (state.spreadUntil > time) powers.push(`triple ${secondsLeft(state.spreadUntil, time)}s`);
    if (state.rapidUntil > time) powers.push(`rapido ${secondsLeft(state.rapidUntil, time)}s`);
    if (state.shieldUntil > time) powers.push(`escudo ${secondsLeft(state.shieldUntil, time)}s`);
    ui.power.setText(powers.length ? powers.join('\n') : `Record: ${state.highScore}`);
    drawPowerBars(time);
  }

  function drawPowerBars(time) {
    const bars = [
      { label: 'TRITONO', until: state.spreadUntil, duration: 8200, color: 0x6fffe9 },
      { label: 'RAPIDO', until: state.rapidUntil, duration: 5200, color: 0xe8c872 },
      { label: 'ESCUDO', until: state.shieldUntil, duration: 5200, color: 0x8ef6ff }
    ];
    let row = 0;

    bars.forEach((bar) => {
      if (bar.until <= time) return;
      const x = WIDTH - 340;
      const y = 74 + row * 11;
      const width = 160;
      const progress = Phaser.Math.Clamp((bar.until - time) / bar.duration, 0, 1);
      ui.panel.fillStyle(0xf6f0df, 0.12).fillRoundedRect(x, y, width, 6, 3);
      ui.panel.fillStyle(bar.color, 0.9).fillRoundedRect(x, y, width * progress, 6, 3);
      row += 1;
    });
  }

  function updatePlayerEffects(time) {
    if (!ui.playerFx || !ui.aimFx || !player) return;

    ui.playerFx.clear();
    ui.aimFx.clear();

    const dir = player.flipX ? -1 : 1;
    const aimAlpha = state.spreadUntil > time ? 0.38 : 0.16;
    ui.aimFx.lineStyle(state.spreadUntil > time ? 4 : 2, state.spreadUntil > time ? 0x6fffe9 : 0xe8c872, aimAlpha);
    ui.aimFx.beginPath();
    ui.aimFx.moveTo(player.x + dir * 45, player.y);
    ui.aimFx.lineTo(player.x + dir * 240, player.y);
    ui.aimFx.strokePath();

    if (state.shieldUntil > time) {
      const pulse = 1 + Math.sin(time / 110) * 0.08;
      ui.playerFx.lineStyle(5, 0x8ef6ff, 0.62).strokeCircle(player.x, player.y, 72 * pulse);
      ui.playerFx.lineStyle(2, 0xf6f0df, 0.32).strokeCircle(player.x, player.y, 88 * pulse);
    }

    if (state.invulnerableUntil > time) {
      const alpha = 0.25 + Math.sin(time / 70) * 0.12;
      ui.playerFx.lineStyle(4, 0xff9188, alpha).strokeCircle(player.x, player.y, 62);
    }
  }

  function drawItemAura(item, time) {
    if (!ui.worldFx) return;
    const color = item.getData('auraColor') || 0xc7f9cc;
    const spawnedAt = item.getData('spawnedAt') || time;
    const radius = 42 + Math.sin((time - spawnedAt) / 150) * 7;
    ui.worldFx.lineStyle(3, color, 0.34).strokeCircle(item.x, item.y, radius);
    ui.worldFx.fillStyle(color, 0.08).fillCircle(item.x, item.y, radius * 0.82);
  }

  function secondsLeft(until, now) {
    return Math.max(1, Math.ceil((until - now) / 1000));
  }

  function flash(scene, color, alpha) {
    const rect = scene.add.rectangle(WIDTH / 2, HEIGHT / 2, WIDTH, HEIGHT, color, alpha).setDepth(40);
    scene.tweens.add({
      targets: rect,
      alpha: 0,
      duration: 320,
      onComplete: () => rect.destroy()
    });
  }

  function burst(scene, x, y, count, color) {
    for (let i = 0; i < count; i += 1) {
      const dot = scene.add.image(x, y, 'spark').setTint(color).setDepth(28).setScale(Phaser.Math.FloatBetween(0.42, 0.9));
      const angle = Phaser.Math.FloatBetween(0, Math.PI * 2);
      const distance = Phaser.Math.Between(28, 96);
      scene.tweens.add({
        targets: dot,
        x: x + Math.cos(angle) * distance,
        y: y + Math.sin(angle) * distance,
        alpha: 0,
        scale: 0,
        duration: Phaser.Math.Between(240, 520),
        ease: 'Quad.easeOut',
        onComplete: () => dot.destroy()
      });
    }
  }

  function shakeOnHeavyHit(scene, enemy) {
    if (enemy.getData('boss')) {
      scene.cameras.main.shake(120, 0.009);
      return;
    }

    if (enemy.getData('type') === 'forte') {
      scene.cameras.main.shake(90, 0.0055);
    }
  }

  function muzzleFlash(scene, x, y, dir, spread) {
    const color = spread ? 0x6fffe9 : 0xe8c872;

    [-18, 0, 18].forEach((offset, index) => {
      if (!spread && index !== 1) return;

      const note = scene.add.image(x - dir * 8, y + offset * 0.36, 'noteParticle')
        .setDepth(7)
        .setTint(color)
        .setScale(spread ? 0.62 : 0.52)
        .setAlpha(index === 1 ? 0.82 : 0.58)
        .setBlendMode(Phaser.BlendModes.ADD);

      scene.tweens.add({
        targets: note,
        x: x + dir * Phaser.Math.Between(42, 68),
        y: y + offset - Phaser.Math.Between(12, 30),
        alpha: 0,
        scale: 0.2,
        rotation: dir * Phaser.Math.FloatBetween(0.35, 0.8),
        duration: Phaser.Math.Between(300, 460),
        ease: 'Sine.easeOut',
        onComplete: () => note.destroy()
      });
    });
  }

  function floatText(scene, x, y, text, color) {
    const label = scene.add.text(x, y, text, hudTextStyle(22, color)).setOrigin(0.5).setDepth(31);
    scene.tweens.add({
      targets: label,
      y: y - 48,
      alpha: 0,
      duration: 980,
      ease: 'Quad.easeOut',
      onComplete: () => label.destroy()
    });
  }

  function showBanner(scene, title, subtitle, options = {}) {
    if (!ui.bannerTitle) return;
    ui.bannerTitle.setFontSize(options.large ? 74 : 56);
    ui.bannerSub.setFontSize(options.large ? 28 : 24);
    ui.bannerTitle.setText(title);
    ui.bannerSub.setText(subtitle);
    ui.bannerTitle.setAlpha(0);
    ui.bannerSub.setAlpha(0);
    state.nextBannerAt = scene.time.now + 1760;
    scene.tweens.add({
      targets: [ui.bannerTitle, ui.bannerSub],
      alpha: 1,
      yoyo: true,
      hold: 1220,
      duration: 270,
      ease: 'Quad.easeOut'
    });
  }

  function showBannerIfFree(scene, title, subtitle) {
    if (scene.time.now < state.nextBannerAt) return false;
    showBanner(scene, title, subtitle);
    return true;
  }

  function showMiniMessage(scene, text) {
    floatText(scene, WIDTH / 2, 140, text, '#f6f0df');
  }

  function maybeShowItemTutorial(scene, itemType) {
    if (!itemType.tutorial || state.tutorialSeen.has(itemType.tutorial)) return;

    state.tutorialSeen.add(itemType.tutorial);

    const messages = {
      consonance: [
        'Intervalos consonantes',
        'Las terceras y sextas verdes se deben coger: suman puntos y sostienen el combo.'
      ],
      clef: [
        'Clave de C (clave de do)',
        'Bach usaba mucho esta clave: si la coges, recuperas una vida.'
      ],
      parallels: [
        'Evita paralelas',
        'Las quintas y octavas paralelas rojas rompen el combo y quitan vida.'
      ],
      tritone: [
        'Cuarta aumentada',
        'Cogerla activa disparo triple por unos segundos.'
      ]
    };

    const [title, subtitle] = messages[itemType.tutorial];
    showBanner(scene, title, subtitle);
  }

  function flashSprite(scene, sprite, color) {
    sprite.setTint(color);
    scene.time.delayedCall(90, () => {
      if (!sprite.active || sprite.getData('dead')) return;
      const type = enemyTypes[sprite.getData('type')];
      sprite.setTint(type ? type.tint : 0xe8c872);
    });
  }

  function isMobileLayout() {
    return mobileQuery.matches;
  }

  async function requestImmersiveMode() {
    if (!isMobileLayout()) return;

    document.body.classList.add('mobile-game');

    if (!document.fullscreenElement && dom.shell.requestFullscreen) {
      try {
        await dom.shell.requestFullscreen({ navigationUI: 'hide' });
      } catch (error) {
        // Some mobile browsers only allow fullscreen in installed/PWA mode.
      }
    }

    if (screen.orientation && screen.orientation.lock) {
      try {
        await screen.orientation.lock('landscape');
      } catch (error) {
        // iOS Safari and some Android browsers do not expose orientation lock.
      }
    }

    resizeGame();
  }

  function startFromUserGesture() {
    requestImmersiveMode();
    startGame();
  }

  function refreshViewportMode() {
    document.body.classList.toggle('mobile-game', isMobileLayout());
  }

  function resizeGame() {
    if (!game || !game.scale) return;
    game.scale.refresh();
  }

  function setupViewportMode() {
    refreshViewportMode();
    resizeGame();

    const delayedResize = () => {
      refreshViewportMode();
      window.setTimeout(resizeGame, 60);
      window.setTimeout(resizeGame, 260);
    };

    window.addEventListener('resize', delayedResize);
    window.addEventListener('orientationchange', delayedResize);
    document.addEventListener('fullscreenchange', delayedResize);

    if (mobileQuery.addEventListener) {
      mobileQuery.addEventListener('change', delayedResize);
    } else if (mobileQuery.addListener) {
      mobileQuery.addListener(delayedResize);
    }
  }

  function setupDomEvents() {
    dom.start.addEventListener('click', startFromUserGesture);
    dom.restart.addEventListener('click', startFromUserGesture);
    dom.orientationStart.addEventListener('click', startFromUserGesture);
    dom.pause.addEventListener('click', togglePause);
    dom.mute.addEventListener('click', () => {
      state.muted = !state.muted;
      syncMute();
      if (!state.muted && state.phase === 'playing') unlockMusic();
    });
    dom.fullscreen.addEventListener('click', () => {
      if (!document.fullscreenElement && dom.shell.requestFullscreen) {
        requestImmersiveMode();
      } else if (document.exitFullscreen) {
        document.exitFullscreen().catch(() => {});
      }
    });

    window.addEventListener('keydown', (event) => {
      if (event.key === ' ' || event.key === 'ArrowUp' || event.key === 'ArrowDown') {
        event.preventDefault();
      }

      if (state.phase === 'menu' && !['p', 'P', 'm', 'M'].includes(event.key)) {
        startGame();
      } else if (state.phase === 'gameover' && !['p', 'P', 'm', 'M'].includes(event.key)) {
        startGame();
      }
    });

    setupTouchControls();
    setupViewportMode();
  }

  function exposeDebugApi() {
    if (!DEBUG) return;

    const api = {
      state,
      spawnEnemyAt(x, y, type = 'counterpoint') {
        const enemy = spawnEnemy(sceneRef, type);
        if (!enemy) return null;
        enemy.setPosition(x, y);
        enemy.setVelocity(0, 0);
        enemy.setData('baseY', y);
        return true;
      },
      spawnItemAt(x, y, key = 'tercera') {
        const itemType = itemTypes.find((item) => item.key === key) || itemTypes[0];
        const originalPick = Phaser.Math.RND.pick;
        Phaser.Math.RND.pick = () => itemType;
        const item = spawnItem(sceneRef);
        Phaser.Math.RND.pick = originalPick;
        if (!item) return null;
        item.setPosition(x, y);
        item.setVelocity(0, 0);
        item.setData('baseY', y);
        return true;
      },
      fire() {
        state.lastFired = 0;
        fireIfNeeded(sceneRef, sceneRef.time.now + 1000, true);
        return true;
      },
      getSnapshot() {
        return {
          phase: state.phase,
          score: state.score,
          lives: state.lives,
          combo: state.combo,
          enemies: groups.enemies ? groups.enemies.countActive(true) : 0,
          items: groups.items ? groups.items.countActive(true) : 0,
          player: player ? { x: player.x, y: player.y } : null
        };
      }
    };

    window.__bachShooterDebug = api;
    createDebugPanel(api);
  }

  function createDebugPanel(api) {
    if (document.getElementById('debug-panel')) return;

    const panel = document.createElement('div');
    panel.id = 'debug-panel';
    panel.style.cssText = [
      'position:fixed',
      'right:8px',
      'top:58px',
      'z-index:999',
      'display:flex',
      'gap:6px',
      'align-items:center',
      'padding:6px',
      'border:1px solid rgba(255,255,255,.35)',
      'background:rgba(0,0,0,.72)',
      'color:white',
      'font:12px monospace'
    ].join(';');

    const output = document.createElement('pre');
    output.id = 'debug-state';
    output.style.cssText = 'margin:0;max-width:320px;white-space:pre-wrap';

    const actions = [
      ['debug-enemy', 'enemy', () => {
        const snapshot = api.getSnapshot();
        api.spawnEnemyAt(snapshot.player.x + 260, snapshot.player.y, 'counterpoint');
      }],
      ['debug-fire', 'fire', () => api.fire()],
      ['debug-green', 'green', () => {
        const snapshot = api.getSnapshot();
        api.spawnItemAt(snapshot.player.x, snapshot.player.y, 'tercera');
      }],
      ['debug-red', 'red', () => {
        const snapshot = api.getSnapshot();
        api.spawnItemAt(snapshot.player.x, snapshot.player.y, 'quintas');
      }]
    ];

    actions.forEach(([id, label, handler]) => {
      const button = document.createElement('button');
      button.id = id;
      button.type = 'button';
      button.textContent = label;
      button.style.cssText = 'padding:4px 6px;border-radius:4px';
      button.addEventListener('click', () => {
        handler();
        window.setTimeout(() => {
          output.textContent = JSON.stringify(api.getSnapshot(), null, 2);
        }, 220);
      });
      panel.appendChild(button);
    });

    output.textContent = JSON.stringify(api.getSnapshot(), null, 2);
    panel.appendChild(output);
    document.body.appendChild(panel);
  }

  function setupTouchControls() {
    let activePointer = null;
    const maxDistance = 42;

    const resetStick = () => {
      activePointer = null;
      input.touchMove.x = 0;
      input.touchMove.y = 0;
      dom.touchKnob.style.transform = 'translate(0px, 0px)';
    };

    const updateStick = (event) => {
      if (activePointer !== event.pointerId) return;
      const rect = dom.touchZone.getBoundingClientRect();
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;
      const dx = event.clientX - cx;
      const dy = event.clientY - cy;
      const distance = Math.min(maxDistance, Math.hypot(dx, dy));
      const angle = Math.atan2(dy, dx);
      const x = Math.cos(angle) * distance;
      const y = Math.sin(angle) * distance;
      input.touchMove.x = x / maxDistance;
      input.touchMove.y = y / maxDistance;
      dom.touchKnob.style.transform = `translate(${x}px, ${y}px)`;
    };

    dom.touchZone.addEventListener('pointerdown', (event) => {
      event.preventDefault();
      activePointer = event.pointerId;
      dom.touchZone.setPointerCapture(event.pointerId);
      updateStick(event);
      requestImmersiveMode();
      unlockMusic();
    }, { passive: false });

    dom.touchZone.addEventListener('pointermove', updateStick, { passive: false });
    dom.touchZone.addEventListener('pointerup', resetStick);
    dom.touchZone.addEventListener('pointercancel', resetStick);

    dom.touchFire.addEventListener('pointerdown', (event) => {
      event.preventDefault();
      input.touchFire = true;
      requestImmersiveMode();
      unlockMusic();
    }, { passive: false });

    dom.touchFire.addEventListener('pointerup', () => {
      input.touchFire = false;
    });
    dom.touchFire.addEventListener('pointercancel', () => {
      input.touchFire = false;
    });
  }

  setupDomEvents();
  updateDomScores();

  const config = {
    type: Phaser.AUTO,
    parent: 'game-container',
    width: WIDTH,
    height: HEIGHT,
    backgroundColor: '#101318',
    pixelArt: true,
    antialias: false,
    physics: {
      default: 'arcade',
      arcade: {
        gravity: { y: 0 },
        debug: false
      }
    },
    scale: {
      mode: Phaser.Scale.ENVELOP,
      autoCenter: Phaser.Scale.CENTER_BOTH
    },
    scene: {
      key: 'main',
      preload,
      create,
      update
    }
  };

  game = new Phaser.Game(config);
})();
