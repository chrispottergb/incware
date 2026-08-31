export interface Situation {
  id: string;
  label: string;
  emoji: string;
  color: string;
}

export interface GuidanceCard {
  step: number;
  tag: string;
  title: string;
  body: string;
  action?: string;
}

export const situations: Situation[] = [
  { id: "breakup", label: "Breakup / Heartbreak", emoji: "💔", color: "from-rose-900/60 to-rose-950/80" },
  { id: "angry-boss", label: "Angry Boss / Work", emoji: "🔥", color: "from-orange-900/60 to-orange-950/80" },
  { id: "family", label: "Family Conflict", emoji: "🌀", color: "from-amber-900/60 to-amber-950/80" },
  { id: "anxiety", label: "Anxiety Spiral", emoji: "⚡", color: "from-violet-900/60 to-violet-950/80" },
  { id: "panic", label: "Panic / Overwhelm", emoji: "🌊", color: "from-blue-900/60 to-blue-950/80" },
  { id: "grief", label: "Grief / Loss", emoji: "🌑", color: "from-slate-800/70 to-slate-950/80" },
  { id: "social", label: "Social Tension", emoji: "👥", color: "from-teal-900/60 to-teal-950/80" },
  { id: "off", label: "Just Feel Off", emoji: "🌫️", color: "from-zinc-800/70 to-zinc-950/80" },
];

