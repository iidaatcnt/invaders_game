// ビー・シューター - ゲームロジック

const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const scoreElement = document.getElementById('score');
const stageElement = document.getElementById('stage');
const themeElement = document.getElementById('theme');
const gameOverElement = document.getElementById('gameOver');

// ゲーム状態
let gameRunning = true;
let score = 0;
let keys = {};
let animationFrame = 0;
let currentStage = 1;
let stageThemes = ['spring', 'summer', 'autumn', 'winter'];

// プレイヤー
const player = {
    x: canvas.width / 2 - 25,
    y: canvas.height - 80,
    width: 50,
    height: 30,
    speed: 5,
    color: '#FF6347'
};

// 弾丸（複数対応）
let bullets = [];

// 蜂の針
let beeStingers = [];

// パワーアップシステム
let powerUps = [];
let rapidFire = {
    active: false,
    duration: 300, // 5秒間（60FPS × 5）
    timer: 0,
    fireRate: 3 // 通常の3倍速
};
let playerPowerUps = {
    rapidFire: 0,      // 連射モード残り時間
    wideSpray: 0,      // ワイドスプレー残り時間
    pierce: 0,         // 貫通スプレー残り時間
    shield: 0,         // シールド残り枚数
    homing: 0          // ホーミング残り時間
};

// コンボシステム
let combo = 0;
let comboTimer = 0;
const COMBO_TIMEOUT = 180; // 3秒でコンボリセット

// パーティクルシステム
let particles = [];

// インベーダー
const invaders = [];
const invaderRows = 4;
const invaderCols = 8;
const invaderWidth = 40;
const invaderHeight = 30;
let invaderSpeed = 1;

// インベーダーの初期化
function initInvaders() {
    invaders.length = 0;
    const stageColors = getStageColors();
    const invaderColors = stageColors.beeColors;
    
    for (let row = 0; row < invaderRows; row++) {
        for (let col = 0; col < invaderCols; col++) {
            let beeType = 'normal';
            let points = 10;
            let color = invaderColors[row];
            let speed = 1;
            
            // 特殊蜂のタイプを決定
            const random = Math.random();
            if (row === 0 && col === 3 || col === 4) {
                // 上段中央にクイーン蜂
                beeType = 'queen';
                points = 50;
                color = '#FF00FF'; // マゼンタ
                speed = 0.5;
            } else if (random < 0.2) {
                // 20%の確率でスピード蜂
                beeType = 'speed';
                points = 20;
                color = '#00BFFF'; // スカイブルー
                speed = 2;
            }
            
            invaders.push({
                x: col * (invaderWidth + 20) + 100,
                y: row * (invaderHeight + 15) + 50,
                width: invaderWidth,
                height: invaderHeight,
                type: beeType,
                color: color,
                speed: speed,
                points: points,
                alive: true
            });
        }
    }
}

// 蜂の針クラス
class BeeStinger {
    constructor(x, y) {
        this.x = x;
        this.y = y;
        this.width = 3;
        this.height = 12;
        this.speed = 2;
        this.color = '#8B4513';
    }
    
    update() {
        this.y += this.speed;
    }
    
    draw() {
        // 針の本体（茶色）
        ctx.fillStyle = this.color;
        ctx.fillRect(this.x, this.y, this.width, this.height);
        
        // 針の先端（黒）
        ctx.fillStyle = '#000000';
        ctx.fillRect(this.x, this.y + this.height - 3, this.width, 3);
        
        // 針の光沢
        ctx.fillStyle = '#D2691E';
        ctx.fillRect(this.x + 1, this.y, 1, this.height - 2);
    }
}

// 弾丸クラス
class Bullet {
    constructor(x, y, dx = 0, dy = -4, type = 'normal') {
        this.x = x;
        this.y = y;
        this.dx = dx;
        this.dy = dy;
        this.width = 6;
        this.height = 10;
        this.type = type; // 'normal', 'wide', 'pierce', 'homing'
        this.pierced = []; // 貫通で既に当たった敵のID
        this.homingTarget = null;
    }
    
    update() {
        // ホーミング処理
        if (this.type === 'homing' && !this.homingTarget) {
            this.findHomingTarget();
        }
        
        if (this.type === 'homing' && this.homingTarget && this.homingTarget.alive) {
            const targetX = this.homingTarget.x + this.homingTarget.width / 2;
            const targetY = this.homingTarget.y + this.homingTarget.height / 2;
            const angle = Math.atan2(targetY - this.y, targetX - this.x);
            this.dx = Math.cos(angle) * 3;
            this.dy = Math.sin(angle) * 3;
        }
        
        this.x += this.dx;
        this.y += this.dy;
    }
    
