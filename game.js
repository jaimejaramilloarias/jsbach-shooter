let player, cursors, shootKey;
let bullets, enemies, lifeGroup, itemsGroup;
let score = 0, lives = 3;
let scoreText, livesText, highScoreText, levelText;
let coverImage, gameStarted = false;
let highScore = localStorage.getItem('bachHighScore') || 0;
let level = 1;
let startHandler, restartHandler;

const config = {
  type: Phaser.AUTO,
  width: 1200,
  height: 800,
  parent: 'game-container',
  physics: {
    default: 'arcade',
    arcade: { gravity: { y: 0 }, debug: false }
  },
  scene: { preload, create, update }
};

const game = new Phaser.Game(config);
const container = document.getElementById('game-container');
Object.assign(container.style, {
  margin: '0 auto',
  width: config.width + 'px',
  height: config.height + 'px',
  display: 'block',
  position: 'relative'
});

function playMusic() {
  var audio = document.getElementById('bgmusic');
  if (audio) { audio.muted = false; audio.play(); }
}
function pauseMusic() {
  var audio = document.getElementById('bgmusic');
  if (audio) { audio.pause(); }
}

function preload() {
  this.load.image('background', 'assets/fondo.png');
  this.load.image('cover', 'assets/cover.png');
  this.load.image('bach', 'assets/bach.png');
  this.load.image('zombie', 'assets/zombie.png');
  this.load.image('dead_zombie', 'assets/dead_zombie.png'); // NUEVA IMAGEN
  this.load.image('clefC', 'assets/clefC.png');
  this.load.image('cuarta', 'assets/cuarta_au.png');
  this.load.image('octavas', 'assets/octavas.png');
  this.load.image('quintas', 'assets/quintas.png');
  this.load.image('sexta', 'assets/sexta.png');
  this.load.image('tercera', 'assets/tercera.png');
  // Bala verde
  const g = this.add.graphics();
  g.fillStyle(0x00ff00, 1).fillRect(0, 0, 20, 4);
  g.generateTexture('bullet', 20, 4);
  g.destroy();

  this.load.audio('laser', 'assets/laser_gun.mp3');
  this.load.audio('zombie_down', 'assets/zombie_down.mp3');
  this.load.audio('zombie_escaped', 'assets/zombie_escaped.mp3');
  this.load.audio('item_collected', 'assets/item_collected.mp3');
  this.load.audio('life_collected', 'assets/life_collected.mp3');
}

function create() {
  this.cameras.main.setBackgroundColor('#ffffff');
  this.add.image(config.width / 2, config.height / 2, 'background')
    .setDisplaySize(config.width, config.height)
    .setAlpha(0.7);

  const pImg = this.textures.get('bach').getSourceImage();
  const pRatio = pImg.width / pImg.height;
  player = this.physics.add.image(100, config.height / 2, 'bach')
    .setDisplaySize(100 * pRatio, 100)
    .setOrigin(0.5)
    .setCollideWorldBounds(true);

  bullets = this.physics.add.group();
  enemies = this.physics.add.group();
  lifeGroup = this.physics.add.group();
  itemsGroup = this.physics.add.group();

  cursors = this.input.keyboard.createCursorKeys();
  shootKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.B);

  scoreText = this.add.text(16, 16, 'Score: 0', { fontFamily: 'monospace', fontSize: '48px', fill: '#0f0' });
  livesText = this.add.text(16, 80, 'Lives: 3', { fontFamily: 'monospace', fontSize: '40px', fill: '#f00' });
  highScore = localStorage.getItem('bachHighScore') || 0;
  highScoreText = this.add.text(16, 140, 'High Score: ' + highScore, { fontFamily: 'monospace', fontSize: '40px', fill: '#ff0' });
  level = 1;
  levelText = this.add.text(16, 200, 'Level: 1', { fontFamily: 'monospace', fontSize: '40px', fill: '#00f' });

  this.lastFired = 0;
  this.fireRate = 133;

  this.shootSound = this.sound.add('laser');
  this.zombieDownSound = this.sound.add('zombie_down');
  this.zombieEscapedSound = this.sound.add('zombie_escaped');
  this.itemCollectedSound = this.sound.add('item_collected');
  this.lifeCollectedSound = this.sound.add('life_collected');

  this.physics.add.overlap(bullets, enemies, hitZombie, null, this);
  this.physics.add.overlap(player, enemies, hitPlayer, null, this);
  this.physics.add.overlap(player, lifeGroup, collectLife, null, this);
  this.physics.add.overlap(player, itemsGroup, collectItem, null, this);

  mostrarPortadaInicio.call(this);
}

