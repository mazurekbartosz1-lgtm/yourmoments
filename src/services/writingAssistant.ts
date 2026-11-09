/**
 * Polish Typo & Spelling Correction Engine
 * Strictly fixes typos, spelling, diacritics, and punctuation WITHOUT altering
 * the meaning, syntax, or authentic voice of the author's sentences.
 */

export interface CorrectionChange {
  original: string;
  replacement: string;
  index: number;
}

export interface AutoCorrectionResult {
  correctedText: string;
  changesCount: number;
  changes: CorrectionChange[];
}

// Unicode boundary for Polish letters (a-z, A-Z and all Polish diacritics)
const POLISH_LETTERS = 'a-zA-ZąćęłńóśźżĄĆĘŁŃÓŚŹŻ';
const L_START = `(?<![${POLISH_LETTERS}])`;
const L_END = `(?![${POLISH_LETTERS}])`;

// High-precision Polish typo, metathesis & diacritic restoration rules
const POLISH_TYPO_RULES: [RegExp, string][] = [
  // Screenshot & user-highlighted specific words & variations
  [new RegExp(`${L_START}pamietam${L_END}`, 'giu'), 'pamiętam'],
  [new RegExp(`${L_START}pamietasz${L_END}`, 'giu'), 'pamiętasz'],
  [new RegExp(`${L_START}pamietać${L_END}`, 'giu'), 'pamiętać'],
  [new RegExp(`${L_START}pamietac${L_END}`, 'giu'), 'pamiętać'],
  [new RegExp(`${L_START}milo${L_END}`, 'giu'), 'miło'],
  [new RegExp(`${L_START}kochanmym${L_END}`, 'giu'), 'kochanym'],
  [new RegExp(`${L_START}kochanyn${L_END}`, 'giu'), 'kochanym'],
  [new RegExp(`${L_START}druga osobe${L_END}`, 'giu'), 'drugą osobę'],
  [new RegExp(`${L_START}drugą osobe${L_END}`, 'giu'), 'drugą osobę'],
  [new RegExp(`${L_START}druga osobę${L_END}`, 'giu'), 'drugą osobę'],
  [new RegExp(`${L_START}osobe${L_END}`, 'giu'), 'osobę'],
  [new RegExp(`${L_START}znacza${L_END}`, 'giu'), 'znaczą'],
  [new RegExp(`${L_START}tez${L_END}`, 'giu'), 'też'],
  [new RegExp(`${L_START}powiniem${L_END}`, 'giu'), 'powinienem'],
  [new RegExp(`${L_START}powinnienem${L_END}`, 'giu'), 'powinienem'],
  [new RegExp(`${L_START}powinienm${L_END}`, 'giu'), 'powinienem'],
  [new RegExp(`${L_START}wstala${L_END}`, 'giu'), 'wstała'],
  [new RegExp(`${L_START}wstal${L_END}`, 'giu'), 'wstał'],
  [new RegExp(`${L_START}dala${L_END}`, 'giu'), 'dała'],
  [new RegExp(`${L_START}dal${L_END}`, 'giu'), 'dał'],
  [new RegExp(`${L_START}male${L_END}`, 'giu'), 'małe'],
  [new RegExp(`${L_START}maly${L_END}`, 'giu'), 'mały'],
  [new RegExp(`${L_START}mala${L_END}`, 'giu'), 'mała'],
  [new RegExp(`${L_START}czula${L_END}`, 'giu'), 'czuła'],
  [new RegExp(`${L_START}czul${L_END}`, 'giu'), 'czuł'],
  [new RegExp(`${L_START}dzie[eę]*kuj[eę]${L_END}`, 'giu'), 'dziękuję'],
  [new RegExp(`${L_START}dzie[eę]*kowac${L_END}`, 'giu'), 'dziękować'],
  [new RegExp(`${L_START}dzie[eę]*kujemy${L_END}`, 'giu'), 'dziękujemy'],
  [new RegExp(`${L_START}czerapc${L_END}`, 'giu'), 'czerpać'],
  [new RegExp(`${L_START}czerpac${L_END}`, 'giu'), 'czerpać'],
  [new RegExp(`${L_START}zaczerapc${L_END}`, 'giu'), 'zaczerpnąć'],
  [new RegExp(`${L_START}zaczerpac${L_END}`, 'giu'), 'zaczerpnąć'],
  [new RegExp(`${L_START}stronei${L_END}`, 'giu'), 'stronie'],
  [new RegExp(`${L_START}podpowedzi${L_END}`, 'giu'), 'podpowiedzi'],
  [new RegExp(`${L_START}marginiesie${L_END}`, 'giu'), 'marginesie'],
  [new RegExp(`${L_START}tytył${L_END}`, 'giu'), 'tytuł'],
  [new RegExp(`${L_START}tytyl${L_END}`, 'giu'), 'tytuł'],
  [new RegExp(`${L_START}tytul${L_END}`, 'giu'), 'tytuł'],
  [new RegExp(`${L_START}wygldacac${L_END}`, 'giu'), 'wyglądać'],
  [new RegExp(`${L_START}wygladac${L_END}`, 'giu'), 'wyglądać'],
  [new RegExp(`${L_START}wyglada${L_END}`, 'giu'), 'wygląda'],
  [new RegExp(`${L_START}zminiły${L_END}`, 'giu'), 'zmieniły'],
  [new RegExp(`${L_START}zminily${L_END}`, 'giu'), 'zmieniły'],
  [new RegExp(`${L_START}zmienily${L_END}`, 'giu'), 'zmieniły'],
  [new RegExp(`${L_START}syany${L_END}`, 'giu'), 'stany'],
  [new RegExp(`${L_START}samao${L_END}`, 'giu'), 'samo'],
  [new RegExp(`${L_START}literowkim${L_END}`, 'giu'), 'literówki'],
  [new RegExp(`${L_START}literowki${L_END}`, 'giu'), 'literówki'],
  [new RegExp(`${L_START}literowek${L_END}`, 'giu'), 'literówek'],
  [new RegExp(`${L_START}sprawdzic${L_END}`, 'giu'), 'sprawdzić'],
  [new RegExp(`${L_START}napisalem${L_END}`, 'giu'), 'napisałem'],
  [new RegExp(`${L_START}napisalam${L_END}`, 'giu'), 'napisałam'],
  [new RegExp(`${L_START}ukryc${L_END}`, 'giu'), 'ukryć'],
  [new RegExp(`${L_START}pokazac${L_END}`, 'giu'), 'pokazać'],
  [new RegExp(`${L_START}ikonka${L_END}`, 'giu'), 'ikonką'],
  [new RegExp(`${L_START}długo${L_END}`, 'giu'), 'długo'],
  [new RegExp(`${L_START}dlugo${L_END}`, 'giu'), 'długo'],
  [new RegExp(`${L_START}pojawiac${L_END}`, 'giu'), 'pojawiać'],
  [new RegExp(`${L_START}reagowac${L_END}`, 'giu'), 'reagować'],
  [new RegExp(`${L_START}czytac${L_END}`, 'giu'), 'czytać'],
  [new RegExp(`${L_START}uzyc${L_END}`, 'giu'), 'użyć'],
  [new RegExp(`${L_START}moga${L_END}`, 'giu'), 'mogą'],
  [new RegExp(`${L_START}maja${L_END}`, 'giu'), 'mają'],

  // Earlier user examples & conversational phrases
  [new RegExp(`${L_START}opis mi${L_END}`, 'giu'), 'opisz mi'],
  [new RegExp(`${L_START}miejscie${L_END}`, 'giu'), 'miejsce'],
  [new RegExp(`${L_START}wlasnie${L_END}`, 'giu'), 'właśnie'],
  [new RegExp(`${L_START}własnie${L_END}`, 'giu'), 'właśnie'],
  [new RegExp(`${L_START}sysci${L_END}`, 'giu'), 'czyści'],
  [new RegExp(`${L_START}czysci${L_END}`, 'giu'), 'czyści'],
  [new RegExp(`${L_START}czyscic${L_END}`, 'giu'), 'czyścić'],
  [new RegExp(`${L_START}głowe${L_END}`, 'giu'), 'głowę'],
  [new RegExp(`${L_START}glowe${L_END}`, 'giu'), 'głowę'],
  [new RegExp(`${L_START}glowa${L_END}`, 'giu'), 'głowa'],
  [new RegExp(`${L_START}glowy${L_END}`, 'giu'), 'głowy'],
  [new RegExp(`${L_START}glowie${L_END}`, 'giu'), 'głowie'],
  [new RegExp(`${L_START}czyta głowa${L_END}`, 'giu'), 'czysta głowa'],
  [new RegExp(`${L_START}czyta głowę${L_END}`, 'giu'), 'czysta głowę'],
  [new RegExp(`${L_START}czyta głowe${L_END}`, 'giu'), 'czysta głowę'],
  [new RegExp(`${L_START}kekstem${L_END}`, 'giu'), 'tekstem'],
  [new RegExp(`${L_START}tektu${L_END}`, 'giu'), 'tekstu'],
  [new RegExp(`${L_START}popimo${L_END}`, 'giu'), 'pomimo'],
  [new RegExp(`${L_START}zielonoge${L_END}`, 'giu'), 'zielonego'],
  [new RegExp(`${L_START}pokazuja${L_END}`, 'giu'), 'pokazują'],
  [new RegExp(`${L_START}odpowiadalem${L_END}`, 'giu'), 'odpowiadałem'],
  [new RegExp(`${L_START}posowni${L_END}`, 'giu'), 'pisowni'],
  [new RegExp(`${L_START}posownię${L_END}`, 'giu'), 'pisownię'],
  [new RegExp(`${L_START}posownie${L_END}`, 'giu'), 'pisownię'],
  [new RegExp(`${L_START}pisownie${L_END}`, 'giu'), 'pisownię'],
  [new RegExp(`${L_START}chyciał${L_END}`, 'giu'), 'chciał'],
  [new RegExp(`${L_START}chyciała${L_END}`, 'giu'), 'chciała'],
  [new RegExp(`${L_START}chyciałem${L_END}`, 'giu'), 'chciałem'],
  [new RegExp(`${L_START}chciałem${L_END}`, 'giu'), 'chciałem'],
  [new RegExp(`${L_START}chcialem${L_END}`, 'giu'), 'chciałem'],
  [new RegExp(`${L_START}chcialam${L_END}`, 'giu'), 'chciałam'],
  [new RegExp(`${L_START}chcialbym${L_END}`, 'giu'), 'chciałbym'],
  [new RegExp(`${L_START}chcialabym${L_END}`, 'giu'), 'chciałabym'],
  [new RegExp(`${L_START}mugł${L_END}`, 'giu'), 'mógł'],
  [new RegExp(`${L_START}mugl${L_END}`, 'giu'), 'mógł'],
  [new RegExp(`${L_START}mogl${L_END}`, 'giu'), 'mógł'],
  [new RegExp(`${L_START}mogla${L_END}`, 'giu'), 'mogła'],
  [new RegExp(`${L_START}moglbym${L_END}`, 'giu'), 'mógłbym'],
  [new RegExp(`${L_START}mugł by${L_END}`, 'giu'), 'mógłby'],
  [new RegExp(`${L_START}mogli by${L_END}`, 'giu'), 'mogliby'],
  [new RegExp(`${L_START}zbaczy${L_END}`, 'giu'), 'znaczy'],
  [new RegExp(`${L_START}zmeiniajac${L_END}`, 'giu'), 'zmieniając'],
  [new RegExp(`${L_START}zmeiniając${L_END}`, 'giu'), 'zmieniając'],
  [new RegExp(`${L_START}zmieniajac${L_END}`, 'giu'), 'zmieniając'],
  [new RegExp(`${L_START}u gury${L_END}`, 'giu'), 'u góry'],
  [new RegExp(`${L_START}ugury${L_END}`, 'giu'), 'u góry'],
  [new RegExp(`${L_START}u gory${L_END}`, 'giu'), 'u góry'],
  [new RegExp(`${L_START}zwierzaz${L_END}`, 'giu'), 'zwierząt'],
  [new RegExp(`${L_START}zwierzat${L_END}`, 'giu'), 'zwierząt'],
  [new RegExp(`${L_START}wysrodkuj${L_END}`, 'giu'), 'wyśrodkuj'],
  [new RegExp(`${L_START}wysrodkowany${L_END}`, 'giu'), 'wyśrodkowany'],
  [new RegExp(`${L_START}rosrzerzyc${L_END}`, 'giu'), 'rozszerzyć'],
  [new RegExp(`${L_START}roszerzyc${L_END}`, 'giu'), 'rozszerzyć'],
  [new RegExp(`${L_START}rozszerzyc${L_END}`, 'giu'), 'rozszerzyć'],
  [new RegExp(`${L_START}krecoce${L_END}`, 'giu'), 'kręcące'],
  [new RegExp(`${L_START}krecace${L_END}`, 'giu'), 'kręcące'],
  [new RegExp(`${L_START}katogorii${L_END}`, 'giu'), 'kategorii'],
  [new RegExp(`${L_START}katygorii${L_END}`, 'giu'), 'kategorii'],
  [new RegExp(`${L_START}wytko${L_END}`, 'giu'), 'wszystko'],
  [new RegExp(`${L_START}wsztko${L_END}`, 'giu'), 'wszystko'],
  [new RegExp(`${L_START}wszytkkie${L_END}`, 'giu'), 'wszystkie'],
  [new RegExp(`${L_START}wszytkie${L_END}`, 'giu'), 'wszystkie'],
  [new RegExp(`${L_START}wszytko${L_END}`, 'giu'), 'wszystko'],
  [new RegExp(`${L_START}zaaplokowac${L_END}`, 'giu'), 'zaaplikować'],
  [new RegExp(`${L_START}zaaplikowac${L_END}`, 'giu'), 'zaaplikować'],
  [new RegExp(`${L_START}przeprocesowac${L_END}`, 'giu'), 'przeprocesować'],
  [new RegExp(`${L_START}zasugerowac${L_END}`, 'giu'), 'zasugerować'],
  [new RegExp(`${L_START}przelaczylem${L_END}`, 'giu'), 'przełączyłem'],
  [new RegExp(`${L_START}przełączyłem${L_END}`, 'giu'), 'przełączyłem'],
  [new RegExp(`${L_START}wyzszy${L_END}`, 'giu'), 'wyższy'],
  [new RegExp(`${L_START}robilismy${L_END}`, 'giu'), 'robiliśmy'],
  [new RegExp(`${L_START}zrobic${L_END}`, 'giu'), 'zrobić'],
  [new RegExp(`${L_START}mozesz${L_END}`, 'giu'), 'możesz'],
  [new RegExp(`${L_START}poszczegulnych${L_END}`, 'giu'), 'poszczególnych'],
  [new RegExp(`${L_START}poszczegulne${L_END}`, 'giu'), 'poszczególne'],
  [new RegExp(`${L_START}zmini${L_END}`, 'giu'), 'zmieni'],
  [new RegExp(`${L_START}ciekawosci${L_END}`, 'giu'), 'ciekawości'],
  [new RegExp(`${L_START}ozwierciedla${L_END}`, 'giu'), 'odzwierciedla'],
  [new RegExp(`${L_START}pomiendzy${L_END}`, 'giu'), 'pomiędzy'],
  [new RegExp(`${L_START}pomiedzy${L_END}`, 'giu'), 'pomiędzy'],
  [new RegExp(`${L_START}probby${L_END}`, 'giu'), 'próby'],
  [new RegExp(`${L_START}proby${L_END}`, 'giu'), 'próby'],
  [new RegExp(`${L_START}pruby${L_END}`, 'giu'), 'próby'],
  [new RegExp(`${L_START}prub${L_END}`, 'giu'), 'prób'],

  // Classic Polish orthographic traps
  [new RegExp(`${L_START}napewno${L_END}`, 'giu'), 'na pewno'],
  [new RegExp(`${L_START}wogóle${L_END}`, 'giu'), 'w ogóle'],
  [new RegExp(`${L_START}wogole${L_END}`, 'giu'), 'w ogóle'],
  [new RegExp(`${L_START}w ogole${L_END}`, 'giu'), 'w ogóle'],
  [new RegExp(`${L_START}narazie${L_END}`, 'giu'), 'na razie'],
  [new RegExp(`${L_START}poprostu${L_END}`, 'giu'), 'po prostu'],
  [new RegExp(`${L_START}wziąść${L_END}`, 'giu'), 'wziąć'],
  [new RegExp(`${L_START}wziasc${L_END}`, 'giu'), 'wziąć'],
  [new RegExp(`${L_START}włanczać${L_END}`, 'giu'), 'włączać'],
  [new RegExp(`${L_START}wyłanczać${L_END}`, 'giu'), 'wyłączać'],
  [new RegExp(`${L_START}przełanczać${L_END}`, 'giu'), 'przełączać'],
  [new RegExp(`${L_START}załanczać${L_END}`, 'giu'), 'załączać'],
  [new RegExp(`${L_START}ktury${L_END}`, 'giu'), 'który'],
  [new RegExp(`${L_START}kturego${L_END}`, 'giu'), 'którego'],
  [new RegExp(`${L_START}kturej${L_END}`, 'giu'), 'której'],
  [new RegExp(`${L_START}kture${L_END}`, 'giu'), 'które'],
  [new RegExp(`${L_START}ktura${L_END}`, 'giu'), 'która'],
  [new RegExp(`${L_START}kturych${L_END}`, 'giu'), 'których'],
  [new RegExp(`${L_START}kturym${L_END}`, 'giu'), 'którym'],
  [new RegExp(`${L_START}ktory${L_END}`, 'giu'), 'który'],
  [new RegExp(`${L_START}ktorego${L_END}`, 'giu'), 'którego'],
  [new RegExp(`${L_START}ktorej${L_END}`, 'giu'), 'której'],
  [new RegExp(`${L_START}ktore${L_END}`, 'giu'), 'które'],
  [new RegExp(`${L_START}ktora${L_END}`, 'giu'), 'która'],
  [new RegExp(`${L_START}ktorzy${L_END}`, 'giu'), 'którzy'],
  [new RegExp(`${L_START}ktorych${L_END}`, 'giu'), 'których'],
  [new RegExp(`${L_START}ktorym${L_END}`, 'giu'), 'którym'],
  [new RegExp(`${L_START}juz${L_END}`, 'giu'), 'już'],
  [new RegExp(`${L_START}moze${L_END}`, 'giu'), 'może'],
  [new RegExp(`${L_START}moze byc${L_END}`, 'giu'), 'może być'],
  [new RegExp(`${L_START}naprawde${L_END}`, 'giu'), 'naprawdę'],
  [new RegExp(`${L_START}na codzień${L_END}`, 'giu'), 'na co dzień'],
  [new RegExp(`${L_START}nacodzień${L_END}`, 'giu'), 'na co dzień'],
  [new RegExp(`${L_START}na codzien${L_END}`, 'giu'), 'na co dzień'],
  [new RegExp(`${L_START}spowodu${L_END}`, 'giu'), 'z powodu'],
  [new RegExp(`${L_START}ztąd${L_END}`, 'giu'), 'stąd'],
  [new RegExp(`${L_START}z tąd${L_END}`, 'giu'), 'stąd'],
  [new RegExp(`${L_START}stad${L_END}`, 'giu'), 'stąd'],
  [new RegExp(`${L_START}zkąd${L_END}`, 'giu'), 'skąd'],
  [new RegExp(`${L_START}z kąd${L_END}`, 'giu'), 'skąd'],
  [new RegExp(`${L_START}skad${L_END}`, 'giu'), 'skąd'],
  [new RegExp(`${L_START}spowrotem${L_END}`, 'giu'), 'z powrotem'],
  [new RegExp(`${L_START}przedewszystkim${L_END}`, 'giu'), 'przede wszystkim'],
  [new RegExp(`${L_START}ponad to${L_END}`, 'giu'), 'ponadto'],
  [new RegExp(`${L_START}odrazu${L_END}`, 'giu'), 'od razu'],
  [new RegExp(`${L_START}wkońcu${L_END}`, 'giu'), 'w końcu'],
  [new RegExp(`${L_START}w koncu${L_END}`, 'giu'), 'w końcu'],
  [new RegExp(`${L_START}niewiem${L_END}`, 'giu'), 'nie wiem'],
  [new RegExp(`${L_START}niepotrzebuje${L_END}`, 'giu'), 'nie potrzebuję'],
  [new RegExp(`${L_START}niemoge${L_END}`, 'giu'), 'nie mogę'],
  [new RegExp(`${L_START}nie moge${L_END}`, 'giu'), 'nie mogę'],
  [new RegExp(`${L_START}niemam${L_END}`, 'giu'), 'nie mam'],
  [new RegExp(`${L_START}niechce${L_END}`, 'giu'), 'nie chcę'],
  [new RegExp(`${L_START}nie chce${L_END}`, 'giu'), 'nie chcę'],

  // High-frequency missing Polish diacritics, partial diacritics & metathesis
  [new RegExp(`${L_START}sie${L_END}`, 'giu'), 'się'],
  [new RegExp(`${L_START}zeby${L_END}`, 'giu'), 'żeby'],
  [new RegExp(`${L_START}zbey${L_END}`, 'giu'), 'żeby'],
  [new RegExp(`${L_START}żbey${L_END}`, 'giu'), 'żeby'],
  [new RegExp(`${L_START}zby${L_END}`, 'giu'), 'żeby'],
  [new RegExp(`${L_START}zebym${L_END}`, 'giu'), 'żebym'],
  [new RegExp(`${L_START}zebys${L_END}`, 'giu'), 'żebyś'],
  [new RegExp(`${L_START}chodzic${L_END}`, 'giu'), 'chodzić'],
  [new RegExp(`${L_START}chodze${L_END}`, 'giu'), 'chodzę'],
  [new RegExp(`${L_START}wychodze${L_END}`, 'giu'), 'wychodzę'],
  [new RegExp(`${L_START}przychodze${L_END}`, 'giu'), 'przychodzę'],
  [new RegExp(`${L_START}wchodze${L_END}`, 'giu'), 'wchodzę'],
  [new RegExp(`${L_START}robic${L_END}`, 'giu'), 'robić'],
  [new RegExp(`${L_START}robie${L_END}`, 'giu'), 'robię'],
  [new RegExp(`${L_START}pisac${L_END}`, 'giu'), 'pisać'],
  [new RegExp(`${L_START}pisze${L_END}`, 'giu'), 'piszę'],
  [new RegExp(`${L_START}myslec${L_END}`, 'giu'), 'myśleć'],
  [new RegExp(`${L_START}myśleć${L_END}`, 'giu'), 'myśleć'],
  [new RegExp(`${L_START}myślec${L_END}`, 'giu'), 'myśleć'],
  [new RegExp(`${L_START}myslęc${L_END}`, 'giu'), 'myśleć'],
  [new RegExp(`${L_START}mysle${L_END}`, 'giu'), 'myślę'],
  [new RegExp(`${L_START}myśle${L_END}`, 'giu'), 'myślę'],
  [new RegExp(`${L_START}myslę${L_END}`, 'giu'), 'myślę'],
  [new RegExp(`${L_START}musle${L_END}`, 'giu'), 'myślę'],
  [new RegExp(`${L_START}muśle${L_END}`, 'giu'), 'myślę'],
  [new RegExp(`${L_START}muslę${L_END}`, 'giu'), 'myślę'],
  [new RegExp(`${L_START}mysli${L_END}`, 'giu'), 'myśli'],
  [new RegExp(`${L_START}biore${L_END}`, 'giu'), 'biorę'],
  [new RegExp(`${L_START}zabieram${L_END}`, 'giu'), 'zabieram'],
  [new RegExp(`${L_START}wezme${L_END}`, 'giu'), 'wezmę'],
  [new RegExp(`${L_START}bral${L_END}`, 'giu'), 'brał'],
  [new RegExp(`${L_START}brala${L_END}`, 'giu'), 'brała'],
  [new RegExp(`${L_START}bralem${L_END}`, 'giu'), 'brałem'],
  [new RegExp(`${L_START}bralam${L_END}`, 'giu'), 'brałam'],
  [new RegExp(`${L_START}brac${L_END}`, 'giu'), 'brać'],
  [new RegExp(`${L_START}poszłuchać${L_END}`, 'giu'), 'posłuchać'],
  [new RegExp(`${L_START}poszluchac${L_END}`, 'giu'), 'posłuchać'],
  [new RegExp(`${L_START}poszłuchac${L_END}`, 'giu'), 'posłuchać'],
  [new RegExp(`${L_START}posluchac${L_END}`, 'giu'), 'posłuchać'],
  [new RegExp(`${L_START}posłuchac${L_END}`, 'giu'), 'posłuchać'],
  [new RegExp(`${L_START}posluchać${L_END}`, 'giu'), 'posłuchać'],
  [new RegExp(`${L_START}sluchac${L_END}`, 'giu'), 'słuchać'],
  [new RegExp(`${L_START}słuchac${L_END}`, 'giu'), 'słuchać'],
  [new RegExp(`${L_START}sluchać${L_END}`, 'giu'), 'słuchać'],
  [new RegExp(`${L_START}slucham${L_END}`, 'giu'), 'słucham'],
  [new RegExp(`${L_START}sluchalem${L_END}`, 'giu'), 'słuchałem'],
  [new RegExp(`${L_START}sluchalam${L_END}`, 'giu'), 'słuchałam'],
  [new RegExp(`${L_START}sluchawki${L_END}`, 'giu'), 'słuchawki'],
  [new RegExp(`${L_START}sluchawek${L_END}`, 'giu'), 'słuchawek'],
  [new RegExp(`${L_START}sluchawkach${L_END}`, 'giu'), 'słuchawkach'],
  [new RegExp(`${L_START}sluchawkami${L_END}`, 'giu'), 'słuchawkami'],
  [new RegExp(`${L_START}duzo${L_END}`, 'giu'), 'dużo'],
  [new RegExp(`${L_START}malo${L_END}`, 'giu'), 'mało'],
  [new RegExp(`${L_START}troche${L_END}`, 'giu'), 'trochę'],
  [new RegExp(`${L_START}troszke${L_END}`, 'giu'), 'troszkę'],
  [new RegExp(`${L_START}widziec${L_END}`, 'giu'), 'widzieć'],
  [new RegExp(`${L_START}widze${L_END}`, 'giu'), 'widzę'],
  [new RegExp(`${L_START}slyszec${L_END}`, 'giu'), 'słyszeć'],
  [new RegExp(`${L_START}słyszec${L_END}`, 'giu'), 'słyszeć'],
  [new RegExp(`${L_START}slysze${L_END}`, 'giu'), 'słyszę'],
  [new RegExp(`${L_START}słysze${L_END}`, 'giu'), 'słyszę'],
  [new RegExp(`${L_START}czuc${L_END}`, 'giu'), 'czuć'],
  [new RegExp(`${L_START}czuje${L_END}`, 'giu'), 'czuję'],
  [new RegExp(`${L_START}byc${L_END}`, 'giu'), 'być'],
  [new RegExp(`${L_START}miec${L_END}`, 'giu'), 'mieć'],
  [new RegExp(`${L_START}wrocic${L_END}`, 'giu'), 'wrócić'],
  [new RegExp(`${L_START}wrócic${L_END}`, 'giu'), 'wrócić'],
  [new RegExp(`${L_START}wroce${L_END}`, 'giu'), 'wrócę'],
  [new RegExp(`${L_START}wróce${L_END}`, 'giu'), 'wrócę'],
  [new RegExp(`${L_START}bede${L_END}`, 'giu'), 'będę'],
  [new RegExp(`${L_START}będe${L_END}`, 'giu'), 'będę'],
  [new RegExp(`${L_START}bedę${L_END}`, 'giu'), 'będę'],
  [new RegExp(`${L_START}bedzie${L_END}`, 'giu'), 'będzie'],
  [new RegExp(`${L_START}beda${L_END}`, 'giu'), 'będą'],
  [new RegExp(`${L_START}bedziemy${L_END}`, 'giu'), 'będziemy'],
  [new RegExp(`${L_START}moge${L_END}`, 'giu'), 'mogę'],
  [new RegExp(`${L_START}chce${L_END}`, 'giu'), 'chcę'],
  [new RegExp(`${L_START}musze${L_END}`, 'giu'), 'muszę'],
  [new RegExp(`${L_START}lubie${L_END}`, 'giu'), 'lubię'],
  [new RegExp(`${L_START}potrzebuje${L_END}`, 'giu'), 'potrzebuję'],
  [new RegExp(`${L_START}pracuje${L_END}`, 'giu'), 'pracuję'],
  [new RegExp(`${L_START}dziekuje${L_END}`, 'giu'), 'dziękuję'],
  [new RegExp(`${L_START}dziękuje${L_END}`, 'giu'), 'dziękuję'],
  [new RegExp(`${L_START}prosze${L_END}`, 'giu'), 'proszę'],
  [new RegExp(`${L_START}boje sie${L_END}`, 'giu'), 'boję się'],
  [new RegExp(`${L_START}boje się${L_END}`, 'giu'), 'boję się'],
  [new RegExp(`${L_START}ciesze sie${L_END}`, 'giu'), 'cieszę się'],
  [new RegExp(`${L_START}ciesze się${L_END}`, 'giu'), 'cieszę się'],
  [new RegExp(`${L_START}martwie sie${L_END}`, 'giu'), 'martwię się'],
  [new RegExp(`${L_START}martwie się${L_END}`, 'giu'), 'martwię się'],
  [new RegExp(`${L_START}ucze sie${L_END}`, 'giu'), 'uczę się'],
  [new RegExp(`${L_START}ucze się${L_END}`, 'giu'), 'uczę się'],
  [new RegExp(`${L_START}siedze${L_END}`, 'giu'), 'siedzę'],
  [new RegExp(`${L_START}leze${L_END}`, 'giu'), 'leżę'],
  [new RegExp(`${L_START}leże${L_END}`, 'giu'), 'leżę'],
  [new RegExp(`${L_START}stoje${L_END}`, 'giu'), 'stoję'],
  [new RegExp(`${L_START}mowie${L_END}`, 'giu'), 'mówię'],
  [new RegExp(`${L_START}mówie${L_END}`, 'giu'), 'mówię'],
  [new RegExp(`${L_START}patrze${L_END}`, 'giu'), 'patrzę'],
  [new RegExp(`${L_START}zaczne${L_END}`, 'giu'), 'zacznę'],
  [new RegExp(`${L_START}skoncze${L_END}`, 'giu'), 'skończę'],
  [new RegExp(`${L_START}skończe${L_END}`, 'giu'), 'skończę'],
  [new RegExp(`${L_START}pojde${L_END}`, 'giu'), 'pójdę'],
  [new RegExp(`${L_START}pójde${L_END}`, 'giu'), 'pójdę'],
  [new RegExp(`${L_START}pojdziemy${L_END}`, 'giu'), 'pójdziemy'],
  [new RegExp(`${L_START}pojsc${L_END}`, 'giu'), 'pójść'],
  [new RegExp(`${L_START}pójsc${L_END}`, 'giu'), 'pójść'],
  [new RegExp(`${L_START}isc${L_END}`, 'giu'), 'iść'],
  [new RegExp(`${L_START}ide${L_END}`, 'giu'), 'idę'],
  [new RegExp(`${L_START}szedlem${L_END}`, 'giu'), 'szedłem'],
  [new RegExp(`${L_START}szlam${L_END}`, 'giu'), 'szłam'],
  [new RegExp(`${L_START}zauwazylem${L_END}`, 'giu'), 'zauważyłem'],
  [new RegExp(`${L_START}zauwazylam${L_END}`, 'giu'), 'zauważyłam'],
  [new RegExp(`${L_START}poszedlem${L_END}`, 'giu'), 'poszedłem'],
  [new RegExp(`${L_START}poszlam${L_END}`, 'giu'), 'poszłam'],
  [new RegExp(`${L_START}zrobilem${L_END}`, 'giu'), 'zrobiłem'],
  [new RegExp(`${L_START}zrobilam${L_END}`, 'giu'), 'zrobiłam'],
  [new RegExp(`${L_START}pomyslalem${L_END}`, 'giu'), 'pomyślałem'],
  [new RegExp(`${L_START}pomyslalam${L_END}`, 'giu'), 'pomyślałam'],
  [new RegExp(`${L_START}dzis${L_END}`, 'giu'), 'dziś'],
  [new RegExp(`${L_START}dzisiaj${L_END}`, 'giu'), 'dzisiaj'],
  [new RegExp(`${L_START}wiecej${L_END}`, 'giu'), 'więcej'],
  [new RegExp(`${L_START}czesciej${L_END}`, 'giu'), 'częściej'],
  [new RegExp(`${L_START}pozniej${L_END}`, 'giu'), 'później'],
  [new RegExp(`${L_START}wczesniej${L_END}`, 'giu'), 'wcześniej'],
  [new RegExp(`${L_START}najbardziej${L_END}`, 'giu'), 'najbardziej'],
  [new RegExp(`${L_START}swiat${L_END}`, 'giu'), 'świat'],
  [new RegExp(`${L_START}swiecie${L_END}`, 'giu'), 'świecie'],
  [new RegExp(`${L_START}zycie${L_END}`, 'giu'), 'życie'],
  [new RegExp(`${L_START}zyciu${L_END}`, 'giu'), 'życiu'],
  [new RegExp(`${L_START}zycia${L_END}`, 'giu'), 'życia'],
  [new RegExp(`${L_START}dzien${L_END}`, 'giu'), 'dzień'],
  [new RegExp(`${L_START}spokoj${L_END}`, 'giu'), 'spokój'],
  [new RegExp(`${L_START}radosc${L_END}`, 'giu'), 'radość'],
  [new RegExp(`${L_START}przyjemnosc${L_END}`, 'giu'), 'przyjemność'],
  [new RegExp(`${L_START}wdziecznosc${L_END}`, 'giu'), 'wdzięczność'],
  [new RegExp(`${L_START}ulatwia${L_END}`, 'giu'), 'ułatwia'],
  [new RegExp(`${L_START}cos${L_END}`, 'giu'), 'coś'],
  [new RegExp(`${L_START}ktos${L_END}`, 'giu'), 'ktoś'],
  [new RegExp(`${L_START}jakis${L_END}`, 'giu'), 'jakiś'],
  [new RegExp(`${L_START}jakas${L_END}`, 'giu'), 'jakaś'],
  [new RegExp(`${L_START}jakies${L_END}`, 'giu'), 'jakieś'],
  [new RegExp(`${L_START}gdzies${L_END}`, 'giu'), 'gdzieś'],
  [new RegExp(`${L_START}kiedys${L_END}`, 'giu'), 'kiedyś'],
  [new RegExp(`${L_START}bardziej${L_END}`, 'giu'), 'bardziej'],
  [new RegExp(`${L_START}ciągle${L_END}`, 'giu'), 'ciągle'],
  [new RegExp(`${L_START}ciagle${L_END}`, 'giu'), 'ciągle'],
  [new RegExp(`${L_START}wlasciwie${L_END}`, 'giu'), 'właściwie'],
  [new RegExp(`${L_START}dokladnie${L_END}`, 'giu'), 'dokładnie'],
];

