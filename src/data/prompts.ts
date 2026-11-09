export type PromptCategory = 'sensory' | 'gratitude' | 'reflection' | 'memory' | 'vision';
export type Language = 'pl' | 'en' | 'es' | 'fr';

export interface DailyPrompt {
  id: string;
  slug?: string;
  category: PromptCategory;
  categoryLabel: string;
  promptPl: string;
  promptEn: string;
  promptEs: string;
  promptFr?: string;
  hintPl: string;
  hintEn: string;
  hintEs: string;
  hintFr?: string;
}

export const CATEGORIES: {
  id: PromptCategory | 'all';
  labelPl: string;
  labelEn: string;
  labelEs: string;
  labelFr: string;
}[] = [
  { id: 'all', labelPl: 'Wszystkie', labelEn: 'All', labelEs: 'Todas', labelFr: 'Toutes' },
  { id: 'sensory', labelPl: 'Zmysły', labelEn: 'Senses', labelEs: 'Sentidos', labelFr: 'Sens' },
  { id: 'memory', labelPl: 'Pamięć', labelEn: 'Memory', labelEs: 'Memoria', labelFr: 'Mémoire' },
  { id: 'gratitude', labelPl: 'Wdzięczność', labelEn: 'Gratitude', labelEs: 'Gratitud', labelFr: 'Gratitude' },
  { id: 'reflection', labelPl: 'Refleksja', labelEn: 'Reflection', labelEs: 'Reflexión', labelFr: 'Réflexion' },
  { id: 'vision', labelPl: 'Wizja', labelEn: 'Vision', labelEs: 'Visión', labelFr: 'Vision' },
];

export function getPromptText(prompt: DailyPrompt, lang: Language): string {
  if (lang === 'en') return prompt.promptEn;
  if (lang === 'es') return prompt.promptEs || prompt.promptEn;
  if (lang === 'fr') return prompt.promptFr || prompt.promptEn;
  return prompt.promptPl;
}

export function getHintText(prompt: DailyPrompt, lang: Language): string {
  if (lang === 'en') return prompt.hintEn || prompt.hintPl;
  if (lang === 'es') return prompt.hintEs || prompt.hintEn || prompt.hintPl;
  if (lang === 'fr') return prompt.hintFr || prompt.hintEn || prompt.hintPl;
  return prompt.hintPl;
}

export function getCategoryLabel(catId: PromptCategory | 'all', lang: Language): string {
  const found = CATEGORIES.find(c => c.id === catId);
  if (!found) return String(catId);
  if (lang === 'en') return found.labelEn;
  if (lang === 'es') return found.labelEs;
  if (lang === 'fr') return found.labelFr;
  return found.labelPl;
}

export const FREE_THOUGHT_PROMPT_ID = 'free-thought';

export const FREE_THOUGHT_PROMPT: DailyPrompt = {
  id: FREE_THOUGHT_PROMPT_ID,
  category: 'reflection',
  categoryLabel: 'Wolna myśl',
  promptPl: 'Wolna myśl — zapisz to, co teraz chodzi Ci po głowie.',
  promptEn: 'Free thought — write down whatever is on your mind right now.',
  promptEs: 'Pensamiento libre — escribe lo que tengas en mente ahora mismo.',
  promptFr: 'Pensée libre — écrivez ce qui vous traverse l’esprit en ce moment.',
  hintPl: 'Bez narzuconego pytania dnia — po prostu Twoje własne myśli.',
  hintEn: 'Without a daily prompt — simply your own thoughts.',
  hintEs: 'Sin pregunta diaria — simplemente tus propios pensamientos.',
  hintFr: 'Sans question du jour — simplement vos propres pensées.',
};

