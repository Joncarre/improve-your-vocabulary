/*
 * The British (RP) sounds the app shows, explained for a Spanish speaker from Spain. The symbol set
 * is the one the AI is asked for (Oxford Learner's / Cambridge UK conventions: /e/ for DRESS, /əʊ/
 * for GOAT, /ɒ/ for LOT, non-rhotic). Example words are common and short on purpose.
 */

export type SoundGroup = 'shortVowel' | 'longVowel' | 'diphthong' | 'familiar' | 'careful'

export interface SoundExample {
  word: string
  /** Between slashes, as everywhere else in the app. */
  ipa: string
}

export interface Sound {
  symbol: string
  group: SoundGroup
  /** What it sounds like in Spanish, in a few words (used in the breakdown of a word). */
  hint: string
  /** How to make it, for the guide. */
  tip: string
  examples: readonly SoundExample[]
}

export const GROUP_INFO: Record<SoundGroup, { title: string; intro: string }> = {
  shortVowel: {
    title: 'Vocales cortas',
    intro: 'Breves y relajadas. En español todas las vocales son claras y tensas; aquí no las alargues ni las abras de más.',
  },
  longVowel: {
    title: 'Vocales largas',
    intro: 'Llevan «ː» y duran más o menos el doble que una corta. No es un detalle: cambia la palabra (ship ≠ sheep).',
  },
  diphthong: {
    title: 'Diptongos',
    intro: 'Dos vocales en una sola sílaba: empiezas en la primera y te deslizas hacia la segunda, que es más suave.',
  },
  familiar: {
    title: 'Consonantes que ya conoces',
    intro: 'Suenan casi como en español. /θ/ y /ð/ también los tienes, aunque en español se escriban con otras letras.',
  },
  careful: {
    title: 'Consonantes con trampa',
    intro: 'Algunas se escriben como en español pero suenan distinto, y otras no existen en español. Estas son las que más practicar.',
  },
}

