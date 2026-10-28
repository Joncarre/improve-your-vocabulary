/*
 * British / American spelling pairs, as word beginnings so that inflections come for free
 * ("colour" covers "coloured" and "colourful"). Pairs where the other spelling is a different word
 * (tyre/tire, check/cheque, draught/draft) are left out on purpose.
 */
const PAIRS: ReadonlyArray<readonly [uk: string, us: string]> = [
  // -our / -or
  ['colour', 'color'], ['favour', 'favor'], ['honour', 'honor'], ['humour', 'humor'], ['labour', 'labor'],
  ['neighbour', 'neighbor'], ['behaviour', 'behavior'], ['flavour', 'flavor'], ['harbour', 'harbor'],
  ['rumour', 'rumor'], ['vapour', 'vapor'], ['endeavour', 'endeavor'], ['saviour', 'savior'], ['splendour', 'splendor'],
  // -re / -er
  ['centre', 'center'], ['theatre', 'theater'], ['metre', 'meter'], ['litre', 'liter'], ['fibre', 'fiber'],
  ['calibre', 'caliber'], ['sombre', 'somber'], ['spectre', 'specter'],
  // -ise / -ize and -yse / -yze
  ['organis', 'organiz'], ['realis', 'realiz'], ['recognis', 'recogniz'], ['apologis', 'apologiz'],
  ['criticis', 'criticiz'], ['emphasis', 'emphasiz'], ['summaris', 'summariz'], ['specialis', 'specializ'],
  ['civilis', 'civiliz'], ['familiaris', 'familiariz'], ['memoris', 'memoriz'], ['minimis', 'minimiz'],
  ['maximis', 'maximiz'], ['authoris', 'authoriz'], ['capitalis', 'capitaliz'], ['customis', 'customiz'],
  ['analys', 'analyz'], ['paralys', 'paralyz'], ['catalys', 'catalyz'],
  // -ce / -se
  ['defence', 'defense'], ['offence', 'offense'], ['licence', 'license'], ['pretence', 'pretense'],
  // single or double l
  ['travell', 'travel'], ['cancell', 'cancel'], ['labell', 'label'], ['modell', 'model'], ['signall', 'signal'],
  ['fuell', 'fuel'], ['marvell', 'marvel'], ['counsell', 'counsel'], ['fulfil', 'fulfill'], ['enrol', 'enroll'],
  ['skilful', 'skillful'], ['instalment', 'installment'],
  // -ogue / -og
  ['catalogue', 'catalog'], ['dialogue', 'dialog'], ['analogue', 'analog'],
  // others
  ['grey', 'gray'], ['programme', 'program'], ['plough', 'plow'], ['mould', 'mold'], ['moustache', 'mustache'],
  ['pyjama', 'pajama'], ['aluminium', 'aluminum'], ['maths', 'math'], ['whilst', 'while'], ['towards', 'toward'],
  ['ageing', 'aging'], ['judgement', 'judgment'], ['sceptic', 'skeptic'], ['manoeuvre', 'maneuver'],
  ['anaesthe', 'anesthe'], ['paediatric', 'pediatric'], ['encyclopaedia', 'encyclopedia'], ['artefact', 'artifact'],
  ['practise', 'practice'],
  // irregular verb forms with a regular American twin
  ['learnt', 'learned'], ['spelt', 'spelled'], ['dreamt', 'dreamed'], ['burnt', 'burned'], ['leapt', 'leaped'],
  ['smelt', 'smelled'], ['spilt', 'spilled'], ['spoilt', 'spoiled'], ['knelt', 'kneeled'], ['got', 'gotten'],
]

/**
 * The other-dialect spellings of a lower-case word or expression (each word is changed on its own).
 * Never includes the word itself.
 */
export function spellingVariants(text: string): string[] {
  const words = text.split(' ')
  const variants = new Set<string>()
  words.forEach((word, index) => {
    const matches = PAIRS.flatMap(([uk, us]) => [
      [uk, us],
      [us, uk],
    ] as const).filter(([start]) => word.startsWith(start))
    // The longest beginning wins: "travelled" is "travell" + "ed", not "travel" + "led".
    const longest = Math.max(0, ...matches.map(([start]) => start.length))
    for (const [start, other] of matches) {
      if (start.length === longest) variants.add([...words.slice(0, index), other + word.slice(start.length), ...words.slice(index + 1)].join(' '))
    }
  })
  variants.delete(text)
  return [...variants]
}