export const DAILY_PROMPTS: DailyPrompt[] = [
  {
    id: 'p-01',
    category: 'sensory',
    categoryLabel: 'Zmysły',
    promptPl: 'Opisz posiłek lub napój z ostatnich dni, którego smak lub aromat wywołał w Tobie niespodziewane wspomnienie.',
    promptEn: 'Describe a meal or beverage from recent days whose taste or aroma triggered an unexpected memory.',
    promptEs: 'Describe una comida o bebida de los últimos días cuyo sabor o aroma despertó en ti un recuerdo inesperado.',
    promptFr: 'Décrivez un repas ou une boisson de ces derniers jours dont le goût ou l’arôme a éveillé un souvenir inattendu.',
    hintPl: 'Zwróć uwagę na temperaturę, fakturę i otaczające dźwięki.',
    hintEn: 'Pay attention to the temperature, texture, and surrounding sounds.',
    hintEs: 'Presta atención a la temperatura, la textura y los sonidos a tu alrededor.',
    hintFr: 'Prêtez attention à la température, à la texture et aux bruits environnants.',
  },
  {
    id: 'p-02',
    category: 'memory',
    categoryLabel: 'Pamięć',
    promptPl: 'Przypomnij sobie fotografię, do której wracasz myślami. Kto na niej jest i co działo się sekundę przed jej zrobieniem?',
    promptEn: 'Recall a photograph you often return to in thought. Who is in it and what happened a second before it was taken?',
    promptEs: 'Recuerda una fotografía a la que vuelves con frecuencia en tus pensamientos. ¿Quién aparece y qué pasó un segundo antes de tomarla?',
    promptFr: 'Repensez à une photographie qui vous revient souvent à l’esprit. Qui y figure et que s’est-il passé une seconde avant le déclic ?',
    hintPl: 'Co kryje się poza kadrem?',
    hintEn: 'What lies just outside the frame?',
    hintEs: '¿Qué se esconde fuera del encuadre?',
    hintFr: 'Que se cache-t-il juste hors du cadre ?',
  },
  {
    id: 'p-03',
    category: 'gratitude',
    categoryLabel: 'Wdzięczność',
    promptPl: 'Zapisz jeden drobny, prawie niewidoczny gest życzliwości, którego byłeś świadkiem lub odbiorcą w tym tygodniu.',
    promptEn: 'Note down one subtle, almost invisible act of kindness that you witnessed or received this week.',
    promptEs: 'Anota un gesto pequeño, casi invisible, de amabilidad que hayas presenciado o recibido esta semana.',
    promptFr: 'Notez un geste discret, presque invisible, de bienveillance dont vous avez été témoin ou destinataire cette semaine.',
    hintPl: 'Nawet przelotne spojrzenie czy przytrzymane drzwi mają swoją wagę.',
    hintEn: 'Even a fleeting glance or holding a door carries weight.',
    hintEs: 'Incluso una mirada fugaz o sostener una puerta tiene su valor.',
    hintFr: 'Même un regard fugace ou une porte retenue a son importance.',
  },
  {
    id: 'p-04',
    category: 'reflection',
    categoryLabel: 'Refleksja',
    promptPl: 'O czym pomyślałeś dziś tuż po przebudzeniu, zanim jeszcze sięgnąłeś po jakiekolwiek urządzenie?',
    promptEn: 'What crossed your mind right upon waking today, before reaching for any device?',
    promptEs: '¿Qué pasó por tu mente hoy justo al despertar, antes de tocar cualquier dispositivo?',
    promptFr: 'Quelle a été votre toute première pensée au réveil aujourd’hui, avant même de toucher un écran ?',
    hintPl: 'Jaki był pierwszy oddech i pierwsze światło w pokoju?',
    hintEn: 'What was the first breath and the first light in the room like?',
    hintEs: '¿Cómo fue la primera respiración y la primera luz en la habitación?',
    hintFr: 'Comment étaient la première respiration et la première lumière dans la pièce ?',
  },
  {
    id: 'p-05',
    category: 'sensory',
    categoryLabel: 'Zmysły',
    promptPl: 'Dźwięk, który dzisiaj usłyszałeś w tle i który na chwilę zatrzymał Twój bieg myśli.',
    promptEn: 'A background sound you heard today that momentarily halted your train of thought.',
    promptEs: 'Un sonido de fondo que escuchaste hoy y que detuvo por un instante el curso de tus pensamientos.',
    promptFr: 'Un bruit de fond entendu aujourd’hui qui a brièvement suspendu le fil de vos pensées.',
    hintPl: 'Szum wiatru, skrzypnięcie podłogi, czyjś odległy śmiech.',
    hintEn: 'The rustle of wind, a creaking floorboard, distant laughter.',
    hintEs: 'El murmullo del viento, el crujido del suelo, una risa lejana.',
    hintFr: 'Le souffle du vent, un parquet qui grince, un rire lointain.',
  },
  {
    id: 'p-06',
    category: 'reflection',
    categoryLabel: 'Refleksja',
    promptPl: 'Gdybyś mógł przekazać sobie z przeszłości sprzed pięciu lat jedno spokojne zdanie — jak by ono brzmiało?',
    promptEn: 'If you could offer your past self from five years ago a single calming sentence, what would it be?',
    promptEs: 'Si pudieras decirle a tu yo de hace cinco años una sola frase tranquila, ¿cuál sería?',
    promptFr: 'Si vous pouviez adresser une seule phrase apaisante à celui ou celle que vous étiez il y a cinq ans, quelle serait-elle ?',
    hintPl: 'Bez moralizatorstwa, czysta serdeczność.',
    hintEn: 'No lecturing — just pure warmth and kindness.',
    hintEs: 'Sin reproches, solo pura calidez y serenidad.',
    hintFr: 'Sans jugement, juste une sincère douceur.',
  },
  {
    id: 'p-07',
    category: 'memory',
    categoryLabel: 'Pamięć',
    promptPl: 'Przedmiot codziennego użytku w Twoim domu, który nosi na sobie widoczne ślady upływu czasu.',
    promptEn: 'An everyday object in your home that bears visible marks of passing time.',
    promptEs: 'Un objeto cotidiano en tu casa que lleva marcas visibles del paso del tiempo.',
    promptFr: 'Un objet du quotidien chez vous qui porte les traces visibles du temps qui passe.',
    hintPl: 'Wyszczerbiony kubek, zagięty róg książki, wytarty blat.',
    hintEn: 'A chipped mug, a dog-eared book page, a worn tabletop.',
    hintEs: 'Una taza astillada, la esquina doblada de un libro, una mesa desgastada.',
    hintFr: 'Une tasse ébréchée, le coin corné d’un livre, une table patinée.',
  },
  {
    id: 'p-08',
    category: 'vision',
    categoryLabel: 'Wizja',
    promptPl: 'Jak wyglądałby Twój idealny, powolny wieczór bez żadnych zobowiązań i pośpiechu?',
    promptEn: 'What would your ideal, unhurried evening look like without any obligations or haste?',
    promptEs: '¿Cómo sería tu tarde-noche ideal y sin prisas, libre de cualquier obligación?',
    promptFr: 'À quoi ressemblerait votre soirée idéale, lente et sans aucune obligation ni précipitation ?',
    hintPl: 'Światło lampy, cisza, lektura lub rozmowa.',
    hintEn: 'Warm lamp light, quietness, reading, or an unhurried talk.',
    hintEs: 'La luz de una lámpara, silencio, lectura o una buena conversación.',
    hintFr: 'La lumière douce d’une lampe, le silence, une lecture ou une conversation.',
  },
  {
    id: 'p-09',
    category: 'sensory',
    categoryLabel: 'Zmysły',
    promptPl: 'Opisz fakturę czegoś, czego dzisiaj dotknąłeś: chłód metalu, miękkość wełny, chropowatość drewna.',
    promptEn: 'Describe the texture of something you touched today: cool metal, soft wool, rough timber.',
    promptEs: 'Describe la textura de algo que tocaste hoy: el frío del metal, la suavidad de la lana, la aspereza de la madera.',
    promptFr: 'Décrivez la texture de quelque chose que vous avez touché aujourd’hui : la fraîcheur du métal, la douceur de la laine, le grain du bois.',
    hintPl: 'Nie spiesz się ze słowami — pozwól palcom przypomnieć sobie to wrażenie.',
    hintEn: 'Take your time with words — let your fingers recall the sensation.',
    hintEs: 'No tengas prisa con las palabras: deja que tus dedos recuerden la sensación.',
    hintFr: 'Prenez votre temps avec les mots — laissez vos doigts retrouver cette sensation.',
  },
  {
    id: 'p-10',
    category: 'gratitude',
    categoryLabel: 'Wdzięczność',
    promptPl: 'Kto w Twoim życiu potrafi słuchać Cię tak, że czujesz się naprawdę zauważony?',
    promptEn: 'Who in your life listens in a way that makes you feel genuinely heard and seen?',
    promptEs: '¿Quién en tu vida sabe escucharte de tal manera que te sientes verdaderamente visto y comprendido?',
    promptFr: 'Qui, dans votre vie, sait vous écouter d’une manière qui vous fait vous sentir vraiment compris ?',
    hintPl: 'Czym charakteryzuje się ta uwaga?',
    hintEn: 'What makes their attention feel so different?',
    hintEs: '¿Qué tiene de especial su forma de prestarte atención?',
    hintFr: 'Qu’est-ce qui rend son attention si particulière ?',
  },
  {
    id: 'p-11',
    category: 'reflection',
    categoryLabel: 'Refleksja',
    promptPl: 'Jaką jedną rzecz robisz tylko z przyzwyczajenia, choć nie przynosi Ci już ani radości, ani pożytku?',
    promptEn: 'What is one thing you do purely out of habit, even though it brings neither joy nor benefit?',
    promptEs: '¿Qué cosa haces solo por costumbre, aunque ya no te aporte ni alegría ni provecho?',
    promptFr: 'Quelle chose faites-vous uniquement par habitude, alors qu’elle ne vous apporte plus ni joie ni bienfait ?',
    hintPl: 'Odważ się na szczerość przed własną kartką.',
    hintEn: 'Dare to be honest in front of your own page.',
    hintEs: 'Atrévete a ser sincero frente a tu propia página.',
    hintFr: 'Osez être sincère devant votre propre page.',
  },
  {
    id: 'p-12',
    category: 'memory',
    categoryLabel: 'Pamięć',
    promptPl: 'Miejsce z dzieciństwa, w którym czułeś się zupełnie bezpieczny i ukryty przed światem.',
    promptEn: 'A childhood sanctuary where you felt completely safe and hidden from the world.',
    promptEs: 'Un rincón de tu infancia donde te sentías completamente seguro y oculto del mundo.',
    promptFr: 'Un refuge de votre enfance où vous vous sentiez complètement en sécurité et à l’abri du monde.',
    hintPl: 'Baza pod stołem, gałąź starego drzewa, poddasze.',
    hintEn: 'A fort under the table, a branch of an old tree, an attic.',
    hintEs: 'Un refugio bajo la mesa, la rama de un viejo árbol, el desván.',
    hintFr: 'Une cabane sous la table, la branche d’un vieil arbre, un grenier.',
  },
  {
    id: 'p-13',
    category: 'sensory',
    categoryLabel: 'Zmysły',
    promptPl: 'Światło w określonej godzinie dnia — jak zmienia pokój, w którym najczęściej przebywasz?',
    promptEn: 'Light at a specific hour of day — how does it transform the room you inhabit most?',
    promptEs: 'La luz a una hora concreta del día: ¿cómo transforma la habitación donde pasas más tiempo?',
    promptFr: 'La lumière à une heure précise de la journée : comment transforme-t-elle la pièce où vous passez le plus de temps ?',
    hintPl: 'Kąt padania cieni, barwa słońca na ścianie.',
    hintEn: 'The angle of shadows, the hue of sunlight against the wall.',
    hintEs: 'El ángulo de las sombras, el tono del sol sobre la pared.',
    hintFr: 'L’angle des ombres, la teinte du soleil sur le mur.',
  },
  {
    id: 'p-14',
    category: 'reflection',
    categoryLabel: 'Refleksja',
    promptPl: 'Czego nauczyła Cię ostatnia trudna rozmowa lub chwila nieporozumienia?',
    promptEn: 'What did a recent difficult conversation or moment of friction teach you?',
    promptEs: '¿Qué te enseñó una conversación difícil reciente o un momento de desacuerdo?',
    promptFr: 'Que vous a appris une conversation difficile récente ou un moment de malentendu ?',
    hintPl: 'Gdzie leżała granica empatii i własnej przestrzeni?',
    hintEn: 'Where was the boundary between empathy and your own space?',
    hintEs: '¿Dónde estaba el límite entre la empatía y tu propio espacio?',
    hintFr: 'Où se situait la frontière entre l’empathie et votre propre espace ?',
  },
  {
    id: 'p-15',
    category: 'vision',
    categoryLabel: 'Wizja',
    promptPl: 'Gdyby ten nadchodzący miesiąc miał swój motyw przewodni — jedno słowo — jak by brzmiało?',
    promptEn: 'If this coming month carried a singular theme — one word — what would it be?',
    promptEs: 'Si el próximo mes tuviera un lema principal —una sola palabra—, ¿cuál sería?',
    promptFr: 'Si le mois à venir avait un fil conducteur — un seul mot — quel serait-il ?',
    hintPl: 'Spokój, odwaga, redukcja, zachwyt?',
    hintEn: 'Calm, courage, simplicity, wonder?',
    hintEs: '¿Calma, valentía, sencillez, asombro?',
    hintFr: 'Calme, audace, simplicité, émerveillement ?',
  },
  {
    id: 'p-16',
    category: 'gratitude',
    categoryLabel: 'Wdzięczność',
    promptPl: 'Za jaką rutynową wygodę współczesnego świata rzadko dziękujesz, a bez której Twój dzień byłby trudniejszy?',
    promptEn: 'What routine modern convenience do you rarely thank for, yet without which your day would be difficult?',
    promptEs: '¿Qué comodidad cotidiana del mundo moderno agradeces rara vez, pero sin la cual tu día sería mucho más difícil?',
    promptFr: 'Quel confort ordinaire du quotidien remarquez-vous rarement, mais sans lequel votre journée serait bien plus difficile ?',
    hintPl: 'Ciepła woda w kranie, światło o zmierzchu, czysta pościel.',
    hintEn: 'Warm running water, light at dusk, clean sheets.',
    hintEs: 'Agua caliente en el grifo, luz al atardecer, sábanas limpias.',
    hintFr: 'De l’eau chaude au robinet, la lumière au crépuscule, des draps propres.',
  },
  {
    id: 'p-17',
    category: 'memory',
    categoryLabel: 'Pamięć',
    promptPl: 'Zapach, który natychmiast przenosi Cię w określony moment z przeszłości.',
    promptEn: 'A scent that instantly transports you back to a specific moment in your past.',
    promptEs: 'Un aroma que te transporta al instante a un momento concreto de tu pasado.',
    promptFr: 'Un parfum ou une odeur qui vous transporte instantanément vers un moment précis du passé.',
    hintPl: 'Mokry asfalt po letnim deszczu, stara biblioteka, wanilia.',
    hintEn: 'Wet pavement after summer rain, an old library, vanilla.',
    hintEs: 'Asfalto mojado tras la lluvia de verano, una vieja biblioteca, vainilla.',
    hintFr: 'L’asphalte mouillé après une pluie d’été, une vieille bibliothèque, la vanille.',
  },
  {
    id: 'p-18',
    category: 'vision',
    categoryLabel: 'Wizja',
    promptPl: 'Jaka rozmowa wciąż na Ciebie czeka i dlaczego warto ją wkrótce odbyć?',
    promptEn: 'What conversation is still waiting for you, and why is it worth having soon?',
    promptEs: '¿Qué conversación sigue esperándote y por qué vale la pena tenerla pronto?',
    promptFr: 'Quelle conversation vous attend encore, et pourquoi vaut-il la peine de l’avoir bientôt ?',
    hintPl: 'Jakie słowa chciałbyś usłyszeć, a jakie wypowiedzieć?',
    hintEn: 'What words would you like to hear, and what words to speak?',
    hintEs: '¿Qué palabras te gustaría escuchar y cuáles pronunciar?',
    hintFr: 'Quels mots aimeriez-vous entendre, et lesquels aimeriez-vous prononcer ?',
  },
  {
    id: 'p-19',
    category: 'sensory',
    categoryLabel: 'Zmysły',
    promptPl: 'Zamknij na 10 sekund oczy. Jaki najdalszy dźwięk dochodzi teraz do Twoich uszu?',
    promptEn: 'Close your eyes for 10 seconds. What is the most distant sound reaching your ears right now?',
    promptEs: 'Cierra los ojos durante 10 segundos. ¿Cuál es el sonido más lejano que llega ahora mismo a tus oídos?',
    promptFr: 'Fermez les yeux pendant 10 secondes. Quel est le son le plus lointain qui parvient à vos oreilles en cet instant ?',
    hintPl: 'Odległy szum drogi, śpiew ptaka, tykanie zegara w drugim pokoju.',
    hintEn: 'Distant traffic hum, a bird outside, a clock ticking in the next room.',
    hintEs: 'El rumor lejano de la calle, un pájaro, el reloj en la otra habitación.',
    hintFr: 'La rumeur lointaine de la rue, un oiseau, le tic-tac d’une horloge.',
  },
  {
    id: 'p-20',
    category: 'reflection',
    categoryLabel: 'Refleksja',
    promptPl: 'Co sprawiło, że ostatnio poczułeś dumę z samego siebie — nawet jeśli nikt inny tego nie zauważył?',
    promptEn: 'What made you feel proud of yourself recently — even if no one else noticed?',
    promptEs: '¿Qué te hizo sentir orgulloso de ti mismo recientemente, aunque nadie más lo notara?',
    promptFr: 'Qu’est-ce qui vous a rendu fier de vous récemment, même si personne d’autre ne l’a remarqué ?',
    hintPl: 'Ciche opanowanie, dotrzymana obietnica, przezwyciężona niechęć.',
    hintEn: 'Quiet composure, a kept promise, overcoming reluctance.',
    hintEs: 'Serenidad en un momento tenso, una promesa cumplida, vencer la pereza.',
    hintFr: 'Un calme gardé, une promesse tenue, une hésitation surmontée.',
  },
  {
    id: 'p-21',
    category: 'sensory',
    categoryLabel: 'Zmysły',
    promptPl: 'Jaki kolor dominował w Twoim dzisiejszym otoczeniu i jak wpływał na Twój nastrój?',
    promptEn: 'What color dominated your surroundings today, and how did it shape your mood?',
    promptEs: '¿Qué color dominó hoy tu entorno y cómo influyó en tu estado de ánimo?',
    promptFr: 'Quelle couleur a dominé votre environnement aujourd’hui et comment a-t-elle influencé votre humeur ?',
    hintPl: 'Szarość porannej mgły, głęboka zieleń liści, ciepły bursztyn herbaty.',
    hintEn: 'The grey of morning mist, deep green leaves, warm amber tea.',
    hintEs: 'El gris de la niebla matinal, el verde profundo de las hojas, el ámbar del té.',
    hintFr: 'Le gris de la brume matinale, le vert profond des feuilles, l’ambre chaud du thé.',
  },
  {
    id: 'p-22',
    category: 'memory',
    categoryLabel: 'Pamięć',
    promptPl: 'Przypomnij sobie podróż lub spacer, podczas którego zgubiłeś drogę, a mimo to odkryłeś coś pięknego.',
    promptEn: 'Recall a journey or walk where you lost your way, yet discovered something worthwhile.',
    promptEs: 'Recuerda un viaje o paseo en el que perdiste el rumbo y, sin embargo, descubriste algo hermoso.',
    promptFr: 'Souvenez-vous d’un voyage ou d’une promenade où vous vous êtes égaré tout en découvrant quelque chose de précieux.',
    hintPl: 'Nieznana uliczka, rozmowa z nieznajomym, nagły widok.',
    hintEn: 'An unfamiliar alley, a talk with a stranger, a sudden view.',
    hintEs: 'Una calle desconocida, una charla con un extraño, un paisaje inesperado.',
    hintFr: 'Une ruelle inconnue, un échange avec un passant, un point de vue inattendu.',
  },
  {
    id: 'p-23',
    category: 'gratitude',
    categoryLabel: 'Wdzięczność',
    promptPl: 'Jaka książka, piosenka lub film przyszedł do Ciebie dokładnie wtedy, gdy najbardziej go potrzebowałeś?',
    promptEn: 'What book, song, or film found you at the exact moment you needed it most?',
    promptEs: '¿Qué libro, canción o película llegó a tu vida justo cuando más lo necesitabas?',
    promptFr: 'Quel livre, chanson ou film est arrivé dans votre vie au moment exact où vous en aviez le plus besoin ?',
    hintPl: 'Co w tym dziele dało Ci wtedy ukojenie lub impuls?',
    hintEn: 'What inside that work gave you solace or momentum then?',
    hintEs: '¿Qué detalle de esa obra te dio consuelo o impulso entonces?',
    hintFr: 'Qu’est-ce qui, dans cette œuvre, vous a apporté réconfort ou élan ?',
  },
  {
    id: 'p-24',
    category: 'vision',
    categoryLabel: 'Wizja',
    promptPl: 'Jakiej jednej umiejętności chciałbyś się nauczyć wyłącznie dla czystej przyjemności tworzenia?',
    promptEn: 'What single skill would you love to learn purely for the quiet joy of making?',
    promptEs: '¿Qué habilidad te gustaría aprender únicamente por el puro placer de crear?',
    promptFr: 'Quel savoir-faire aimeriez-vous apprendre uniquement pour le simple plaisir de créer ?',
    hintPl: 'Bez presji użyteczności czy zarobku — garncarstwo, szkicowanie, pieczenie chleba.',
    hintEn: 'Free of utility or profit — pottery, sketching, baking bread.',
    hintEs: 'Sin presión de utilidad ni beneficio: cerámica, dibujo, hornear pan.',
    hintFr: 'Sans recherche d’utilité ni de rendement : poterie, croquis, pain au levain.',
  },
  {
    id: 'p-25',
    category: 'reflection',
    categoryLabel: 'Refleksja',
    promptPl: 'W jakiej kwestii zmieniłeś zdanie w ciągu ostatniego roku i co Cię do tego skłoniło?',
    promptEn: 'On what matter have you changed your mind over the past year, and what prompted the shift?',
    promptEs: '¿Sobre qué asunto has cambiado de opinión en el último año y qué te llevó a ello?',
    promptFr: 'Sur quel sujet avez-vous changé d’avis au cours de l’année écoulée, et qu’est-ce qui a provoqué ce déclic ?',
    hintPl: 'Zmiana perspektywy to dowód uważnego życia.',
    hintEn: 'Shifting perspective is proof of an attentive life.',
    hintEs: 'Cambiar de perspectiva es señal de una vida atenta.',
    hintFr: 'Changer de regard est la preuve d’une vie attentive.',
  },
  {
    id: 'p-26',
    category: 'sensory',
    categoryLabel: 'Zmysły',
    promptPl: 'Opisz powietrze podczas ostatniego wyjścia z domu: czy było rześkie, ciężkie, wilgotne, wietrzne?',
    promptEn: 'Describe the air the last time you stepped outside: was it crisp, heavy, damp, or breezy?',
    promptEs: 'Describe el aire la última vez que saliste de casa: ¿era fresco, denso, húmedo o ventoso?',
    promptFr: 'Décrivez l’air lors de votre dernière sortie : était-il vif, lourd, humide ou venteux ?',
    hintPl: 'Jak zareagowała Twoja skóra i pierwszy głęboki wdech?',
    hintEn: 'How did your skin and first deep breath respond?',
    hintEs: '¿Cómo reaccionaron tu piel y tu primera inhalación profunda?',
    hintFr: 'Comment votre peau et votre première grande inspiration ont-elles réagi ?',
  },
  {
    id: 'p-27',
    category: 'memory',
    categoryLabel: 'Pamięć',
    promptPl: 'Jaka prosta tradycja lub rytuał z przeszłości najbardziej zasługuje na to, by przywrócić go dziś do życia?',
    promptEn: 'What simple tradition or ritual from your past most deserves to be revived today?',
    promptEs: '¿Qué tradición sencilla o ritual del pasado merece más ser recuperado hoy?',
    promptFr: 'Quelle tradition simple ou quel rituel du passé mériterait le plus d’être réinventé aujourd’hui ?',
    hintPl: 'Niedzielny spacer bez telefonu, papierowy list, wspólna herbata.',
    hintEn: 'A phone-free Sunday walk, a handwritten letter, shared evening tea.',
    hintEs: 'Un paseo dominical sin teléfono, una carta a mano, un té compartido.',
    hintFr: 'Une marche dominicale sans téléphone, une lettre manuscrite, un thé partagé.',
  },
  {
    id: 'p-28',
    category: 'gratitude',
    categoryLabel: 'Wdzięczność',
    promptPl: 'Pomyśl o kimś, kto nauczył Cię czegoś ważnego, choć być może sam nigdy się o tym nie dowiedział.',
    promptEn: 'Think of someone who taught you something important, even if they never knew it.',
    promptEs: 'Piensa en alguien que te enseñó algo valioso, aunque tal vez nunca llegara a saberlo.',
    promptFr: 'Pensez à quelqu’un qui vous a transmis quelque chose d’essentiel, sans peut-être jamais le savoir.',
    hintPl: 'Nauczyciel, dawny znajomy, przypadkowy towarzysz podróży.',
    hintEn: 'A teacher, an old acquaintance, a fellow traveler.',
    hintEs: 'Un maestro, un antiguo conocido, un compañero casual de viaje.',
    hintFr: 'Un professeur, une ancienne connaissance, un compagnon de voyage.',
  },
  {
    id: 'p-29',
    category: 'vision',
    categoryLabel: 'Wizja',
    promptPl: 'Gdybyś mógł zaprojektować pokój przeznaczony wyłącznie do odpoczynku i skupienia, co by się w nim znalazło?',
    promptEn: 'If you could design a room meant solely for rest and deep focus, what would be inside?',
    promptEs: 'Si pudieras diseñar una habitación dedicada solo al descanso y la calma, ¿qué habría en ella?',
    promptFr: 'Si vous pouviez concevoir une pièce dédiée uniquement au repos et à la concentration, que contiendrait-elle ?',
    hintPl: 'Materiały, światło, widok z okna, jeden ulubiony fotel.',
    hintEn: 'Materials, lighting, the window view, one favorite armchair.',
    hintEs: 'Materiales, iluminación, la vista desde la ventana, un sillón favorito.',
    hintFr: 'Les matériaux, la lumière, la vue par la fenêtre, un fauteuil préféré.',
  },
  {
    id: 'p-30',
    category: 'reflection',
    categoryLabel: 'Refleksja',
    promptPl: 'Co w Twoim życiu dzieje się teraz powoli, pod powierzchnią, wymagając od Ciebie cierpliwości?',
    promptEn: 'What in your life is unfolding slowly beneath the surface right now, asking for your patience?',
    promptEs: '¿Qué está creciendo lentamente bajo la superficie en tu vida ahora mismo, pidiendo tu paciencia?',
    promptFr: 'Qu’est-ce qui mûrit lentement sous la surface dans votre vie en ce moment et demande votre patience ?',
    hintPl: 'Nie każde nasiono kiełkuje od razu.',
    hintEn: 'Not every seed sprouts overnight.',
    hintEs: 'No toda semilla brota de la noche a la mañana.',
    hintFr: 'Toutes les graines ne germent pas du jour au lendemain.',
  },
  {
    id: 'p-31',
    category: 'sensory',
    categoryLabel: 'Zmysły',
    promptPl: 'Przypomnij sobie dźwięk deszczu, śniegu lub wiatru za oknem, gdy jesteś bezpiecznie w środku.',
    promptEn: 'Recall the sound of rain, snow, or wind outside the window while you are safe indoors.',
    promptEs: 'Recuerda el sonido de la lluvia, la nieve o el viento tras la ventana mientras estás a salvo dentro.',
    promptFr: 'Rappelez-vous le bruit de la pluie, de la neige ou du vent derrière la vitre lorsque vous êtes à l’abri.',
    hintPl: 'Jak zmienia się wtedy odczuwanie domowego ciepła?',
    hintEn: 'How does that contrast deepen the feeling of warmth inside?',
    hintEs: '¿Cómo cambia entonces la sensación de calidez del hogar?',
    hintFr: 'Comment ce contraste renforce-t-il la sensation de chaleur intérieure ?',
  },
  {
    id: 'p-32',
    category: 'memory',
    categoryLabel: 'Pamięć',
    promptPl: 'Opisz pierwszy dom lub mieszkanie, które pamiętasz — jaką drogę pokonywałeś tam od drzwi do okna?',
    promptEn: 'Describe the earliest home you remember — what was the path from the front door to the window?',
    promptEs: 'Describe la primera casa que recuerdas: ¿cómo era el recorrido desde la puerta hasta la ventana?',
    promptFr: 'Décrivez la première maison dont vous vous souvenez : quel était le chemin de la porte jusqu’à la fenêtre ?',
    hintPl: 'Jakie detale zapamiętała dziecięca uwaga?',
    hintEn: 'Which details did your childhood attention hold onto?',
    hintEs: '¿Qué detalles conservó tu mirada de la infancia?',
    hintFr: 'Quels détails votre regard d’enfant a-t-il retenus ?',
  },
  {
    id: 'p-33',
    category: 'gratitude',
    categoryLabel: 'Wdzięczność',
    promptPl: 'Jaka cecha Twojego charakteru pomogła Ci przetrwać wymagający tydzień lub trudniejszy moment?',
    promptEn: 'What trait of your own character helped carry you through a demanding week or difficult moment?',
    promptEs: '¿Qué rasgo de tu propio carácter te ayudó a superar una semana exigente o un momento difícil?',
    promptFr: 'Quel trait de votre propre caractère vous a aidé à traverser une semaine exigeante ou un moment délicat ?',
    hintPl: 'Wytrwałość, poczucie humoru, umiejętność odpuszczania?',
    hintEn: 'Persistence, a sense of humor, knowing when to let go?',
    hintEs: '¿La constancia, el sentido del humor, saber soltar a tiempo?',
    hintFr: 'La persévérance, le sens de l’humour, la capacité à lâcher prise ?',
  },
  {
    id: 'p-34',
    category: 'vision',
    categoryLabel: 'Wizja',
    promptPl: 'Z czego chciałbyś zrezygnować w najbliższych tygodniach, aby zrobić miejsce na więcej ciszy?',
    promptEn: 'What would you like to step back from in the coming weeks to make room for more quiet?',
    promptEs: '¿A qué te gustaría renunciar en las próximas semanas para dejar espacio a más silencio?',
    promptFr: 'À quoi aimeriez-vous renoncer ces prochaines semaines pour laisser davantage de place au silence ?',
    hintPl: 'Nadmiar informacji, pośpieszne obietnice, wieczorne przewijanie ekranu.',
    hintEn: 'Information noise, hurried commitments, late-night scrolling.',
    hintEs: 'El exceso de información, compromisos apresurados, mirar pantallas de noche.',
    hintFr: 'Le trop-plein d’informations, les promesses hâtives, les écrans tard le soir.',
  },
  {
    id: 'p-35',
    category: 'reflection',
    categoryLabel: 'Refleksja',
    promptPl: 'Kiedy ostatnio poczułeś, że czas płynie zupełnie inaczej niż zwykle — znacznie wolniej lub szybciej?',
    promptEn: 'When did you last feel time moving differently than usual — much slower or much faster?',
    promptEs: '¿Cuándo sentiste por última vez que el tiempo fluía de forma distinta, mucho más lento o más rápido?',
    promptFr: 'Quand avez-vous senti pour la dernière fois que le temps s’écoulait différemment — bien plus lentement ou plus vite ?',
    hintPl: 'Co wtedy robiłeś i z kim byłeś?',
    hintEn: 'What were you doing, and who was there with you?',
    hintEs: '¿Qué estabas haciendo entonces y con quién estabas?',
    hintFr: 'Que faisiez-vous alors et qui vous accompagnait ?',
  },
  {
    id: 'p-36',
    category: 'sensory',
    categoryLabel: 'Zmysły',
    promptPl: 'Spójrz na swoje dłonie. Co dzisiaj trzymały, przesuwały lub tworzyły przez cały dzień?',
    promptEn: 'Look at your hands. What did they hold, move, or create throughout the day today?',
    promptEs: 'Mira tus manos. ¿Qué sostuvieron, movieron o crearon a lo largo del día de hoy?',
    promptFr: 'Regardez vos mains. Qu’ont-elles tenu, déplacé ou façonné tout au long de cette journée ?',
    hintPl: 'Od porannego kubka po wieczorne zgaszenie światła.',
    hintEn: 'From the morning cup to turning off the evening light.',
    hintEs: 'Desde la taza de la mañana hasta apagar la luz por la noche.',
    hintFr: 'De la tasse du matin jusqu’à la lumière éteinte le soir.',
  },
  {
    id: 'p-37',
    category: 'memory',
    categoryLabel: 'Pamięć',
    promptPl: 'Przypomnij sobie komplement lub dobre słowo sprzed lat, które wciąż nosi w Tobie ciepło.',
    promptEn: 'Recall a compliment or kind word from years ago that still carries warmth inside you.',
    promptEs: 'Recuerda un cumplido o una palabra amable de hace años que aún conserva su calidez en ti.',
    promptFr: 'Souvenez-vous d’un compliment ou d’une parole bienveillante d’il y a des années qui vous réchauffe encore.',
    hintPl: 'Dlaczego właśnie te słowa zostały z Tobą tak długo?',
    hintEn: 'Why did those particular words stay with you so long?',
    hintEs: '¿Por qué esas palabras en particular se quedaron contigo tanto tiempo?',
    hintFr: 'Pourquoi ces mots-là sont-ils restés si longtemps en vous ?',
  },
  {
    id: 'p-38',
    category: 'gratitude',
    categoryLabel: 'Wdzięczność',
    promptPl: 'Która pora dnia sprzyja Ci teraz najbardziej i za co ją najbardziej cenisz?',
    promptEn: 'Which hour of the day suits you best right now, and what do you treasure most about it?',
    promptEs: '¿Qué momento del día te sienta mejor ahora mismo y qué es lo que más valoras de él?',
    promptFr: 'Quel moment de la journée vous convient le mieux actuellement, et qu’y appréciez-vous le plus ?',
    hintPl: 'Brzask przed budzikiem, popołudniowe słońce, głęboki zmierzch.',
    hintEn: 'Dawn before the alarm, late afternoon sun, deep twilight.',
    hintEs: 'El alba antes del despertador, el sol de la tarde, el crepúsculo.',
    hintFr: 'L’aube avant le réveil, le soleil d’après-midi, le crépuscule.',
  },
  {
    id: 'p-39',
    category: 'vision',
    categoryLabel: 'Wizja',
    promptPl: 'Gdybyś miał napisać krótki list do siebie za rok, o co byś siebie w nim zapytał?',
    promptEn: 'If you were to write a short note to yourself one year from today, what would you ask?',
    promptEs: 'Si escribieras una breve nota para tu yo de dentro de un año, ¿qué le preguntarías?',
    promptFr: 'Si vous deviez écrire un court billet à celui ou celle que vous serez dans un an, quelle question poseriez-vous ?',
    hintPl: 'Pytanie o spokój ducha, nie o listę zadań.',
    hintEn: 'Ask about peace of mind rather than a checklist of tasks.',
    hintEs: 'Una pregunta sobre la paz interior, no sobre una lista de tareas.',
    hintFr: 'Une question sur la paix intérieure plutôt que sur une liste d’objectifs.',
  },
  {
    id: 'p-40',
    category: 'reflection',
    categoryLabel: 'Refleksja',
    promptPl: 'Co pomaga Ci wrócić do równowagi, gdy świat wokół staje się zbyt głośny i wymagający?',
    promptEn: 'What helps you return to balance when the world around you grows too loud and demanding?',
    promptEs: '¿Qué te ayuda a recuperar el equilibrio cuando el mundo a tu alrededor se vuelve demasiado ruidoso?',
    promptFr: 'Qu’est-ce qui vous aide à retrouver votre équilibre lorsque le monde autour devient trop bruyant ?',
    hintPl: 'Nazwij swoją bezpieczną przystań w codzienności.',
    hintEn: 'Name your quiet harbor in everyday life.',
    hintEs: 'Nombra tu refugio tranquilo en la vida cotidiana.',
    hintFr: 'Nommez votre havre de calme dans le quotidien.',
  },
  {
    id: 'p-41',
    category: 'sensory',
    categoryLabel: 'Zmysły',
    promptPl: 'Jaki smak kojarzy Ci się z obecną porą roku i kiedy ostatnio miałeś okazję go poczuć?',
    promptEn: 'What flavor belongs to this current season for you, and when did you last taste it?',
    promptEs: '¿Qué sabor asocias con esta estación del año y cuándo tuviste ocasión de probarlo por última vez?',
    promptFr: 'Quelle saveur associez-vous à la saison actuelle, et quand l’avez-vous goûtée pour la dernière fois ?',
    hintPl: 'Pieczone jabłka, świeże zioła, cynamon, chłodna lemoniada.',
    hintEn: 'Baked apples, fresh herbs, cinnamon, cool lemonade.',
    hintEs: 'Manzanas asadas, hierbas frescas, canela, limonada fría.',
    hintFr: 'Pommes au four, herbes fraîches, cannelle, limonade fraîche.',
  },
  {
    id: 'p-42',
    category: 'memory',
    categoryLabel: 'Pamięć',
    promptPl: 'Opisz wieczór z przeszłości, podczas którego długo rozmawiałeś z kimś do późna w nocy.',
    promptEn: 'Describe an evening from your past when you talked with someone late into the night.',
    promptEs: 'Describe una noche del pasado en la que conversaste con alguien hasta altas horas.',
    promptFr: 'Décrivez une soirée du passé où vous avez discuté avec quelqu’un jusque tard dans la nuit.',
    hintPl: 'O czym mówiliście, gdy cały dom lub miasto już spało?',
    hintEn: 'What did you talk about while the house or city slept?',
    hintEs: '¿De qué hablaban mientras toda la casa o la ciudad dormía?',
    hintFr: 'De quoi parliez-vous pendant que la maison ou la ville dormait ?',
  },
  {
    id: 'p-43',
    category: 'gratitude',
    categoryLabel: 'Wdzięczność',
    promptPl: 'Za jaki błąd lub potknięcie z przeszłości potrafisz dziś być sobie wdzięczny?',
    promptEn: 'What past mistake or stumble can you look back on today with genuine gratitude?',
    promptEs: '¿Por qué error o tropiezo del pasado puedes sentir hoy una sincera gratitud?',
    promptFr: 'Pour quelle erreur ou quel faux pas du passé pouvez-vous aujourd’hui éprouver de la gratitude ?',
    hintPl: 'Czasem zamknięte drzwi chronią przed niewłaściwą drogą.',
    hintEn: 'Sometimes a closed door protects us from the wrong path.',
    hintEs: 'A veces una puerta cerrada nos protege del camino equivocado.',
    hintFr: 'Parfois, une porte fermée nous protège d’un mauvais chemin.',
  },
  {
    id: 'p-44',
    category: 'vision',
    categoryLabel: 'Wizja',
    promptPl: 'Jakie miejsce na świecie lub w Twojej okolicy chciałbyś odwiedzić bez pośpiechu i bez planu?',
    promptEn: 'What place in the world or near your home would you love to visit unhurried and unplanned?',
    promptEs: '¿Qué lugar del mundo o de tu entorno te gustaría visitar sin prisas y sin itinerario?',
    promptFr: 'Quel endroit, proche ou lointain, aimeriez-vous visiter sans hâte et sans programme ?',
    hintPl: 'Wyobraź sobie pierwsze pół godziny po dotarciu na miejsce.',
    hintEn: 'Picture the first half hour after arriving there.',
    hintEs: 'Imagina la primera media hora tras llegar a ese lugar.',
    hintFr: 'Imaginez la première demi-heure après votre arrivée sur place.',
  },
  {
    id: 'p-45',
    slug: 'daily-nature-respite',
    category: 'gratitude',
    categoryLabel: 'Wdzięczność',
    promptPl: 'Jaki fragment przyrody — drzewo za oknem, park, niebo nad ulicą — daje Ci co dzień chwilę wytchnienia?',
    promptEn: 'What piece of nature — a tree outside, a park, the sky above the street — gives you daily respite?',
    promptEs: '¿Qué rincón de la naturaleza —un árbol tras la ventana, un parque, el cielo— te da respiro cada día?',
    promptFr: 'Quel fragment de nature — un arbre devant la fenêtre, un parc, le ciel — vous offre un répit quotidien ?',
    hintPl: 'Jak zmienia się z tygodnia na tydzień na Twoich oczach?',
    hintEn: 'How does it change week by week before your eyes?',
    hintEs: '¿Cómo cambia semana a semana ante tus ojos?',
    hintFr: 'Comment évolue-t-il semaine après semaine sous vos yeux ?',
  },
  {
    id: 'p-46',
    slug: 'overcoming-burnout',
    category: 'reflection',
    categoryLabel: 'Refleksja',
    promptPl: 'Kiedy ostatnio poczułeś przeciążenie lub wypalenie — i jaki jeden mały ciężar możesz dziś świadomie odłożyć na bok?',
    promptEn: 'When did you last feel stretched thin or burned out — and what one small weight can you consciously set down today?',
    promptEs: '¿Cuándo te sentiste por última vez agotado o saturado, y qué pequeña carga puedes dejar conscientemente a un lado hoy?',
    promptFr: 'Quand vous êtes-vous senti épuisé ou surmené pour la dernière fois — et quel petit poids pouvez-vous déposer consciemment aujourd’hui ?',
    hintPl: 'Nazwij jedną rzecz, której nie musisz dzisiaj udowadniać ani kończyć na siłę.',
    hintEn: 'Name one expectation you do not need to prove or force to completion today.',
    hintEs: 'Nombra una expectativa que hoy no necesites demostrar ni forzar.',
    hintFr: 'Nommez une attente que vous n’avez pas besoin de prouver ni de forcer aujourd’hui.',
  },
  {
    id: 'p-47',
    slug: 'evening-gratitude',
    category: 'gratitude',
    categoryLabel: 'Wdzięczność',
    promptPl: 'Zanim zamkniesz dzisiejszy dzień: jaka jedna spokojna chwila, rozmowa lub drobiazg sprawiły, że warto było przez niego przejść?',
    promptEn: 'Before closing today: what single quiet moment, conversation, or small detail made the day worth walking through?',
    promptEs: 'Antes de cerrar el día de hoy: ¿qué momento tranquilo, conversación o pequeño detalle hizo que valiera la pena?',
    promptFr: 'Avant de clore cette journée : quel moment paisible, échange ou détail a rendu ce jour précieux ?',
    hintPl: 'Skup się na czymś małym i prawdziwym, co wydarzyło się między wierszami dnia.',
    hintEn: 'Focus on something small and genuine that happened between the lines of your day.',
    hintEs: 'Concéntrate en algo pequeño y auténtico que ocurrió entre líneas hoy.',
    hintFr: 'Concentrez-vous sur quelque chose de simple et vrai survenu aujourd’hui.',
  },
];

