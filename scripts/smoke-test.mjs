import { readFileSync, existsSync } from 'node:fs';

const requiredFiles = [
  'index.html',
  'game.js',
  'assets/bach.png',
  'assets/zombie.png',
  'assets/cover.png',
  'assets/music.mp3',
  'assets/levels/level-1-aula.png',
  'assets/levels/level-2-arnstadt.png',
  'assets/levels/level-3-weimar.png',
  'assets/levels/level-4-leipzig.png',
  'assets/levels/level-5-fuga.png'
];

for (const file of requiredFiles) {
  if (!existsSync(file)) {
    throw new Error(`Missing required file: ${file}`);
  }
}

const html = readFileSync('index.html', 'utf8');
const game = readFileSync('game.js', 'utf8');
const pkg = readFileSync('package.json', 'utf8');

const checks = [
  [html.includes('vendor/phaser.min.js'), 'index.html loads local Phaser'],
  [existsSync('vendor/phaser.min.js'), 'local Phaser vendor file exists'],
  [html.includes('manifest.webmanifest'), 'web app manifest is linked'],
  [html.includes('game.js'), 'index.html loads game.js'],
  [html.includes('touch-controls'), 'touch controls exist in HTML'],
  [html.includes('menu-overlay'), 'menu overlay exists'],
  [html.includes('gameover-overlay'), 'game over overlay exists'],
  [game.includes('Phaser.Scale.ENVELOP'), 'game uses full-bleed Phaser scaling'],
  [game.includes('pixelArt: true'), 'game keeps pixel art crisp'],
  [game.includes('const levels = ['), 'level progression table exists'],
  [game.includes('updateLevel'), 'level transition logic exists'],
  [game.includes('Math.floor((wave - 1) / 6)'), 'level changes are spaced by six waves'],
  [game.includes('Escenario ${state.levelIndex + 1}/${levels.length}'), 'HUD shows current scenario'],
  [game.includes("name: 'Leipzig nocturna'"), 'nocturnal stage exists'],
  [game.includes("subtitle: 'Final nocturno: sobrevive la ultima fuga.'"), 'nocturnal stage is the final level'],
  [!game.includes('lineBetween(0, y, WIDTH, y)'), 'decorative horizontal overlay lines were removed'],
  [!game.includes('lineBetween(x, top, x, HEIGHT - 112)'), 'decorative vertical overlay lines were removed'],
  [game.includes('spawnEnemy'), 'enemy spawning exists'],
  [game.includes('bossWave'), 'boss wave logic exists'],
  [game.includes('itemTypes'), 'musical power-up table exists'],
  [game.includes('¡Disparo de Tritono!'), 'tritone shot banner exists'],
  [game.includes('options.large ? 74 : 56'), 'large banner sizing exists'],
  [game.includes('updatePlayerEffects'), 'player shield and aim effects exist'],
  [game.includes('drawItemAura'), 'item aura effects exist'],
  [game.includes('drawPowerBars'), 'power duration bars exist'],
  [game.includes('muzzleFlash'), 'muzzle flash effect exists'],
  [game.includes('shakeOnHeavyHit'), 'heavy zombie hit shake exists'],
  [!game.includes('add.triangle'), 'large triangular muzzle flash was removed'],
  [game.includes('setHitboxFromDisplay'), 'scaled hitbox helper exists'],
  [game.includes('damage: 1'), 'negative items can damage player'],
  [game.includes('maybeShowItemTutorial'), 'first-appearance item tutorial exists'],
  [game.includes('Intervalos consonantes'), 'consonance explanation exists'],
  [game.includes('Clave de C (clave de do)'), 'C clef explanation exists'],
  [game.includes('quintas y octavas paralelas'), 'parallel fifths/octaves warning exists'],
  [game.includes('No dejes escapar a los pequeños!'), 'small zombie warning exists'],
  [game.includes("escapedType === 'allegro'"), 'only small zombies subtract escape points'],
  [game.includes('showBannerIfFree'), 'small zombie warning respects active banners'],
  [game.includes('__bachShooterDebug'), 'debug collision harness exists behind query flag'],
  [game.includes('setupTouchControls'), 'touch input is wired'],
  [html.includes('orientation-overlay'), 'mobile orientation overlay exists'],
  [game.includes('screen.orientation.lock'), 'mobile landscape lock is attempted from a user gesture'],
  [game.includes('requestFullscreen'), 'fullscreen control is wired'],
  [game.includes('playPromise.catch'), 'audio autoplay rejection is handled'],
  [pkg.includes('"start"'), 'npm start script exists'],
  [pkg.includes('"test"'), 'npm test script exists']
];

for (const [passed, message] of checks) {
  if (!passed) {
    throw new Error(`Smoke check failed: ${message}`);
  }
}

console.log('Smoke test passed.');