export const guidanceCards: Record<string, GuidanceCard[]> = {
  breakup: [
    {
      step: 1, tag: "Right now",
      title: "Your nervous system is not broken.",
      body: "What you're feeling is a real, physical response — cortisol, adrenaline, attachment circuitry firing. It's not weakness. It's biology doing exactly what it was designed to do when connection is severed.",
      action: "Take 3 slow exhales — longer out than in.",
    },
    {
      step: 2, tag: "Reframe",
      title: "This is grief, not evidence of your worth.",
      body: "The pain is proportional to how much you let yourself care — which means you are fully capable of depth. That capacity doesn't leave with them.",
    },
    {
      step: 3, tag: "What this is NOT",
      title: "This is not the end of your story.",
      body: "Right now your brain is pattern-matching toward the worst outcome. That's a survival reflex. The version of you who gets through this is already forming — you just can't see it yet.",
    },
    {
      step: 4, tag: "Next 15 minutes",
      title: "Give your body one anchor.",
      body: "Eat something. Drink water. Step outside for 2 minutes. You don't need to process everything right now. You just need to get through the next 15 minutes.",
      action: "Let's find your sound.",
    },
  ],
  "angry-boss": [
    {
      step: 1, tag: "Right now",
      title: "Separate the heat from the meaning.",
      body: "When someone comes at you with anger, your threat response activates instantly — same as physical danger. That charge you feel is not weakness. It's your system doing its job. You don't have to react from inside it.",
      action: "Inhale 4 counts. Hold 4. Out 6. Twice.",
    },
    {
      step: 2, tag: "Reframe",
      title: "Their reaction is data, not verdict.",
      body: "Anger directed at you is almost always about the situation, the pressure above them, or an old pattern they're running. It rarely means what it sounds like it means.",
    },
    {
      step: 3, tag: "What this is NOT",
      title: "This is not a threat to who you are.",
      body: "Your identity is not on the table in this interaction. Your position, maybe. Your performance, temporarily. But who you fundamentally are cannot be altered by someone else's bad day.",
    },
    {
      step: 4, tag: "Next 15 minutes",
      title: "Give the cortisol somewhere to go.",
      body: "Walk. Cold water on your wrists. Write 3 sentences of what actually happened, no interpretation. Let your nervous system discharge before you decide what to do about it.",
      action: "Let's find your sound.",
    },
  ],
  family: [
    {
      step: 1, tag: "Right now",
      title: "Old roles activate automatically.",
      body: "Family conflict pulls you back into a version of yourself that was built for survival in that dynamic. That response is older than your adult identity. You can notice it without becoming it.",
      action: "Feel your feet on the floor. That's the present.",
    },
    {
      step: 2, tag: "Reframe",
      title: "Pattern, not person.",
      body: "What's happening is almost always a pattern repeating, not a new attack. Seeing it as a pattern instead of a personal assault creates space between you and your reaction.",
    },
    {
      step: 3, tag: "What this is NOT",
      title: "This is not proof they don't love you.",
      body: "People who are dysregulated cannot access their love in that moment. It doesn't mean it isn't there. It means they haven't learned how to stay with themselves through difficulty.",
    },
    {
      step: 4, tag: "Next 15 minutes",
      title: "Physical distance first.",
      body: "If you can — remove yourself from the space. Not permanently. Just enough to interrupt the loop. Your best thinking about this won't happen in the middle of it.",
      action: "Let's find your sound.",
    },
  ],
  anxiety: [
    {
      step: 1, tag: "Right now",
      title: "Name what's happening.",
      body: "Anxiety is your system generating threat signals without a clear target. Naming it — 'this is anxiety' — activates your prefrontal cortex and immediately begins to reduce the intensity. Language is regulation.",
      action: "Say it out loud: 'This is anxiety. I'm not in danger.'",
    },
    {
      step: 2, tag: "Reframe",
      title: "The spiral is a loop, not a prediction.",
      body: "The anxious mind generates scenarios as if they're probability. They're not. They're the mind trying to prepare for every outcome. The preparation loop is not the outcome.",
    },
    {
      step: 3, tag: "What this is NOT",
      title: "This is not a sign something bad is coming.",
      body: "The feeling of dread is often the anxiety itself, not a signal. Your system has learned to trigger alarm in the absence of real threat. The alarm is the condition — not the message.",
    },
    {
      step: 4, tag: "Next 15 minutes",
      title: "One physical thing. Right now.",
      body: "Cold water. A brief walk. 5 things you can see. The body is the fastest way back. Anxious thoughts can't be argued out — they can be metabolized.",
      action: "Let's find your sound.",
    },
  ],
  panic: [
    {
      step: 1, tag: "Right now",
      title: "This will pass. It always does.",
      body: "A panic response peaks and subsides. The intensity you're feeling cannot hold at this level. Your body does not have the resources to maintain it. You are not dying. You are overwhelmed.",
      action: "Exhale fully. Empty the lungs completely. Let the inhale come on its own.",
    },
    {
      step: 2, tag: "Reframe",
      title: "Overwhelm means you've been carrying too much.",
      body: "Panic and overwhelm are not character flaws. They are overflow — a system that has been running past capacity for too long without enough restoration. This is the bill coming due.",
    },
    {
      step: 3, tag: "What this is NOT",
      title: "This is not a breakdown.",
      body: "This is a breakthrough of pressure that needed release. Your system is trying to reset, not fail. What happens after panic — if you let it move through instead of fighting it — is often clarity.",
    },
    {
      step: 4, tag: "Next 15 minutes",
      title: "One thing off the list. Just one.",
      body: "You don't have to solve everything right now. What is the single most urgent thing in the next 15 minutes? Only that. The rest exists tomorrow.",
      action: "Let's find your sound.",
    },
  ],
  grief: [
    {
      step: 1, tag: "Right now",
      title: "Grief is love with nowhere to go.",
      body: "What you're carrying is the weight of what mattered. The depth of the loss is exactly proportional to the depth of the love or meaning. You're not broken — you're honoring something real.",
      action: "You don't have to do anything right now except breathe.",
    },
    {
      step: 2, tag: "Reframe",
      title: "There's no timeline you're behind on.",
      body: "Grief moves in waves, not stages. There's no correct way to do this and no point where you should be done. Anyone who suggests otherwise is uncomfortable with their own unprocessed loss.",
    },
    {
      step: 3, tag: "What this is NOT",
      title: "This is not a sign you're weak.",
      body: "The capacity to grieve is the capacity to have loved. People who cannot grieve cannot fully connect. What you're feeling is evidence of how fully you are alive.",
    },
    {
      step: 4, tag: "Next 15 minutes",
      title: "Permission to not be okay.",
      body: "You do not need to be productive, functional, or fine right now. Find one person or one space where you don't have to perform okay. That is the most useful thing you can do right now.",
      action: "Let's find your sound.",
    },
  ],
  social: [
    {
      step: 1, tag: "Right now",
      title: "Social threat activates the same system as physical threat.",
      body: "Rejection, conflict, judgment — your nervous system processes these through the same threat circuitry as physical danger. The flush, the rumination, the replay — it's biology. It's real. And it can be regulated.",
      action: "Slow your breath. You are physically safe right now.",
    },
    {
      step: 2, tag: "Reframe",
      title: "What they think is data, not definition.",
      body: "Other people's reactions to you are filtered through their entire history, their current state, their insecurities. You cannot accurately read what someone thinks of you through your own triggered lens.",
    },
    {
      step: 3, tag: "What this is NOT",
      title: "This is not evidence of who you are.",
      body: "One interaction, one person's reaction, one awkward moment — none of these are evidence of your fundamental value or your ability to connect. You have survived every hard social moment before this one.",
    },
    {
      step: 4, tag: "Next 15 minutes",
      title: "Discharge the charge, then decide.",
      body: "Do not make decisions about the relationship, the job, the friendship, or yourself right now. Move your body. Let the activation metabolize. Decide nothing while you're flooded.",
      action: "Let's find your sound.",
    },
  ],
  off: [
    {
      step: 1, tag: "Right now",
      title: "Not knowing what's wrong is still something.",
      body: "The low-grade sense that something's off — without a clear cause — is often accumulated stress, unprocessed emotion, or the body signaling a need that hasn't been named yet. You don't need to identify it to respond to it.",
      action: "Check in: When did you last drink water? Eat? Sleep enough?",
    },
    {
      step: 2, tag: "Reframe",
      title: "Feeling off is information.",
      body: "Your system is telling you something isn't aligned. That might be rest, connection, creative outlet, or simply permission to not be 'on' right now. The signal itself is useful.",
    },
    {
      step: 3, tag: "What this is NOT",
      title: "This is not your new baseline.",
      body: "Moods are not identities. States are not permanent. How you feel right now is a current condition, not a forecast. It will shift — the question is what helps it move.",
    },
    {
      step: 4, tag: "Next 15 minutes",
      title: "Give yourself one genuine thing.",
      body: "Not productive. Not impressive. One thing that is actually for you — a song, sunlight, silence, movement, a conversation, a snack you like. Small genuine input often moves what big analysis can't.",
      action: "Let's find your sound.",
    },
  ],
};

export const moods = [
  "Grounding", "Release", "Clarity", "Strength", "Comfort",
  "Focus", "Surrender", "Uplift", "Stillness", "Power",
];

export const genres = [
  "Ambient", "Lo-Fi", "Neo-Soul", "Classical", "Electronic",
  "R&B", "Cinematic", "Jazz", "Acoustic", "Binaural",
  "Hip-Hop", "Meditation", "Indie", "Gospel", "Afrobeats",
];