    findHomingTarget() {
        let closest = null;
        let minDistance = Infinity;
        
        for (let invader of invaders) {
            if (!invader.alive) continue;
            const distance = Math.hypot(
                invader.x - this.x,
                invader.y - this.y
            );
            if (distance < minDistance) {
                minDistance = distance;
                closest = invader;
            }
        }
        
        this.homingTarget = closest;
    }
}

// パワーアップアイテムクラス
class PowerUp {
    constructor(x, y, type) {
        this.x = x;
        this.y = y;
        this.type = type; // 'rapid', 'wide', 'pierce', 'shield', 'homing'
        this.width = 20;
        this.height = 20;
        this.speed = 1;
        this.collected = false;
        this.animFrame = 0;
    }
    
    update() {
        this.y += this.speed;
        this.animFrame++;
    }
    
    draw() {
        const centerX = this.x + this.width / 2;
        const centerY = this.y + this.height / 2;
        const pulse = Math.sin(this.animFrame * 0.2) * 0.3 + 1;
        
        // パワーアップの背景円
        ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
        ctx.beginPath();
        ctx.arc(centerX, centerY, this.width/2 * pulse, 0, Math.PI * 2);
        ctx.fill();
        
        // タイプ別のアイコン
        ctx.fillStyle = this.getColor();
        ctx.font = '14px Arial';
        ctx.textAlign = 'center';
        ctx.fillText(this.getSymbol(), centerX, centerY + 4);
    }
    
    getColor() {
        const colors = {
            rapid: '#FF6347',
            wide: '#32CD32',
            pierce: '#FFD700',
            shield: '#87CEEB',
            homing: '#FF69B4'
        };
        return colors[this.type] || '#FFFFFF';
    }
    
    getSymbol() {
        const symbols = {
            rapid: '⚡',
            wide: '🌪️',
            pierce: '➤',
            shield: '🛡️',
            homing: '🎯'
        };
        return symbols[this.type] || '?';
    }
}

// パーティクルクラス
class Particle {
    constructor(x, y, type = 'explosion') {
        this.x = x;
        this.y = y;
        this.type = type;
        this.life = 60; // 寿命（フレーム数）
        this.maxLife = this.life;
        
        if (type === 'explosion') {
            this.vx = (Math.random() - 0.5) * 8;
            this.vy = (Math.random() - 0.5) * 8;
            this.size = Math.random() * 4 + 2;
            this.color = ['#FFD700', '#FF6347', '#FF4500', '#FFA500'][Math.floor(Math.random() * 4)];
        } else if (type === 'spark') {
            this.vx = (Math.random() - 0.5) * 12;
            this.vy = (Math.random() - 0.5) * 12;
            this.size = Math.random() * 2 + 1;
            this.color = '#FFFF00';
        } else if (type === 'smoke') {
            this.vx = (Math.random() - 0.5) * 2;
            this.vy = -Math.random() * 3;
            this.size = Math.random() * 6 + 3;
            this.color = `rgba(128, 128, 128, ${0.7})`;
        } else if (type === 'impact') {
            this.vx = (Math.random() - 0.5) * 6;
            this.vy = (Math.random() - 0.5) * 6;
            this.size = Math.random() * 3 + 1;
            this.color = '#00FF00'; // スプレー色
        }
        
        this.gravity = 0.1;
        this.friction = 0.98;
    }
    
    update() {
        this.x += this.vx;
        this.y += this.vy;
        this.vy += this.gravity;
        this.vx *= this.friction;
        this.vy *= this.friction;
        this.life--;
        
        // サイズの減衰
        if (this.type !== 'smoke') {
            this.size *= 0.98;
        }
    }
    
    draw() {
        const alpha = this.life / this.maxLife;
        
        if (this.type === 'smoke') {
            ctx.fillStyle = `rgba(128, 128, 128, ${alpha * 0.5})`;
        } else if (this.type === 'spark') {
            ctx.fillStyle = `rgba(255, 255, 0, ${alpha})`;
        } else {
            ctx.fillStyle = this.color;
            ctx.globalAlpha = alpha;
        }
        
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;
    }
    
    isDead() {
        return this.life <= 0 || this.size <= 0.5;
    }
}

