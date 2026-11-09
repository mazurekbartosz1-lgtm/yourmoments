import React, { useEffect, useState, useRef } from 'react';

export type CompanionId =
  | 'crocodile'
  | 'wolf'
  | 'axolotl'
  | 'bear'
  | 'panda'
  | 'dragon'
  | 'cat'
  | 'fox'
  | 'bird'
  | 'dinosaur'
  | 'lizard';

export interface CompanionInfo {
  id: CompanionId;
  namePl: string;
  nameEn: string;
  nameEs: string;
  nameFr: string;
  descriptionPl: string;
  descriptionEn: string;
  descriptionEs: string;
  descriptionFr: string;
  emoji: string;
}

export const COMPANIONS: CompanionInfo[] = [
  {
    id: 'crocodile',
    namePl: 'Krokodyl',
    nameEn: 'Crocodile',
    nameEs: 'Cocodrilo',
    nameFr: 'Crocodile',
    descriptionPl: 'Cierpliwy strażnik codziennych zapisków',
    descriptionEn: 'Patient guardian of daily notes',
    descriptionEs: 'Guardián paciente de tus notas diarias',
    descriptionFr: 'Gardien patient de vos notes quotidiennes',
    emoji: '🐊',
  },
  {
    id: 'wolf',
    namePl: 'Wilk',
    nameEn: 'Wolf',
    nameEs: 'Lobo',
    nameFr: 'Loup',
    descriptionPl: 'Uważny słuchacz wieczornych myśli',
    descriptionEn: 'Attentive listener of evening thoughts',
    descriptionEs: 'Oyente atento de pensamientos nocturnos',
    descriptionFr: 'Auditeur attentif des pensées du soir',
    emoji: '🐺',
  },
  {
    id: 'axolotl',
    namePl: 'Aksolotl',
    nameEn: 'Axolotl',
    nameEs: 'Ajolote',
    nameFr: 'Axolotl',
    descriptionPl: 'Pogodny towarzysz spokojnej refleksji',
    descriptionEn: 'Cheerful companion of calm reflection',
    descriptionEs: 'Compañero sereno de reflexión tranquila',
    descriptionFr: 'Compagnon serein de réflexion paisible',
    emoji: '🦎',
  },
  {
    id: 'bear',
    namePl: 'Niedźwiedź',
    nameEn: 'Bear',
    nameEs: 'Oso',
    nameFr: 'Ours',
    descriptionPl: 'Ciepły przyjaciel z kubkiem herbaty',
    descriptionEn: 'Warm friend with a mug of tea',
    descriptionEs: 'Amigo cálido con una taza de té',
    descriptionFr: 'Ami chaleureux avec une tasse de thé',
    emoji: '🐻',
  },
  {
    id: 'panda',
    namePl: 'Panda',
    nameEn: 'Panda',
    nameEs: 'Panda',
    nameFr: 'Panda',
    descriptionPl: 'Mistrz spokoju i powolnego rytmu dnia',
    descriptionEn: 'Master of calm and unhurried daily rhythm',
    descriptionEs: 'Maestro de la calma y del ritmo pausado',
    descriptionFr: 'Maître du calme et du rythme apaisé',
    emoji: '🐼',
  },
  {
    id: 'dragon',
    namePl: 'Smok',
    nameEn: 'Dragon',
    nameEs: 'Dragón',
    nameFr: 'Dragon',
    descriptionPl: 'Strażnik tajemnic i odważnych marzeń',
    descriptionEn: 'Keeper of secrets and bold dreams',
    descriptionEs: 'Guardián de secretos y sueños valientes',
    descriptionFr: 'Gardien des secrets et des rêves audacieux',
    emoji: '🐉',
  },
  {
    id: 'cat',
    namePl: 'Kot',
    nameEn: 'Cat',
    nameEs: 'Gato',
    nameFr: 'Chat',
    descriptionPl: 'Cichy myśliciel mruczący na skraju biurka',
    descriptionEn: 'Quiet thinker purring at the desk edge',
    descriptionEs: 'Pensador silencioso que ronronea en el escritorio',
    descriptionFr: 'Penseur silencieux ronronnant au bord du bureau',
    emoji: '🐱',
  },
  {
    id: 'fox',
    namePl: 'Lis',
    nameEn: 'Fox',
    nameEs: 'Zorro',
    nameFr: 'Renard',
    descriptionPl: 'Uważny wędrowiec i przyjaciel małych chwil',
    descriptionEn: 'Attentive wanderer and friend of small moments',
    descriptionEs: 'Vagabundo atento y amigo de pequeños momentos',
    descriptionFr: 'Vagabond attentif et ami des petits moments',
    emoji: '🦊',
  },
  {
    id: 'bird',
    namePl: 'Ptaszek',
    nameEn: 'Little Bird',
    nameEs: 'Pajarito',
    nameFr: 'Petit Oiseau',
    descriptionPl: 'Lekki kronikarz porannych i nocnych chwil',
    descriptionEn: 'Light chronicler of morning and night moments',
    descriptionEs: 'Cronista ligero de la mañana y la noche',
    descriptionFr: 'Chroniqueur léger du matin et du soir',
    emoji: '🐦',
  },
];