// Match words with accidental tripled letters (e.g. "pytanieee" -> "pytanie")
function fixAccidentalRepeats(text: string): string {
  return text.replace(/([a-zA-ZąćęłńóśźżĄĆĘŁŃÓŚŹŻ])\1{2,}/gu, '$1');
}

// Fix punctuation spacing: removes space before comma/period, adds space after
function fixPunctuationSpacing(text: string): string {
  return text
    .replace(/ +([,\.!\?:;])/g, '$1')
    .replace(/([,\.!\?:;])([a-zA-ZąćęłńóśźżĄĆĘŁŃÓŚŹŻ])/gu, '$1 $2')
    .replace(/ {2,}/g, ' ');
}

// Fix Polish vocalized prepositions ("z słuchawek" -> "ze słuchawek", "z sobą" -> "ze sobą")
// and missing diacritic on conjunction "ze" -> "że" after commas or cognitive verbs
function fixPolishPrepositionsAndConjunctions(text: string): string {
  return text
    // "z słuchawek", "z sobą", "z mną", "z strachu", "z szkoły", "z względu", "z świata", "z środka", "z snu", "z szczęścia", "z złości", "z smutku", "z wszystkim"
    .replace(
      new RegExp(
        `${L_START}(z)\\s+(słuchawk[a-zA-Ząćęłńóśźż]*|słuchawek|sobą|soba|mną|mna|strachu|szkoły|szkoly|względu|wzgledu|świata|swiata|środka|srodka|snu|szczęścia|szczescia|złości|zlosci|smutku|wszystk[a-zA-Ząćęłńóśźż]*)${L_END}`,
        'giu'
      ),
      (_, z, word) => `${z === 'Z' ? 'Ze' : 'ze'} ${word}`
    )
    // Conjunction "ze" -> "że" after comma or common clause-introducing words
    .replace(
      /(,\s*)ze(?=\s+[a-zA-ZąćęłńóśźżĄĆĘŁŃÓŚŹŻ])/gu,
      '$1że'
    )
    .replace(
      /\b(myślę|wiem|czuję|widzę|sądzę|wierzę|chcę|mam wrażenie|problem w tym|dlatego|tylko|chyba|pewnie|może)\s+ze\b/giu,
      '$1, że'
    );
}