// パーティクル生成関数
function createExplosion(x, y, count = 15) {
    for (let i = 0; i < count; i++) {
        particles.push(new Particle(x, y, 'explosion'));
    }
    // スパークも追加
    for (let i = 0; i < 8; i++) {
        particles.push(new Particle(x, y, 'spark'));
    }
    // 煙も追加
    for (let i = 0; i < 5; i++) {
        particles.push(new Particle(x, y, 'smoke'));
    }
}

function createImpactEffect(x, y, count = 8) {
    for (let i = 0; i < count; i++) {
        particles.push(new Particle(x, y, 'impact'));
    }
}

// パーティクル更新関数
function updateParticles() {
    for (let i = particles.length - 1; i >= 0; i--) {
        const particle = particles[i];
        particle.update();
        
        if (particle.isDead()) {
            particles.splice(i, 1);
        }
    }
}

// 効果音を生成する関数
function playSound(frequency, duration, type = 'sine') {
    const audioContext = new (window.AudioContext || window.webkitAudioContext)();
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();
    
    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);
    
    oscillator.frequency.setValueAtTime(frequency, audioContext.currentTime);
    oscillator.type = type;
    
    gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + duration);
    
    oscillator.start(audioContext.currentTime);
    oscillator.stop(audioContext.currentTime + duration);
}

// 発射音
function playShootSound() {
    playSound(800, 0.1, 'square');
}

// 命中音（強化版 - より確実に再生）
function playHitSound() {
    try {
        playSound(400, 0.2, 'sawtooth');
        setTimeout(() => {
            try {
                playSound(600, 0.1, 'sine');
            } catch (e) {
                console.log('Hit sound 2 playback failed:', e);
            }
        }, 100);
    } catch (e) {
        console.log('Hit sound 1 playback failed:', e);
    }
}

// 勝利音
function playVictorySound() {
    playSound(523, 0.2, 'sine'); // ド
    setTimeout(() => playSound(659, 0.2, 'sine'), 200); // ミ
    setTimeout(() => playSound(784, 0.2, 'sine'), 400); // ソ
    setTimeout(() => playSound(1047, 0.4, 'sine'), 600); // 高いド
}

// ゲームオーバー音
function playGameOverSound() {
    playSound(300, 0.3, 'sawtooth'); // 低い音
    setTimeout(() => playSound(250, 0.3, 'sawtooth'), 200); // もっと低い音
    setTimeout(() => playSound(200, 0.5, 'sawtooth'), 400); // 最低音
}

// パワーアップ音
function playPowerUpSound() {
    playSound(800, 0.1, 'sine');
    setTimeout(() => playSound(1000, 0.1, 'sine'), 100);
    setTimeout(() => playSound(1200, 0.2, 'sine'), 200);
}

// コンボ音
function playComboSound(comboCount) {
    const baseFreq = 600 + (comboCount * 100);
    playSound(baseFreq, 0.15, 'triangle');
}

// 敗北音
function playDefeatSound() {
    playSound(200, 0.3, 'sawtooth');
    setTimeout(() => playSound(150, 0.3, 'sawtooth'), 300);
    setTimeout(() => playSound(100, 0.5, 'sawtooth'), 600);
}

// キーボードイベント
document.addEventListener('keydown', (e) => {
    keys[e.code] = true;
    
    if ((e.code === 'Space' || e.key === ' ') && gameRunning) {
        e.preventDefault();
        
        // 連射モード時の処理
        if (rapidFire.active) {
            // 連射モードでは間隔を短縮
            if (Date.now() - lastShotTime > (rapidFire.active ? 100 : 300)) {
                createBullet();
                lastShotTime = Date.now();
            }
        } else {
            // 通常モード
            if (!bullet) {
                createBullet();
            }
        }
    }
    
    // テスト用：Rキーで連射モード起動
    if (e.code === 'KeyR' && gameRunning) {
        activateRapidFire();
    }
});

let lastShotTime = 0;

function updatePowerUps() {
    // 連射モードタイマー更新
    if (rapidFire.active) {
        rapidFire.timer--;
        if (rapidFire.timer <= 0) {
            rapidFire.active = false;
        }
    }
}

function activateRapidFire() {
    rapidFire.active = true;
    rapidFire.timer = rapidFire.duration;
}

function getStageTheme() {
    return stageThemes[(currentStage - 1) % stageThemes.length];
}