interface CompanionDeskProps {
  companionId: CompanionId;
  isTyping: boolean;
  isSealed?: boolean;
  isSearching?: boolean;
  lang?: 'pl' | 'en' | 'es' | 'fr';
  onSelectCompanion?: () => void;
}

const INK = '#1C1A18';
const PAPER = '#FAF8F5';
const SOFT_ROSE = '#EBC5CF';

export const CompanionDesk: React.FC<CompanionDeskProps> = ({
  companionId,
  isTyping,
  isSealed = false,
  isSearching = false,
  lang = 'pl',
  onSelectCompanion,
}) => {
  const [displayedCompanion, setDisplayedCompanion] = useState<CompanionId>(companionId);
  const [walkingPhase, setWalkingPhase] = useState<'sitting' | 'exiting_left' | 'entering_right'>(
    'sitting'
  );
  const [typingFrame, setTypingFrame] = useState<number>(0);
  const [searchFrame, setSearchFrame] = useState<number>(0);
  const [readFrame, setReadFrame] = useState<number>(0);
  const [walkStep, setWalkStep] = useState<number>(0);
  const [blink, setBlink] = useState<boolean>(false);

  const prevCompanionRef = useRef<CompanionId>(companionId);

  // Trigger walk-out and walk-in animation when companionId changes
  useEffect(() => {
    if (companionId !== prevCompanionRef.current) {
      prevCompanionRef.current = companionId;
      setWalkingPhase('exiting_left');

      const switchTimer = setTimeout(() => {
        setDisplayedCompanion(companionId);
        setWalkingPhase('entering_right');
      }, 850);

      const sitTimer = setTimeout(() => {
        setWalkingPhase('sitting');
      }, 1700);

      return () => {
        clearTimeout(switchTimer);
        clearTimeout(sitTimer);
      };
    }
  }, [companionId]);

  // Animate walking legs during transition
  useEffect(() => {
    if (walkingPhase === 'sitting') {
      setWalkStep(0);
      return;
    }
    const interval = setInterval(() => {
      setWalkStep(s => (s + 1) % 4);
    }, 120);
    return () => clearInterval(interval);
  }, [walkingPhase]);

  // Alternate typing arm animation when user is typing (calmer, unhurried rhythm)
  useEffect(() => {
    if (!isTyping || walkingPhase !== 'sitting') {
      setTypingFrame(0);
      return;
    }
    const interval = setInterval(() => {
      setTypingFrame(f => (f + 1) % 4);
    }, 240);
    return () => clearInterval(interval);
  }, [isTyping, walkingPhase]);

  // Searching with magnifying glass animation when a bottom drawer page is open
  useEffect(() => {
    if (!isSearching || walkingPhase !== 'sitting') {
      setSearchFrame(0);
      return;
    }
    const interval = setInterval(() => {
      setSearchFrame(f => (f + 1) % 6);
    }, 1400);
    return () => clearInterval(interval);
  }, [isSearching, walkingPhase]);

  // Gentle book reading eye-scan cadence when day is sealed
  useEffect(() => {
    if (!isSealed || isSearching || walkingPhase !== 'sitting') {
      setReadFrame(0);
      return;
    }
    const interval = setInterval(() => {
      setReadFrame(f => (f + 1) % 6);
    }, 1100);
    return () => clearInterval(interval);
  }, [isSealed, isSearching, walkingPhase]);

  // Gentle idle blink every ~3.8 seconds
  useEffect(() => {
    if (isTyping || walkingPhase !== 'sitting') return;
    const interval = setInterval(() => {
      setBlink(true);
      setTimeout(() => setBlink(false), 200);
    }, 3800);
    return () => clearInterval(interval);
  }, [isTyping, walkingPhase]);

  const activeInfo = COMPANIONS.find(c => c.id === displayedCompanion) || COMPANIONS[0];

  const eyeShiftX = isSearching
    ? searchFrame === 0 || searchFrame === 5
      ? -2
      : searchFrame === 2 || searchFrame === 3
      ? 2
      : 0
    : isSealed
    ? readFrame === 0 || readFrame === 1
      ? -1.6
      : readFrame === 3 || readFrame === 4
      ? 1.6
      : 0
    : 0;

  const getCompanionColor = (id: CompanionId): string => {
    switch (id) {
      case 'crocodile':
        return '#789A82';
      case 'wolf':
        return '#8D959E';
      case 'axolotl':
        return SOFT_ROSE;
      case 'bear':
        return '#A6836C';
      case 'panda':
        return PAPER;
      case 'dragon':
        return '#6C9A96';
      case 'cat':
      case 'dinosaur':
        return '#C8B89E';
      case 'fox':
      case 'lizard':
        return '#C96839';
      case 'bird':
        return INK;
    }
  };

  // Clean graphic eyes (simple line-art circle + pupil)
  const renderExpressiveEyes = (leftX = 81, rightX = 99, y = 47, r = 4.6) => {
    if (blink) {
      return (
        <g stroke={INK} strokeWidth="1.8" strokeLinecap="round">
          <line x1={leftX - 3.5} y1={y} x2={leftX + 3.5} y2={y} />
          <line x1={rightX - 3.5} y1={y} x2={rightX + 3.5} y2={y} />
        </g>
      );
    }
    return (
      <g>
        <circle cx={leftX} cy={y} r={r} fill="#FFFFFF" stroke={INK} strokeWidth="1.8" />
        <circle
          cx={leftX + eyeShiftX}
          cy={y}
          r={r * 0.45}
          fill={INK}
          style={{ transition: 'all 900ms ease-in-out' }}
        />

        <circle cx={rightX} cy={y} r={r} fill="#FFFFFF" stroke={INK} strokeWidth="1.8" />
        <circle
          cx={rightX + eyeShiftX}
          cy={y}
          r={r * 0.45}
          fill={INK}
          style={{ transition: 'all 900ms ease-in-out' }}
        />
      </g>
    );
  };

  // Simple, structured graphic line-art characters (not overly round or candy-like)
  const renderCompanionCharacter = () => {
    const mainColor = getCompanionColor(displayedCompanion);

    switch (displayedCompanion) {
      case 'crocodile':
        return (
          <g>
            {/* Simple geometric dorsal ridges */}
            <polygon
              points="83,33 87,26 91,33"
              fill={mainColor}
              stroke={INK}
              strokeWidth="1.7"
              strokeLinejoin="round"
            />
            <polygon
              points="91,33 95,27 99,33"
              fill={mainColor}
              stroke={INK}
              strokeWidth="1.7"
              strokeLinejoin="round"
            />
            {/* Torso */}
            <rect
              x="70"
              y="62"
              width="40"
              height="34"
              rx="4"
              fill={mainColor}
              stroke={INK}
              strokeWidth="1.8"
            />
            {/* Belly patch */}
            <rect
              x="78"
              y="67"
              width="24"
              height="25"
              rx="2"
              fill="#E5E0D5"
              stroke={INK}
              strokeWidth="1.5"
            />
            {/* Head */}
            <rect
              x="68"
              y="33"
              width="44"
              height="32"
              rx="5"
              fill={mainColor}
              stroke={INK}
              strokeWidth="1.8"
            />
            {/* Snout */}
            <rect
              x="54"
              y="47"
              width="20"
              height="12"
              rx="3"
              fill={mainColor}
              stroke={INK}
              strokeWidth="1.8"
            />
            {/* Single crisp tooth */}
            <polygon
              points="59,59 64,59 61.5,64"
              fill="#FFFFFF"
              stroke={INK}
              strokeWidth="1.5"
              strokeLinejoin="round"
            />
            <circle cx="59" cy="51" r="1.3" fill={INK} />
            {renderExpressiveEyes(81, 99, 45, 4.6)}
          </g>
        );

      case 'bird':
        return (
          <g>
            {/* Graphic black-and-white bird inspired by the reference artwork */}
            <path
              d="M73 94 L73 41 C73 33 81 29 90 31 C96 33 99 39 99 46 L107 66 L116 82 L96 82 L96 94 Z"
              fill={INK}
              stroke={INK}
              strokeWidth="1.8"
              strokeLinejoin="round"
            />
            {/* Crisp white wing stripe */}
            <polygon
              points="85,55 104,73 92,73 80,60"
              fill="#FFFFFF"
              stroke={INK}
              strokeWidth="1.6"
              strokeLinejoin="round"
            />
            {/* Pointed beak */}
            <polygon
              points="73,39 58,42 73,46"
              fill={PAPER}
              stroke={INK}
              strokeWidth="1.8"
              strokeLinejoin="round"
            />
            {!blink ? (
              <g>
                <circle cx="84" cy="41" r="5" fill="#FFFFFF" stroke={INK} strokeWidth="1.8" />
                <circle cx={84 + eyeShiftX} cy="41" r="2.2" fill={INK} />
              </g>
            ) : (
              <line
                x1="80"
                y1="41"
                x2="88"
                y2="41"
                stroke="#FFFFFF"
                strokeWidth="1.8"
                strokeLinecap="round"
              />
            )}
          </g>
        );

      case 'axolotl':
        return (
          <g>
            {/* Simple line-art gills */}
            <line x1="56" y1="39" x2="68" y2="42" stroke={INK} strokeWidth="2.2" strokeLinecap="round" />
            <line x1="54" y1="47" x2="68" y2="48" stroke={INK} strokeWidth="2.2" strokeLinecap="round" />
            <line x1="56" y1="55" x2="68" y2="54" stroke={INK} strokeWidth="2.2" strokeLinecap="round" />
            <line x1="124" y1="39" x2="112" y2="42" stroke={INK} strokeWidth="2.2" strokeLinecap="round" />
            <line x1="126" y1="47" x2="112" y2="48" stroke={INK} strokeWidth="2.2" strokeLinecap="round" />
            <line x1="124" y1="55" x2="112" y2="54" stroke={INK} strokeWidth="2.2" strokeLinecap="round" />
            {/* Torso */}
            <rect x="70" y="62" width="40" height="34" rx="4" fill={mainColor} stroke={INK} strokeWidth="1.8" />
            {/* Head */}
            <rect x="67" y="34" width="46" height="31" rx="6" fill={mainColor} stroke={INK} strokeWidth="1.8" />
            {renderExpressiveEyes(80, 100, 47, 4.4)}
            <line x1="86" y1="57" x2="94" y2="57" stroke={INK} strokeWidth="1.6" strokeLinecap="round" />
          </g>
        );

      case 'wolf':
        return (
          <g>
            <polygon points="70,35 75,19 84,34" fill={mainColor} stroke={INK} strokeWidth="1.8" strokeLinejoin="round" />
            <polygon points="96,34 105,19 110,35" fill={mainColor} stroke={INK} strokeWidth="1.8" strokeLinejoin="round" />
            <rect x="70" y="62" width="40" height="34" rx="4" fill={mainColor} stroke={INK} strokeWidth="1.8" />
            <rect x="68" y="33" width="44" height="32" rx="5" fill={mainColor} stroke={INK} strokeWidth="1.8" />
            <rect x="81" y="51" width="18" height="10" rx="2" fill={PAPER} stroke={INK} strokeWidth="1.6" />
            <circle cx="90" cy="54" r="2.2" fill={INK} />
            {renderExpressiveEyes(80, 100, 44, 4.4)}
          </g>
        );

      case 'bear':
        return (
          <g>
            <rect x="67" y="25" width="11" height="11" rx="3" fill={mainColor} stroke={INK} strokeWidth="1.8" />
            <rect x="102" y="25" width="11" height="11" rx="3" fill={mainColor} stroke={INK} strokeWidth="1.8" />
            <rect x="69" y="62" width="42" height="34" rx="4" fill={mainColor} stroke={INK} strokeWidth="1.8" />
            <rect x="67" y="33" width="46" height="32" rx="5" fill={mainColor} stroke={INK} strokeWidth="1.8" />
            <rect x="82" y="50" width="16" height="10" rx="2" fill={PAPER} stroke={INK} strokeWidth="1.6" />
            <circle cx="90" cy="53.5" r="2.2" fill={INK} />
            {renderExpressiveEyes(80, 100, 44, 4.4)}
          </g>
        );

      case 'panda':
        return (
          <g>
            <rect x="67" y="25" width="11" height="11" rx="3" fill={INK} />
            <rect x="102" y="25" width="11" height="11" rx="3" fill={INK} />
            <rect x="69" y="62" width="42" height="34" rx="4" fill={INK} stroke={INK} strokeWidth="1.8" />
            <rect x="76" y="67" width="28" height="24" rx="3" fill={PAPER} stroke={INK} strokeWidth="1.6" />
            <rect x="67" y="33" width="46" height="32" rx="5" fill={PAPER} stroke={INK} strokeWidth="1.8" />
            <circle cx="90" cy="55" r="2.2" fill={INK} />
            {renderExpressiveEyes(80, 100, 45, 4.6)}
          </g>
        );

      case 'dragon':
        return (
          <g>
            <path d="M70 68 L54 56 L59 75 Z" fill="#E5E0D5" stroke={INK} strokeWidth="1.8" strokeLinejoin="round" />
            <path d="M110 68 L126 56 L121 75 Z" fill="#E5E0D5" stroke={INK} strokeWidth="1.8" strokeLinejoin="round" />
            <polygon points="73,33 69,20 80,33" fill={PAPER} stroke={INK} strokeWidth="1.8" strokeLinejoin="round" />
            <polygon points="107,33 111,20 100,33" fill={PAPER} stroke={INK} strokeWidth="1.8" strokeLinejoin="round" />
            <rect x="70" y="62" width="40" height="34" rx="4" fill={mainColor} stroke={INK} strokeWidth="1.8" />
            <rect x="68" y="33" width="44" height="32" rx="5" fill={mainColor} stroke={INK} strokeWidth="1.8" />
            {renderExpressiveEyes(80, 100, 45, 4.5)}
          </g>
        );

      case 'cat':
      case 'dinosaur':
        return (
          <g>
            {/* Pointed cat ears with soft rose interior */}
            <polygon points="68,34 74,17 83,33" fill={mainColor} stroke={INK} strokeWidth="1.8" strokeLinejoin="round" />
            <polygon points="72,32 75,21 80,32" fill={SOFT_ROSE} />
            <polygon points="97,33 106,17 112,34" fill={mainColor} stroke={INK} strokeWidth="1.8" strokeLinejoin="round" />
            <polygon points="100,32 105,21 108,32" fill={SOFT_ROSE} />
            {/* Torso */}
            <rect x="70" y="62" width="40" height="34" rx="4" fill={mainColor} stroke={INK} strokeWidth="1.8" />
            {/* Chest patch */}
            <rect x="79" y="67" width="22" height="25" rx="3" fill={PAPER} stroke={INK} strokeWidth="1.5" />
            {/* Head */}
            <rect x="67" y="33" width="46" height="32" rx="6" fill={mainColor} stroke={INK} strokeWidth="1.8" />
            {/* Delicate line whiskers */}
            <line x1="53" y1="48" x2="66" y2="50" stroke={INK} strokeWidth="1.4" strokeLinecap="round" />
            <line x1="53" y1="54" x2="66" y2="53" stroke={INK} strokeWidth="1.4" strokeLinecap="round" />
            <line x1="114" y1="50" x2="127" y2="48" stroke={INK} strokeWidth="1.4" strokeLinecap="round" />
            <line x1="114" y1="53" x2="127" y2="54" stroke={INK} strokeWidth="1.4" strokeLinecap="round" />
            {/* Little pink nose & mouth */}
            <polygon points="88,52 92,52 90,55" fill={SOFT_ROSE} stroke={INK} strokeWidth="1.2" strokeLinejoin="round" />
            <path d="M86 56 Q90 58.5 94 56" fill="none" stroke={INK} strokeWidth="1.4" strokeLinecap="round" />
            {renderExpressiveEyes(80, 100, 44, 4.4)}
          </g>
        );

      case 'fox':
      case 'lizard':
        return (
          <g>
            {/* Tall alert ears with black tips */}
            <polygon points="68,34 73,14 83,33" fill={mainColor} stroke={INK} strokeWidth="1.8" strokeLinejoin="round" />
            <polygon points="71,21 73,14 77,21" fill={INK} />
            <polygon points="72,32 75,23 80,32" fill={PAPER} />
            <polygon points="97,33 107,14 112,34" fill={mainColor} stroke={INK} strokeWidth="1.8" strokeLinejoin="round" />
            <polygon points="103,21 107,14 109,21" fill={INK} />
            <polygon points="100,32 105,23 108,32" fill={PAPER} />
            {/* Torso */}
            <rect x="70" y="62" width="40" height="34" rx="4" fill={mainColor} stroke={INK} strokeWidth="1.8" />
            {/* White chest bib */}
            <polygon points="78,92 90,66 102,92" fill={PAPER} stroke={INK} strokeWidth="1.5" strokeLinejoin="round" />
            {/* Head */}
            <rect x="67" y="33" width="46" height="32" rx="5" fill={mainColor} stroke={INK} strokeWidth="1.8" />
            {/* White cheek cheeks and muzzle */}
            <polygon points="67,61 80,48 90,62 100,48 113,61" fill={PAPER} stroke={INK} strokeWidth="1.6" strokeLinejoin="round" />
            <circle cx="90" cy="53" r="2.2" fill={INK} />
            {renderExpressiveEyes(79, 101, 43, 4.3)}
            {/* Bushy tail tip peek */}
            <path d="M110 80 C122 76 128 66 126 58 C122 66 116 72 110 74 Z" fill={mainColor} stroke={INK} strokeWidth="1.6" />
            <polygon points="126,58 122,66 125,64" fill={PAPER} />
          </g>
        );
    }
  };

  // Magnifying glass when isSearching is active
  const renderSearchingWithMagnifier = () => {
    const offsets = [
      { x: -10, y: 0 },
      { x: -4, y: -4 },
      { x: 6, y: -2 },
      { x: 11, y: 2 },
      { x: 4, y: 3 },
      { x: -4, y: 1 },
    ];
    const pos = offsets[searchFrame % offsets.length];
    const pawFill = displayedCompanion === 'bird' ? PAPER : getCompanionColor(displayedCompanion);

    return (
      <g>
        <rect
          x="61"
          y="86"
          width="12"
          height="9"
          rx="2"
          fill={pawFill}
          stroke={INK}
          strokeWidth="1.8"
        />

        <g
          style={{
            transform: `translate(${pos.x}px, ${pos.y}px)`,
            transition: 'transform 1350ms cubic-bezier(0.4, 0, 0.2, 1)',
          }}
        >
          <line
            x1="104"
            y1="67"
            x2="115"
            y2="82"
            stroke={INK}
            strokeWidth="3.5"
            strokeLinecap="round"
          />
          <circle
            cx="96"
            cy="58"
            r="12"
            fill={PAPER}
            fillOpacity="0.9"
            stroke={INK}
            strokeWidth="2"
          />
          <rect
            x="107"
            y="77"
            width="12"
            height="9"
            rx="2"
            fill={pawFill}
            stroke={INK}
            strokeWidth="1.8"
          />
        </g>
      </g>
    );
  };

  // Reading a book when day is sealed
  const renderReadingBook = () => {
    const pawFill = displayedCompanion === 'bird' ? PAPER : getCompanionColor(displayedCompanion);
    const bookBobY = readFrame === 2 || readFrame === 5 ? -1.5 : 0;

    return (
      <g
        style={{
          transform: `translateY(${bookBobY}px)`,
          transition: 'transform 900ms ease-in-out',
        }}
      >
        <rect
          x="59"
          y="67"
          width="62"
          height="28"
          rx="2"
          fill="#E5DFD3"
          stroke={INK}
          strokeWidth="1.8"
        />
        <rect
          x="62"
          y="65"
          width="28"
          height="27"
          rx="1.5"
          fill={PAPER}
          stroke={INK}
          strokeWidth="1.6"
        />
        <rect
          x="90"
          y="65"
          width="28"
          height="27"
          rx="1.5"
          fill="#F5F0E6"
          stroke={INK}
          strokeWidth="1.6"
        />
        <line x1="67" y1="72" x2="84" y2="72" stroke={INK} strokeWidth="1.4" strokeLinecap="round" />
        <line x1="67" y1="78" x2="82" y2="78" stroke={INK} strokeWidth="1.4" strokeLinecap="round" />
        <line x1="67" y1="84" x2="79" y2="84" stroke={INK} strokeWidth="1.4" strokeLinecap="round" />
        <line x1="95" y1="72" x2="112" y2="72" stroke={INK} strokeWidth="1.4" strokeLinecap="round" />
        <line x1="95" y1="78" x2="110" y2="78" stroke={INK} strokeWidth="1.4" strokeLinecap="round" />
        <line x1="95" y1="84" x2="107" y2="84" stroke={INK} strokeWidth="1.4" strokeLinecap="round" />

        <rect
          x="54"
          y="75"
          width="11"
          height="9"
          rx="2"
          fill={pawFill}
          stroke={INK}
          strokeWidth="1.8"
        />
        <rect
          x="115"
          y="75"
          width="11"
          height="9"
          rx="2"
          fill={pawFill}
          stroke={INK}
          strokeWidth="1.8"
        />
      </g>
    );
  };

  const renderPaws = () => {
    if (isSearching) {
      return renderSearchingWithMagnifier();
    }
    if (isSealed) {
      return renderReadingBook();
    }

    const pawFill = displayedCompanion === 'bird' ? PAPER : getCompanionColor(displayedCompanion);
    let leftY = 86;
    let rightY = 86;

    if (isTyping) {
      if (typingFrame === 1 || typingFrame === 3) {
        leftY = 81;
        rightY = 88;
      } else {
        leftY = 88;
        rightY = 81;
      }
    }

    return (
      <g>
        <rect
          x="63"
          y={leftY}
          width="12"
          height="9"
          rx="2"
          fill={pawFill}
          stroke={INK}
          strokeWidth="1.8"
        />
        <rect
          x="105"
          y={rightY}
          width="12"
          height="9"
          rx="2"
          fill={pawFill}
          stroke={INK}
          strokeWidth="1.8"
        />
      </g>
    );
  };

  const renderWalkingLegs = () => {
    const isStepA = walkStep === 0 || walkStep === 2;
    return (
      <g>
        <rect
          x="76"
          y="92"
          width="8"
          height={isStepA ? '18' : '12'}
          rx="2"
          fill={PAPER}
          stroke={INK}
          strokeWidth="1.8"
        />
        <rect
          x="96"
          y="92"
          width="8"
          height={isStepA ? '12' : '18'}
          rx="2"
          fill={PAPER}
          stroke={INK}
          strokeWidth="1.8"
        />
      </g>
    );
  };

  let characterTransformClass = 'translate-x-0 transition-transform duration-700 ease-in-out';
  if (walkingPhase === 'exiting_left') {
    characterTransformClass = '-translate-x-[260px] opacity-0 transition-all duration-850 ease-in';
  } else if (walkingPhase === 'entering_right') {
    characterTransformClass = 'translate-x-0 transition-all duration-850 ease-out';
  }

  return (
    <div className="relative flex flex-col items-center justify-center select-none mx-auto">
      <div
        onClick={onSelectCompanion}
        title={
          lang === 'en'
            ? 'Click to change companion'
            : lang === 'es'
            ? 'Haz clic para cambiar de compañero'
            : 'Kliknij, aby zmienić towarzysza'
        }
        className="relative w-52 h-34 flex items-end justify-center cursor-pointer group"
      >
        {/* Animated Companion Layer — Clean & Frameless */}
        <div className={`absolute inset-0 w-full h-full ${characterTransformClass} z-10`}>
          <svg viewBox="0 0 180 135" className="w-full h-full">
            {renderCompanionCharacter()}
            {walkingPhase === 'sitting' ? renderPaws() : renderWalkingLegs()}
          </svg>
        </div>

        {/* Stationary Foreground Desk & Typewriter / Book / Tea Cup */}
        <svg
          viewBox="0 0 180 135"
          className="absolute inset-0 w-full h-full pointer-events-none z-20"
        >
          {isSearching ? (
            <g>
              <rect
                x="58"
                y="89"
                width="64"
                height="10"
                rx="1.5"
                fill={PAPER}
                stroke={INK}
                strokeWidth="1.8"
              />
              <line x1="90" y1="89" x2="90" y2="99" stroke={INK} strokeWidth="1.6" />
            </g>
          ) : isSealed ? null : (
            /* Clean Line-Art Typewriter */
            <g>
              <rect
                x={isTyping && typingFrame % 2 === 0 ? 77 : 75}
                y="67"
                width="30"
                height="20"
                rx="1.5"
                fill={PAPER}
                stroke={INK}
                strokeWidth="1.7"
              />
              <line
                x1={isTyping && typingFrame % 2 === 0 ? 81 : 79}
                y1="73"
                x2={isTyping && typingFrame % 2 === 0 ? 99 : 97}
                y2="73"
                stroke={INK}
                strokeWidth="1.4"
                strokeLinecap="round"
              />
              <line
                x1={isTyping && typingFrame % 2 === 0 ? 81 : 79}
                y1="78"
                x2={isTyping && typingFrame % 2 === 0 ? 94 : 92}
                y2="78"
                stroke={INK}
                strokeWidth="1.4"
                strokeLinecap="round"
              />
              <rect
                x="65"
                y="84"
                width="50"
                height="15"
                rx="2.5"
                fill={INK}
                stroke={INK}
                strokeWidth="1.8"
              />
              <rect
                x="72"
                y="88"
                width="36"
                height="6"
                rx="1.5"
                fill="#E5DFD3"
              />
              <circle cx="78" cy="91" r="1.2" fill={INK} />
              <circle cx="84" cy="91" r="1.2" fill={INK} />
              <circle cx="90" cy="91" r="1.2" fill={INK} />
              <circle cx="96" cy="91" r="1.2" fill={INK} />
              <circle cx="102" cy="91" r="1.2" fill={INK} />
            </g>
          )}

          {/* Simple Mug on Left of Desk */}
          <rect
            x="28"
            y="85"
            width="12"
            height="14"
            rx="1.5"
            fill={SOFT_ROSE}
            stroke={INK}
            strokeWidth="1.7"
          />
          <path
            d="M28 88 H24.5 C23 88 23 94 24.5 94 H28"
            fill="none"
            stroke={INK}
            strokeWidth="1.6"
          />

          {/* Subtle Seal Stamp on Right of Desk when Sealed */}
          {isSealed && (
            <circle
              cx="144"
              cy="93"
              r="5.5"
              fill={SOFT_ROSE}
              stroke={INK}
              strokeWidth="1.7"
            />
          )}

          {/* Clean Straight Desk Surface */}
          <rect
            x="14"
            y="99"
            width="152"
            height="7"
            rx="1.5"
            fill="#EAE4D7"
            stroke={INK}
            strokeWidth="1.8"
          />
          {/* Desk Legs */}
          <line x1="28" y1="106" x2="28" y2="129" stroke={INK} strokeWidth="2" strokeLinecap="round" />
          <line x1="152" y1="106" x2="152" y2="129" stroke={INK} strokeWidth="2" strokeLinecap="round" />
          <line x1="10" y1="129" x2="170" y2="129" stroke="#D8D1C3" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      </div>
    </div>
  );
};
