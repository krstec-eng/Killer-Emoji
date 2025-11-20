
export const PLAYER_WIDTH_VW = 5;
export const PLAYER_HEIGHT_VH = 5;
export const PLAYER_SPEED = 1.0; // in vw

export const EMOJI_SIZE_VW = 4;
export const EMOJI_SPEED_START = 0.2; // in vh
export const EMOJI_SPAWN_INTERVAL_START = 600; // ms
export const EMOJI_SPAWN_INTERVAL_MIN = 150; // ms

export const DIFFICULTY_SCORE_THRESHOLD = 100; // Zwiększ poziom co 100 punktów
export const DIFFICULTY_SPEED_INCREASE = 1.2; // Mnożnik prędkości emoji
export const DIFFICULTY_SPAWN_DECREASE = 0.9; // Mnożnik interwału pojawiania się

export const FALLING_EMOJIS = ['💧', '🔥', '💀', '💣', '😂', '🌶️', '🚀', '⭐', '🍕', '👻', '🤖', '🤯'];

export const CHARACTERS = {
    boy: {
        idle: '🧍‍♂️',
        walk: ['🏃‍♂️', '🚶‍♂️'],
    },
    girl: {
        idle: '🧍‍♀️',
        walk: ['🏃‍♀️', '🚶‍♀️'],
    }
};

export const COLLISION_EMOJI = '💥';