const CURATED_PROMPT_SLUGS: Record<string, string> = {
  'p-01': 'sensory-memory-of-taste',
  'p-02': 'photograph-outside-the-frame',
  'p-03': 'subtle-act-of-kindness',
  'p-04': 'quiet-morning-before-screens',
  'p-05': 'background-sound-that-stopped-time',
  'p-06': 'calming-sentence-to-past-self',
  'p-07': 'everyday-object-marks-of-time',
  'p-08': 'unspoken-gratitude-to-someone',
  'p-09': 'place-where-time-slows-down',
  'p-10': 'habit-that-brings-calm',
  'p-45': 'daily-nature-respite',
  'p-46': 'overcoming-burnout',
  'p-47': 'evening-gratitude',
};

export function slugifyPromptText(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .split(/\s+/)
    .slice(0, 6)
    .join('-')
    .replace(/-+/g, '-');
}

export function getPromptSlug(prompt: DailyPrompt): string {
  if (prompt.slug) return prompt.slug;
  if (CURATED_PROMPT_SLUGS[prompt.id]) return CURATED_PROMPT_SLUGS[prompt.id];
  const generated = slugifyPromptText(prompt.promptEn || prompt.id);
  return generated ? `${generated}-${prompt.id}` : prompt.id;
}

export function getPromptBySlug(slugOrId: string): DailyPrompt | undefined {
  const clean = decodeURIComponent(slugOrId || '').trim().toLowerCase();
  if (!clean) return undefined;
  return DAILY_PROMPTS.find(
    p =>
      p.id.toLowerCase() === clean ||
      getPromptSlug(p).toLowerCase() === clean ||
      slugifyPromptText(p.promptEn).toLowerCase() === clean
  );
}