export const SOUNDS: readonly Sound[] = [
  /* Vocales cortas */
  {
    symbol: 'ɪ',
    group: 'shortVowel',
    hint: '«i» corta y relajada',
    tip: 'Entre la «i» y la «e» españolas: más breve y floja que una «i». No sonrías ni tenses los labios.',
    examples: [
      { word: 'sit', ipa: '/sɪt/' },
      { word: 'big', ipa: '/bɪɡ/' },
      { word: 'ship', ipa: '/ʃɪp/' },
    ],
  },
  {
    symbol: 'e',
    group: 'shortVowel',
    hint: 'como la «e» de «peso»',
    tip: 'Como tu «e» de «peso», quizá un poco más abierta. Siempre corta: no la alargues.',
    examples: [
      { word: 'bed', ipa: '/bed/' },
      { word: 'ten', ipa: '/ten/' },
      { word: 'said', ipa: '/sed/' },
    ],
  },
  {
    symbol: 'æ',
    group: 'shortVowel',
    hint: 'entre «a» y «e», boca abierta',
    tip: 'No existe en español. Abre la boca como para decir «a» pero di «e»: un sonido intermedio, más abierto que tu «e» y más cerrado que tu «a». Es el de «cat», «man» y «bad».',
    examples: [
      { word: 'cat', ipa: '/kæt/' },
      { word: 'man', ipa: '/mæn/' },
      { word: 'bad', ipa: '/bæd/' },
    ],
  },
  {
    symbol: 'ʌ',
    group: 'shortVowel',
    hint: '«a» corta y relajada',
    tip: 'Como una «a» española más corta, floja y echada hacia el fondo de la boca. No la conviertas en «o» ni en «u»: «cup» no es «cop».',
    examples: [
      { word: 'cup', ipa: '/kʌp/' },
      { word: 'bus', ipa: '/bʌs/' },
      { word: 'love', ipa: '/lʌv/' },
    ],
  },
  {
    symbol: 'ɒ',
    group: 'shortVowel',
    hint: '«o» abierta y corta',
    tip: 'Una «o» española más abierta y más corta, con la boca bien abierta y los labios apenas redondeados. Es la «o» del inglés británico; el americano suele decir «a».',
    examples: [
      { word: 'hot', ipa: '/hɒt/' },
      { word: 'dog', ipa: '/dɒɡ/' },
      { word: 'wash', ipa: '/wɒʃ/' },
    ],
  },
  {
    symbol: 'ʊ',
    group: 'shortVowel',
    hint: '«u» corta y relajada',
    tip: 'Una «u» española más corta, floja y con los labios menos redondeados. «put» y «book» no llevan una «u» larga y tensa.',
    examples: [
      { word: 'put', ipa: '/pʊt/' },
      { word: 'book', ipa: '/bʊk/' },
      { word: 'good', ipa: '/ɡʊd/' },
    ],
  },
  {
    symbol: 'ə',
    group: 'shortVowel',
    hint: '«e» muy débil, casi muda',
    tip: 'La vocal más frecuente del inglés («schwa»). Muy corta, floja y sin fuerza: casi un murmullo. Aparece en sílabas sin acento, donde en español dirías una vocal clara. No la pronuncies como una «a», «e» u «o» claras: en «about» la primera vocal es casi un murmullo y la fuerza va en «-bout».',
    examples: [
      { word: 'about', ipa: '/əˈbaʊt/' },
      { word: 'teacher', ipa: '/ˈtiːtʃə/' },
      { word: 'banana', ipa: '/bəˈnɑːnə/' },
    ],
  },
  {
    symbol: 'i',
    group: 'shortVowel',
    hint: '«i» corta',
    tip: 'Una «i» española corta. Aparece al final de palabras como «happy»: no la alargues ni la conviertas en «ai» (como en «my»).',
    examples: [
      { word: 'happy', ipa: '/ˈhæpi/' },
      { word: 'city', ipa: '/ˈsɪti/' },
      { word: 'coffee', ipa: '/ˈkɒfi/' },
    ],
  },
  {
    symbol: 'u',
    group: 'shortVowel',
    hint: '«u» corta',
    tip: 'Una «u» española corta, dentro de la palabra y sin acento: «situation» /ˌsɪtʃuˈeɪʃn/. Es la hermana corta de /uː/.',
    examples: [
      { word: 'situation', ipa: '/ˌsɪtʃuˈeɪʃn/' },
      { word: 'influence', ipa: '/ˈɪnfluəns/' },
      { word: 'actually', ipa: '/ˈæktʃuəli/' },
    ],
  },

  /* Vocales largas */
  {
    symbol: 'iː',
    group: 'longVowel',
    hint: '«i» larga',
    tip: 'Tu «i» española alargada y tensa, como si sonrieras. Es lo que separa «sheep» /ʃiːp/ (oveja) de «ship» /ʃɪp/ (barco).',
    examples: [
      { word: 'see', ipa: '/siː/' },
      { word: 'sheep', ipa: '/ʃiːp/' },
      { word: 'key', ipa: '/kiː/' },
    ],
  },
  {
    symbol: 'ɑː',
    group: 'longVowel',
    hint: '«a» larga y profunda',
    tip: 'Tu «a» española, larga y con la garganta abierta: la «aaah» del médico. En inglés británico no se pronuncia la «r» final: «car» es /kɑː/.',
    examples: [
      { word: 'car', ipa: '/kɑː/' },
      { word: 'father', ipa: '/ˈfɑːðə/' },
      { word: 'start', ipa: '/stɑːt/' },
    ],
  },
  {
    symbol: 'ɔː',
    group: 'longVowel',
    hint: '«o» larga y redondeada',
    tip: 'Tu «o» española, larga y con los labios bien redondeados y adelantados. Sin «r» final: «door» es /dɔː/.',
    examples: [
      { word: 'saw', ipa: '/sɔː/' },
      { word: 'door', ipa: '/dɔː/' },
      { word: 'more', ipa: '/mɔː/' },
    ],
  },
  {
    symbol: 'uː',
    group: 'longVowel',
    hint: '«u» larga',
    tip: 'Tu «u» española alargada, con los labios muy redondeados. «food» /fuːd/ dura más que «good» /ɡʊd/.',
    examples: [
      { word: 'blue', ipa: '/bluː/' },
      { word: 'food', ipa: '/fuːd/' },
      { word: 'too', ipa: '/tuː/' },
    ],
  },
  {
    symbol: 'ɜː',
    group: 'longVowel',
    hint: '«e» larga y relajada, sin «r»',
    tip: 'No existe en español. Di una «e» larga con los labios relajados y sin sonreír, como cuando dudas: «eeeh…». Aunque se escriba «ir», «ur», «or» o «ear», no lleva «r»: «bird» es /bɜːd/.',
    examples: [
      { word: 'bird', ipa: '/bɜːd/' },
      { word: 'work', ipa: '/wɜːk/' },
      { word: 'learn', ipa: '/lɜːn/' },
    ],
  },

  /* Diptongos */
  {
    symbol: 'eɪ',
    group: 'diphthong',
    hint: '«ei» de «rey»',
    tip: 'Como la «ei» de «rey» o «peine». El segundo sonido es muy suave.',
    examples: [
      { word: 'day', ipa: '/deɪ/' },
      { word: 'make', ipa: '/meɪk/' },
      { word: 'rain', ipa: '/reɪn/' },
    ],
  },
  {
    symbol: 'aɪ',
    group: 'diphthong',
    hint: '«ai» de «aire»',
    tip: 'Como la «ai» de «aire» o «hay».',
    examples: [
      { word: 'my', ipa: '/maɪ/' },
      { word: 'time', ipa: '/taɪm/' },
      { word: 'light', ipa: '/laɪt/' },
    ],
  },
  {
    symbol: 'ɔɪ',
    group: 'diphthong',
    hint: '«oi» de «hoy»',
    tip: 'Como la «oi» de «hoy» o «boicot».',
    examples: [
      { word: 'boy', ipa: '/bɔɪ/' },
      { word: 'coin', ipa: '/kɔɪn/' },
      { word: 'enjoy', ipa: '/ɪnˈdʒɔɪ/' },
    ],
  },
  {
    symbol: 'əʊ',
    group: 'diphthong',
    hint: '«eu» suave, no una «o» pura',
    tip: 'Típico del inglés británico: empieza con la /ə/ floja y termina en «u», algo como «eu». No es una «o» pura (esa es la pronunciación americana). «go» suena parecido a «géu», con la «e» muy débil.',
    examples: [
      { word: 'go', ipa: '/ɡəʊ/' },
      { word: 'home', ipa: '/həʊm/' },
      { word: 'no', ipa: '/nəʊ/' },
    ],
  },
  {
    symbol: 'aʊ',
    group: 'diphthong',
    hint: '«au» de «causa»',
    tip: 'Como la «au» de «causa» o «aula».',
    examples: [
      { word: 'now', ipa: '/naʊ/' },
      { word: 'house', ipa: '/haʊs/' },
      { word: 'down', ipa: '/daʊn/' },
    ],
  },
  {
    symbol: 'ɪə',
    group: 'diphthong',
    hint: '«ia» relajada',
    tip: 'Una /ɪ/ corta que se desliza hacia la /ə/ floja: como una «ia» muy relajada. Sin «r» final: «here» es /hɪə/.',
    examples: [
      { word: 'here', ipa: '/hɪə/' },
      { word: 'beer', ipa: '/bɪə/' },
      { word: 'idea', ipa: '/aɪˈdɪə/' },
    ],
  },
  {
    symbol: 'eə',
    group: 'diphthong',
    hint: '«ea» relajada',
    tip: 'Una «e» abierta que se relaja hacia la /ə/: algo como «ea» muy suave. Sin «r» final: «there» es /ðeə/.',
    examples: [
      { word: 'air', ipa: '/eə/' },
      { word: 'care', ipa: '/keə/' },
      { word: 'there', ipa: '/ðeə/' },
    ],
  },
  {
    symbol: 'ʊə',
    group: 'diphthong',
    hint: '«ua» relajada',
    tip: 'Una /ʊ/ corta que se desliza hacia la /ə/: como una «ua» floja. Poco frecuente: muchos británicos dicen /ɔː/ en «sure» o «pure» («shor»).',
    examples: [
      { word: 'tour', ipa: '/tʊə/' },
      { word: 'pure', ipa: '/pjʊə/' },
      { word: 'sure', ipa: '/ʃʊə/' },
    ],
  },

  /* Consonantes que ya conoces */
  {
    symbol: 'p',
    group: 'familiar',
    hint: '«p», con un soplo de aire',
    tip: 'Como tu «p», pero al empezar una sílaba con acento sale con un pequeño soplo de aire (aspirada). Pon la mano delante de la boca: en «pen» notas el soplo; en español casi no.',
    examples: [
      { word: 'pen', ipa: '/pen/' },
      { word: 'stop', ipa: '/stɒp/' },
      { word: 'paper', ipa: '/ˈpeɪpə/' },
    ],
  },
  {
    symbol: 'b',
    group: 'familiar',
    hint: '«b» de «barco»',
    tip: 'Como la «b» de «barco». En inglés siempre suena así, tensa: no la suavices entre vocales como en «lobo». Y no es la «v»: eso es /v/.',
    examples: [
      { word: 'bad', ipa: '/bæd/' },
      { word: 'baby', ipa: '/ˈbeɪbi/' },
      { word: 'rob', ipa: '/rɒb/' },
    ],
  },
  {
    symbol: 't',
    group: 'familiar',
    hint: '«t», con un soplo de aire',
    tip: 'Como tu «t», pero con la punta de la lengua en las encías de arriba (no en los dientes) y, al empezar sílaba con acento, con un soplo de aire.',
    examples: [
      { word: 'ten', ipa: '/ten/' },
      { word: 'cat', ipa: '/kæt/' },
      { word: 'water', ipa: '/ˈwɔːtə/' },
    ],
  },
  {
    symbol: 'd',
    group: 'familiar',
    hint: '«d» de «donde»',
    tip: 'Como la «d» de «donde», con la lengua en las encías de arriba. Nunca se suaviza como la «d» de «nada»: ese sonido es /ð/.',
    examples: [
      { word: 'day', ipa: '/deɪ/' },
      { word: 'red', ipa: '/red/' },
      { word: 'under', ipa: '/ˈʌndə/' },
    ],
  },
  {
    symbol: 'k',
    group: 'familiar',
    hint: '«k» o «c» de «casa»',
    tip: 'Como la «c» de «casa» o la «k», con un soplo de aire al empezar sílaba con acento. Puede escribirse k, c, ck, ch o qu.',
    examples: [
      { word: 'cat', ipa: '/kæt/' },
      { word: 'back', ipa: '/bæk/' },
      { word: 'school', ipa: '/skuːl/' },
    ],
  },
  {
    symbol: 'ɡ',
    group: 'familiar',
    hint: '«g» de «gato»',
    tip: 'Como la «g» de «gato»: siempre dura, nunca como la «j». Es el símbolo «ɡ» (con una sola vuelta), que no es otra cosa que una «g».',
    examples: [
      { word: 'go', ipa: '/ɡəʊ/' },
      { word: 'big', ipa: '/bɪɡ/' },
      { word: 'bag', ipa: '/bæɡ/' },
    ],
  },
  {
    symbol: 'f',
    group: 'familiar',
    hint: '«f»',
    tip: 'Como tu «f». Aparece escrita f, ff, ph o gh: «fish», «off», «phone».',
    examples: [
      { word: 'fish', ipa: '/fɪʃ/' },
      { word: 'off', ipa: '/ɒf/' },
      { word: 'phone', ipa: '/fəʊn/' },
    ],
  },
  {
    symbol: 's',
    group: 'familiar',
    hint: '«s»',
    tip: 'Como tu «s». Puede escribirse s, ss o c suave: «see», «miss», «city».',
    examples: [
      { word: 'see', ipa: '/siː/' },
      { word: 'miss', ipa: '/mɪs/' },
      { word: 'city', ipa: '/ˈsɪti/' },
    ],
  },
  {
    symbol: 'm',
    group: 'familiar',
    hint: '«m»',
    tip: 'Como tu «m».',
    examples: [
      { word: 'man', ipa: '/mæn/' },
      { word: 'time', ipa: '/taɪm/' },
      { word: 'summer', ipa: '/ˈsʌmə/' },
    ],
  },
  {
    symbol: 'n',
    group: 'familiar',
    hint: '«n»',
    tip: 'Como tu «n», con la punta de la lengua en las encías de arriba.',
    examples: [
      { word: 'no', ipa: '/nəʊ/' },
      { word: 'sun', ipa: '/sʌn/' },
      { word: 'dinner', ipa: '/ˈdɪnə/' },
    ],
  },
  {
    symbol: 'l',
    group: 'familiar',
    hint: '«l»',
    tip: 'Como tu «l» al principio de sílaba. Al final de sílaba («ball», «milk») la lengua se echa hacia atrás y suena más «oscura», con un toque de «u».',
    examples: [
      { word: 'love', ipa: '/lʌv/' },
      { word: 'ball', ipa: '/bɔːl/' },
      { word: 'milk', ipa: '/mɪlk/' },
    ],
  },
  {
    symbol: 'tʃ',
    group: 'familiar',
    hint: '«ch» de «chico»',
    tip: 'Como la «ch» de «chico». Son dos sonidos juntos (/t/ + /ʃ/) y se escribe con un solo símbolo doble.',
    examples: [
      { word: 'church', ipa: '/tʃɜːtʃ/' },
      { word: 'chair', ipa: '/tʃeə/' },
      { word: 'watch', ipa: '/wɒtʃ/' },
    ],
  },
  {
    symbol: 'θ',
    group: 'familiar',
    hint: 'tu «z» de «zapato»',
    tip: 'Es tu «z» de «zapato» (la de España) o la «c» de «cielo»: la punta de la lengua entre los dientes, soplando sin voz. Un hispanohablante de España ya lo tiene; solo hay que recordar que en inglés se escribe «th»: «think», «three».',
    examples: [
      { word: 'think', ipa: '/θɪŋk/' },
      { word: 'bath', ipa: '/bɑːθ/' },
      { word: 'three', ipa: '/θriː/' },
    ],
  },
  {
    symbol: 'ð',
    group: 'familiar',
    hint: 'la «d» de «nada»',
    tip: 'Es la «d» suave de «nada» o «lado», pero con la punta de la lengua asomando entre los dientes y haciendo vibrar la garganta. Se escribe «th» en «this», «mother». No digas una «d» dura: «this» no es «dis».',
    examples: [
      { word: 'this', ipa: '/ðɪs/' },
      { word: 'mother', ipa: '/ˈmʌðə/' },
      { word: 'breathe', ipa: '/briːð/' },
    ],
  },

  /* Consonantes con trampa */
  {
    symbol: 'j',
    group: 'careful',
    hint: '«y» de «hielo» (no la «j»)',
    tip: '¡Ojo! Este símbolo no suena como la «j» española: es la «y» de «hielo» o «mayo», suave. «yes» es /jes/. La «j» inglesa de «job» es /dʒ/.',
    examples: [
      { word: 'yes', ipa: '/jes/' },
      { word: 'you', ipa: '/juː/' },
      { word: 'music', ipa: '/ˈmjuːzɪk/' },
    ],
  },
  {
    symbol: 'w',
    group: 'careful',
    hint: '«u» de «huevo»',
    tip: 'Como la «u» de «huevo» o «guau»: labios redondeados que se abren enseguida hacia la vocal. «we» suena «uí» y «wine» suena «uáin». No pongas una «g» delante.',
    examples: [
      { word: 'we', ipa: '/wiː/' },
      { word: 'wait', ipa: '/weɪt/' },
      { word: 'queen', ipa: '/kwiːn/' },
    ],
  },
  {
    symbol: 'h',
    group: 'careful',
    hint: '«j» muy suave, solo aire',
    tip: 'Es un soplido suave, como una «j» sin rascar la garganta: solo aire, como cuando empañas un cristal. No es muda como la «h» española («hola») ni tan fuerte como la «j» de «jamón».',
    examples: [
      { word: 'house', ipa: '/haʊs/' },
      { word: 'who', ipa: '/huː/' },
      { word: 'behind', ipa: '/bɪˈhaɪnd/' },
    ],
  },
  {
    symbol: 'r',
    group: 'careful',
    hint: '«r» suave, sin vibrar',
    tip: 'No vibra como la «r» española. La punta de la lengua se curva hacia atrás sin tocar nada y suena como una «r» muy suave. Solo se pronuncia delante de una vocal: «red» sí; «car» /kɑː/ y «teacher» /ˈtiːtʃə/ no llevan «r» al final.',
    examples: [
      { word: 'red', ipa: '/red/' },
      { word: 'very', ipa: '/ˈveri/' },
      { word: 'sorry', ipa: '/ˈsɒri/' },
    ],
  },
  {
    symbol: 'v',
    group: 'careful',
    hint: '«f» con voz (no la «b»)',
    tip: 'No es la «b». Apoya los dientes de arriba sobre el labio de abajo, como para decir «f», y haz vibrar la garganta. Tócate el cuello: tiene que vibrar. «very» /ˈveri/ y «berry» /ˈberi/ son palabras distintas.',
    examples: [
      { word: 'very', ipa: '/ˈveri/' },
      { word: 'love', ipa: '/lʌv/' },
      { word: 'give', ipa: '/ɡɪv/' },
    ],
  },
  {
    symbol: 'z',
    group: 'careful',
    hint: '«s» con zumbido',
    tip: 'Una «s» con la garganta vibrando, como el zumbido de una abeja: «zzz». No es tu «z» de «zapato» (esa es /θ/). Sale en plurales y terminaciones tras un sonido con voz: «dogs» /dɒɡz/, «nose» /nəʊz/.',
    examples: [
      { word: 'zoo', ipa: '/zuː/' },
      { word: 'nose', ipa: '/nəʊz/' },
      { word: 'dogs', ipa: '/dɒɡz/' },
    ],
  },
  {
    symbol: 'ʃ',
    group: 'careful',
    hint: '«sh» de «¡shhh!»',
    tip: 'Es el sonido que haces para pedir silencio: «¡shhh!». No es «ch» (sin la «t» delante) ni «s»: la lengua va hacia atrás y los labios se adelantan un poco. Se escribe sh, ti, ci o ssi: «she», «nation».',
    examples: [
      { word: 'she', ipa: '/ʃiː/' },
      { word: 'ship', ipa: '/ʃɪp/' },
      { word: 'nation', ipa: '/ˈneɪʃn/' },
    ],
  },
  {
    symbol: 'ʒ',
    group: 'careful',
    hint: '«sh» con voz',
    tip: 'Es la /ʃ/ pero con la garganta vibrando: parecida a la «y» argentina de «yo» o a la «j» francesa de «Jean». Poco frecuente: «vision», «measure».',
    examples: [
      { word: 'vision', ipa: '/ˈvɪʒn/' },
      { word: 'measure', ipa: '/ˈmeʒə/' },
      { word: 'usually', ipa: '/ˈjuːʒuəli/' },
    ],
  },
  {
    symbol: 'dʒ',
    group: 'careful',
    hint: '«ch» con voz',
    tip: 'Como la /tʃ/ («ch») pero con la garganta vibrando: empieza como una «d» y suelta una «y» fuerte, como en «cónyuge» o «un yate». Tócate el cuello: si no vibra, estás diciendo «ch». Es la «j» inglesa de «job» y la «g» de «gentle».',
    examples: [
      { word: 'job', ipa: '/dʒɒb/' },
      { word: 'judge', ipa: '/dʒʌdʒ/' },
      { word: 'bridge', ipa: '/brɪdʒ/' },
    ],
  },
  {
    symbol: 'ŋ',
    group: 'careful',
    hint: '«n» de «banco»',
    tip: 'Es la «n» de «banco» o «manga» (la lengua toca el paladar blando), pero también al final de palabra: «sing» /sɪŋ/. No pronuncies una «g» detrás: «sing» no es «sin-g». (Hay excepciones como «finger» /ˈfɪŋɡə/.)',
    examples: [
      { word: 'sing', ipa: '/sɪŋ/' },
      { word: 'long', ipa: '/lɒŋ/' },
      { word: 'thinking', ipa: '/ˈθɪŋkɪŋ/' },
    ],
  },
]

