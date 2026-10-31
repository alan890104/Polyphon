# Polyphon

**用程式碼寫音樂，在瀏覽器裡演奏。** 一套記譜語法、一支 120 種樂器的合成樂團，加上一個排程器，全部建立在 Web Audio API 上。沒有任何音檔：每個音都是在瀏覽器裡算出來的。

[English](README.md)

```ts
import { Jukebox, bassline, chords, defineSong, melody, pad, rhythm } from 'polyphon';

const harmony = chords('C | Am | F | G');

const theme = defineSong({
  title: 'Morning Market',
  bpm: 112,
  tracks: [
    { instrument: 'marimba', part: 'E5:2 G5:2 C6:4 B5:2 G5:2 E5:4 | A5:4 G5:2 E5:2 C5:8 | F5:2 A5:2 C6:4 A5:2 F5:2 D5:4 | G5:6 F5:2 E5:4 D5:4 |' },
    { instrument: 'strPad', part: pad(harmony, { center: 'C4', velocity: 0.4 }), gain: 0.6 },
    { instrument: 'pizzBass', part: bassline(harmony, 'x...x.x.x...x.x.', '1 5 8 5') },
    { instrument: 'kick', part: rhythm('X.......x.......') },
  ],
});

const music = new Jukebox();
music.play(theme); // 瀏覽器要求使用者互動時，會在第一次點擊或按鍵時開始
```