export interface PromptSeoDetails {
  slug: string;
  urlPath: string;
  title: string;
  metaDescription: string;
  categoryLabel: string;
  promptText: string;
  hintText: string;
  reflectionGuide: string;
  followUpQuestions: string[];
}

export function getPromptSeoDetails(
  prompt: DailyPrompt,
  lang: Language = 'pl'
): PromptSeoDetails {
  const slug = getPromptSlug(prompt);
  const urlPath = `/prompts/${slug}`;
  const promptText = getPromptText(prompt, lang);
  const hintText = getHintText(prompt, lang);
  const categoryLabel = getCategoryLabel(prompt.category, lang);

  const isEn = lang === 'en';
  const isEs = lang === 'es';
  const isFr = lang === 'fr';

  const shortQuestion =
    promptText.length > 52 ? `${promptText.slice(0, 49).trim()}...` : promptText;

  const title = isEn
    ? `${shortQuestion} | Moments — Daily Reflection Prompt`
    : isEs
    ? `${shortQuestion} | Moments — Pregunta de Reflexión Diaria`
    : isFr
    ? `${shortQuestion} | Moments — Question de Réflexion Quotidienne`
    : `${shortQuestion} | Momenty — Pytanie do Dziennika`;

  const metaDescription = isEn
    ? `Reflect on "${promptText}" (${categoryLabel}). Write your private, end-to-end encrypted journal entry right on the page — no sign-up wall required to start.`
    : isEs
    ? `Reflexiona sobre «${promptText}» (${categoryLabel}). Escribe tu entrada privada con cifrado de extremo a extremo directamente en la página.`
    : isFr
    ? `Réfléchissez à « ${promptText} » (${categoryLabel}). Écrivez votre entrée privée chiffrée de bout en bout directement sur la page.`
    : `Zatrzymaj się przy pytaniu: „${promptText}” (${categoryLabel}). Zapisz swoją refleksję od razu na stronie w prywatnym dzienniku z szyfrowaniem end-to-end.`;

  const reflectionGuideByCategory: Record<PromptCategory, { pl: string; en: string; es: string; fr: string }> = {
    sensory: {
      pl: 'Uważność zmysłowa pozwala wyjść z natłoku abstrakcyjnych zmartwień i zakotwiczyć pamięć w konkretnym detalu — zapachu, temperaturze, świetle lub dźwięku. Wystarczą trzy spokojne zdania.',
      en: 'Sensory mindfulness pulls you out of abstract overthinking and anchors memory in a concrete detail — a scent, temperature, light, or sound. Three unhurried sentences are enough.',
      es: 'La atención sensorial te saca del exceso de pensamientos abstractos y ancla la memoria en un detalle concreto: un aroma, luz o sonido.',
      fr: 'L’attention sensorielle vous sort du flot de pensées abstraites et ancre la mémoire dans un détail concret — un arôme, une lumière ou un son.',
    },
    memory: {
      pl: 'Wspomnienia zapisane własnymi słowami nie blakną z upływem lat. Zamiast opisywać całe wydarzenie, uchwyć pojedynczą scenę i to, co działo się tuż poza kadrem.',
      en: 'Memories written in your own words do not fade with the years. Instead of summarizing a whole event, capture a single scene and what happened just outside the frame.',
      es: 'Los recuerdos escritos con tus propias palabras no se desvanecen con los años. Captura una sola escena y lo que ocurrió fuera del encuadre.',
      fr: 'Les souvenirs écrits avec vos propres mots ne s’effacent pas avec les années. Capturez une seule scène et ce qui se passait hors du cadre.',
    },
    gratitude: {
      pl: 'Wieczorna wdzięczność nie polega na wymuszonym optymizmie, lecz na zauważeniu jednego prawdziwego drobiazgu, który dał Ci dziś odrobinę ciepła lub spokoju.',
      en: 'Evening gratitude is not forced optimism — it is noticing one genuine small thing that brought you warmth, relief, or quietness today.',
      es: 'La gratitud nocturna no es optimismo forzado, sino notar un detalle auténtico que te dio calma o calidez hoy.',
      fr: 'La gratitude du soir n’est pas un optimisme forcé, mais l’art de remarquer un détail sincère qui vous a apporté du calme aujourd’hui.',
    },
    reflection: {
      pl: 'Spokojna refleksja pomaga oddzielić to, co naprawdę ważne, od codziennego szumu i przeciążenia. Pisz szczerze, tylko dla siebie — tekst jest szyfrowany przed zapisem.',
      en: 'Quiet reflection helps separate what truly matters from daily noise and burnout. Write honestly, just for yourself — your words are encrypted before saving.',
      es: 'La reflexión tranquila ayuda a separar lo que realmente importa del ruido diario y el agotamiento. Escribe con sinceridad solo para ti.',
      fr: 'La réflexion paisible aide à séparer l’essentiel du bruit quotidien et de l’épuisement. Écrivez sincèrement, uniquement pour vous.',
    },
    vision: {
      pl: 'Patrzenie w przyszłość bez presji listy zadań pozwala usłyszeć własne potrzeby. Wyobraź sobie jedno miejsce, rytm dnia lub uczucie, do którego chcesz się zbliżyć.',
      en: 'Looking ahead without the pressure of a to-do list lets you hear your own needs. Picture a single place, daily rhythm, or feeling you want to move toward.',
      es: 'Mirar hacia adelante sin la presión de una lista de tareas te permite escuchar tus propias necesidades.',
      fr: 'Regarder vers l’avenir sans la pression d’une liste de tâches permet d’écouter vos vrais besoins.',
    },
  };

  const followUpsByCategory: Record<PromptCategory, { pl: string[]; en: string[]; es: string[]; fr: string[] }> = {
    sensory: {
      pl: [
        'Jaki pojedynczy dźwięk lub zapach najmocniej kojarzy Ci się z tą chwilą?',
        'Gdzie dokładnie wtedy byłeś i jakie światło panowało wokół?',
        'Jak Twoje ciało zareagowało na ten bodziec — napięciem czy rozluźnieniem?',
      ],
      en: [
        'What single sound or scent do you associate most strongly with this moment?',
        'Where exactly were you, and what was the light like around you?',
        'How did your body respond — with tension or with calm release?',
      ],
      es: [
        '¿Qué sonido o aroma asocias con más fuerza a este momento?',
        '¿Dónde estabas exactamente y cómo era la luz a tu alrededor?',
        '¿Cómo reaccionó tu cuerpo: con tensión o con calma?',
      ],
      fr: [
        'Quel son ou quel parfum associez-vous le plus fortement à cet instant ?',
        'Où étiez-vous exactement et comment était la lumière autour de vous ?',
        'Comment votre corps a-t-il réagi — par de la tension ou de l’apaisement ?',
      ],
    },
    memory: {
      pl: [
        'Kto jeszcze był wtedy w pobliżu lub o kim wtedy pomyślałeś?',
        'Jaki drobny szczegół z tamtej chwili pamiętasz najdokładniej?',
        'Co powiedziałbyś dzisiaj osobie, którą wtedy byłeś?',
      ],
      en: [
        'Who else was nearby, or who crossed your mind in that moment?',
        'What small detail from that scene do you remember most vividly?',
        'What would you say today to the person you were back then?',
      ],
      es: [
        '¿Quién más estaba cerca o en quién pensaste en ese instante?',
        '¿Qué pequeño detalle de esa escena recuerdas con mayor nitidez?',
        '¿Qué le dirías hoy a la persona que eras entonces?',
      ],
      fr: [
        'Qui d’autre était présent ou à qui avez-vous pensé à cet instant ?',
        'Quel petit détail de cette scène vous revient le plus clairement ?',
        'Que diriez-vous aujourd’hui à la personne que vous étiez alors ?',
      ],
    },
    gratitude: {
      pl: [
        'Dlaczego akurat ten drobiazg zapadł Ci dzisiaj w pamięć?',
        'Czy osoba, której jesteś wdzięczny, wie, ile to dla Ciebie znaczyło?',
        'Jak zmienił się Twój nastrój, kiedy to zauważyłeś?',
      ],
      en: [
        'Why did this particular detail stand out to you today?',
        'Does the person involved know how much that moment meant to you?',
        'How did your mood shift once you noticed it?',
      ],
      es: [
        '¿Por qué te llamó la atención precisamente ese detalle hoy?',
        '¿Sabe esa persona cuánto significó ese gesto para ti?',
        '¿Cómo cambió tu estado de ánimo al notarlo?',
      ],
      fr: [
        'Pourquoi ce détail particulier a-t-il retenu votre attention aujourd’hui ?',
        'La personne concernée sait-elle à quel point cela a compté pour vous ?',
        'Comment votre humeur a-t-elle évolué en le remarquant ?',
      ],
    },
    reflection: {
      pl: [
        'Co w tej sytuacji zależy bezpośrednio od Ciebie, a co możesz spokojnie odpuścić?',
        'Jaka myśl powracała do Ciebie najczęściej w ciągu ostatnich godzin?',
        'Gdybyś miał zadbać o siebie dziś wieczorem w jeden prosty sposób, co by to było?',
      ],
      en: [
        'What part of this is within your control, and what can you gently let go of?',
        'Which thought kept returning to you over the past few hours?',
        'If you could care for yourself in one simple way tonight, what would it be?',
      ],
      es: [
        '¿Qué parte de esto depende de ti y qué puedes soltar con calma?',
        '¿Qué pensamiento volvió con más frecuencia en las últimas horas?',
        'Si pudieras cuidarte de una forma sencilla esta noche, ¿cuál sería?',
      ],
      fr: [
        'Quelle part dépend de vous, et que pouvez-vous laisser aller sereinement ?',
        'Quelle pensée est revenue le plus souvent ces dernières heures ?',
        'Si vous pouviez prendre soin de vous simplement ce soir, que feriez-vous ?',
      ],
    },
    vision: {
      pl: [
        'Jaki jeden mały krok przybliżyłby Cię do tego stanu już w tym tygodniu?',
        'Jak wyglądałby Twój poranek, gdyby ta wizja stała się codziennością?',
        'Co musiałbyś pożegnać, żeby zrobić na to miejsce?',
      ],
      en: [
        'What single small step could bring you closer to this feeling this week?',
        'What would your morning look like if this vision became your everyday rhythm?',
        'What would you need to set aside to make room for it?',
      ],
      es: [
        '¿Qué pequeño paso podría acercarte a esa sensación esta misma semana?',
        '¿Cómo sería tu mañana si esa visión fuera tu ritmo diario?',
        '¿Qué tendrías que dejar atrás para hacerle espacio?',
      ],
      fr: [
        'Quel petit pas pourrait vous rapprocher de cet état dès cette semaine ?',
        'À quoi ressemblerait votre matinée si cette vision devenait votre quotidien ?',
        'Que devriez-vous laisser de côté pour lui faire de la place ?',
      ],
    },
  };

  const guideObj = reflectionGuideByCategory[prompt.category] || reflectionGuideByCategory.reflection;
  const followObj = followUpsByCategory[prompt.category] || followUpsByCategory.reflection;

  return {
    slug,
    urlPath,
    title,
    metaDescription,
    categoryLabel,
    promptText,
    hintText,
    reflectionGuide: isEn ? guideObj.en : isEs ? guideObj.es : isFr ? guideObj.fr : guideObj.pl,
    followUpQuestions: isEn ? followObj.en : isEs ? followObj.es : isFr ? followObj.fr : followObj.pl,
  };
}

