type PromptRow = {
  id: string
  prompt: string
}

type BucketDefinition = {
  slug: string
  description: string
  matches: (row: PromptRow, text: string) => boolean
}

const catalogPath = 'dev-research/training-prompts/catalog/prompts.jsonl'
const outputDir = 'dev-research/training-prompts/catalog/buckets'

const hasAny = (text: string, patterns: RegExp[]) => patterns.some((pattern) => pattern.test(text))

const isLegacyUtilityId = (id: string) =>
  /(?:^|[_-])(xcmd|xfcn|appleevent|script|scripts|dialog|palette|modal|focus|cursor|window|menu|alias|clipboard|printer|compile|convert|parser|utility|utilities)(?:[_-]|$)/.test(
    id,
  )

const bucketDefinitions: BucketDefinition[] = [
  {
    slug: '01-community-marketplaces-and-local-networks',
    description: 'Farmer-market, proximity network, public node, and locality-aware service prompts.',
    matches: (row, text) =>
      hasAny(text, [
        /\bfarm-stand\b/,
        /\bboundary-(private|supplier|public)-view\b/,
        /\bfarmer'?s market\b/,
        /\bpop-up market\b/,
        /\bpublic-service-aggregator\b/,
        /\bephemeral-(meeting-place|library-autoconnect|market-aggregator)\b/,
        /\bhealth-overlay-market\b/,
        /\burban-planner-density\b/,
        /\bpopup-art-exhibition\b/,
        /\bwholesale\b/,
        /\bnearby public nodes\b/,
        /\bnearby\b.*\bvendors\b/,
      ]),
  },
  {
    slug: '02-home-family-and-personal-life',
    description: 'Household, family, journaling, groceries, recipes, and domestic organization prompts.',
    matches: (row, text) =>
      hasAny(text, [
        /\bfamily\b/,
        /\bhousehold\b/,
        /\bhome-(bedroom|living-room|house)\b/,
        /\bjournal\b/,
        /\bgrocery\b/,
        /\bchore\b/,
        /\bshared calendar\b/,
        /\bmeal planning\b/,
        /\brecipe\b/,
        /\bkitchen\b/,
        /\bholiday scene\b/,
      ]),
  },
  {
    slug: '03-work-business-and-service-operations',
    description: 'Workflows, business operations, booking, inventory, and internal-tool prompts.',
    matches: (row, text) =>
      hasAny(text, [
        /\bwork-/,
        /\bproposal\b/,
        /\breview board\b/,
        /\bcapacity-(alert-owner-view|migration-plan|paid-priority-plan)\b/,
        /\bnode-upgrade-options\b/,
        /\btransition-internal-to-service\b/,
        /\bbooking\b/,
        /\bworkflow\b/,
        /\binternal tool\b/,
        /\bresume\b/,
        /\bcitizen developers?\b/,
        /\blow-code\b/,
        /\bdashboard\b/,
        /\binventory\b/,
        /\bcogs\b/,
        /\bgross margins?\b/,
        /\binvoice\b/,
        /\bbilling\b/,
        /\breservation\b/,
        /\bitinerary\b/,
        /\broute validation\b/,
        /\bsmall business\b/,
        /\bcontact dialer\b/,
      ]),
  },
  {
    slug: '04-communication-publishing-and-media',
    description: 'Messaging, social, publishing, streaming, email, audio, and subscriber prompts.',
    matches: (row, text) =>
      hasAny(text, [
        /\bbluesky\b/,
        /\bwhatsapp\b/,
        /\btelegram\b/,
        /\bunified inbox\b/,
        /\bcross-post\b/,
        /\bcompose view\b/,
        /\bmessage(s|d)?\b/,
        /\binbox\b/,
        /\bemail\b/,
        /\bpublisher\b/,
        /\bpublishing\b/,
        /\bchapters?\b/,
        /\bsubscribers?\b/,
        /\btransition-artifact-to-service\b/,
        /\baudiobook\b/,
        /\bvoice\b/,
        /\bvideo\b/,
        /\bstream(ing)?\b/,
        /\bpodcast\b/,
        /\btimeline\b/,
        /\bnotifications?\b/,
      ]),
  },
  {
    slug: '05-education-reference-and-practice',
    description: 'Tutoring, drills, quizzes, study aids, biographies, guides, and reference prompts.',
    matches: (row, text) =>
      hasAny(text, [
        /\btutor\b/,
        /\bquiz\b/,
        /\bdrill\b/,
        /\bpractice\b/,
        /\bflashcard\b/,
        /\bspaced repetition\b/,
        /\blearner\b/,
        /\bstudent\b/,
        /\bteacher\b/,
        /\blesson\b/,
        /\bcourse\b/,
        /\btraining\b/,
        /\bguide\b/,
        /\bquick reference\b/,
        /\breference\b/,
        /\bbibliograph(y|ic)\b/,
        /\bbiography\b/,
        /\btimeline maker\b/,
        /\bscripture\b/,
        /\bvocabulary\b/,
        /\bfraction\b/,
        /\bgeography\b/,
        /\bhistory\b/,
        /\bdictionary\b/,
        /\bperiodic table\b/,
        /\bmap labeling\b/,
      ]),
  },
  {
    slug: '06-creative-tools-and-design',
    description: 'Creative production, design, art, animation, layout, and presentation prompts.',
    matches: (row, text) =>
      hasAny(text, [
        /\bportfolio\b/,
        /\bart\b/,
        /\banimation\b/,
        /\banimated\b/,
        /\bdrawing\b/,
        /\bdesign\b/,
        /\bdecorator\b/,
        /\bbeat board\b/,
        /\bscreenplay\b/,
        /\bcomic\b/,
        /\bhotspot\b/,
        /\bscene\b/,
        /\bicons?\b/,
        /\bmicro-interactions?\b/,
        /\blabels?\b/,
        /\bprintable timeline\b/,
        /\bbookbinding\b/,
      ]),
  },
  {
    slug: '07-developer-automation-and-system-utilities',
    description: 'Technical utilities, automation helpers, file/system tools, and developer aids.',
    matches: (row, text) =>
      isLegacyUtilityId(row.id) ||
      hasAny(text, [
        /\bautomation\b/,
        /\bdesktop automation\b/,
        /\bapi\b/,
        /\breact hook\b/,
        /\bmodule that creates persistent file references\b/,
        /\bsymlinks?\b/,
        /\bshortcuts?\b/,
        /\bvalidation and error handling\b/,
        /\bkeyboard trap\b/,
        /\bfocus returns?\b/,
        /\bplatform differences\b/,
        /\bintercept(?:ion)? rules\b/,
        /\bdeveloper panel\b/,
        /\bdebug(ging)?\b/,
        /\bcommand palette\b/,
        /\bmodifier-key\b/,
        /\badd-copyright-notice-to-a-sta\b/,
        /\bcopyright notice\b/,
        /\bacp module\b/,
        /\bcontrol surface\b/,
        /\bbootstrap\b/,
        /\bmerge order\b/,
        /\bloading spinner\b/,
        /\bbusy state\b/,
        /\bpath for a ui element\b/,
      ]),
  },
  {
    slug: '08-catalogs-archives-and-collections',
    description: 'Cataloging, personal archives, libraries, records, and collection-management prompts.',
    matches: (row, text) =>
      hasAny(text, [
        /\bcatalog\b/,
        /\bcollection\b/,
        /\blibrary\b/,
        /\barchive\b/,
        /\bpersonal book\b/,
        /\bmedia collection\b/,
        /\bquote library\b/,
        /\bcontact registry\b/,
        /\brecords?\b/,
        /\bdatabase\b/,
        /\blook up structured entries\b/,
        /\bsearchable metadata\b/,
        /\btrack their physical collectibles\b/,
      ]),
  },
  {
    slug: '09-finance-health-and-life-planning',
    description: 'Finance, health, fitness, nutrition, and decision/planning prompts.',
    matches: (row, text) =>
      hasAny(text, [
        /\bfinancial\b/,
        /\bfinance\b/,
        /\bpayment\b/,
        /\bspending limit\b/,
        /\bloan\b/,
        /\bmortgage\b/,
        /\binvest(?:ing|ment)?\b/,
        /\bratio analysis\b/,
        /\bportfolio-level valuation\b/,
        /\bhealth\b/,
        /\bdiabetic\b/,
        /\bhiv\b/,
        /\bnutrition\b/,
        /\bfat percentage\b/,
        /\bworkout\b/,
        /\bexercise\b/,
        /\brda\b/,
        /\bdecision helper\b/,
        /\bprioritizer\b/,
      ]),
  },
  {
    slug: '10-games-and-entertainment',
    description: 'Games, trivia, hobby play, and entertainment-oriented prompts.',
    matches: (row, text) =>
      hasAny(text, [
        /\bgame\b/,
        /\btrivia\b/,
        /\bdungeon\b/,
        /\bbingo\b/,
        /\bwarrior\b/,
        /\bencounters?\b/,
        /\bboss\b/,
        /\bscore\b/,
        /\bentertainment\b/,
        /\bguitar tablature\b/,
        /\bchess\b/,
        /\bsports cards?\b/,
      ]),
  },
]