// Ensure comma before subordinating Polish conjunctions if missing
function fixSubordinatingCommas(text: string): string {
  return text
    .replace(
      /([a-zA-ZąćęłńóśźżĄĆĘŁŃÓŚŹŻ])\s+(że|żeby|ponieważ|który|która|które|którzy|których|gdyż|chociaż|jeśli|jeżeli|dlatego)\b/giu,
      '$1, $2'
    )
    .replace(/,\s*,\s*/g, ', ');
}

// Preserve capitalization of the first letter
function matchCase(original: string, replacement: string): string {
  if (!original || !replacement) return replacement;
  if (original[0] === original[0].toUpperCase() && original[0] !== original[0].toLowerCase()) {
    return replacement.charAt(0).toUpperCase() + replacement.slice(1);
  }
  return replacement;
}

const ENGLISH_TYPO_RULES: [RegExp, string][] = [
  [/\bteh\b/gi, 'the'],
  [/\badn\b/gi, 'and'],
  [/\btaht\b/gi, 'that'],
  [/\bwiht\b/gi, 'with'],
  [/\bthier\b/gi, 'their'],
  [/\brecieve\b/gi, 'receive'],
  [/\brecieved\b/gi, 'received'],
  [/\bbelive\b/gi, 'believe'],
  [/\bdefinately\b/gi, 'definitely'],
  [/\bseperate\b/gi, 'separate'],
  [/\boccured\b/gi, 'occurred'],
  [/\buntill\b/gi, 'until'],
  [/\btommorow\b/gi, 'tomorrow'],
  [/\btomorow\b/gi, 'tomorrow'],
  [/\byestarday\b/gi, 'yesterday'],
  [/\bbeacuse\b/gi, 'because'],
  [/\bbecouse\b/gi, 'because'],
  [/\bawsome\b/gi, 'awesome'],
  [/\bwierd\b/gi, 'weird'],
  [/\bfreind\b/gi, 'friend'],
  [/\bfreinds\b/gi, 'friends'],
  [/\bgratefull\b/gi, 'grateful'],
  [/\bthougth\b/gi, 'thought'],
  [/\bthrought\b/gi, 'thought'],
  [/\bremeber\b/gi, 'remember'],
  [/\brember\b/gi, 'remember'],
  [/\bmomment\b/gi, 'moment'],
  [/\bmorining\b/gi, 'morning'],
  [/\balot\b/gi, 'a lot'],
  [/\bdont\b/gi, "don't"],
  [/\bdoesnt\b/gi, "doesn't"],
  [/\bdidnt\b/gi, "didn't"],
  [/\bcant\b/gi, "can't"],
  [/\bwont\b/gi, "won't"],
  [/\bisnt\b/gi, "isn't"],
  [/\barent\b/gi, "aren't"],
  [/\bwasnt\b/gi, "wasn't"],
  [/\bwerent\b/gi, "weren't"],
  [/\bhavent\b/gi, "haven't"],
  [/\bhasnt\b/gi, "hasn't"],
  [/\bhadnt\b/gi, "hadn't"],
  [/\bwouldnt\b/gi, "wouldn't"],
  [/\bcouldnt\b/gi, "couldn't"],
  [/\bshouldnt\b/gi, "shouldn't"],
  [/\bim\b/gi, "I'm"],
  [/\bive\b/gi, "I've"],
  [/\bid\b/g, "I'd"],
  [/\bi\b/g, 'I'],
];