const MONTHLY_PROMPT_LOG_KEY = 'kronika_monthly_prompt_log';

export function getPastMonthDateKeys(todayKey: string, daysBack: number = 30): string[] {
  const [y, m, d] = todayKey.split('-').map(Number);
  const baseDate = y && m && d ? new Date(y, m - 1, d) : new Date();
  const keys: string[] = [];
  for (let i = 1; i <= daysBack; i++) {
    const dt = new Date(baseDate);
    dt.setDate(dt.getDate() - i);
    keys.push(formatDateKey(dt));
  }
  return keys;
}

export function recordMonthlyPromptUsage(dateKey: string, promptIds: string | string[]): void {
  if (typeof window === 'undefined') return;
  try {
    const raw = localStorage.getItem(MONTHLY_PROMPT_LOG_KEY);
    const parsed: Record<string, string[]> = raw ? JSON.parse(raw) : {};
    const idsToAdd = (Array.isArray(promptIds) ? promptIds : [promptIds]).filter(
      id => Boolean(id) && id !== FREE_THOUGHT_PROMPT_ID
    );
    if (idsToAdd.length === 0) return;
    const existing = Array.isArray(parsed[dateKey]) ? parsed[dateKey] : [];
    const merged = Array.from(new Set([...existing, ...idsToAdd]));
    parsed[dateKey] = merged;

    // Prune entries older than 35 days to keep storage tidy
    const keepKeys = new Set([dateKey, ...getPastMonthDateKeys(dateKey, 35)]);
    for (const k of Object.keys(parsed)) {
      if (!keepKeys.has(k)) {
        delete parsed[k];
      }
    }

    localStorage.setItem(MONTHLY_PROMPT_LOG_KEY, JSON.stringify(parsed));
  } catch {
    // Ignore storage errors
  }
}