function getStageColors() {
    const theme = getStageTheme();
    switch (theme) {
        case 'spring':
            return {
                background: 'linear-gradient(180deg, #87CEFA, #98FB98)',
                beeColors: ['#FFB6C1', '#FF69B4', '#FFC0CB', '#FF1493']
            };
        case 'summer':
            return {
                background: 'linear-gradient(180deg, #FFD700, #FF8C00)',
                beeColors: ['#FF4500', '#FF6347', '#FFA500', '#FFD700']
            };
        case 'autumn':
            return {
                background: 'linear-gradient(180deg, #DEB887, #CD853F)',
                beeColors: ['#8B4513', '#A0522D', '#CD853F', '#D2691E']
            };
        case 'winter':
            return {
                background: 'linear-gradient(180deg, #B0E0E6, #F0F8FF)',
                beeColors: ['#4682B4', '#87CEEB', '#B0C4DE', '#E0E0E0']
            };
    }
}

function showStageComplete() {
    const message = document.createElement('div');
    message.style.position = 'fixed';
    message.style.top = '50%';
    message.style.left = '50%';
    message.style.transform = 'translate(-50%, -50%)';
    message.style.background = 'rgba(0, 0, 0, 0.8)';
    message.style.color = 'white';
    message.style.padding = '20px';
    message.style.borderRadius = '10px';
    message.style.fontSize = '24px';
    message.style.textAlign = 'center';
    message.style.zIndex = '1000';
    message.innerHTML = `ステージ ${currentStage - 1} クリア！<br>${getStageTheme()} ステージ開始！`;
    document.body.appendChild(message);
    
    setTimeout(() => {
        document.body.removeChild(message);
    }, 2000);
}

function showGameComplete() {
    const message = document.createElement('div');
    message.style.position = 'fixed';
    message.style.top = '50%';
    message.style.left = '50%';
    message.style.transform = 'translate(-50%, -50%)';
    message.style.background = 'rgba(0, 0, 0, 0.8)';
    message.style.color = 'gold';
    message.style.padding = '30px';
    message.style.borderRadius = '15px';
    message.style.fontSize = '32px';
    message.style.textAlign = 'center';
    message.style.zIndex = '1000';
    message.innerHTML = `🎉 全ステージクリア！ 🎉<br>最終スコア: ${score}`;
    document.body.appendChild(message);
}

function initNextStage() {
    // パーティクルと針をクリア
    particles = [];
    beeStingers = [];
    
    // 蜂を再初期化
    initInvaders();
    
    // 難易度上昇
    invaderSpeed = currentStage * 0.5;
    
    // UI更新
    updateStageDisplay();
}

function updateStageDisplay() {
    stageElement.textContent = currentStage;
    const themeNames = { 'spring': 'Spring', 'summer': 'Summer', 'autumn': 'Autumn', 'winter': 'Winter' };
    themeElement.textContent = themeNames[getStageTheme()];
}

function createBullet() {
    bullet = {
        x: player.x + player.width / 2 - 3,
        y: player.y,
        width: 6,
        height: 15,
        speed: 8,
        color: '#FF0000'
    };
    playShootSound();
}

document.addEventListener('keyup', (e) => {
    keys[e.code] = false;
});

// プレイヤーの更新
function updatePlayer() {
    if (keys['ArrowLeft'] && player.x > 0) {
        player.x -= player.speed;
    }
    if (keys['ArrowRight'] && player.x < canvas.width - player.width) {
        player.x += player.speed;
    }
}

// 弾丸の更新
function updateBullet() {
    if (bullet) {
        bullet.y -= bullet.speed;
        
        // 画面外に出たら削除
        if (bullet.y < 0) {
            bullet = null;
        }
    }
}

// インベーダーの更新
function updateInvaders() {
    let moveDown = false;
    
    // 端に到達したかチェック（生きているインベーダーのみ）
    for (let invader of invaders) {
        if (!invader.alive) continue;
        
        if ((invaderSpeed > 0 && invader.x >= canvas.width - invader.width) ||
            (invaderSpeed < 0 && invader.x <= 0)) {
            moveDown = true;
            break;
        }
    }
    
    if (moveDown) {
        // 1段下に移動して方向転換
        for (let invader of invaders) {
            if (!invader.alive) continue;
            invader.y += 40;
        }
        invaderSpeed *= -1;
    } else {
        // 左右に移動
        for (let invader of invaders) {
            if (!invader.alive) continue;
            // 個別の速度を適用
            let actualSpeed = invaderSpeed * invader.speed;
            invader.x += actualSpeed;
        }
    }
    
    // 蜂が針を発射する（ランダムに）
    if (Math.random() < 0.008) { // 針発射の確率を調整
        const aliveBees = invaders.filter(invader => invader.alive);
        if (aliveBees.length > 0) {
            const randomBee = aliveBees[Math.floor(Math.random() * aliveBees.length)];
            const stingerX = randomBee.x + randomBee.width / 2 - 1.5;
            const stingerY = randomBee.y + randomBee.height;
            
            if (randomBee.type === 'queen') {
                // クイーン蜂は3連射
                beeStingers.push(new BeeStinger(stingerX - 10, stingerY));
                beeStingers.push(new BeeStinger(stingerX, stingerY));
                beeStingers.push(new BeeStinger(stingerX + 10, stingerY));
            } else {
                beeStingers.push(new BeeStinger(stingerX, stingerY));
            }
        }
    }
}

