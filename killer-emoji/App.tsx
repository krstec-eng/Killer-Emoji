import React, { useState, useEffect, useRef, useCallback } from 'react';
import type { Emoji, HighScore } from './types';
import ParticleBackground from './ParticleBackground';
import { 
    PLAYER_WIDTH_VW, 
    PLAYER_SPEED,
    EMOJI_SIZE_VW,
    EMOJI_SPEED_START, 
    EMOJI_SPAWN_INTERVAL_START,
    EMOJI_SPAWN_INTERVAL_MIN,
    DIFFICULTY_SCORE_THRESHOLD,
    DIFFICULTY_SPEED_INCREASE,
    DIFFICULTY_SPAWN_DECREASE,
    FALLING_EMOJIS,
    CHARACTERS,
    COLLISION_EMOJI
} from './constants';
import { AudioManager } from './audio';

type GameState = 'start' | 'playing' | 'gameOver';
type PlayerDirection = 'idle' | 'left' | 'right';
type CharacterType = 'boy' | 'girl';

interface MenuEmoji {
    id: number;
    x: number;
    y: number;
    emoji: string;
    speed: number;
    size: number;
    opacity: number;
}

const STORAGE_KEY = 'killerEmojiHighScores';

// Helper component for animated text
const AnimatedText = ({ text }: { text: string }) => (
    <h1 className="text-5xl md:text-7xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-purple-400 via-pink-500 to-red-500 animate-pulse">
        {text}
    </h1>
);

// Helper component for High Score List
const HighScoreList = ({ scores }: { scores: HighScore[] }) => (
    <div className="mt-6 w-full max-w-sm">
        <h3 className="text-2xl font-bold text-yellow-300 mb-3">Ranking:</h3>
        {scores.length > 0 ? (
            <ol className="list-decimal list-inside bg-slate-900/50 p-4 rounded-lg space-y-2 text-left">
                {scores.map((s, index) => (
                    <li key={index} className="text-lg flex justify-between items-center">
                        <span>
                            <span className="font-bold text-slate-300 mr-2">{index + 1}.</span>
                            {s.name}
                        </span>
                        <span className="font-bold text-yellow-400">{s.score}</span>
                    </li>
                ))}
            </ol>
        ) : (
            <p className="text-slate-400">Brak wyników. Bądź pierwszy!</p>
        )}
    </div>
);