export function getRecentPromptIdsLast30Days(
  todayKey: string,
  savedEntries?: { date: string; promptId?: string }[]
): Set<string> {
  const used = new Set<string>();
  const past30Keys = getPastMonthDateKeys(todayKey, 30);
  const past30Set = new Set(past30Keys);

  if (typeof window !== 'undefined') {
    try {
      const rawLog = localStorage.getItem(MONTHLY_PROMPT_LOG_KEY);
      if (rawLog) {
        const parsedLog: Record<string, string[]> = JSON.parse(rawLog);
        for (const [dtKey, ids] of Object.entries(parsedLog)) {
          if (past30Set.has(dtKey) && Array.isArray(ids)) {
            ids.forEach(id => {
              if (id) used.add(id);
            });
          }
        }
      }
    } catch {
      // Ignore parse errors
    }

    for (const dtKey of past30Keys) {
      const answered = localStorage.getItem(`kronika_answered_prompt_${dtKey}`);
      if (answered) used.add(answered);

      const draftRaw = localStorage.getItem(`kronika_draft_${dtKey}`);
      if (draftRaw) {
        try {
          const parsedDraft = JSON.parse(draftRaw);
          if (parsedDraft?.promptId) used.add(parsedDraft.promptId);
        } catch {
          // Ignore
        }
      }

      const historyRaw = localStorage.getItem(`kronika_prompt_history_${dtKey}`);
      if (historyRaw) {
        try {
          const parsedHist = JSON.parse(historyRaw);
          if (Array.isArray(parsedHist) && parsedHist[0]?.id) {
            // Always exclude at least the primary question shown on that day
            used.add(parsedHist[0].id);
          }
        } catch {
          // Ignore
        }
      }
    }
  }

  if (Array.isArray(savedEntries)) {
    for (const entry of savedEntries) {
      if (entry && entry.date && past30Set.has(entry.date) && entry.promptId) {
        used.add(entry.promptId);
      }
    }
  }

  return used;
}