// 蜂の針の更新
function updateBeeStingers() {
    for (let i = beeStingers.length - 1; i >= 0; i--) {
        const stinger = beeStingers[i];
        stinger.update();
        
        // 画面外に出た針を削除
        if (stinger.y > canvas.height) {
            beeStingers.splice(i, 1);
        }
    }
}

// 衝突検出
function checkCollisions() {
    if (!bullet) return;
    
    for (let invader of invaders) {
        if (!invader.alive) continue;
        
        if (bullet.x < invader.x + invader.width &&
            bullet.x + bullet.width > invader.x &&
            bullet.y < invader.y + invader.height &&
            bullet.y + bullet.height > invader.y) {
            
            // 命中
            invader.alive = false;
            
            // 爆発エフェクト生成（蜂の中心で）
            const explosionX = invader.x + invader.width / 2;
            const explosionY = invader.y + invader.height / 2;
            createExplosion(explosionX, explosionY, 20);
            
            bullet = null;
            score += invader.points;
            scoreElement.textContent = score;
            
            // ヒット音を確実に再生（勝利条件チェック前）
            playHitSound();
            
            // 勝利条件チェック（わずかに遅延して実行）
            setTimeout(() => {
                if (invaders.every(inv => !inv.alive)) {
                    currentStage++;
                    if (currentStage <= 4) {
                        // 次のステージへ
                        playVictorySound();
                        showStageComplete();
                        setTimeout(() => {
                            initNextStage();
                        }, 2000);
                    } else {
                        // 全ステージクリア
                        gameRunning = false;
                        playVictorySound();
                        showGameComplete();
                    }
                }
            }, 50); // 50ms遅延でヒット音の再生を確実にする
            
            break;
        }
    }
    
    // 蜂の針とプレイヤーの衝突検出
    for (let i = beeStingers.length - 1; i >= 0; i--) {
        const stinger = beeStingers[i];
        
        if (stinger.x < player.x + player.width &&
            stinger.x + stinger.width > player.x &&
            stinger.y < player.y + player.height &&
            stinger.y + stinger.height > player.y) {
            
            // プレイヤーが針に刺された
            // 衝撃エフェクト生成（プレイヤーの位置で）
            const impactX = player.x + player.width / 2;
            const impactY = player.y + player.height / 2;
            createImpactEffect(impactX, impactY, 15);
            
            gameRunning = false;
            playGameOverSound();
            showGameOverAnimation();
            
            // 針を削除
            beeStingers.splice(i, 1);
            break;
        }
    }
}

// 勝利アニメーション
function showVictoryAnimation() {
    let sparkles = [];
    for (let i = 0; i < 20; i++) {
        sparkles.push({
            x: Math.random() * canvas.width,
            y: Math.random() * canvas.height,
            size: Math.random() * 10 + 5,
            color: `hsl(${Math.random() * 360}, 70%, 60%)`,
            velocity: { x: (Math.random() - 0.5) * 4, y: (Math.random() - 0.5) * 4 }
        });
    }
    
    let animationTime = 0;
    function animate() {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        
        // 背景のグラデーション
        const gradient = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
        gradient.addColorStop(0, `hsl(${animationTime * 2}, 50%, 80%)`);
        gradient.addColorStop(1, `hsl(${animationTime * 2 + 60}, 50%, 80%)`);
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        
        // キラキラエフェクト
        sparkles.forEach(sparkle => {
            ctx.fillStyle = sparkle.color;
            ctx.beginPath();
            ctx.arc(sparkle.x, sparkle.y, sparkle.size, 0, Math.PI * 2);
            ctx.fill();
            
            sparkle.x += sparkle.velocity.x;
            sparkle.y += sparkle.velocity.y;
            sparkle.size *= 0.99;
        });
        
        // 勝利メッセージ
        ctx.fillStyle = '#FFFFFF';
        ctx.font = 'bold 48px Arial';
        ctx.textAlign = 'center';
        ctx.fillText('🍯 蜂を撃退！ 🍯', canvas.width / 2, canvas.height / 2 - 50);
        
        ctx.font = 'bold 32px Arial';
        ctx.fillText(`Score: ${score}`, canvas.width / 2, canvas.height / 2 + 20);
        
        animationTime++;
        if (animationTime < 180) {
            requestAnimationFrame(animate);
        } else {
            setTimeout(() => {
                gameOverElement.innerHTML = `
                    <div style="color: #32CD32; font-size: 32px; margin-bottom: 15px;">🍯 蜂を撃退！ 🍯</div>
                    <div style="color: #FF6347; font-size: 24px; margin-bottom: 20px;">最終スコア: ${score}点</div>
                    <button onclick="restartGame()">もう一度遊ぶ</button>
                `;
                gameOverElement.style.display = 'block';
            }, 500);
        }
    }
    animate();
}