/**
 * Synchronous local English typo & contraction fixer
 */
export function autoFixEnglishText(text: string): AutoCorrectionResult {
  if (!text) {
    return { correctedText: text, changesCount: 0, changes: [] };
  }

  let result = text;
  const changes: CorrectionChange[] = [];

  const withoutRepeats = fixAccidentalRepeats(result);
  if (withoutRepeats !== result) {
    result = withoutRepeats;
  }

  ENGLISH_TYPO_RULES.forEach(([pattern, replacement]) => {
    result = result.replace(pattern, (match, offset) => {
      const cased =
        replacement.startsWith("I'") || replacement === 'I'
          ? replacement
          : matchCase(match, replacement);
      if (match !== cased) {
        changes.push({
          original: match,
          replacement: cased,
          index: offset,
        });
      }
      return cased;
    });
  });

  const formattedPunctuation = fixPunctuationSpacing(result);
  if (formattedPunctuation !== result) {
    result = formattedPunctuation;
  }

  const wordDiffCount = countWordDifferences(text, result);
  const finalCount = Math.max(changes.length, wordDiffCount, result !== text ? 1 : 0);

  return {
    correctedText: result,
    changesCount: result === text ? 0 : finalCount,
    changes,
  };
}

const SPANISH_TYPO_RULES: [RegExp, string][] = [
  [/\bhabia\b/giu, 'había'],
  [/\btenia\b/giu, 'tenía'],
  [/\bquería\b/giu, 'quería'],
  [/\bqueria\b/giu, 'quería'],
  [/\btambien\b/giu, 'también'],
  [/\bdespues\b/giu, 'después'],
  [/\bademas\b/giu, 'además'],
  [/\bmas\b(?=\s+(?:tarde|temprano|tranquilo|calma|tiempo|fácil|difícil|importante|allá))/giu, 'más'],
  [/\bdia\b/giu, 'día'],
  [/\bdias\b/giu, 'días'],
  [/\basi\b/giu, 'así'],
  [/\baqui\b/giu, 'aquí'],
  [/\balli\b/giu, 'allí'],
  [/\bcorazon\b/giu, 'corazón'],
  [/\brazon\b/giu, 'razón'],
  [/\bcafe\b/giu, 'café'],
  [/\bmanana\b/giu, 'mañana'],
  [/\banos\b/giu, 'años'],
  [/\bano\b/giu, 'año'],
  [/\bsenti\b/giu, 'sentí'],
  [/\bpense\b/giu, 'pensé'],
  [/\bhable\b/giu, 'hablé'],
];