export function getPromptForDate(
  date: Date = new Date(),
  excludedIds?: Set<string> | string[]
): DailyPrompt {
  const startOfYear = new Date(date.getFullYear(), 0, 0);
  const diff = date.getTime() - startOfYear.getTime();
  const oneDay = 1000 * 60 * 60 * 24;
  const dayOfYear = Math.floor(diff / oneDay);
  const baseIndex = Math.abs(dayOfYear) % DAILY_PROMPTS.length;

  const excludeSet =
    excludedIds instanceof Set
      ? excludedIds
      : Array.isArray(excludedIds)
      ? new Set(excludedIds)
      : new Set<string>();

  if (excludeSet.size > 0) {
    for (let offset = 0; offset < DAILY_PROMPTS.length; offset++) {
      const candidate = DAILY_PROMPTS[(baseIndex + offset) % DAILY_PROMPTS.length];
      if (!excludeSet.has(candidate.id)) {
        return candidate;
      }
    }
  }

  return DAILY_PROMPTS[baseIndex];
}

export function getRandomPrompt(
  category: PromptCategory | 'all',
  excludeId?: string | string[] | Set<string>
): DailyPrompt {
  const excludeSet =
    excludeId instanceof Set
      ? excludeId
      : Array.isArray(excludeId)
      ? new Set(excludeId)
      : excludeId
      ? new Set([excludeId])
      : new Set<string>();

  const pool = DAILY_PROMPTS.filter(p => {
    if (excludeSet.has(p.id)) return false;
    if (category === 'all') return true;
    return p.category === category;
  });

  const fallbackPool = DAILY_PROMPTS.filter(p => !excludeSet.has(p.id));
  const finalPool =
    pool.length > 0 ? pool : fallbackPool.length > 0 ? fallbackPool : DAILY_PROMPTS;
  const randomIndex = Math.floor(Math.random() * finalPool.length);
  return finalPool[randomIndex];
}

export function formatPolishDate(date: Date = new Date()): string {
  const days = ['NIEDZIELA', 'PONIEDZIAŁEK', 'WTOREK', 'ŚRODA', 'CZWARTEK', 'PIĄTEK', 'SOBOTA'];
  const months = [
    'STYCZNIA', 'LUTEGO', 'MARCA', 'KWIETNIA', 'MAJA', 'CZERWCA',
    'LIPCA', 'SIERPNIA', 'WRZEŚNIA', 'PAŹDZIERNIKA', 'LISTOPADA', 'GRUDNIA'
  ];

  const dayName = days[date.getDay()];
  const day = date.getDate();
  const monthName = months[date.getMonth()];
  const year = date.getFullYear();

  return `${dayName}, ${day} ${monthName} ${year}`;
}

export function formatDateKey(date: Date = new Date()): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