// 敗北アニメーション
function showDefeatAnimation() {
    let shakeIntensity = 20;
    let animationTime = 0;
    
    function animate() {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        
        // 画面を揺らす
        ctx.save();
        ctx.translate(
            (Math.random() - 0.5) * shakeIntensity,
            (Math.random() - 0.5) * shakeIntensity
        );
        
        // 暗い背景
        ctx.fillStyle = `rgba(139, 0, 0, ${0.3 + Math.sin(animationTime * 0.3) * 0.2})`;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        
        // プレイヤー（スプレー缶）を描画
        const centerX = player.x + player.width / 2;
        const centerY = player.y + player.height / 2;
        
        // スプレー缶の本体
        ctx.fillStyle = '#999999'; // ダークシルバー（ゲームオーバー時）
        ctx.beginPath();
        ctx.ellipse(centerX, centerY + 5, player.width/3, player.height/2, 0, 0, Math.PI * 2);
        ctx.fill();
        
        // キャップ
        ctx.fillStyle = '#800000'; // ダークレッド
        ctx.beginPath();
        ctx.ellipse(centerX, centerY - 8, player.width/4, player.height/6, 0, 0, Math.PI * 2);
        ctx.fill();
        
        // ノズル
        ctx.fillStyle = '#000000';
        ctx.fillRect(centerX - 2, centerY - 15, 4, 8);
        
        // 蜂のようなインベーダーを描画（ゲームオーバー時）
        for (let invader of invaders) {
            if (!invader.alive) continue;
            
            const centerX = invader.x + invader.width / 2;
            const centerY = invader.y + invader.height / 2;
            const wingFlap = Math.sin(animationTime * 0.3) * 2;
            
            // 胴体（蜂の体）
            ctx.fillStyle = invader.color;
            ctx.beginPath();
            ctx.ellipse(centerX, centerY, invader.width/3, invader.height/2, 0, 0, Math.PI * 2);
            ctx.fill();
            
            // 黒いストライプ
            ctx.fillStyle = '#333333';
            for (let i = 0; i < 2; i++) {
                const stripeY = centerY - 4 + i * 4;
                ctx.fillRect(centerX - invader.width/4, stripeY, invader.width/2, 2);
            }
            
            // 頭部
            ctx.fillStyle = '#8B4513';
            ctx.beginPath();
            ctx.ellipse(centerX, centerY - 6, invader.width/5, invader.height/4, 0, 0, Math.PI * 2);
            ctx.fill();
            
            // 目
            ctx.fillStyle = '#FF0000'; // ゲームオーバー時は赤い目
            ctx.beginPath();
            ctx.arc(centerX - 2, centerY - 6, 1, 0, Math.PI * 2);
            ctx.fill();
            ctx.beginPath();
            ctx.arc(centerX + 2, centerY - 6, 1, 0, Math.PI * 2);
            ctx.fill();
        }
        
        // 敗北メッセージ
        ctx.fillStyle = '#FF0000';
        ctx.font = 'bold 48px Arial';
        ctx.textAlign = 'center';
        ctx.fillText('GAME OVER', canvas.width / 2, canvas.height / 2);
        
        ctx.restore();
        
        shakeIntensity *= 0.95;
        animationTime++;
        
        if (animationTime < 120) {
            requestAnimationFrame(animate);
        } else {
            gameOverElement.innerHTML = `
                <div style="color: #FF4500; font-size: 28px; margin-bottom: 15px;">蜂に負けた！</div>
                <div style="color: #FF6347; font-size: 20px; margin-bottom: 20px;">最終スコア: ${score}点</div>
                <button onclick="restartGame()">もう一度遊ぶ</button>
            `;
            gameOverElement.style.display = 'block';
        }
    }
    animate();
}