Polyphon 源自生物對戰 RPG [Eldor（艾爾多）](https://github.com/alan890104/eldor) 的音樂引擎。

## 聆聽

所有範例都由 Polyphon 自己算出來（沒有任何錄音）：

| 曲目 | 內容 | |
| --- | --- | --- |
| Morning Market | 原創，C 大調的市集小曲：馬林巴主旋律，撥奏低音、沙鈴與輕柔的弦樂 | [▶ 0:24](docs/audio/morning-market.mp3) |
| Night Waltz | 原創，A 小調圓舞曲：鋼琴配豎琴琶音、弦樂墊音與大提琴 | [▶ 0:20](docs/audio/night-waltz.mp3) |
| After Midnight | 原創，B 小調鋼琴抒情曲，慢速 R&B 律動，加上弦樂與小提琴 | [▶ 1:42](docs/audio/after-midnight.mp3) |
| Neon Tide | 原創，F 小調前衛浩室：推升、抽吸的 supersaw drop、鋼琴間奏、最終 drop | [▶ 2:35](docs/audio/neon-tide.mp3) |
| Moonlight Sonata | 貝多芬《月光》第一樂章開頭，用建模鋼琴演奏 | [▶ 0:43](docs/audio/moonlight.mp3) |
| Canon in D | 帕海貝爾《卡農》全曲：三把小提琴輪唱，大提琴反覆低音 | [▶ 4:08](docs/audio/canon.mp3) |
| Canon in D Minor | 同一首卡農移到 D 小調，以原曲轉換而成 | [▶ 4:08](docs/audio/canon-minor.mp3) |
| Symphony No. 5 | 貝多芬《第五號交響曲》第一樂章呈示部，完整管弦樂團 | [▶ 1:19](docs/audio/symphony5.mp3) |
| Carmen: Prelude | 比才《卡門》第一幕前奏曲全曲，完整管弦樂團：鬥牛士進場、鬥牛士之歌、命運動機 | [▶ 3:36](docs/audio/carmen.mp3) |

## 它能做什麼

- **讀起來像樂譜的記譜法。** 旋律是短字串（`'E5:4 D5:2 C5:2 |'`），鼓是格子（`'X...x...'`），和聲是和弦記號（`'Am7 | D7 | Gmaj7'`）。墊音、琶音、低音線、刷弦都從和弦進行長出來。所有東西都是純資料，你也可以自己產生音符。
- **沒有取樣的樂團。** 鋼琴和撥弦用物理模型，弓弦樂一位一位演奏者分開算，管樂、銅管、合唱、合成器即時合成。取樣型樂器的每個音只算一次並快取，播放時幾乎不耗 CPU。
- **給遊戲用的點唱機。** 換曲淡入淡出、預先準備、暫停／繼續／跳轉、在音效下壓低音樂、前奏接循環，並自動處理瀏覽器的音訊解鎖。
- **匯入與匯出。** `songFromMidi` 讀標準 MIDI 檔，`transcribe` 把哼唱的旋律寫成樂譜；`renderSong` 加 `encodeWav` 把任何曲子輸出成 WAV。
- **音樂鑑賞室。** `npm run dev` 打開播放器，收錄所有範例，附分軌混音台；每首歌都依自己的音符畫成一張打孔圓盤（就像 polyphon 音樂盒的圓盤），播放時跟著轉動。

## 安裝

```bash
npm install github:alan890104/polyphon
```

內含 TypeScript 型別，沒有任何執行期相依套件。

## 寫音樂

時間以 **step** 計：一個 step 是一個十六分音符，四分音符是 4，4/4 拍一小節是 16。

### 旋律

```ts
melody('E5:4 D5:2 C5:2 | B4:8 r:8 |')
```

| 寫法 | 意思 |
| --- | --- |
| `E5:4` | E5，長 4 個 step（四分音符） |
| `E5 D5` | 省略長度就沿用上一個 |
| `r:8` 或 `.` | 休止 |
| `R` | 整小節休止 |
| `\|` | 小節線：會檢查每小節長度，寫錯會直接報出是第幾小節 |
| `C4+E4+G4:16` | 和弦 |
| `!E5` / `?E5` | 重音／輕音 |
| `E5:4>` | 滑音到下一個音（支援滑音的樂器） |
| `G4:8~ \| G4:4` | 連結線：同一個音跨過小節線延續 |
| `E5:4/3` | 分數長度：三連音八分音符是 `4/3` |
| `(E5:2 D5:2)*4` | 重複一組 |

其他拍號傳入拍號即可：`melody('G4:6 A4:2 B4:4 |', '3/4')`。旋律字串也可以直接當軌道的 `part`，會用曲子的拍號解讀。

### 節奏

```ts
rhythm('X...x...X..xx...')             // X 重音、x 一般、o 輕、. 或 - 休止
rhythm('x.x.x.x.', { pitch: 'G2' })    // 每一下都打同一個音高
rhythm('x.x.', { step: 2 })            // 每個字元 2 個 step
```

### 和聲

```ts
const harmony = chords('Am | F | C G | E7');   // 同一小節的和弦平分時間
chords('Dm:12 A7:4 | %');                      // 明確寫長度；% 表示上一個和弦再延一小節
```

支援的和弦：大三、`m`、`dim`、`aug`、`sus2`、`sus4`、`5`、`6`、`m6`、`7`、`maj7`、`m7`、`mmaj7`、`m7b5`、`dim7`、`7sus4`、`add9`、`madd9`、`9`、`maj9`、`m9`、`7b9`、`7#9`、`m11`、`11`、`maj7s11`、`6/9`、`q` 與 `q4`（四度疊置），以及斜線低音（`C/E`）。

從和弦進行產生聲部：

| 函式 | 產生 |
| --- | --- |
| `pad(harmony, { center, size, velocity, gap })` | 長音和弦，聲部會挑移動最少的轉位 |
| `arpeggio(harmony, '0 1 2 1', { step, center, size, velocity, accent })` | 分解和弦：數字從下往上選和弦音（超過就升八度），`.` 休止，`-` 延長 |
| `bassline(harmony, 'x...x.x.', '1 5 8 5', { register, velocity })` | 低音線：節奏每小節循環，級數依序使用（`1 3 5 8 -8 b7 7 2 4 6 b2 -5 -4`） |
| `roots(harmony, { register, fifth, velocity })` | 每個和弦一個長低音，可疊空五度 |
| `strum(harmony, 'x.x-', { center, size, spread, velocity })` | 刷弦 |

`center` 和 `register` 可以寫音名（`'C4'`）或 MIDI 數字。

### 組合聲部

| 函式 | 作用 |
| --- | --- |
| `sequence(a, b, ...)` | 一段接一段（字串視為 4/4 旋律） |
| `stack(a, b, ...)` | 同時發聲 |
| `repeat(part, n)` | 連續 n 次 |
| `rest(bars, meter?)` | 休止幾小節 |
| `transpose(part, semitones)` | 移調 |
| `mapPitch(part, fn)` | 改寫音高（例如 `remapToMode` 換調式） |
| `scaleVelocity(part, factor)` | 整體變大聲或變小聲 |
| `slice(part, from, to)` | 切出一段 step 範圍 |
| `pedal(part, changes)` | 延音踏板：音會一直響到下一次換踩（每 n 個 step、指定的 step 清單，或跟著和弦進行換），或同一個鍵再被敲下 |

樂理工具：`midi('C#4')`、`frequency('A4')`、`noteName(61)`、`parseChord('F#m7b5')`、`voiceChord`、`scaleDegree('D4', 'dorian', 2)`、`remapToMode`、`romanChord('iv7', 'D4', 'aeolian')`，以及 `MODES`（從 ionian 到 locrian、和聲與旋律小調、弗里吉亞屬調、匈牙利小調、雙和聲、五聲音階、全音、八聲音階等）。

### 曲子

```ts
defineSong({
  title: 'Night Waltz',
  description: 'A 小調，3/4',
  bpm: 84,                   // 開頭的速度
  tempo: [{ bar: 33, bpm: 72, over: 4 }],  // 速度變化，見下方
  meter: '3/4',              // 預設 '4/4'
  swing: 0,                  // 八分音符搖擺 0-0.5；十六分音符用 swing16
  reverb: { size: 2.6, damp: 0.5, preDelay: 0.02, early: 0.3, mix: 1 },
  delay: { steps: 3, feedback: 0.3, tone: 2800, mix: 0.8 },  // 跟速度同步的左右乒乓延遲
  gain: 1,
  master: { warm: 2, cut: 1, trim: -1 },  // 母帶等化（dB）；glue 與 loud 見下方
  intro: [/* 只播一次的軌道 */],
  tracks: [/* 循環的軌道 */],
  loop: true,                // false：只播一次（短曲、號角）
});
```

一個段落的長度等於最長的軌道（補足整小節），較短的軌道會重複填滿，除非設 `repeat: false`。

速度可以在曲中改變，可以突然換，也可以逐漸變快變慢。小節從整首歌的開頭算起（前奏的小節在前），循環的主體每一輪都會重新走一次這些變化。

```ts
tempo: [
  { bar: 17, bpm: 66 },           // 從第 17 小節起換成新速度
  { bar: 29, bpm: 50, over: 4 },  // 漸慢：第 29 到 32 小節逐漸慢到 50
  { bar: 33, bpm: 84 },           // 回原速
  { bar: 40.5, bpm: 40 },         // 第 40 小節的後半放慢撐長：延長記號
  { bar: 41, bpm: 84 },
]
```

`tempoClock(song)` 可以把樂譜上的位置換算成秒數（也能反過來），給任何需要跟著音樂走的東西使用。

軌道欄位：

| 欄位 | 預設 | |
| --- | --- | --- |
| `instrument` | | 內建樂器名稱（編輯器會自動補全）或自己註冊的名稱 |
| `part` | | 一個 part，或一段旋律字串 |
| `name` | 樂器名稱 | 混音台上顯示的名字 |
| `gain` | 1 | 音量 |
| `pan` | 0 | -1 左到 1 右 |
| `reverb` | 0.25 | 送到殘響的量 |
| `delay` | 0 | 送到延遲的量 |
| `duck` | | 跟著另一軌的敲擊下沉：那一軌的名字（`'Kick'`），或 `{ by, depth, release }` |
| `lowpass` | | 低通截止頻率（Hz），或掃頻 `{ step: Hz }` |
| `highpass` | | 高通截止頻率（Hz），或掃頻 |
| `transpose` | 0 | 半音 |
| `humanize` | 0.008 秒（鼓 0.003） | 時間上的人味 |
| `params` | | 樂器參數：`attack`、`release`、`bright`、`glide`、`ring`、`tune` 等 |
| `repeat` | true | 重複填滿段落 |

### 電子音樂的混音

```ts
const harmony = chords('Fm | Db | Ab | Eb');

defineSong({
  title: 'Drop',
  bpm: 128,
  master: { glue: 0.5, loud: 8 },
  tracks: [
    { name: 'Kick', instrument: 'bigKick', part: rhythm('X...'.repeat(64), { pitch: 'F1' }) },
    { name: 'Chords', instrument: 'supersaw', part: pad(harmony, { center: 'Ab4' }), duck: 'Kick' },
    { name: 'Sub', instrument: 'sub', part: roots(harmony, { register: 'F1' }), duck: { by: 'Kick', depth: 0.9 } },
    { name: 'Pluck', instrument: 'pluck', part: arpeggio(harmony, '0 1 2 3', { center: 'C5' }), lowpass: { 0: 400, 128: 400, 256: 18000 } },
  ],
});
```

- **側鏈抽吸。** `duck: 'Kick'` 讓這一軌在同一段落裡名為 Kick 的那一軌每敲一下就往下沉，再慢慢回升：也就是 house 與 EDM 那種「抽吸」的律動。`depth` 是下沉多深（0-1，預設 0.7），`release` 是幾個 step 回到原音量（預設 4，一拍）。它跟著音符走而不是跟著聲音，所以跳轉和循環時都準確，大鼓靜音或 `gain: 0` 時也照樣會抽吸。
- **濾波掃頻。** `lowpass` 與 `highpass` 接受一個截止頻率（Hz），或從段落開頭算起的轉折點 `{ step: Hz }`。截止頻率在轉折點之間依音高均勻滑動，第一個之前與最後一個之後維持不變，所以上面的撥音前八小節是暗的，接下來八小節逐漸打開。每次循環都會重新掃一次。
- **母帶。** `glue`（0-1）是讓整體混音黏在一起的匯流排壓縮。`loud` 把歌曲做成大聲的母帶：推進磚牆限幅器的 dB 數，連取樣點之間的峰值都壓在 -1 dBFS 以下（EDM 大約 6 到 10）。設了 `loud` 的歌會跳過其他歌共用的溫和限幅器，不會被壓縮兩次。

## 播放

```ts
const music = new Jukebox({
  songs: {                                       // 可選：用名稱播放的曲目
    town: () => import('./music/town.ts'),       // 第一次用到時才載入、準備
    battle: battleSong,
  },
  volume: 0.8,
});

music.play('town');                       // 從正在播的曲子淡入淡出切過來
music.preload('battle');                  // 先把樣本算好
await music.play('battle', { fadeOut: 0.5, fadeIn: 0.05 });
music.duck(-10);                          // 大音效時壓低 10 dB，0.35 秒後回來
music.duck(-30, { attack: 0.12, hold: 4, release: 0.6 });
music.pause();
music.resume();
music.seek(30);
music.playOnce(victoryJingle);            // 疊在上面播
music.stop();
```

`play` 在曲子開始時回傳 `Playback`；如果在準備好之前又要求了別首，則回傳 `null`（`music.playback` 是目前這一個）。`Playback` 提供 `position()`、`duration`、`introDuration`、`loopDuration`；它的 `tracks` 可以逐軌靜音（`track.muted = true`），並提供 `output` 節點接音量表；有結尾的曲子播完時 `finished` 會 resolve。`play` 傳入 `{ loops: n }` 可以在播完 n 輪後結束。

Jukebox 會在第一次使用時建立 `AudioContext`，並在第一次點擊、觸控或按鍵時啟動。要跟音效共用同一個 context，傳入 `context` 和 `destination` 即可。

## 樂器

| 類別 | 樂器 |
| --- | --- |
| 鍵盤 | `piano` `softPiano` `epiano` `revPiano` `organ` `organFull` `accordion` |
| 撥弦 | `harp` `nylon` `steel` `lute` `dulcimer` `pizz` `pizzBass` |
| 敲擊旋律與鐘 | `kalimba` `marimba` `vibes` `glock` `celesta` `musicbox` `bell` `chime` `steelpan` |
| 弓弦 | `strings` `strPad` `violin` `cello` `celli` `contrabass` `fiddle` `morin` `spicc` |
| 木管 | `flute` `panflute` `ocarina` `whistle` `clarinet` `oboe` `bassoon` `sax` `tenorSax` |
| 銅管 | `horn` `horns` `trumpet` `trumpets` `trombone` `tuba` `brassStab` |
| 人聲 | `choir` `choirOo` `choirO` `menChoir` `chant` `soprano` `throat` |
| 墊音與持續音 | `warmPad` `glassPad` `darkPad` `airPad` `glass` `drone` |
| 合成器與吉他 | `supersaw` `synthLead` `pluck` `powerGtr` `muteGtr` |
| 低音 | `bass` `synthBass` `reese` `acid` `bass808` `sub` `distBass` |
| 鼓 | `kick` `boom` `snare` `field` `rim` `clap` `hat` `ohat` `ride` `crash` `swell` `tom` `taiko` `timpani` `frame` `darbuka` |
| 電子鼓 | `kick808` `kick909` `bigKick` `snare909` `clap909` `hat909` `ohat909` |
| 打擊 | `shaker` `tamb` `woodblock` `clave` `anvil` `triangle` `gong` `chain` `snap` `brush` `drip` `thunder` `thunderclap` |
| 環境音與效果 | `wind` `sea` `fire` `crickets` `rain` `void` `cave` `birds` `riser` `downlifter` `impact` |

它們是怎麼做的：

- **鋼琴**：每根弦（每個音一到三根，彼此微微走音）都用 modal synthesis 計算，包含非諧和性、擴展調律、兩段式衰減、隨頻率增加的弦損耗；槌子的毛氈會把高音的上方泛音修圓；其他弦的共鳴；響板、制音器的聲音與放鍵後的微弱餘韻；隨力度變化的明亮度；以及從低音到高音左右展開的立體聲。
- **撥弦**：Karplus-Strong，以符合物理的撥弦波形激發（第 n 個泛音 ∝ sin(nπ·撥弦位置)/n），弦損耗隨頻率增加，用 allpass 精準調音，再加上琴身共鳴（吉他、魯特琴、豎琴、揚琴、小提琴）；低音撥弦用加法合成。
- **弓弦**：聲部裡每位演奏者分開算，各自有音準、顫音、運弓點和弓毛雜音，再通過上百個共鳴的琴身（依真實小提琴、大提琴、低音提琴的錄音擬合），讓顫音帶動高頻泛音閃動。弓弦波形的圓角落在固定的泛音次數，所以低音弦比高音弦暗。持續段可以無縫循環；跳弓在弓彈離後讓弦自然餘響。
- **敲擊旋律與鐘**：依真實琴鍵、簧片與管鐘的分音比例做 modal synthesis（教堂鐘有 hum、prime、tierce、quint、nominal；管鐘的音高是由約 2 : 3 : 4 的分音聽出來的），琴槌的接觸時間會讓高音的泛音變圓潤。
- **管樂與銅管**：把嘴唇、簧片或氣流建模成一個閥門（正弦波通過非線性曲線），所以音色會像真的樂器一樣隨力度變亮：小聲的小號柔和、大聲的嘹亮，單簧管低音區以奇次泛音為主，薩克斯風吹得用力時會帶點沙啞。管身與喇叭口用濾波器和共振峰表現；聲部裡的每位演奏者進來的時間差幾毫秒、音準差幾音分。
- **人聲**：共振峰（合唱真的在唱母音）、氣音和每個音各自的顫音。
- **鼓**：鼓皮用圓形薄膜的振動模態計算，敲擊後音高會從略高處滑落，並帶有鼓棒或鼓槌的撞擊聲；定音鼓的音高來自鼓腔內空氣把模態推成約 1 : 1.5 : 2 : 2.5 : 3；鈸的「刷」聲在敲擊後由低往高擴散，高頻先消失；敲得越輕越暗；每種鼓有隨機變體，連打不會像機關槍。
- **合成器**：類比減法合成。振盪器自由運轉（每個音從波形的隨機位置開始，音準偏差一兩音分），送進四極低通濾波器（24 dB/oct，像電晶體梯形濾波器），截止頻率跟著音高走，濾波包絡彈得越用力開得越大。`supersaw` 依 Adam Szabo 對 Roland JP-8000 的量測重現（七個鋸齒波，照原機的走音與混音曲線，並在基頻處高通）；`synthLead` 是 Minimoog 風格的主奏，`pluck` 是 trance 琶音的撥音，`warmPad` 與 `darkPad` 是 Juno 風格帶合唱效果的墊音。`acid` 是 TB-303（`!` 重音、`>` 滑音），`reese` 是翻滾的走音低音，`bass808` 是會滑音的 808；低音在 120 Hz 以下都維持單聲道。`cut`、`q`、`env`、`detune`、`attack`、`release`、`glide` 可以調整每種音色。
- **電子鼓**：依 Roland 鼓機建模，並對照錄音擬合。808 大鼓是橋式 T 型共振器，敲擊瞬間音高會短暫上揚；909 大鼓是帶快速音高包絡與雜訊敲擊聲的振盪器；拍手是相隔約 11 毫秒的三次雜訊加上一段殘響尾巴；909 腳踏鈸和原機的記憶體一樣是 6 位元，閉合的腳踏鈸會切斷還在響的開放腳踏鈸。`bigKick` 是現代分層的 EDM 大鼓：音高急墜的衝擊、削波的超低音和高頻敲擊聲。給大鼓一個音高就能配合歌曲調音（`rhythm('X...X...X...X...', { pitch: 'F1' })`）；`riser` 與 `downlifter` 的長度等於音符長度，所以 `melody('C4:128')` 就是八小節的推升。
- **空間**：每首歌有自己程式產生的捲積殘響。

自訂樂器：

```ts
registerInstrument('beep', {
  play({ context, destination, time, duration, frequency, velocity }) {
    const osc = new OscillatorNode(context, { type: 'square', frequency });
    const amp = new GainNode(context, { gain: velocity * 0.2 });
    osc.connect(amp).connect(destination);
    osc.start(time);
    osc.stop(time + duration);
  },
});

registerInstrument('myBell', {
  render: (sampleRate, midi) => renderBell(sampleRate, midi), // 回傳 Float32Array，每個音高只算一次
  sustain: 'ring',
});
```

## MIDI、音檔與哼唱

```ts
const song = songFromMidi(await file.arrayBuffer(), { title: file.name });
music.play(song);
```

`songFromMidi` 會讓音符留在檔案的拍子格線上，速度變化則成為歌曲本身的速度變化，並讀取拍號、延音踏板、音量與聲像。General MIDI 音色會對應到樂團裡的樂器，第 10 頻道對應到鼓組。

```ts
const buffer = await renderSong(song, { loops: 1 });  // OfflineAudioContext，比即時快
const wav = encodeWav(buffer);                        // 16-bit PCM
```

WAV 是無損的，但檔案很大，每分鐘約 10 MB。要 MP3（大約七分之一大）就把 buffer 交給 MP3 編碼器；鑑賞室是在 worker 裡用 [lamejs](https://github.com/zhuker/lamejs) 編碼（`player/src/mp3.ts`），所以函式庫本身不需要任何編碼器。

一次唱一個音的旋律（哼唱或歌唱）可以寫成樂譜。`PitchTracker` 隨著聲音進來追蹤音高，來源可以是麥克風或音檔；`transcribe` 再把聽到的內容放到拍子格線上：

```ts
const tracker = new PitchTracker(audio.sampleRate);
tracker.push(audio.getChannelData(0));
const { melody, bpm, key } = transcribe(tracker.frames);
// 'r:12 Bb4:4 | Bb4:3 C5 D5:2 D5:8 | A4:12 G4:4 | ...', 96.8, 'G minor'
```

這不需要訓練過的模型：人聲的音高就藏在聲音本身的週期裡。唱得整體偏高、偏低或越唱越偏，都會被跟上；落在兩個半音中間的音，會選調內的那一個。跟著節拍器唱時（`{ bpm, start }`：它的速度和第一小節從哪裡開始），音符會落在節拍器的拍子上；沒有節拍器時，速度和強拍位置會從音符本身推算出來。音高改變、聲音停了再出來，或同一個音重新發出，都算新的一個音；只有明顯的停頓才會寫成休止符。`formatMelody` 能把任何單聲部的段落寫回旋律字串，並依調號拼寫升降記號。

## 音樂鑑賞室

```bash
npm install
npm run dev
```

播放器收錄所有範例（貝多芬《月光》與《第五號交響曲》、帕海貝爾《D 大調卡農》與移到 D 小調的同一首卡農，以及幾首短曲），有可以靜音或獨奏各軌的混音台、MP3 與 WAV 下載和 MIDI 匯入。每首歌的封面就是它的樂譜：音符打成圓盤上的孔，角度是時間、半徑是音高，主旋律是黃銅色。播放時圓盤在簧片梳下轉動，孔經過時會亮起來。

按 **F**（或視覺化按鈕）進入沉浸模式：全螢幕，聆聽時控制列會自動淡出。可以選擇樣式（預設是一台 3D 的圓盤音樂盒：你聽到每個音的同時，它的孔正好撥動簧片，盒裡的燈把正在響的音投到盒蓋上；另有被頻譜環繞的轉動圓盤、落到鋼琴鍵盤上的音符、頻譜、波形、山脊圖、粒子）、背景（墨色、這首歌的圓盤、極光、星空或你自己的圖片；音樂盒有自己的房間）和配色主題，設定會被記住。音樂盒、落下的音符和圓盤都直接照樂譜走，和你聽到的聲音同步。匯入的 MIDI 只留在你的瀏覽器裡。

按側欄的 **Hum a tune** 把旋律寫成樂譜：對著麥克風用「da」哼或唱，可以開節拍器跟著拍子，也可以照自己的速度；或者直接打開一段錄音。唱的時候畫面會即時畫出你的音高，唱完音符會排在捲軸上，用你選的樂器演奏（也可以把你的聲音疊在下面對照），樂譜可以直接複製，一個按鈕就能把這首曲子加進 Your songs，和匯入的 MIDI 放在一起。你唱的東西不會離開瀏覽器。

## 開發

```bash
npm test             # 記譜、樂理、MIDI 匯入、哼唱轉譜，以及每一首範例曲（Node，不需要瀏覽器）
npm run typecheck
npm run build        # 函式庫，輸出到 dist/
npm run build:player # 鑑賞室，輸出到 player/dist/
```

Node 22.18 以上可以直接執行 TypeScript 原始碼。

## 致謝

- 《月光》範例的音高對照 [Mutopia Project](https://www.mutopiaproject.org) 的版本（樂曲本身是公有領域；該版本以 CC BY-SA 2.5 授權）。
- 《第五號交響曲》範例的音符對照 [Mutopia Project](https://www.mutopiaproject.org) 的版本（樂曲與該版本都是公有領域）。
- 《卡農》範例的音符對照 [Mutopia Project](https://www.mutopiaproject.org) 的版本（樂曲本身是公有領域；該版本以 CC BY 4.0 授權）。
- 鋼琴的弦損耗模型參考 A. Chaigne 與 A. Askenfelt 的 *Numerical simulations of piano strings*（1994）。
- 鑑賞室的 MP3 下載使用 [lamejs](https://github.com/zhuker/lamejs)，它是 [LAME](https://lame.sourceforge.io) 的 JavaScript 移植版（LGPL-3.0），未經修改、以獨立檔案載入，只在下載歌曲時才會用到。

## 授權

MIT