export interface Mark {
  symbol: string
  name: string
  /** Short version, for the breakdown of a word. */
  hint: string
  tip: string
  examples: readonly SoundExample[]
}

/** Stress and length marks. They are not sounds: they say how to say the ones around them. */
export const MARKS: readonly Mark[] = [
  {
    symbol: 'ˈ',
    name: 'Acento principal',
    hint: 'la sílaba que sigue lleva el acento',
    tip: 'La sílaba que viene justo después es la más fuerte de la palabra. Funciona como la tilde, pero en inglés no se escribe en la palabra, solo en la IPA: «about» /əˈbaʊt/ se dice a-BOUT; «water» /ˈwɔːtə/ se dice WA-ter.',
    examples: [
      { word: 'about', ipa: '/əˈbaʊt/' },
      { word: 'water', ipa: '/ˈwɔːtə/' },
      { word: 'hotel', ipa: '/həʊˈtel/' },
    ],
  },
  {
    symbol: 'ˌ',
    name: 'Acento secundario',
    hint: 'sílaba con un acento más flojo',
    tip: 'Una sílaba con un acento más suave que el principal. Aparece en palabras largas: «education» /ˌedʒuˈkeɪʃn/ se dice e-ju-KEI-shn, con un pequeño apoyo en la primera.',
    examples: [
      { word: 'education', ipa: '/ˌedʒuˈkeɪʃn/' },
      { word: 'information', ipa: '/ˌɪnfəˈmeɪʃn/' },
    ],
  },
  {
    symbol: 'ː',
    name: 'Vocal larga',
    hint: 'alarga la vocal anterior',
    tip: 'Alarga la vocal que tiene delante, más o menos al doble. En español no cambia el significado; en inglés sí: «ship» /ʃɪp/ (barco) frente a «sheep» /ʃiːp/ (oveja).',
    examples: [
      { word: 'ship', ipa: '/ʃɪp/' },
      { word: 'sheep', ipa: '/ʃiːp/' },
    ],
  },
]