// ゲームオーバー用関数 (showGameOverAnimationのエイリアス)
function showGameOverAnimation() {
    showDefeatAnimation();
}

// ゲームオーバーチェック
function checkGameOver() {
    for (let invader of invaders) {
        if (invader.alive && invader.y + invader.height >= player.y) {
            gameRunning = false;
            playDefeatSound();
            showDefeatAnimation();
            return;
        }
    }
}

// 描画関数
function draw() {
    // 背景をクリア
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // プレイヤー（スプレー缶）を描画
    const centerX = player.x + player.width / 2;
    const centerY = player.y + player.height / 2;
    
    // スプレー缶の本体（縦長の楕円）
    ctx.fillStyle = '#C0C0C0'; // シルバー
    ctx.beginPath();
    ctx.ellipse(centerX, centerY + 5, player.width/3, player.height/2, 0, 0, Math.PI * 2);
    ctx.fill();
    
    // スプレー缶の上部（キャップ）
    ctx.fillStyle = '#FF0000'; // 赤いキャップ
    ctx.beginPath();
    ctx.ellipse(centerX, centerY - 8, player.width/4, player.height/6, 0, 0, Math.PI * 2);
    ctx.fill();
    
    // ノズル
    ctx.fillStyle = '#000000';
    ctx.fillRect(centerX - 2, centerY - 15, 4, 8);
    
    // ラベル
    ctx.fillStyle = '#FFD700';
    ctx.fillRect(centerX - player.width/4, centerY, player.width/2, player.height/4);
    
    // ラベルのテキスト
    ctx.fillStyle = '#000000';
    ctx.font = '8px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('BEE', centerX, centerY + 6);
    ctx.fillText('AWAY', centerX, centerY + 14);
    
    // スプレーの液体を描画
    if (bullet) {
        // スプレー液体のメイン部分（液滴状）
        const bulletCenterX = bullet.x + bullet.width / 2;
        const bulletCenterY = bullet.y + bullet.height / 2;
        
        // メインの液滴（半透明の毒々しい緑）
        ctx.fillStyle = 'rgba(50, 255, 50, 0.8)';
        ctx.beginPath();
        ctx.ellipse(bulletCenterX, bulletCenterY, bullet.width/2, bullet.height/2, 0, 0, Math.PI * 2);
        ctx.fill();
        
        // 液体の核心部分（濃い緑）
        ctx.fillStyle = 'rgba(0, 200, 0, 0.9)';
        ctx.beginPath();
        ctx.ellipse(bulletCenterX, bulletCenterY, bullet.width/3, bullet.height/3, 0, 0, Math.PI * 2);
        ctx.fill();
        
        // ハイライト（白い光沢）
        ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
        ctx.beginPath();
        ctx.ellipse(bulletCenterX - 1, bulletCenterY - 1, bullet.width/4, bullet.height/4, 0, 0, Math.PI * 2);
        ctx.fill();
        
        // スプレーの霧効果（周りの小さな粒子）
        ctx.fillStyle = 'rgba(50, 255, 50, 0.3)';
        for (let i = 0; i < 3; i++) {
            const angle = (Math.PI * 2 / 3) * i + animationFrame * 0.1;
            const distance = 8;
            const particleX = bulletCenterX + Math.cos(angle) * distance;
            const particleY = bulletCenterY + Math.sin(angle) * distance;
            ctx.beginPath();
            ctx.arc(particleX, particleY, 1, 0, Math.PI * 2);
            ctx.fill();
        }
    }
    
    // 蜂のようなインベーダーを描画
    for (let invader of invaders) {
        if (!invader.alive) continue;
        
        const centerX = invader.x + invader.width / 2;
        const centerY = invader.y + invader.height / 2;
        const wingFlap = Math.sin(animationFrame * 0.3) * 2; // 羽ばたき
        
        // 影
        ctx.fillStyle = 'rgba(0, 0, 0, 0.2)';
        ctx.beginPath();
        ctx.ellipse(centerX + 2, centerY + invader.height/2 + 2, invader.width/2, 4, 0, 0, Math.PI * 2);
        ctx.fill();
        
        // 羽（背景）- 動く
        ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
        ctx.beginPath();
        // 左の羽
        ctx.ellipse(centerX - 12, centerY - 5 + wingFlap, 8, 12, -0.3, 0, Math.PI * 2);
        ctx.fill();
        // 右の羽
        ctx.beginPath();
        ctx.ellipse(centerX + 12, centerY - 5 + wingFlap, 8, 12, 0.3, 0, Math.PI * 2);
        ctx.fill();
        
        // 胴体（蜂の体） - タイプに応じたサイズと色
        ctx.fillStyle = invader.color;
        let bodyWidth = invader.width/3;
        let bodyHeight = invader.height/2;
        
        if (invader.type === 'queen') {
            bodyWidth *= 1.5; // クイーンは大きい
            bodyHeight *= 1.3;
        } else if (invader.type === 'speed') {
            bodyWidth *= 0.8; // スピード蜂は小さい
            bodyHeight *= 0.8;
        }
        
        ctx.beginPath();
        ctx.ellipse(centerX, centerY, bodyWidth, bodyHeight, 0, 0, Math.PI * 2);
        ctx.fill();
        
        // 黒いストライプ（蜂らしく）
        ctx.fillStyle = '#333333';
        for (let i = 0; i < 3; i++) {
            const stripeY = centerY - 6 + i * 4;
            ctx.fillRect(centerX - invader.width/4, stripeY, invader.width/2, 2);
        }
        
        // 頭部
        ctx.fillStyle = '#8B4513';
        ctx.beginPath();
        ctx.ellipse(centerX, centerY - 8, invader.width/4, invader.height/4, 0, 0, Math.PI * 2);
        ctx.fill();
        
        // 触角
        ctx.strokeStyle = '#654321';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(centerX - 3, centerY - 12);
        ctx.lineTo(centerX - 6, centerY - 16);
        ctx.moveTo(centerX + 3, centerY - 12);
        ctx.lineTo(centerX + 6, centerY - 16);
        ctx.stroke();
        
        // 触角の先（小さな丸）
        ctx.fillStyle = '#654321';
        ctx.beginPath();
        ctx.arc(centerX - 6, centerY - 16, 1, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(centerX + 6, centerY - 16, 1, 0, Math.PI * 2);
        ctx.fill();
        
        // 目
        ctx.fillStyle = '#000000';
        ctx.beginPath();
        ctx.arc(centerX - 3, centerY - 8, 2, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(centerX + 3, centerY - 8, 2, 0, Math.PI * 2);
        ctx.fill();
        
        // 目のハイライト
        ctx.fillStyle = '#FFFFFF';
        ctx.beginPath();
        ctx.arc(centerX - 3, centerY - 9, 1, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(centerX + 3, centerY - 9, 1, 0, Math.PI * 2);
        ctx.fill();
    }
    
    // 蜂の針を描画
    for (let stinger of beeStingers) {
        stinger.draw();
    }
    
    // パーティクルエフェクトを描画
    for (let particle of particles) {
        particle.draw();
    }
    
    // パワーアップ状態表示
    if (rapidFire.active) {
        ctx.fillStyle = 'rgba(255, 0, 0, 0.8)';
        ctx.fillRect(10, 10, 200, 30);
        ctx.fillStyle = 'white';
        ctx.font = 'bold 16px Arial';
        const remainingTime = Math.ceil(rapidFire.timer / 60);
        ctx.fillText(`連射モード: ${remainingTime}秒`, 15, 30);
    }
}

// ゲームループ
function gameLoop() {
    if (!gameRunning) return;
    
    animationFrame++;
    updatePowerUps();
    updatePlayer();
    updateBullet();
    updateInvaders();
    updateBeeStingers();
    updateParticles();
    checkCollisions();
    checkGameOver();
    draw();
    
    requestAnimationFrame(gameLoop);
}

// ゲーム再開始
function restartGame() {
    gameRunning = true;
    score = 0;
    currentStage = 1;
    animationFrame = 0;
    scoreElement.textContent = score;
    updateStageDisplay();
    gameOverElement.style.display = 'none';
    bullet = null;
    beeStingers = []; // 針もクリア
    particles = []; // パーティクルもクリア
    rapidFire.active = false; // パワーアップもリセット
    player.x = canvas.width / 2 - 25;
    invaderSpeed = 1; // スピードもリセット
    initInvaders();
    gameLoop();
}

// ゲーム開始
initInvaders();
gameLoop();