const classifyRow = (row: PromptRow) => {
  const text = `${row.id} ${row.prompt}`.toLowerCase()

  for (const bucket of bucketDefinitions) {
    if (bucket.matches(row, text)) {
      return bucket.slug
    }
  }

  if (row.id.startsWith('hypercard_') || row.id.startsWith('hc_') || row.id.startsWith('macrepo-')) {
    return '11-legacy-hypercard-and-macrepo-general'
  }

  return '12-modern-general-modules'
}

const main = async () => {
  const input = await Bun.file(catalogPath).text()
  const rows = input
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .map((line) => JSON.parse(line) as PromptRow)

  const bucketed = new Map<string, PromptRow[]>()

  for (const row of rows) {
    const bucket = classifyRow(row)
    const current = bucketed.get(bucket) ?? []
    current.push(row)
    bucketed.set(bucket, current)
  }

  const manifest = [
    ...bucketDefinitions.map(({ slug, description }) => ({ slug, description })),
    {
      slug: '11-legacy-hypercard-and-macrepo-general',
      description: 'Legacy HyperCard, HC, and Mac repo prompts that remain useful but span many mixed subtypes.',
    },
    {
      slug: '12-modern-general-modules',
      description: 'Modern prompts that do not fit the more specific topical buckets above.',
    },
  ].map(({ slug, description }) => ({
    slug,
    description,
    count: bucketed.get(slug)?.length ?? 0,
  }))

  for (const entry of manifest) {
    const rowsForBucket = bucketed.get(entry.slug) ?? []
    const body = rowsForBucket.map((row) => JSON.stringify(row)).join('\n')
    await Bun.write(`${outputDir}/${entry.slug}.jsonl`, body.length > 0 ? `${body}\n` : '')
  }

  await Bun.write(
    `${outputDir}/index.json`,
    `${JSON.stringify(
      {
        source: catalogPath,
        totalPrompts: rows.length,
        buckets: manifest,
      },
      null,
      2,
    )}\n`,
  )
}

await main()