export function autoFixSpanishText(text: string): AutoCorrectionResult {
  if (!text) {
    return { correctedText: text, changesCount: 0, changes: [] };
  }

  let result = text;
  const changes: CorrectionChange[] = [];

  const withoutRepeats = fixAccidentalRepeats(result);
  if (withoutRepeats !== result) {
    result = withoutRepeats;
  }

  SPANISH_TYPO_RULES.forEach(([pattern, replacement]) => {
    result = result.replace(pattern, (match, offset) => {
      const cased = matchCase(match, replacement);
      if (match !== cased) {
        changes.push({
          original: match,
          replacement: cased,
          index: offset,
        });
      }
      return cased;
    });
  });

  const formattedPunctuation = fixPunctuationSpacing(result);
  if (formattedPunctuation !== result) {
    result = formattedPunctuation;
  }

  const wordDiffCount = countWordDifferences(text, result);
  const finalCount = Math.max(changes.length, wordDiffCount, result !== text ? 1 : 0);

  return {
    correctedText: result,
    changesCount: result === text ? 0 : finalCount,
    changes,
  };
}

const FRENCH_TYPO_RULES: [RegExp, string][] = [
  [/\betait\b/giu, 'était'],
  [/\betaient\b/giu, 'étaient'],
  [/\bmeme\b/giu, 'même'],
  [/\btres\b/giu, 'très'],
  [/\bapres\b/giu, 'après'],
  [/\bdeja\b/giu, 'déjà'],
  [/\bpeut etre\b/giu, 'peut-être'],
  [/\bpeut-etre\b/giu, 'peut-être'],
  [/\baujourdhui\b/giu, "aujourd'hui"],
  [/\bcafe\b/giu, 'café'],
  [/\bthe\b/giu, 'thé'],
  [/\bmatinee\b/giu, 'matinée'],
  [/\bsoiree\b/giu, 'soirée'],
  [/\bjournee\b/giu, 'journée'],
  [/\bpensee\b/giu, 'pensée'],
  [/\bpensees\b/giu, 'pensées'],
  [/\bpremiere\b/giu, 'première'],
  [/\bderniere\b/giu, 'dernière'],
  [/\blumiere\b/giu, 'lumière'],
  [/\bprefere\b/giu, 'préfère'],
  [/\bparceque\b/giu, 'parce que'],
];