export const SOUND_BY_SYMBOL: ReadonlyMap<string, Sound> = new Map(SOUNDS.map((sound) => [sound.symbol, sound]))
export const MARK_BY_SYMBOL: ReadonlyMap<string, Mark> = new Map(MARKS.map((mark) => [mark.symbol, mark]))

export function soundsInGroup(group: SoundGroup): Sound[] {
  return SOUNDS.filter((sound) => sound.group === group)
}

export interface Pitfall {
  title: string
  text: string
  words: readonly SoundExample[]
}

/** What costs a Spanish speaker the most, with words to hear it (spec: guide for Spanish speakers). */
export const PITFALLS: readonly Pitfall[] = [
  {
    title: 'No añadas una «e» delante de «s» + consonante',
    text: 'En español no empezamos palabras con «s» + consonante, y tendemos a poner una «e» delante. En inglés se dice directamente: school /skuːl/, no «escuel»; Spain /speɪn/, no «España».',
    words: [
      { word: 'school', ipa: '/skuːl/' },
      { word: 'Spain', ipa: '/speɪn/' },
      { word: 'student', ipa: '/ˈstjuːdnt/' },
    ],
  },
  {
    title: 'La consonante final se pronuncia',
    text: 'En español las consonantes finales se debilitan; en inglés cuentan: «red» no es «re», «want» no es «guan». Si no suena la última consonante, la palabra puede sonar a otra.',
    words: [
      { word: 'red', ipa: '/red/' },
      { word: 'want', ipa: '/wɒnt/' },
      { word: 'walked', ipa: '/wɔːkt/' },
    ],
  },
  {
    title: 'Vocal corta o vocal larga',
    text: 'El español no distingue la duración de las vocales; el inglés sí, y cambia la palabra. Practica estos pares: primero la corta, luego la larga.',
    words: [
      { word: 'ship', ipa: '/ʃɪp/' },
      { word: 'sheep', ipa: '/ʃiːp/' },
      { word: 'full', ipa: '/fʊl/' },
      { word: 'fool', ipa: '/fuːl/' },
      { word: 'live', ipa: '/lɪv/' },
      { word: 'leave', ipa: '/liːv/' },
    ],
  },
  {
    title: 'La «b» y la «v» son distintas',
    text: 'En español suenan igual; en inglés no. Para la /v/ apoya los dientes de arriba en el labio de abajo y haz vibrar la garganta.',
    words: [
      { word: 'berry', ipa: '/ˈberi/' },
      { word: 'very', ipa: '/ˈveri/' },
    ],
  },
  {
    title: 'La «th» no es una «d» ni una «t»',
    text: 'Saca la punta de la lengua entre los dientes. Sin voz es tu «z» de «zapato» (/θ/); con voz, la «d» suave de «nada» (/ð/).',
    words: [
      { word: 'think', ipa: '/θɪŋk/' },
      { word: 'sink', ipa: '/sɪŋk/' },
      { word: 'this', ipa: '/ðɪs/' },
    ],
  },
  {
    title: 'La «r» del final no suena',
    text: 'En inglés británico la «r» solo se pronuncia delante de una vocal. Al final de palabra («car», «teacher») queda solo la vocal. Y nunca vibra como la «rr» española.',
    words: [
      { word: 'car', ipa: '/kɑː/' },
      { word: 'teacher', ipa: '/ˈtiːtʃə/' },
      { word: 'red', ipa: '/red/' },
    ],
  },
  {
    title: 'La «h» del principio se aspira',
    text: 'No es muda como en «hola»: es un soplido suave de aire antes de la vocal.',
    words: [
      { word: 'house', ipa: '/haʊs/' },
      { word: 'hello', ipa: '/həˈləʊ/' },
    ],
  },
]