function mostrarPortadaInicio() {
  let coverImg = this.textures.get('cover').getSourceImage();
  let imgW = coverImg.width;
  let imgH = coverImg.height;
  let targetH = config.height;
  let scale = targetH / imgH;
  let proportionalW = imgW * scale;

  coverImage = this.add.image(config.width / 2, config.height / 2, 'cover')
    .setDisplaySize(proportionalW, targetH)
    .setDepth(10);

  this.scene.pause();
  pauseMusic();

  startHandler = () => {
    if (coverImage) coverImage.destroy();
    if (!gameStarted) {
      spawnItem.call(this);
      this.time.addEvent({ delay: 1500, callback: spawnItem, callbackScope: this, loop: true });
      this.time.addEvent({ delay: 1000, callback: spawnZombie, callbackScope: this, loop: true });
    }
    this.scene.resume();
    playMusic();
    gameStarted = true;
    window.removeEventListener('keydown', startHandler);
    window.removeEventListener('pointerdown', startHandler);
  };
  window.addEventListener('pointerdown', startHandler, { once: true });
  window.addEventListener('keydown', startHandler, { once: true });
  coverImage.setInteractive();
  coverImage.once('pointerdown', startHandler);
}

function mostrarPortadaGameOver() {
  let coverImg = this.textures.get('cover').getSourceImage();
  let imgW = coverImg.width;
  let imgH = coverImg.height;
  let targetH = config.height;
  let scale = targetH / imgH;
  let proportionalW = imgW * scale;

  coverImage = this.add.image(config.width / 2, config.height / 2, 'cover')
    .setDisplaySize(proportionalW, targetH)
    .setDepth(10);

  pauseMusic();
  this.scene.pause();

  restartHandler = () => {
    if (coverImage) coverImage.destroy();
    gameStarted = false;
    this.scene.restart();
    score = 0;
    lives = 3;
    highScore = localStorage.getItem('bachHighScore') || 0;
    if (highScoreText) highScoreText.setText('High Score: ' + highScore);
    playMusic();
    window.removeEventListener('keydown', restartHandler);
    window.removeEventListener('pointerdown', restartHandler);
  };
  window.addEventListener('pointerdown', restartHandler, { once: true });
  window.addEventListener('keydown', restartHandler, { once: true });
  coverImage.setInteractive();
  coverImage.once('pointerdown', restartHandler);
}

function update(time) {
  if (!gameStarted) return;

  player.setVelocity(0);
  const speed = 600;
  if (cursors.left.isDown) {
    player.setVelocityX(-speed);
    player.setFlipX(true);
  }
  if (cursors.right.isDown) {
    player.setVelocityX(speed);
    player.setFlipX(false);
  }
  if (cursors.up.isDown) player.setVelocityY(-speed);
  if (cursors.down.isDown) player.setVelocityY(speed);

  if (shootKey.isDown && time > this.lastFired) {
    const dir = player.flipX ? -1 : 1;
    const b = bullets.create(player.x + dir * 40, player.y, 'bullet').setOrigin(0.5);
    b.body.allowGravity = false;
    b.setVelocityX(1350 * dir);
    if (this.shootSound) this.shootSound.play();
    this.lastFired = time + this.fireRate;
  }

  enemies.getChildren().forEach(z => {
    if (z.x < -100 || z.x > config.width + 100) {
      z.destroy();
      score = Math.max(0, score - 5);
      scoreText.setText('Score: ' + score);
      if (this.zombieEscapedSound) this.zombieEscapedSound.play();
      const flash = this.add.rectangle(config.width / 2, config.height / 2, config.width, config.height, 0xff0000, 0.2);
      this.tweens.add({ targets: flash, alpha: 0, duration: 500, onComplete: () => flash.destroy() });
      updateHighScore();
    }
  });
  [lifeGroup, itemsGroup].forEach(grp =>
    grp.getChildren().forEach(o => { if (o.x < -100 || o.x > config.width + 100) o.destroy(); })
  );
  bullets.getChildren().forEach(b => { if (b.x < -20 || b.x > config.width + 20) b.destroy(); });
}