export function autoFixFrenchText(text: string): AutoCorrectionResult {
  if (!text) {
    return { correctedText: text, changesCount: 0, changes: [] };
  }

  let result = text;
  const changes: CorrectionChange[] = [];

  const withoutRepeats = fixAccidentalRepeats(result);
  if (withoutRepeats !== result) {
    result = withoutRepeats;
  }

  FRENCH_TYPO_RULES.forEach(([pattern, replacement]) => {
    result = result.replace(pattern, (match, offset) => {
      const cased = matchCase(match, replacement);
      if (match !== cased) {
        changes.push({
          original: match,
          replacement: cased,
          index: offset,
        });
      }
      return cased;
    });
  });

  const formattedPunctuation = fixPunctuationSpacing(result);
  if (formattedPunctuation !== result) {
    result = formattedPunctuation;
  }

  const wordDiffCount = countWordDifferences(text, result);
  const finalCount = Math.max(changes.length, wordDiffCount, result !== text ? 1 : 0);

  return {
    correctedText: result,
    changesCount: result === text ? 0 : finalCount,
    changes,
  };
}

/**
 * Synchronous local Polish/English/Spanish/French typo fixer
 */
export function autoFixPolishText(
  text: string,
  lang: 'pl' | 'en' | 'es' | 'fr' = 'pl'
): AutoCorrectionResult {
  if (lang === 'en') {
    return autoFixEnglishText(text);
  }
  if (lang === 'es') {
    return autoFixSpanishText(text);
  }
  if (lang === 'fr') {
    return autoFixFrenchText(text);
  }
  if (!text) {
    return { correctedText: text, changesCount: 0, changes: [] };
  }

  let result = text;
  const changes: CorrectionChange[] = [];

  // 1. Fix accidental repeated letters
  const withoutRepeats = fixAccidentalRepeats(result);
  if (withoutRepeats !== result) {
    result = withoutRepeats;
  }

  // 2. Fix known typos, diacritics, and metathesis
  POLISH_TYPO_RULES.forEach(([pattern, replacement]) => {
    result = result.replace(pattern, (match, offset) => {
      const cased = matchCase(match, replacement);
      if (match !== cased) {
        changes.push({
          original: match,
          replacement: cased,
          index: offset,
        });
      }
      return cased;
    });
  });

  // 2.5 Fix Polish vocalized prepositions ("z słuchawek" -> "ze słuchawek") and conjunction "ze" -> "że"
  const withPrepositions = fixPolishPrepositionsAndConjunctions(result);
  if (withPrepositions !== result) {
    result = withPrepositions;
  }

  // 3. Fix comma before conjunctions
  const withCommas = fixSubordinatingCommas(result);
  if (withCommas !== result) {
    result = withCommas;
  }

  // 4. Fix punctuation spacing
  const formattedPunctuation = fixPunctuationSpacing(result);
  if (formattedPunctuation !== result) {
    result = formattedPunctuation;
  }

  const wordDiffCount = countWordDifferences(text, result);
  const finalCount = Math.max(changes.length, wordDiffCount, result !== text ? 1 : 0);

  return {
    correctedText: result,
    changesCount: result === text ? 0 : finalCount,
    changes,
  };
}

