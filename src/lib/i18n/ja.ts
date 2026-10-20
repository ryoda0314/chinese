// UI copy, written plainly from the learner's side. Client components get strings as props or import this file.

export type FamilyId =
  | "t14" | "t23" | "t12" | "t34" | "t24" | "t13" | "tw"
  | "asp" | "retro" | "pal" | "nng" | "uv" | "rl" | "fh" | "ouuo";

// ことのあめ: the sister app whose accounts (and database) this one uses.
const KOTONOAME_URL = (process.env.NEXT_PUBLIC_KOTONOAME_URL || "https://polylinga.vercel.app").replace(/\/$/, "");

export const ja = {
  name: "ことのね",
  kotonoame: { name: "ことのあめ", url: KOTONOAME_URL },
  description:
    "中国語の声調とピンインを、耳で聞き分けて、口で言えるように。1か所だけ違う語の組が、いくつもの声で降ってくる。聞き比べて、聞き分けて、言ってみる。",

  intro: {
    lead: "知っている違いと、聞こえる違いは別のもの。",
    body: [
      "大学 dàxué と 大雪 dàxuě。肚子 dùzi と 兔子 tùzi。人民 rénmín と 人名 rénmíng。日本語では区別しない違いなので、知っていても最初は同じに聞こえる。",
      "1か所だけ違う語の組が、4つの声で降ってくる。聞き比べて、どっちだったか選ぶと、すぐ答えが分かる。何度も直されるうちに、ある日ふいに別の音として聞こえてくる。",
      "表や理屈からは入らない。違いの名前は、聞き分けたあとで知ればいい。",
    ],
    start: "はじめる",
    again: "続きから",
    note: "登録はいりません。記録はこの端末に残ります。",
    link: "ことのあめのアカウントがあれば、つなぐと記録がどの端末でも続きます",
  },

  nav: { label: "メニュー", listen: "聞く", me: "自分" },

  steps: {
    compare: "聞き比べる",
    tell: "聞き分ける",
    sentences: "文の中で",
    say: "言ってみる",
  },

  rain: {
    loading: "雨を集めています…",
    failed: "読み込めませんでした。電波のよいところで、もう一度。",
    retry: "もう一度",
    compareLead: "1か所だけ違う語の組が、いくつもの声で降ってきます。どこが違うか、聞き比べてみて。",
    soundOn: "音が出ます。電車の中ならイヤホンで。",
    tapToHear: "語を押すと、別の声でもう一度",
    replayAll: "もう一度流す",
    toTell: "聞き分けてみる",
    tellLead: "流れたのはどっち？",
    hearAgain: "もう一度聞く",
    next: "次へ",
    trialOf: (n: number, total: number) => `${n} / ${total}`,
    heardRight: "そう、こっち。",
    heardWrong: "こっちでした。両方を聞き比べてみて。",
    lineOf: (word: string) => `${word} の高さ`,
    revealTitle: "違いのこと",
    comesBack: "取り違えた組は、日をあけてまた降ってきます",
    toSentences: "文の中で聞く",
    toSay: "言ってみる",
    sentencesLead: "同じ語が、ふだんの文の中で流れます。どこにいるか、耳で探してみて。",
    showTranslation: "訳を見る",
    sayLead: "手本を聞いてから、言ってみて。声の高さが線になって、手本の線に重なります。",
    record: "言ってみる",
    recording: "聞いています…",
    analysing: "線を描いています…",
    yourLine: "あなたの声",
    modelLine: "手本",
    heard: "聞こえた語",
    hearUnavailable: "（何に聞こえたかは、いまは確かめられません）",
    through: "通じた",
    vowelNearer: (word: string) => `母音は「${word}」に近い`,
    vowelUndecided: "母音はどちらとも言えない",
    vowelNote: "u と ü は音声認識が取り違えやすいので、ここでは母音の響きを測っています。",
    asPartner: (word: string) => `（${word} に聞こえた）`,
    nearer: (word: string) => `線は「${word}」に近い`,
    undecided: "線はどちらとも言えない",
    noVoice: "声が拾えませんでした。もう少し近くで、はっきりと。",
    micDenied: "マイクが使えません。ブラウザの設定でマイクを許可してください。",
    micMissing: "この端末では録音できません。",
    nextRain: "次の雨",
    finishedToday: "今日はここまででも十分。また来たときに、続きが降ってきます。",
    splitNow: (name: string) => `このごろ、${name}が分かれて聞こえています。`,
  },

  me: {
    title: "自分",
    lead: "これまでに浴びた雨。ほかの人とは比べません。",
    rains: (n: number) => `${n} 回の雨`,
    empty: "まだ雨を浴びていません。",
    families: "違いごと",
    familyRains: (n: number) => `${n} 回`,
    splitSince: (date: string) => `${date} ごろから分かれて聞こえている`,
    returning: "また降ってくる組",
    never: "まだ",
    reset: "この端末の記録を消す",
    resetConfirm: "この端末に残っている記録をすべて消します。よろしいですか？",
    resetLinked: "記録を消す",
    resetLinkedConfirm: "この端末と、ことのあめのアカウントに残っている、ことのねの記録をすべて消します。よろしいですか？",
    account: "アカウント",
    linkLead: "ことのあめのアカウントでつなぐと、記録がアカウントに保存され、スマホでもパソコンでも続きから降ってきます。",
    link: "ことのあめのアカウントでつなぐ",
    linked: (email: string) => `${email} とつないでいます`,
    linkedLead: "記録はこの端末と、ことのあめのアカウントの両方に残ります。",
    unlink: "ログアウト",
  },

  login: {
    title: "ことのあめのアカウントでつなぐ",
    lead: "ことのあめと同じメールアドレスとパスワードで。つなぐと、ことのねの記録がアカウントに保存されます。",
    email: "メールアドレス",
    password: "パスワード",
    submit: "つなぐ",
    signingIn: "つないでいます…",
    noAccount: "アカウントを作るとき、パスワードを忘れたとき、Google だけで登録していてパスワードがないときは、",
    toKotonoame: "ことのあめで",
    already: (email: string) => `${email} とつないでいます。`,
    toApp: "続ける",
    signOut: "ログアウト",
    note: "つながなくても、すべての雨はこの端末で使えます。",
    errors: {
      credentials: "メールアドレスかパスワードが違います。",
      unconfirmed: "メールアドレスの確認がまだです。ことのあめから届いた確認メールのリンクを先に押してください。",
      busy: "試行が続いたため、少し待つ必要があります。1分ほどしてからもう一度。",
      failed: "つなげませんでした。電波のよいところで、少し待ってからもう一度。",
      unavailable: "いまはアカウントにつなげません。",
      google: "Google でつなげませんでした。メールアドレスとパスワードでお試しください。",
    },
  },

  families: {
    t14: { name: "1声と4声", hint: "1声は高いところで平らに伸ばす。4声は高いところから一気に下がる。" },
    t23: {
      name: "2声と3声",
      hint: "2声は低めから高く上がる。3声は低く沈む（語の終わりでは少し戻る）。いちばん取り違えやすい組。",
    },
    t12: { name: "1声と2声", hint: "1声は高いまま平ら。2声は低めから上がってくる。" },
    t34: { name: "3声と4声", hint: "3声は低く沈む。4声は高いところから落ちる。" },
    t24: { name: "2声と4声", hint: "2声は上がり、4声は下がる。線の向きが逆。" },
    t13: { name: "1声と3声", hint: "1声は高いところで平ら。3声は低いところに沈む。" },
    tw: {
      name: "2音節の声調",
      hint: "2つの音節の声調がどちらも違う組。3声が2つ続くと、前の3声は2声で言う（水饺 shuǐjiǎo は shuíjiǎo と聞こえる）。",
    },
    asp: {
      name: "息の強さ",
      hint: "p・t・k・q・ch・c は息を強く出す（有気音）。b・d・g・j・zh・z は息を出さない（無気音）。どちらも濁らない。日本語の濁る・濁らないとは別の違い。",
    },
    retro: { name: "舌をそらす音", hint: "zh・ch・sh は舌先を上にそらす（そり舌音）。z・c・s は舌先を前歯の裏に当てる。" },
    pal: {
      name: "j q x と zh ch sh",
      hint: "j・q・x は舌の前のほうを上あごに近づけ、口を横に引く。zh・ch・sh は舌先を上にそらす。",
    },
    nng: {
      name: "-n と -ng",
      hint: "-n は舌先を上の歯ぐきにつけて終わる（「案内」のン）。-ng は舌の奥を上げて鼻に抜く（「案外」のン）。",
    },
    uv: { name: "u と ü", hint: "ü は「イ」の舌のまま唇を丸める。u は唇を丸めて舌を奥に引く。" },
    rl: { name: "r と l", hint: "r は舌先を上にそらし、こすれる音を出す。l は舌先を上の歯ぐきにつける。" },
    fh: { name: "f と h", hint: "f は上の歯を下唇に軽く当てる。h はのどの奥でこする。日本語の「フ」はその間の音。" },
    ouuo: { name: "ou と uo", hint: "ou は「オ」から「ウ」へ。uo は「ウ」から「オ」へ。" },
  } satisfies Record<FamilyId, { name: string; hint: string }>,
};