function spawnItem() {
  const types = ['8sp', '5sp', '3', '6', '4+', 'clefC'];
  const type = Phaser.Math.RND.pick(types);
  const fromLeft = Math.random() < 0.5;
  const baseSize = 56;
  const x = fromLeft ? -baseSize : config.width + baseSize;
  const y = Phaser.Math.Between(baseSize, config.height - baseSize);

  const vel = (fromLeft ? 1 : -1) * Phaser.Math.Between(80, 320);

  if (type === 'clefC') {
    const life = lifeGroup.create(x, y, 'clefC');
    const img = this.textures.get('clefC').getSourceImage();
    const r = img.width / img.height;
    life.setDisplaySize(baseSize * r, baseSize).setOrigin(0.5);
    life.body.allowGravity = false;
    life.setVelocityX(vel);
  } else {
    const map = { '8sp': 'octavas', '5sp': 'quintas', '3': 'tercera', '6': 'sexta', '4+': 'cuarta' };
    const key = map[type];
    const img = this.textures.get(key).getSourceImage();
    const r = img.width / img.height;
    const item = itemsGroup.create(x, y, key)
      .setDisplaySize(baseSize * r, baseSize).setOrigin(0.5);
    item.body.allowGravity = false;
    item.setVelocityX(vel);
  }
}

function spawnZombie() {
  const fromLeft = Math.random() < 0.5;
  const x = fromLeft ? -80 : config.width + 80;
  const y = Phaser.Math.Between(80, config.height - 80);

  // Velocidad según el nivel
  const baseMin = 180 + (level - 1) * 20;
  const baseMax = 420 + (level - 1) * 30;
  const speedVal = Phaser.Math.Between(baseMin, baseMax) * (fromLeft ? 1 : -1);

  const z = enemies.create(x, y, 'zombie');
  const img = this.textures.get('zombie').getSourceImage();
  const r = img.width / img.height;
  z.setDisplaySize(80 * r, 80).setOrigin(0.5);
  z.body.allowGravity = false;
  z.setVelocityX(speedVal);
  z.setFlipX(speedVal > 0);
}

function hitZombie(b, z) {
  b.destroy();

  // Cambia textura a muerto
  z.setTexture('dead_zombie');
  z.setVelocityX(0);

  // Destruye tras 0.5 segundos (500ms)
  this.time.delayedCall(500, () => {
    if (z && z.active) z.destroy();
  });

  score += 10;
  scoreText.setText('Score: ' + score);
  if (this.zombieDownSound) this.zombieDownSound.play();
  updateHighScore();
}

function hitPlayer(p, h) {
  h.destroy();
  lives--;
  livesText.setText('Lives: ' + lives);
  if (this.zombieEscapedSound) this.zombieEscapedSound.play();
  const flash = this.add.rectangle(config.width / 2, config.height / 2, config.width, config.height, 0xff0000, 0.2);
  this.tweens.add({ targets: flash, alpha: 0, duration: 500, onComplete: () => flash.destroy() });
  updateHighScore();
  if (lives <= 0) {
    this.physics.pause();
    scoreText.setText('Game Over! Score: ' + score);
    mostrarPortadaGameOver.call(this);
  }
}

function collectLife(p, l) {
  l.destroy();
  lives++;
  livesText.setText('Lives: ' + lives);
  if (this.lifeCollectedSound) this.lifeCollectedSound.play();
  const flash = this.add.rectangle(config.width / 2, config.height / 2, config.width, config.height, 0x00ff00, 0.2);
  this.tweens.add({ targets: flash, alpha: 0, duration: 500, onComplete: () => flash.destroy() });
}

function collectItem(p, i) {
  i.destroy();
  let positive = true;
  switch (i.texture.key) {
    case 'octavas': score = Math.max(0, score - 8); positive = false; break;
    case 'quintas': score = Math.max(0, score - 5); positive = false; break;
    case 'tercera': score += 3; break;
    case 'sexta': score += 6; break;
    case 'cuarta': score *= 2; break;
  }
  scoreText.setText('Score: ' + score);
  if (positive && this.itemCollectedSound) this.itemCollectedSound.play();
  updateHighScore();
  const c = positive ? 0x00ff00 : 0xff0000;
  const flash = this.add.rectangle(config.width / 2, config.height / 2, config.width, config.height, c, 0.2);
  this.tweens.add({ targets: flash, alpha: 0, duration: 500, onComplete: () => flash.destroy() });
}

function updateHighScore() {
  if (score > highScore) {
    highScore = score;
    localStorage.setItem('bachHighScore', highScore);
    if (highScoreText) highScoreText.setText('High Score: ' + highScore);
  }

  // Level logic
  let newLevel = Math.floor(score / 50000) + 1;
  if (newLevel !== level) {
    level = newLevel;
    if (levelText) levelText.setText('Level: ' + level);
    // Aquí podrías mostrar destello, animación, etc
  }
}