const clientSpellCache = new Map<string, string>();
const MAX_CLIENT_SPELL_CACHE = 40;

/**
 * Async spell fixer that uses server-side Gemini correction with an 8-second timeout,
 * client-side LRU cache, plus local orthography rules (Polish, English, Spanish, or French).
 */
export async function fixSpellingFull(
  text: string,
  lang: 'pl' | 'en' | 'es' | 'fr' = 'pl'
): Promise<AutoCorrectionResult> {
  if (!text.trim()) {
    return { correctedText: text, changesCount: 0, changes: [] };
  }

  // Pre-clean known local patterns first
  const localResult = autoFixPolishText(text, lang);
  const cacheKey = `${lang}::${localResult.correctedText.trim()}`;
  const cachedRefined = clientSpellCache.get(cacheKey);
  if (cachedRefined !== undefined) {
    const diffCount = countWordDifferences(text, cachedRefined);
    return {
      correctedText: cachedRefined,
      changesCount: cachedRefined === text ? 0 : Math.max(1, diffCount, localResult.changesCount),
      changes: localResult.changes,
    };
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);

    const response = await fetch('/api/fix-spelling', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: localResult.correctedText, lang }),
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (response.ok) {
      const data = await response.json();
      if (data && typeof data.correctedText === 'string' && data.correctedText.trim().length > 0) {
        const serverLocal = autoFixPolishText(data.correctedText.trim(), lang);
        const refined = serverLocal.correctedText;
        if (clientSpellCache.size >= MAX_CLIENT_SPELL_CACHE) {
          const oldest = clientSpellCache.keys().next().value;
          if (oldest !== undefined) clientSpellCache.delete(oldest);
        }
        clientSpellCache.set(cacheKey, refined);
        const diffCount = countWordDifferences(text, refined);
        return {
          correctedText: refined,
          changesCount: refined === text ? 0 : Math.max(1, diffCount, localResult.changesCount),
          changes: localResult.changes,
        };
      }
    }
  } catch {
    // Smooth fallback to localResult if network or timeout occurs
  }

  return localResult;
}

function countWordDifferences(original: string, modified: string): number {
  if (original === modified) return 0;
  const origWords = original.trim().split(/\s+/);
  const modWords = modified.trim().split(/\s+/);
  let diff = 0;
  const maxLen = Math.max(origWords.length, modWords.length);
  for (let i = 0; i < maxLen; i++) {
    if (origWords[i] !== modWords[i]) {
      diff++;
    }
  }
  return diff;
}

export interface SpellCheckResult {
  suggestions: { id: string; original: string; replacement: string; explanation: string; index: number }[];
  correctedText: string;
}

export function checkPolishSpelling(text: string): SpellCheckResult {
  const fix = autoFixPolishText(text);
  return {
    correctedText: fix.correctedText,
    suggestions: fix.changes.map((c, i) => ({
      id: `c-${i}-${c.index}`,
      original: c.original,
      replacement: c.replacement,
      explanation: `Poprawa pisowni: ${c.replacement}`,
      index: c.index,
    })),
  };
}

export function generateExpansionQuestions(text: string, _promptText: string): string[] {
  return text ? [text] : [];
}
