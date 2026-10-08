const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

app.use(express.static('public'));

const WORLD_SIZE = 4000;
const players = {};
let foods = [];

// Danh sách các loại thức ăn phong phú (Trái cây, Bánh kẹo, Ngọc)
const FOOD_TYPES = [
    { type: 'fruit', emoji: '🍎', score: 10, size: 14 },
    { type: 'fruit', emoji: '🍉', score: 15, size: 16 },
    { type: 'fruit', emoji: '🍓', score: 12, size: 14 },
    { type: 'fruit', emoji: '🍌', score: 10, size: 14 },
    { type: 'fruit', emoji: '🍇', score: 18, size: 15 },
    { type: 'fruit', emoji: '🍊', score: 12, size: 14 },
    { type: 'fruit', emoji: '🍍', score: 20, size: 17 },
    { type: 'candy', emoji: '🍩', score: 25, size: 18 },
    { type: 'candy', emoji: '🧁', score: 20, size: 16 },
    { type: 'candy', emoji: '🍭', score: 30, size: 20 },
    { type: 'orb', emoji: '✨', score: 50, size: 22 }
];

const SKINS = [
    { id: 'cyber', name: 'Cyber Neon', colors: ['#00f2fe', '#4facfe'] },
    { id: 'fire', name: 'Lửa Thiêng', colors: ['#ff0844', '#ffb199'] },
    { id: 'gold', name: 'Hoàng Kim', colors: ['#f12711', '#f5af19'] },
    { id: 'purple', name: 'Mộng Mơ', colors: ['#b224ef', '#7579ff'] },
    { id: 'jade', name: 'Ngọc Bích', colors: ['#11998e', '#38ef7d'] },
    { id: 'lava', name: 'Dung Nham', colors: ['#fc4a1a', '#f7b733'] }
];

const HEAD_TYPES = [
    { id: 'normal', name: 'Mắt Thường', icon: '👀' },
    { id: 'sunglasses', name: 'Kính Râm', icon: '🕶️' },
    { id: 'crown', name: 'Vương Miện', icon: '👑' },
    { id: 'bunny', name: 'Tai Thỏ', icon: '🐰' },
    { id: 'wizard', name: 'Nón Phù Thủy', icon: '🧙' }
];

function spawnFood() {
    const randomFood = FOOD_TYPES[Math.floor(Math.random() * FOOD_TYPES.length)];
    return {
        id: Math.random().toString(36).substr(2, 9),
        x: Math.random() * (WORLD_SIZE - 200) + 100,
        y: Math.random() * (WORLD_SIZE - 200) + 100,
        ...randomFood
    };
}

function initFoods() {
    if (foods.length < 600) {
        for (let i = foods.length; i < 600; i++) {
            foods.push(spawnFood());
        }
    }
}
initFoods();

io.on('connection', (socket) => {
    console.log('Người chơi kết nối:', socket.id);

    socket.on('joinRoom', (data) => {
        const startX = Math.random() * (WORLD_SIZE - 600) + 300;
        const startY = Math.random() * (WORLD_SIZE - 600) + 300;
        const skinIdx = Number(data.skinIndex) || 0;
        const roomType = data.roomType || 'medium';
        
        let baseSpeed = 4;
        if (roomType === 'easy') baseSpeed = 3.2;
        if (roomType === 'hard') baseSpeed = 5.2;

        const initialSegments = [];
        for (let i = 0; i < 20; i++) {
            initialSegments.push({ x: startX - i * 5, y: startY });
        }

        players[socket.id] = {
            id: socket.id,
            name: data.name || 'Rắn_Săn_Mồi',
            x: startX,
            y: startY,
            angle: 0,
            score: 0,
            skinIndex: skinIdx,
            headType: data.headType || 'normal',
            roomType: roomType,
            speed: baseSpeed,
            segments: initialSegments
        };

        socket.emit('initData', { 
            id: socket.id, 
            foods, 
            worldSize: WORLD_SIZE, 
            skins: SKINS,
            headTypes: HEAD_TYPES
        });
    });

    socket.on('updatePlayer', (data) => {
        if (players[socket.id]) {
            players[socket.id].x = data.x;
            players[socket.id].y = data.y;
            players[socket.id].angle = data.angle;
            players[socket.id].score = data.score;
            players[socket.id].segments = data.segments;
        }
    });

    socket.on('eatFood', (foodId) => {
        const idx = foods.findIndex(f => f.id === foodId);
        if (idx !== -1) {
            foods.splice(idx, 1);
            foods.push(spawnFood());
            io.emit('foodUpdated', foods);
        }
    });

    socket.on('disconnect', () => {
        delete players[socket.id];
        io.emit('playerLeft', socket.id);
    });
});

setInterval(() => {
    io.emit('gameState', { players });
}, 1000 / 30);

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Server chạy tại: http://localhost:${PORT}`);
});