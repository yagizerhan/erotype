// SPDX-License-Identifier: AGPL-3.0-or-later
// Data-driven UI localization module

export type UiLang = "tr" | "en";

export const UI_STRINGS = {
  tr: {
    // Topbar
    soundLabel: "ses:",
    caretLabel: "imleç:",
    themeLabel: "tema:",
    soundOff: "kapalı",
    soundTypewriter: "daktilo",
    caretLine: "çizgi",
    caretBlock: "blok",
    caretUnderline: "alt",
    guestPlaceholder: "misafir adı",
    createRoom: "oda aç",
    soloMode: "tek kişilik",
    loginBtn: "Giriş",
    leaderboardBtn: "skor tablosu",
    uiLangTooltip: "Site arayüz dilini değiştir (TR / EN)",

    // Mode Bar
    punctuation: "@ noktalama",
    numbers: "# sayılar",
    modeTime: "süre",
    modeWords: "kelime",
    modeQuote: "alıntı",
    settingsTooltip: "Ayarlar",

    // Typing & Live Counter
    pbPrefix: "rekor:",
    restartBtn: "↻ yeniden başlat",
    restartShortcutHint: "Yeniden başlat (Tab + Enter)",
    nextTestBtn: "↻ sonraki test (tab + enter)",

    // Results Screen
    testFailedPrefix: "test başarısız",
    failMasterChar: "kusursuz mod: hata yapıldı",
    failMasterWord: "kusursuz mod: hatalı kelime",
    savedNewBest: "skor tablosuna yeni kişisel rekor olarak kaydedildi!",
    savedResult: "skor hesabına kaydedildi.",
    newBestBadge: "yeni rekor",
    accuracy: "doğruluk",
    modeStat: "mod",
    rawWpm: "ham wpm",
    consistency: "tutarlılık",
    characters: "karakter",
    charactersTooltip: "doğru / hatalı",
    durationStat: "süre",
    personalBestStat: "kişisel rekor",
    chartWpm: "wpm",
    chartRaw: "ham (raw)",
    chartErrors: "hata",
    chartSecSuffix: "sn",

    // Multiplayer Room
    connectingRoom: "odaya bağlanılıyor",
    backToHome: "ana sayfaya dön",
    roomWord: "oda",
    playersWord: "oyuncu",
    copyInvite: "davet linkini kopyala",
    copiedInvite: "link kopyalandı",
    addBot: "+ bot ekle",
    reconnecting: "bağlantı koptu, yeniden bağlanılıyor...",
    removeBots: "botları çıkar",
    startRace: "yarışı başlat",
    rematchBtn: "↻ tekrar oyna (tab + enter)",
    youSuffix: " (sen)",
    hostSuffix: " · host",
    lobbyNeedMore:
      "arkadaşlarını davet linkiyle çağır veya test etmek için '+ bot ekle' butonuna bas.",
    lobbyReadyHost: "oyuncular hazır! 'yarışı başlat' butonuna basabilirsin.",
    lobbyWaitingHost: "oda sahibinin yarışı başlatması bekleniyor...",
    raceStandings: "yarış sıralaması",
    yourRaceChart: "senin yarış hız grafiğin",

    // Leaderboard Modal
    leaderboardTitle: "skor tablosu",
    closeEsc: "kapat [esc]",
    loading: "yükleniyor...",
    emptyLeaderboard:
      "bu kategoride henüz kayıtlı skor yok. giriş yapıp ilk rekoru sen kır!",
    colPlayer: "oyuncu",
    colWpm: "wpm",
    colAcc: "doğruluk",

    // Settings Modal
    settingsTitle: "ayarlar",
    diffTitle: "zorluk / hata modu",
    diffDesc:
      "normal: silme tuşu ile önceki kelimeye dönüp hatayı düzeltebilirsin · uzman: geçilen kelimeye geri dönülemez (test bitmez) · kusursuz: ilk yanlış harfte biter",
    diffNormal: "normal",
    diffExpert: "uzman",
    diffMaster: "kusursuz",
    liveWpmTitle: "yazarken canlı wpm göster",
    liveWpmDesc:
      "yazım sırasında sağ üstte anlık hız ve doğruluk oranını gösterir (varsayılan kapalı)",
    offLabel: "kapalı",
    onLabel: "açık",
    blindModeTitle: "kör mod (blind mode)",
    blindModeDesc:
      "yazarken hataları kırmızı göstermez ve hata sesi çalmaz; sonucu test sonunda görürsün",
    quickTabTitle: "hızlı yeniden başlat (tek tab)",
    quickTabDesc:
      "açıkken tab tuşuna basmak odaklamak yerine testi anında yeniden başlatır",
    fontSizeTitle: "yazı boyutu",
    fontSizeDesc: "yazma alanındaki kelimelerin büyüklüğü",
    fontSm: "küçük",
    fontMd: "orta",
    fontLg: "büyük",
    volumeTitle: "tuş ses seviyesi",
    volumeDesc: "mekanik klavye ve hata seslerinin yüksekliği",

    // Auth & Account Customization Modal
    profileTitle: "hesap & profil",
    loginModalTitle: "Giriş",
    tabSignIn: "giriş yap",
    tabSignUp: "kayıt ol",
    namePlaceholder: "ad soyad / görünen ad",
    emailPlaceholder: "e-posta adresi",
    passwordPlaceholder: "şifre (en az 8 karakter)",
    rememberMe: "beni hatırla",
    pleaseWait: "lütfen bekleyin...",
    createAccountBtn: "hesap oluştur",
    orSocialLogin: "veya sosyal hesap ile bağlan",
    githubLoginTitle: "GitHub ile giriş yap",
    googleLoginTitle: "Google ile giriş yap",
    customizeAccountHeading: "hesap kişiselleştirme",
    fullNameLabel: "tam isim (ad soyad)",
    usernameLabel: "kullanıcı adı (@handle)",
    photoLabel: "profil fotoğrafı",
    uploadPhotoBtn: "fotoğraf seç",
    removePhotoBtn: "kaldır",
    photoHint: "JPG, PNG veya WebP (otomatik 128×128 boyutlandırılır)",
    saveProfileBtn: "değişiklikleri kaydet",
    savingProfile: "kaydediliyor...",
    profileSavedMsg: "profil ve hesap bilgileri güncellendi.",
    signOutBtn: "çıkış yap",
    deleteAccountTitle: "hesabı sil",
    deleteAccountWarn: "Hesabınız, profiliniz, tüm test sonuçlarınız ve rekorlarınız kalıcı olarak silinir. Bu işlem geri alınamaz.",
    deleteAccountConfirmLabel: "Onaylamak için kullanıcı adınızı yazın",
    deleteAccountBtn: "hesabımı kalıcı olarak sil",
    deletingAccount: "siliniyor...",
    deleteAccountFailed: "Hesap silinemedi.",
    editProfileBtn: "profili düzenle",
    viewPublicProfileBtn: "profil önizlemesi",
    bioLabel: "kısa biyografi / klavye bilgisi",
    bioPlaceholder: "ör. mekanik klavye · türkçe q",
    joinedPrefix: "katılım:",
    shareProfileBtn: "profil linkini kopyala",
    sharedProfileMsg: "profil linki kopyalandı",
    backToLeaderboard: "← skor tablosuna dön",
    clickToViewProfile: "profili görüntülemek için tıkla",
    userNotFound: "kullanıcı profili bulunamadı.",
    statTests: "tamamlanan test",
    statRaces: "çok oyunculu yarış",
    statRacesWon: "kazanılan",
    statBestWpm: "en yüksek wpm",
    statAvgAcc: "ort. doğruluk",
    pbSectionTitle: "kişisel rekorlar (sunucu onaylı)",
    noServerPb: "henüz kaydedilmiş sunucu rekoru yok.",
    recentTestsTitle: "son testler",

    // Footer & Legal Modal
    footerRestartHint: "tab + enter: yeniden başlat",
    footerPrivacy: "gizlilik politikası",
    footerSecurity: "güvenlik politikası",
    footerLicense: "agpl-3.0 açık kaynak & hukuk",
    legalModalTitle: "hukuki bildirimler, gizlilik ve güvenlik",
    legalTabPrivacy: "gizlilik politikası",
    legalTabSecurity: "güvenlik politikası",
    legalTabLicense: "lisans & kullanım koşulları",

    // Theme & Sound Picker
    pickerTitle: "görünüm ve ses galerisi",
    pickerThemesTab: "temalar",
    pickerSoundsTab: "sesler",
    pickerSearchPlaceholder: "tema veya ses ara...",
    pickerActiveBadge: "seçili",
    pickerTestSound: "sesi çal",
    pickerThemesCount: "tema mevcut",
    pickerSoundsCount: "ses profili mevcut"
  },
  en: {
    // Topbar
    soundLabel: "sound:",
    caretLabel: "caret:",
    themeLabel: "theme:",
    soundOff: "off",
    soundTypewriter: "typewriter",
    caretLine: "line",
    caretBlock: "block",
    caretUnderline: "underline",
    guestPlaceholder: "guest name",
    createRoom: "create room",
    soloMode: "solo practice",
    loginBtn: "Sign In",
    leaderboardBtn: "leaderboard",
    uiLangTooltip: "Switch site interface language (TR / EN)",

    // Mode Bar
    punctuation: "@ punctuation",
    numbers: "# numbers",
    modeTime: "time",
    modeWords: "words",
    modeQuote: "quote",
    settingsTooltip: "Settings",

    // Typing & Live Counter
    pbPrefix: "best:",
    restartBtn: "↻ restart test",
    restartShortcutHint: "Restart test (Tab + Enter)",
    nextTestBtn: "↻ next test (tab + enter)",

    // Results Screen
    testFailedPrefix: "test failed",
    failMasterChar: "master mode: mistake made",
    failMasterWord: "master mode: incorrect word",
    savedNewBest: "saved to leaderboard as a new personal best!",
    savedResult: "score saved to your account.",
    newBestBadge: "new best",
    accuracy: "accuracy",
    modeStat: "mode",
    rawWpm: "raw wpm",
    consistency: "consistency",
    characters: "characters",
    charactersTooltip: "correct / errors",
    durationStat: "time",
    personalBestStat: "personal best",
    chartWpm: "wpm",
    chartRaw: "raw",
    chartErrors: "errors",
    chartSecSuffix: "s",

    // Multiplayer Room
    connectingRoom: "connecting to room",
    backToHome: "back to home",
    roomWord: "room",
    playersWord: "players",
    copyInvite: "copy invite link",
    copiedInvite: "link copied",
    addBot: "+ add bot",
    reconnecting: "connection lost, reconnecting...",
    removeBots: "remove bots",
    startRace: "start race",
    rematchBtn: "↻ play again (tab + enter)",
    youSuffix: " (you)",
    hostSuffix: " · host",
    lobbyNeedMore:
      "invite friends with the room link or click '+ add bot' to practice.",
    lobbyReadyHost: "players ready! click 'start race' to begin.",
    lobbyWaitingHost: "waiting for the room host to start the race...",
    raceStandings: "race standings",
    yourRaceChart: "your race speed chart",

    // Leaderboard Modal
    leaderboardTitle: "leaderboard",
    closeEsc: "close [esc]",
    loading: "loading...",
    emptyLeaderboard:
      "no scores recorded in this category yet. sign in and set the first record!",
    colPlayer: "player",
    colWpm: "wpm",
    colAcc: "accuracy",

    // Settings Modal
    settingsTitle: "settings",
    diffTitle: "difficulty / error mode",
    diffDesc:
      "normal: press backspace to return to previous word and fix mistakes · expert: passed words are locked (test continues) · master: fails on first wrong key",
    diffNormal: "normal",
    diffExpert: "expert",
    diffMaster: "master",
    liveWpmTitle: "show live wpm while typing",
    liveWpmDesc:
      "displays live speed and accuracy above the words while typing (off by default)",
    offLabel: "off",
    onLabel: "on",
    blindModeTitle: "blind mode",
    blindModeDesc:
      "hides red error highlights and error sounds while typing; see accuracy at the end",
    quickTabTitle: "quick restart (single tab)",
    quickTabDesc:
      "when enabled, pressing tab immediately restarts the test instead of focusing the button",
    fontSizeTitle: "font size",
    fontSizeDesc: "size of the words in the typing viewport",
    fontSm: "small",
    fontMd: "medium",
    fontLg: "large",
    volumeTitle: "key sound volume",
    volumeDesc: "volume of mechanical key switches and error sounds",

    // Auth & Account Customization Modal
    profileTitle: "account & profile",
    loginModalTitle: "Sign In",
    tabSignIn: "sign in",
    tabSignUp: "sign up",
    namePlaceholder: "full name / display name",
    emailPlaceholder: "email address",
    passwordPlaceholder: "password (min 8 characters)",
    rememberMe: "remember me",
    pleaseWait: "please wait...",
    createAccountBtn: "create account",
    orSocialLogin: "or connect with",
    githubLoginTitle: "Sign in with GitHub",
    googleLoginTitle: "Sign in with Google",
    customizeAccountHeading: "account customization",
    fullNameLabel: "full name",
    usernameLabel: "username (@handle)",
    photoLabel: "profile photo",
    uploadPhotoBtn: "choose photo",
    removePhotoBtn: "remove",
    photoHint: "JPG, PNG or WebP (auto-resized to 128×128)",
    saveProfileBtn: "save changes",
    savingProfile: "saving...",
    profileSavedMsg: "profile and account settings updated.",
    signOutBtn: "sign out",
    deleteAccountTitle: "delete account",
    deleteAccountWarn: "Your account, profile, all test results and personal bests will be permanently deleted. This cannot be undone.",
    deleteAccountConfirmLabel: "Type your username to confirm",
    deleteAccountBtn: "permanently delete my account",
    deletingAccount: "deleting...",
    deleteAccountFailed: "Could not delete account.",
    editProfileBtn: "edit profile",
    viewPublicProfileBtn: "profile preview",
    bioLabel: "short bio / keyboard setup",
    bioPlaceholder: "e.g. custom tkl · tactile switches",
    joinedPrefix: "joined:",
    shareProfileBtn: "copy profile link",
    sharedProfileMsg: "profile link copied",
    backToLeaderboard: "← back to leaderboard",
    clickToViewProfile: "click to view player profile",
    userNotFound: "user profile not found.",
    statTests: "tests completed",
    statRaces: "multiplayer races",
    statRacesWon: "won",
    statBestWpm: "highest wpm",
    statAvgAcc: "avg accuracy",
    pbSectionTitle: "personal bests (server verified)",
    noServerPb: "no server-verified personal bests yet.",
    recentTestsTitle: "recent tests",

    // Footer & Legal Modal
    footerRestartHint: "tab + enter: restart test",
    footerPrivacy: "privacy policy",
    footerSecurity: "security policy",
    footerLicense: "agpl-3.0 open source & legal",
    legalModalTitle: "legal notices, privacy & security",
    legalTabPrivacy: "privacy policy",
    legalTabSecurity: "security policy",
    legalTabLicense: "license & terms",

    // Theme & Sound Picker
    pickerTitle: "appearance & audio gallery",
    pickerThemesTab: "themes",
    pickerSoundsTab: "sounds",
    pickerSearchPlaceholder: "search themes or sounds...",
    pickerActiveBadge: "active",
    pickerTestSound: "play sample",
    pickerThemesCount: "themes available",
    pickerSoundsCount: "sound profiles available"
  }
} as const;

export type UiDictionary = (typeof UI_STRINGS)[UiLang];

export function getInitialUiLang(): UiLang {
  try {
    const saved =
      localStorage.getItem("erotype_ui_lang") ||
      localStorage.getItem("erotype_ui_lang");
    if (saved === "tr" || saved === "en") return saved;
  } catch {
    // ignore
  }
  return "tr";
}