const App: React.FC = () => {
    const [gameState, setGameState] = useState<GameState>('start');
    const [score, setScore] = useState(0);
    const [playerPosition, setPlayerPosition] = useState(50); // percentage from left
    const [emojis, setEmojis] = useState<Emoji[]>([]);
    const [collidedEmoji, setCollidedEmoji] = useState<string | null>(null);
    const [volumeLevel, setVolumeLevel] = useState(4); // 0-5 levels
    const [playerDirection, setPlayerDirection] = useState<PlayerDirection>('idle');
    const [collisionPosition, setCollisionPosition] = useState<{ x: number; y: number } | null>(null);
    const [walkFrame, setWalkFrame] = useState(0);
    const [selectedCharacter, setSelectedCharacter] = useState<CharacterType>('boy');
    const [menuEmojis, setMenuEmojis] = useState<MenuEmoji[]>([]);
    const [highScores, setHighScores] = useState<HighScore[]>([]);
    const [isNewHighScore, setIsNewHighScore] = useState(false);
    const [playerName, setPlayerName] = useState('');
    const [showHighScores, setShowHighScores] = useState(false);
    const [difficultyLevel, setDifficultyLevel] = useState(1);


    const gameAreaRef = useRef<HTMLDivElement>(null);
    const animationFrameRef = useRef<number | null>(null);
    const menuAnimationRef = useRef<number | null>(null);
    const lastSpawnTimeRef = useRef(0);
    
    const emojiSpeedRef = useRef(EMOJI_SPEED_START);
    const emojiSpawnIntervalRef = useRef(EMOJI_SPAWN_INTERVAL_START);
    const audioManagerRef = useRef<AudioManager | null>(null);

    // Movement state for both keyboard and touch
    const isMovingLeft = useRef(false);
    const isMovingRight = useRef(false);

    // High score management
    const getHighScoresFromStorage = (): HighScore[] => {
        try {
            const scoresJSON = localStorage.getItem(STORAGE_KEY);
            return scoresJSON ? JSON.parse(scoresJSON) : [];
        } catch (error) {
            console.error("Could not parse high scores from localStorage", error);
            return [];
        }
    };

    const saveHighScoresToStorage = (scores: HighScore[]) => {
        const sortedScores = [...scores].sort((a, b) => b.score - a.score);
        const topScores = sortedScores.slice(0, 5);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(topScores));
        setHighScores(topScores);
    };

    useEffect(() => {
        setHighScores(getHighScoresFromStorage());
    }, []);

    const handleSaveScore = () => {
        const finalScore = Math.floor(score / 10);
        const newScore: HighScore = {
            name: playerName.trim() === '' ? 'Anonim' : playerName.trim(),
            score: finalScore
        };
        const currentHighScores = getHighScoresFromStorage();
        saveHighScoresToStorage([...currentHighScores, newScore]);
        setIsNewHighScore(false); // Hide the input form
    };

    const handleShareScore = async () => {
        const finalScore = Math.floor(score / 10);
        const shareData = {
            title: 'Killer Emoji',
            text: `Zdobyłem ${finalScore} punktów w Killer Emoji! Spróbuj mnie pobić! 🤪`,
            url: window.location.href
        };

        if (navigator.share) {
            try {
                await navigator.share(shareData);
            } catch (err) {
                console.log('Error sharing:', err);
            }
        } else {
            try {
                await navigator.clipboard.writeText(`${shareData.text} ${shareData.url}`);
                alert('Link skopiowany do schowka!');
            } catch (err) {
                console.error('Could not copy text: ', err);
            }
        }
    };

    // Create decorative emojis for the start menu
    useEffect(() => {
        const createInitialEmojis = () => {
            const initialEmojis: MenuEmoji[] = [];
            for (let i = 0; i < 10; i++) {
                initialEmojis.push({
                    id: i,
                    x: Math.random() * 100,
                    y: Math.random() * 100 + 100, // Start below the screen
                    emoji: FALLING_EMOJIS[Math.floor(Math.random() * FALLING_EMOJIS.length)],
                    speed: Math.random() * 0.05 + 0.02, // Very slow
                    size: Math.random() * 6 + 4, // 4vw to 10vw
                    opacity: Math.random() * 0.3 + 0.1,
                });
            }
            setMenuEmojis(initialEmojis);
        };
        createInitialEmojis();
    }, []);

    // Animate decorative emojis in the start menu
    useEffect(() => {
        if (gameState !== 'start') return;

        const animateMenu = () => {
            setMenuEmojis(prev => prev.map(e => {
                let newY = e.y - e.speed;
                if (newY < -20) { // Reset when it goes way off screen
                    return {
                        ...e,
                        y: 120,
                        x: Math.random() * 100,
                    };
                }
                return { ...e, y: newY };
            }));
            menuAnimationRef.current = requestAnimationFrame(animateMenu);
        };

        menuAnimationRef.current = requestAnimationFrame(animateMenu);

        return () => {
            if (menuAnimationRef.current) {
                cancelAnimationFrame(menuAnimationRef.current);
            }
        };
    }, [gameState]);


    const resetGame = useCallback(() => {
        setScore(0);
        setPlayerPosition(50);
        setEmojis([]);
        setGameState('playing');
        setCollisionPosition(null);
        setCollidedEmoji(null);
        setIsNewHighScore(false);
        // Do not reset playerName here
        setShowHighScores(false);
        setDifficultyLevel(1);
        lastSpawnTimeRef.current = performance.now();
        emojiSpeedRef.current = EMOJI_SPEED_START;
        emojiSpawnIntervalRef.current = EMOJI_SPAWN_INTERVAL_START;
    }, []);

    const handleStartGame = () => {
        if (!audioManagerRef.current) {
            audioManagerRef.current = new AudioManager();
        }
        audioManagerRef.current.init();
        audioManagerRef.current.playStartSound();
        resetGame();
    };
    
    // Keyboard controls for volume
    useEffect(() => {
        const handleVolumeChange = (e: KeyboardEvent) => {
            if (e.key === '-' || e.key === '_') {
                setVolumeLevel(prev => Math.max(0, prev - 1));
            } else if (e.key === '+' || e.key === '=') {
                setVolumeLevel(prev => Math.min(5, prev + 1));
            }
        };

        window.addEventListener('keydown', handleVolumeChange);
        return () => {
            window.removeEventListener('keydown', handleVolumeChange);
        };
    }, []);
    
    // Update audio manager when volume level changes
    useEffect(() => {
        if (audioManagerRef.current) {
            // Map volume level 0-5 to a 0.0-1.0 float
            audioManagerRef.current.setVolume(volumeLevel / 5);
        }
    }, [volumeLevel]);


    const gameLoop = useCallback((timestamp: number) => {
        if (gameState !== 'playing') return;

        // Player movement
        setPlayerPosition(prev => {
            let newPos = prev;
            if (isMovingLeft.current) {
                newPos -= PLAYER_SPEED;
            }
            if (isMovingRight.current) {
                newPos += PLAYER_SPEED;
            }
            return Math.max(PLAYER_WIDTH_VW / 2, Math.min(100 - PLAYER_WIDTH_VW / 2, newPos));
        });

        // Score update based on time
        setScore(prevScore => prevScore + 1);

        // Emoji spawning
        if (timestamp - lastSpawnTimeRef.current > emojiSpawnIntervalRef.current) {
            lastSpawnTimeRef.current = timestamp;
            const newEmoji: Emoji = {
                id: timestamp,
                x: Math.random() * (100 - EMOJI_SIZE_VW), // vw percentage
                y: -10, // vh to start off-screen
                emoji: FALLING_EMOJIS[Math.floor(Math.random() * FALLING_EMOJIS.length)],
                speed: emojiSpeedRef.current * (0.8 + Math.random() * 0.4),
                rotation: Math.random() * 360,
            };
            setEmojis(prev => [...prev, newEmoji]);
            audioManagerRef.current?.playSpawnSound();
        }

        // Increase difficulty based on score
        const displayedScore = Math.floor(score / 10);
        const newDifficultyLevel = Math.min(5, Math.floor(displayedScore / DIFFICULTY_SCORE_THRESHOLD) + 1);

        if (newDifficultyLevel > difficultyLevel) {
            setDifficultyLevel(newDifficultyLevel);
            emojiSpeedRef.current *= DIFFICULTY_SPEED_INCREASE;
            emojiSpawnIntervalRef.current = Math.max(
                EMOJI_SPAWN_INTERVAL_MIN,
                emojiSpawnIntervalRef.current * DIFFICULTY_SPAWN_DECREASE
            );
        }

        // Update emoji positions & check for collision/cleanup
        const playerRect = {
            left: playerPosition - PLAYER_WIDTH_VW / 2,
            right: playerPosition + PLAYER_WIDTH_VW / 2,
            top: 90,
            bottom: 100
        };

        setEmojis(prev => {
            const updatedEmojis: Emoji[] = [];
            for (const emoji of prev) {
                const newY = emoji.y + emoji.speed;

                // Check collision
                const emojiRect = {
                    left: emoji.x,
                    right: emoji.x + EMOJI_SIZE_VW,
                    top: newY,
                    bottom: newY + EMOJI_SIZE_VW,
                };

                if (
                    playerRect.left < emojiRect.right &&
                    playerRect.right > emojiRect.left &&
                    playerRect.top < emojiRect.bottom &&
                    playerRect.bottom > emojiRect.top
                ) {
                    const finalScore = Math.floor(score / 10);
                    const currentHighScores = getHighScoresFromStorage();
                    const lowestHighScore = currentHighScores.length < 5 ? 0 : currentHighScores[currentHighScores.length - 1].score;

                    if (finalScore > 0 && finalScore > lowestHighScore) {
                        setIsNewHighScore(true);
                    } else {
                        setIsNewHighScore(false);
                    }
                    
                    setCollisionPosition({ x: playerPosition, y: 95 });
                    setCollidedEmoji(emoji.emoji);
                    setGameState('gameOver');
                    audioManagerRef.current?.playCollisionSound();
                    return []; // Stop processing
                }

                // Keep emoji if it's still on screen
                if (newY < 100) {
                    updatedEmojis.push({ ...emoji, y: newY });
                }
            }
            return updatedEmojis;
        });

        animationFrameRef.current = requestAnimationFrame(gameLoop);
    }, [gameState, playerPosition, score, difficultyLevel]);

    useEffect(() => {
        if (gameState === 'playing') {
            animationFrameRef.current = requestAnimationFrame(gameLoop);
        }
        return () => {
            if (animationFrameRef.current) {
                cancelAnimationFrame(animationFrameRef.current);
            }
        };
    }, [gameState, gameLoop]);
    
    // Update player direction for animation based on movement state
    useEffect(() => {
        if (isMovingLeft.current) {
            setPlayerDirection('left');
        } else if (isMovingRight.current) {
            setPlayerDirection('right');
        } else {
            setPlayerDirection('idle');
        }
    }, [isMovingLeft.current, isMovingRight.current]);

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'ArrowLeft' || e.key.toLowerCase() === 'a') {
                isMovingLeft.current = true;
            }
            if (e.key === 'ArrowRight' || e.key.toLowerCase() === 'd') {
                isMovingRight.current = true;
            }
        };

        const handleKeyUp = (e: KeyboardEvent) => {
             if (e.key === 'ArrowLeft' || e.key.toLowerCase() === 'a') {
                isMovingLeft.current = false;
            }
            if (e.key === 'ArrowRight' || e.key.toLowerCase() === 'd') {
                isMovingRight.current = false;
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        window.addEventListener('keyup', handleKeyUp);
        
        return () => {
            window.removeEventListener('keydown', handleKeyDown);
            window.removeEventListener('keyup', handleKeyUp);
        };
    }, []);

    useEffect(() => {
        if (playerDirection === 'left' || playerDirection === 'right') {
            const walkInterval = setInterval(() => {
                setWalkFrame(prevFrame => (prevFrame + 1) % CHARACTERS[selectedCharacter].walk.length);
            }, 200);
            return () => clearInterval(walkInterval);
        }
    }, [playerDirection, selectedCharacter]);

    const getPlayerEmoji = () => {
        const character = CHARACTERS[selectedCharacter];
        if (playerDirection === 'idle') {
            return character.idle;
        }
        return character.walk[walkFrame];
    };
    
    // Touch controls handlers
    const handleTouchStart = (direction: 'left' | 'right') => (e: React.TouchEvent) => {
        // e.preventDefault(); // Removed here, better handled by CSS touch-action
        if (direction === 'left') isMovingLeft.current = true;
        if (direction === 'right') isMovingRight.current = true;
    };

    const handleTouchEnd = (direction: 'left' | 'right') => (e: React.TouchEvent) => {
        // e.preventDefault();
        if (direction === 'left') isMovingLeft.current = false;
        if (direction === 'right') isMovingRight.current = false;
    };


    const renderContent = () => {
        switch (gameState) {
            case 'start':
                if (showHighScores) {
                    return (
                         <div className="text-center flex flex-col items-center gap-6 relative z-10 bg-slate-900/50 backdrop-blur-md p-8 rounded-2xl shadow-2xl border border-slate-700/50 max-h-[90vh] overflow-y-auto">
                             <AnimatedText text="Ranking" />
                             <HighScoreList scores={highScores} />
                             <button
                                onClick={() => setShowHighScores(false)}
                                className="mt-4 bg-blue-500 text-white font-bold py-3 px-6 rounded-lg text-xl shadow-lg hover:bg-blue-600 transform hover:scale-105 transition-all duration-300"
                            >
                                Wróć
                            </button>
                         </div>
                    );
                }
                return (
                    <div className="text-center flex flex-col items-center gap-6 relative z-10 bg-slate-900/50 backdrop-blur-md p-8 rounded-2xl shadow-2xl border border-slate-700/50 max-h-[90vh] overflow-y-auto">
                        <AnimatedText text="Killer Emoji" />
                        <p className="text-slate-300 text-lg max-w-md">Użyj strzałek [←] [→] lub dotknij ekranu, by unikać zabójczych emoji.</p>

                        <div className="flex flex-col items-center gap-3 mt-4">
                            <p className="text-slate-200 font-semibold">Wybierz postać:</p>
                            <div className="flex gap-4">
                                <button
                                    onClick={() => setSelectedCharacter('boy')}
                                    className={`p-4 rounded-lg bg-slate-800/60 border-2 transition-all duration-200 ${selectedCharacter === 'boy' ? 'border-yellow-400 scale-110' : 'border-transparent hover:border-slate-500'}`}
                                >
                                    <span className="text-5xl">{CHARACTERS.boy.idle}</span>
                                </button>
                                <button
                                    onClick={() => setSelectedCharacter('girl')}
                                    className={`p-4 rounded-lg bg-slate-800/60 border-2 transition-all duration-200 ${selectedCharacter === 'girl' ? 'border-yellow-400 scale-110' : 'border-transparent hover:border-slate-500'}`}
                                >
                                    <span className="text-5xl">{CHARACTERS.girl.idle}</span>
                                </button>
                            </div>
                        </div>

                        <div className="mt-4 w-full max-w-xs">
                            <input 
                                type="text"
                                value={playerName}
                                onChange={(e) => setPlayerName(e.target.value)}
                                placeholder="Wpisz swoje imię"
                                maxLength={12}
                                className="bg-slate-700/80 text-white w-full text-center p-3 rounded-md border border-slate-500 focus:ring-2 focus:ring-yellow-400 focus:outline-none text-lg"
                            />
                        </div>


                        <div className="flex gap-4 mt-4">
                            <button
                                onClick={handleStartGame}
                                className="bg-green-500 text-white font-bold py-4 px-8 rounded-lg text-2xl shadow-lg hover:bg-green-600 transform hover:scale-105 transition-all duration-300"
                            >
                                Graj
                            </button>
                             <button
                                onClick={() => setShowHighScores(true)}
                                className="bg-purple-500 text-white font-bold py-4 px-8 rounded-lg text-2xl shadow-lg hover:bg-purple-600 transform hover:scale-105 transition-all duration-300"
                            >
                                Ranking
                            </button>
                        </div>
                    </div>
                );
            case 'gameOver':
                return (
                    <div className="text-center flex flex-col items-center gap-6 bg-slate-800/80 p-8 rounded-xl shadow-2xl backdrop-blur-sm relative z-10 max-h-[90vh] overflow-y-auto">
                         <h2 className="text-6xl font-bold text-red-500">Koniec Gry!</h2>
                         <p className="text-2xl text-slate-200">Złapał Cię: <span className="text-4xl">{collidedEmoji}</span></p>
                         <p className="text-3xl text-slate-100">Twój wynik: <span className="font-bold text-yellow-400">{Math.floor(score / 10)}</span></p>
                        {isNewHighScore ? (
                            <div className="flex flex-col items-center gap-3 mt-2">
                                <p className="text-lg text-green-400 font-semibold animate-pulse">Gratulacje! Nowy rekord!</p>
                                <input 
                                    type="text"
                                    value={playerName}
                                    onChange={(e) => setPlayerName(e.target.value)}
                                    placeholder="Wpisz swoje imię"
                                    maxLength={12}
                                    className="bg-slate-700 text-white text-center p-2 rounded-md border border-slate-500 focus:ring-2 focus:ring-yellow-400 focus:outline-none"
                                />
                                <button 
                                    onClick={handleSaveScore}
                                    className="bg-yellow-500 text-slate-900 font-bold py-2 px-4 rounded-lg shadow-md hover:bg-yellow-400 transition-colors"
                                >
                                    Zapisz wynik
                                </button>
                            </div>
                        ) : (
                            <div className="flex gap-4">
                                <button
                                    onClick={handleStartGame}
                                    className="mt-4 bg-blue-500 text-white font-bold py-3 px-6 rounded-lg text-xl shadow-lg hover:bg-blue-600 transform hover:scale-105 transition-all duration-300"
                                >
                                    Zagraj Ponownie
                                </button>
                                <button
                                    onClick={handleShareScore}
                                    className="mt-4 bg-pink-500 text-white font-bold py-3 px-6 rounded-lg text-xl shadow-lg hover:bg-pink-600 transform hover:scale-105 transition-all duration-300 flex items-center gap-2"
                                >
                                    <span>📤</span> Udostępnij
                                </button>
                            </div>
                        )}
                        <HighScoreList scores={highScores} />
                    </div>
                );
            case 'playing':
                const playerStyle: React.CSSProperties = {
                    left: `${playerPosition}%`,
                    width: `${PLAYER_WIDTH_VW}vw`,
                    fontSize: `${PLAYER_WIDTH_VW}vw`,
                    lineHeight: 1,
                    transform: 'translateX(-50%)',
                };

                if (playerDirection !== 'idle') {
                    const isBobbingUp = walkFrame % 2 === 0;
                    const verticalBob = isBobbingUp ? '-0.4vw' : '0';
                    const sway = isBobbingUp ? '5deg' : '-5deg';
                    playerStyle.transform += ` translateY(${verticalBob}) rotate(${sway})`;
                }
                
                if (playerDirection === 'right') {
                    playerStyle.transform += ' scaleX(-1)';
                }

                return (
                    <div ref={gameAreaRef} className="absolute inset-0 overflow-hidden">
                        {/* Touch Controls */}
                        <div 
                            className="absolute left-0 top-0 w-1/2 h-full z-20"
                            style={{ touchAction: 'none' }}
                            onTouchStart={handleTouchStart('left')}
                            onTouchEnd={handleTouchEnd('left')}
                        ></div>
                        <div 
                            className="absolute right-0 top-0 w-1/2 h-full z-20"
                            style={{ touchAction: 'none' }}
                            onTouchStart={handleTouchStart('right')}
                            onTouchEnd={handleTouchEnd('right')}
                        ></div>

                        <div className="absolute top-4 left-4 text-white text-2xl font-bold bg-black/50 p-2 rounded-md z-10">
                            Wynik: {Math.floor(score / 10)}
                        </div>
                        
                        {/* Indicators Container */}
                        <div className="absolute top-4 right-4 flex flex-col items-end gap-2 bg-black/50 p-2 rounded-md z-10">
                          {/* Volume Indicator */}
                          <div className="flex items-center gap-2">
                            <span className="text-2xl w-8 text-center">
                              {volumeLevel === 0 ? '🔇' : '🔊'}
                            </span>
                            <div className="flex items-end gap-1 h-6">
                              {Array.from({ length: 5 }).map((_, i) => (
                                <div
                                  key={i}
                                  className={`w-2 rounded-sm transition-all duration-150 ${
                                    i < volumeLevel ? 'bg-sky-400' : 'bg-slate-600'
                                  }`}
                                  style={{ height: `${(i + 1) * 20}%` }}
                                ></div>
                              ))}
                            </div>
                          </div>
                           {/* Difficulty Indicator */}
                          <div className="flex items-center gap-2">
                            <span className="text-2xl w-8 text-center">
                              🔥
                            </span>
                            <div className="flex items-end gap-1 h-6">
                              {Array.from({ length: 5 }).map((_, i) => (
                                <div
                                  key={i}
                                  className={`w-2 rounded-sm transition-all duration-150 ${
                                    i < difficultyLevel ? 'bg-red-500' : 'bg-slate-600'
                                  }`}
                                  style={{ height: `${(i + 1) * 20}%` }}
                                ></div>
                              ))}
                            </div>
                          </div>
                        </div>

                        <div
                            className="absolute bottom-0 text-center transition-transform duration-100"
                            style={playerStyle}
                        >
                           {getPlayerEmoji()}
                        </div>
                        {emojis.map(e => (
                            <div
                                key={e.id}
                                className="absolute"
                                style={{
                                    left: `${e.x}vw`,
                                    top: `${e.y}vh`,
                                    fontSize: `${EMOJI_SIZE_VW}vw`,
                                    transform: `rotate(${e.rotation}deg)`,
                                    lineHeight: 1,
                                }}
                            >
                                {e.emoji}
                            </div>
                        ))}
                    </div>
                );
        }
    };

    return (
        <div className="fixed inset-0 w-full h-full bg-gradient-to-b from-slate-900 to-indigo-900 text-white flex items-center justify-center font-sans overflow-hidden select-none">
            <ParticleBackground />
             {gameState === 'start' && menuEmojis.map(e => (
                <div
                    key={e.id}
                    className="absolute"
                    style={{
                        left: `${e.x}vw`,
                        top: `${e.y}vh`,
                        fontSize: `${e.size}vw`,
                        opacity: e.opacity,
                        lineHeight: 1,
                        pointerEvents: 'none'
                    }}
                >
                    {e.emoji}
                </div>
            ))}
            {renderContent()}
            {collisionPosition && (
                <div
                    className="absolute explosion"
                    style={{
                        left: `${collisionPosition.x}vw`,
                        top: `${collisionPosition.y}vh`,
                        fontSize: `${EMOJI_SIZE_VW * 2}vw`,
                        lineHeight: 1,
                        pointerEvents: 'none',
                    }}
                >
                    {COLLISION_EMOJI}
                </div>
            )}
        </div>
    );
};

export default App;