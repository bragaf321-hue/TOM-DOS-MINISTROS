// Garante acesso aos binários yt-dlp e ffmpeg no macOS (Homebrew) e Linux
process.env.PATH = `/opt/homebrew/bin:/opt/homebrew/sbin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin:${process.env.PATH || ''}`;

const express = require('express');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { execFile, spawn } = require('child_process');
const https = require('https');

const app = express();
const PORT = process.env.PORT || 3080;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const uploadsDir = path.join(__dirname, 'uploads');
const cacheDir = path.join(uploadsDir, 'cache');
const shiftedDir = path.join(uploadsDir, 'shifted');
const dataDir = path.join(__dirname, 'data');

[uploadsDir, cacheDir, shiftedDir, dataDir].forEach((dir) => {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
});

app.use('/uploads', express.static(uploadsDir));

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, cacheDir),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname) || '.mp3';
    cb(null, `upload_${Date.now()}${ext}`);
  }
});
const upload = multer({ storage });

// Base de dados de cantores e músicas conhecidas do louvor
const MALE_ARTISTS = [
  'israel salazar', 'fernandinho', 'isaias saad', 'isaías saad', 'lukas agustinho',
  'theo rubia', 'gabriel guedes', 'eli soares', 'anderson freire', 'kleber lucas',
  'davi sacer', 'thalles roberto', 'leonardo goncalves', 'leonardo gonçalves',
  'paulo cesar baruk', 'paulo césar baruk', 'juliano son', 'livres para adorar',
  'morada', 'brunão morada', 'alessandro vilas boas', 'som do reino', 'marcos almeida',
  'andre valadao', 'andré valadão', 'rodolfo abrantes', 'leandro borges', 'regis danese',
  'ton carfi', 'preto no branco', 'wesley santos', 'pedro valença', 'asaph borba',
  'adhemar de campos', 'luiz arcanjo', 'toque no altar', 'trazendo a arca',
  'julliany souza e leo brandao', 'léo brandão', 'felipe rodrigues', 'david quinlan',
  'antonio cirilo', 'antônio cirilo', 'renascer praise', 'casa worship', 'davi passos',
  'victin', 'jota.a', 'mattos nascimento', 'gerson cardoso', 'sergio lopes',
  'fernando iglesias', 'luiz de carvalho', 'ozéias de paula', 'marcelo markes',
  'jhonas serra', 'jefferson e suellen', 'discopraise', 'pc baruk'
];

const FEMALE_ARTISTS = [
  'gabriela rocha', 'nivea soares', 'nívea soares', 'ana paula valadao', 'ana paula valadão',
  'diante do trono', 'aline barros', 'bruna karla', 'fernanda brum', 'isadora pompeo',
  'julia vitoria', 'júlia vitória', 'valesca mayssa', 'sarah farias', 'midian lima',
  'camila barros', 'eyshila', 'cassiane', 'damares', 'elaine de jesus', 'laura souguellis',
  'gabi sampaio', 'luma elpidio', 'luma elpídio', 'marine friesen', 'bruna olly',
  'priscilla alcantara', 'priscilla alcântara', 'mariana valadao', 'mariana valadão',
  'soraya moraes', 'ludmila ferber', 'heloisa rosa', 'heloísa rosa', 'ana nobrega',
  'ana nóbrega', 'ester batista', 'stella laura', 'kailane frauche', 'sullamita',
  'maria marçal', 'julliany souza', 'fhop', 'talita catanzaro', 'debora rabelo'
];

// Catálogo rápido de músicas conhecidas para precisão imediata
const KNOWN_SONGS = [
  {
    match: ['tudo e teu', 'tudo é teu', 'israel salazar'],
    requireAll: false,
    check: (t) => t.includes('israel salazar') && (t.includes('tudo e teu') || t.includes('tudo é teu')),
    key: 'G',
    isMinor: false,
    gender: 'male',
    artist: 'Israel Salazar',
    title: 'Tudo É Teu'
  },
  {
    check: (t) => t.includes('israel salazar') && (t.includes('graca') || t.includes('graça')),
    key: 'A',
    isMinor: false,
    gender: 'male',
    artist: 'Israel Salazar',
    title: 'Graça'
  },
  {
    check: (t) => t.includes('israel salazar') && (t.includes(' Rei ') || t.includes('mover do espirito') || t.includes('mover do espírito')),
    key: 'E',
    isMinor: false,
    gender: 'male',
    artist: 'Israel Salazar',
    title: 'Mover do Espírito (Quero que Valorize)'
  },
  {
    check: (t) => t.includes('israel salazar') && t.includes('jesus'),
    key: 'G',
    isMinor: false,
    gender: 'male',
    artist: 'Israel Salazar',
    title: 'Jesus'
  },
  {
    check: (t) => t.includes('lugar secreto') || (t.includes('gabriela rocha') && t.includes('secreto')),
    key: 'C',
    isMinor: false,
    gender: 'female',
    artist: 'Gabriela Rocha',
    title: 'Lugar Secreto'
  },
  {
    check: (t) => t.includes('me atraiu') || (t.includes('gabriela rocha') && t.includes('atraiu')),
    key: 'G',
    isMinor: false,
    gender: 'female',
    artist: 'Gabriela Rocha',
    title: 'Me Atraiu'
  },
  {
    check: (t) => t.includes('bondade de deus') && t.includes('isaias'),
    key: 'G',
    isMinor: false,
    gender: 'male',
    artist: 'Isaías Saad',
    title: 'Bondade de Deus'
  },
  {
    check: (t) => t.includes('ousado amor') || t.includes('isaias saad') && t.includes('amor'),
    key: 'G',
    isMinor: false,
    gender: 'male',
    artist: 'Isaías Saad',
    title: 'Ousado Amor'
  },
  {
    check: (t) => t.includes('grandes coisas') && t.includes('fernandinho'),
    key: 'A',
    isMinor: false,
    gender: 'male',
    artist: 'Fernandinho',
    title: 'Grandes Coisas'
  },
  {
    check: (t) => t.includes('unico') && t.includes('fhop'),
    key: 'D',
    isMinor: false,
    gender: 'female',
    artist: 'FHOP Music',
    title: 'Único'
  },
  {
    check: (t) => t.includes('pode morar aqui') || t.includes('theo rubia'),
    key: 'C',
    isMinor: false,
    gender: 'male',
    artist: 'Theo Rubia',
    title: 'Pode Morar Aqui'
  },
  {
    check: (t) => t.includes('algo novo') && (t.includes('lukas') || t.includes('kemuel')),
    key: 'G',
    isMinor: false,
    gender: 'male',
    artist: 'Lukas Agustinho / Kemuel',
    title: 'Algo Novo'
  }
];

function detectGenderFromText(text) {
  const lower = (text || '').toLowerCase();
  for (const f of FEMALE_ARTISTS) {
    if (lower.includes(f)) return 'female';
  }
  for (const m of MALE_ARTISTS) {
    if (lower.includes(m)) return 'male';
  }
  return null;
}

// Krumhansl-Schmuckler Key Detection from Audio File via ffmpeg PCM + Goertzel Chroma
const PITCH_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const MAJOR_PROFILE = [6.35, 2.23, 3.48, 2.33, 4.38, 4.09, 2.52, 5.19, 2.39, 3.66, 2.29, 2.88];
const MINOR_PROFILE = [6.33, 2.68, 3.52, 5.38, 2.60, 3.53, 2.54, 4.75, 3.98, 2.69, 3.34, 3.17];

function analyzeAudioKeyAndPitch(audioPath) {
  return new Promise((resolve) => {
    const sampleRate = 8000;
    // Extract 25 seconds starting at 15s (or 0s if short) as 16-bit signed little-endian mono PCM
    const args = [
      '-ss', '10',
      '-t', '25',
      '-i', audioPath,
      '-vn',
      '-ac', '1',
      '-ar', String(sampleRate),
      '-f', 's16le',
      'pipe:1'
    ];

    const proc = spawn('ffmpeg', args, { stdio: ['ignore', 'pipe', 'ignore'] });
    const chunks = [];
    proc.stdout.on('data', (chunk) => chunks.push(chunk));
    proc.on('error', () => resolve({ key: 'G', gender: 'male' }));
    proc.on('close', () => {
      const buffer = Buffer.concat(chunks);
      if (buffer.length < 4000) {
        return resolve({ key: 'G', gender: 'male' });
      }

      const numSamples = Math.floor(buffer.length / 2);
      const samples = new Float32Array(numSamples);
      for (let i = 0; i < numSamples; i++) {
        samples[i] = buffer.readInt16LE(i * 2) / 32768.0;
      }

      // Compute chroma energy across octaves 2, 3, 4, 5 using Goertzel algorithm on 4096-sample frames
      const chroma = new Float64Array(12);
      const frameSize = 4096;
      const hopSize = 2048;

      // Precompute Goertzel coefficients for each pitch class across octaves 2..5
      const coeffs = [];
      for (let pc = 0; pc < 12; pc++) {
        coeffs[pc] = [];
        for (let oct = 2; oct <= 5; oct++) {
          const midi = 12 * (oct + 1) + pc;
          const freq = 440.0 * Math.pow(2, (midi - 69) / 12.0);
          const k = Math.round((frameSize * freq) / sampleRate);
          const w = (2 * Math.PI * k) / frameSize;
          coeffs[pc].push(2 * Math.cos(w));
        }
      }

      for (let start = 0; start + frameSize <= numSamples; start += hopSize) {
        for (let pc = 0; pc < 12; pc++) {
          for (let o = 0; o < coeffs[pc].length; o++) {
            const c = coeffs[pc][o];
            let s1 = 0;
            let s2 = 0;
            for (let n = 0; n < frameSize; n++) {
              const s0 = samples[start + n] + c * s1 - s2;
              s2 = s1;
              s1 = s0;
            }
            const power = s1 * s1 + s2 * s2 - c * s1 * s2;
            if (power > 0) chroma[pc] += Math.sqrt(power);
          }
        }
      }

      // Correlate with Krumhansl-Schmuckler major profiles
      let bestKey = 'G';
      let bestScore = -Infinity;

      for (let shift = 0; shift < 12; shift++) {
        let majScore = 0;
        for (let i = 0; i < 12; i++) {
          majScore += chroma[(i + shift) % 12] * MAJOR_PROFILE[i];
        }
        if (majScore > bestScore) {
          bestScore = majScore;
          bestKey = PITCH_NAMES[shift];
        }
      }

      resolve({ key: bestKey, gender: 'male' });
    });
  });
}

// Helper to search CifraClub for the song's official key if possible
function lookupKeyFromWeb(queryText) {
  return new Promise((resolve) => {
    const clean = queryText
      .replace(/\(.*?\)|\[.*?\]|oficial|clipe|ao vivo|live|lyric|video|vídeo|hd|4k/gi, '')
      .trim();

    const lower = queryText.toLowerCase();
    for (const item of KNOWN_SONGS) {
      if (item.check(lower)) {
        return resolve({
          key: item.key,
          gender: item.gender,
          artist: item.artist,
          title: item.title,
          source: 'Catálogo Louvor'
        });
      }
    }

    // Try quick DuckDuckGo/CifraClub slug guess if artist - song format exists
    const parts = clean.split(/[-–|]/).map((s) => s.trim()).filter(Boolean);
    if (parts.length >= 2) {
      const slugify = (str) =>
        str
          .toLowerCase()
          .normalize('NFD')
          .replace(/[\u0300-\u036f]/g, '')
          .replace(/[^a-z0-9]+/g, '-')
          .replace(/^-+|-+$/g, '');

      const s1 = slugify(parts[0]);
      const s2 = slugify(parts[1]);

      // Try both [artist]/[song] and [song]/[artist]
      const tryUrls = [
        `https://www.cifraclub.com.br/${s1}/${s2}/`,
        `https://www.cifraclub.com.br/${s2}/${s1}/`
      ];

      let resolved = false;
      let pending = tryUrls.length;

      tryUrls.forEach((url) => {
        const req = https.get(url, { timeout: 3000, headers: { 'User-Agent': 'Mozilla/5.0' } }, (res) => {
          let html = '';
          res.on('data', (d) => {
            if (html.length < 120000) html += d.toString();
          });
          res.on('end', () => {
            if (resolved) return;
            // Look for "tom": "G" or Tom: <a ...>G</a>
            const tomMatch =
              html.match(/"tom"\s*:\s*"([A-G][#b]?m?)"/i) ||
              html.match(/Tom:\s*<[^>]+>([A-G][#b]?m?)<\//i);
            if (tomMatch && tomMatch[1]) {
              resolved = true;
              let rawKey = tomMatch[1];
              // Convert minor to relative major or keep clean root
              return resolve({
                key: normalizeKeyToMajorRoot(rawKey),
                rawKey,
                source: 'Cifra Club'
              });
            }
            pending--;
            if (pending === 0 && !resolved) resolve(null);
          });
        });
        req.on('error', () => {
          pending--;
          if (pending === 0 && !resolved) resolve(null);
        });
        req.on('timeout', () => {
          req.destroy();
          pending--;
          if (pending === 0 && !resolved) resolve(null);
        });
      });
    } else {
      resolve(null);
    }
  });
}

function normalizeKeyToMajorRoot(rawKey) {
  if (!rawKey) return 'G';
  const flatToSharp = {
    Db: 'C#',
    Eb: 'D#',
    Gb: 'F#',
    Ab: 'G#',
    Bb: 'A#'
  };
  let isMinor = rawKey.endsWith('m');
  let root = isMinor ? rawKey.slice(0, -1) : rawKey;
  root = root.charAt(0).toUpperCase() + root.slice(1);
  if (flatToSharp[root]) root = flatToSharp[root];
  const idx = PITCH_NAMES.indexOf(root);
  if (idx === -1) return 'G';
  // If minor key, relative major is +3 semitones, or we return the root
  return PITCH_NAMES[idx];
}

function fetchJsonHttps(url) {
  return new Promise((resolve) => {
    https
      .get(
        url,
        {
          timeout: 5000,
          headers: {
            'User-Agent':
              'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
          }
        },
        (res) => {
          if (res.statusCode < 200 || res.statusCode >= 300) return resolve(null);
          let data = '';
          res.on('data', (d) => {
            if (data.length < 100000) data += d.toString();
          });
          res.on('end', () => {
            try {
              resolve(JSON.parse(data));
            } catch {
              resolve(null);
            }
          });
        }
      )
      .on('error', () => resolve(null))
      .on('timeout', function () {
        this.destroy();
        resolve(null);
      });
  });
}

// Normalizador inteligente de URLs e consultas de música
async function parseMusicMediaInput(rawInput) {
  const input = rawInput.trim();

  // 1. YouTube (Watch, Short, Share, Embed, Music, Live)
  const ytRegex =
    /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?|shorts|live)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/i;
  const ytMatch = input.match(ytRegex);
  if (ytMatch && ytMatch[1]) {
    const videoId = ytMatch[1];
    return {
      type: 'youtube',
      videoId,
      cleanUrl: `https://www.youtube.com/watch?v=${videoId}`,
      searchTarget: `https://www.youtube.com/watch?v=${videoId}`
    };
  }

  // Verifica se o usuário colou um link do YouTube que foi cortado acidentalmente
  if (/youtu\.be\/|youtube\.com\//i.test(input)) {
    const partialMatch = input.match(/(?:v=|youtu\.be\/|shorts\/|live\/)([^&?/\s]+)/i);
    if (partialMatch && partialMatch[1] && partialMatch[1].length < 11) {
      throw new Error(
        `O link do YouTube colado parece incompleto ou cortado ("${partialMatch[1]}"). Verifique se copiou o link inteiro ou digite o nome da música diretamente.`
      );
    }
  }

  // 2. Spotify Track URL
  const spotifyMatch = input.match(/open\.spotify\.com\/(?:intl-[a-z]+\/)?track\/([a-zA-Z0-9]+)/i);
  if (spotifyMatch) {
    const cleanSpotifyUrl = input.split('?')[0];
    const oembed = await fetchJsonHttps(
      `https://open.spotify.com/oembed?url=${encodeURIComponent(cleanSpotifyUrl)}`
    );
    if (oembed && oembed.title) {
      return {
        type: 'spotify',
        title: oembed.title,
        cleanUrl: cleanSpotifyUrl,
        searchTarget: `ytsearch1:${oembed.title}`
      };
    }
  }

  // 3. Cifra Club URL
  const cifraMatch = input.match(/cifraclub\.com\.br\/([^\/]+)\/([^\/]+)/i);
  if (cifraMatch) {
    const artistSlug = cifraMatch[1].replace(/-/g, ' ');
    const songSlug = cifraMatch[2].replace(/-/g, ' ');
    const query = `${artistSlug} ${songSlug}`.trim();
    return {
      type: 'cifraclub',
      title: `${songSlug} - ${artistSlug}`,
      cleanUrl: input,
      searchTarget: `ytsearch1:${query}`
    };
  }

  // 4. Texto livre / Nome da música
  return {
    type: 'query',
    title: input,
    searchTarget: `ytsearch1:${input}`
  };
}

// Helper para baixar áudio com yt-dlp usando rotação de player_client para evitar bloqueios
async function downloadYoutubeAudio(targetUrl, outTemplate, audioFullPath, videoId) {
  if (fs.existsSync(audioFullPath)) return;

  const runYtDlp = (flags) =>
    new Promise((resolve, reject) => {
      execFile('yt-dlp', flags, { timeout: 75000, maxBuffer: 10 * 1024 * 1024 }, (err, stdout, stderr) => {
        if (err) return reject(new Error(stderr || err.message));
        resolve();
      });
    });

  const baseArgs = [
    '--no-playlist',
    '--no-warnings',
    '--no-check-certificates',
    '--geo-bypass',
    '-f',
    'bestaudio/ba/b',
    '-x',
    '--audio-format',
    'mp3',
    '--audio-quality',
    '0',
    '--max-filesize',
    '65M',
    '-o',
    outTemplate
  ];

  // Tentativa 1: player_client android + web
  try {
    await runYtDlp([
      ...baseArgs,
      '--extractor-args',
      'youtube:player_client=android,ios,web;player_skip=configs',
      targetUrl
    ]);
  } catch (err1) {
    console.warn('Tentativa 1 com yt-dlp falhou, tentando fallback (ios,tv_embedded):', err1.message);
    // Tentativa 2: player_client ios + tv_embedded
    try {
      await runYtDlp([
        ...baseArgs,
        '--extractor-args',
        'youtube:player_client=ios,tv_embedded;player_skip=configs',
        targetUrl
      ]);
    } catch (err2) {
      console.warn('Tentativa 2 com yt-dlp falhou, tentando sem extractor-args:', err2.message);
      // Tentativa 3: args padrão
      await runYtDlp([...baseArgs, targetUrl]);
    }
  }

  // Verifica se o arquivo .mp3 existe, ou se foi gerado com outra extensão (.m4a, .webm, .opus)
  if (!fs.existsSync(audioFullPath)) {
    const parentDir = path.dirname(audioFullPath);
    const files = fs.readdirSync(parentDir);
    const candidate = files.find((f) => f.startsWith(`yt_${videoId}`) && !f.endsWith('.part'));
    if (candidate) {
      const candidatePath = path.join(parentDir, candidate);
      if (candidatePath !== audioFullPath) {
        // Converte para mp3 via ffmpeg
        await new Promise((resolve, reject) => {
          execFile('ffmpeg', ['-y', '-i', candidatePath, '-vn', '-b:a', '160k', audioFullPath], (err) => {
            if (err) return reject(err);
            resolve();
          });
        });
      }
    } else {
      throw new Error('O áudio não pôde ser salvo no formato MP3.');
    }
  }
}

// Endpoint: Analisar Link (YouTube, Spotify, Cifra Club ou Nome da Música)
app.post('/api/analyze-url', async (req, res) => {
  try {
    const { url } = req.body;
    if (!url || !url.trim()) {
      return res.status(400).json({ error: 'Informe um link do YouTube ou nome da música.' });
    }

    const mediaInfo = await parseMusicMediaInput(url);
    let title = mediaInfo.title || url.trim();
    let uploader = '';
    let thumbnail = '';
    let duration = 0;
    let videoId = mediaInfo.videoId || null;
    let webpageUrl = mediaInfo.cleanUrl || null;

    // Se for link direto do YouTube, consulta o oEmbed oficial primeiro (ultra rápido e imune a bloqueios)
    if (mediaInfo.type === 'youtube') {
      const oembed = await fetchJsonHttps(
        `https://www.youtube.com/oembed?url=${encodeURIComponent(mediaInfo.cleanUrl)}&format=json`
      );
      if (oembed) {
        title = oembed.title || title;
        uploader = oembed.author_name || '';
        thumbnail = oembed.thumbnail_url || `https://i.ytimg.com/vi/${mediaInfo.videoId}/hqdefault.jpg`;
      }
    }

    // Se ainda não temos metadados detalhados, consulta o yt-dlp
    if (!uploader || !videoId) {
      try {
        const metaJson = await new Promise((resolve, reject) => {
          execFile(
            'yt-dlp',
            [
              '--dump-json',
              '--no-playlist',
              '--no-warnings',
              '--no-check-certificates',
              '--extractor-args',
              'youtube:player_client=android,ios,web;player_skip=configs',
              mediaInfo.searchTarget
            ],
            { timeout: 20000, maxBuffer: 10 * 1024 * 1024 },
            (err, stdout) => {
              if (err) return reject(err);
              try {
                const firstLine = stdout.trim().split('\n')[0];
                resolve(JSON.parse(firstLine));
              } catch (e) {
                reject(e);
              }
            }
          );
        });

        videoId = metaJson.id || videoId || `vid_${Date.now()}`;
        title = metaJson.title || title;
        uploader = metaJson.uploader || metaJson.channel || uploader;
        thumbnail = metaJson.thumbnail || thumbnail;
        duration = metaJson.duration || 0;
        webpageUrl = metaJson.webpage_url || (videoId ? `https://www.youtube.com/watch?v=${videoId}` : null);
      } catch (metaErr) {
        console.warn('yt-dlp dump-json avisou:', metaErr.message);
        if (!videoId) {
          videoId = `vid_${Date.now()}`;
        }
      }
    }

    if (!videoId) {
      videoId = `vid_${Date.now()}`;
    }

    const downloadTarget = webpageUrl || mediaInfo.searchTarget;
    const audioFilename = `yt_${videoId}.mp3`;
    const audioFullPath = path.join(cacheDir, audioFilename);
    const outTemplate = path.join(cacheDir, `yt_${videoId}.%(ext)s`);

    // Download do áudio com tolerância a falhas
    await downloadYoutubeAudio(downloadTarget, outTemplate, audioFullPath, videoId);

    // Detecção de gênero do cantor(a) e tom musical
    const combinedText = `${title} ${uploader} ${url}`;
    let detectedGender = detectGenderFromText(combinedText) || 'male';

    const webLookup = await lookupKeyFromWeb(`${title} ${uploader}`);
    let detectedKey = 'G';
    let keySource = 'Análise de Áudio IA';

    if (webLookup && webLookup.key) {
      detectedKey = webLookup.key;
      keySource = webLookup.source || 'Cifra Club';
      if (webLookup.gender) detectedGender = webLookup.gender;
    } else {
      const audioAnalysis = await analyzeAudioKeyAndPitch(audioFullPath);
      detectedKey = audioAnalysis.key || 'G';
    }

    return res.json({
      id: videoId,
      title,
      artist: uploader || 'YouTube',
      thumbnail: thumbnail || (videoId ? `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg` : ''),
      duration,
      audioUrl: `/uploads/cache/${audioFilename}`,
      audioFile: audioFilename,
      originalKey: detectedKey,
      originalGender: detectedGender,
      keySource
    });
  } catch (err) {
    console.error('Erro ao analisar link:', err);
    return res.status(500).json({
      error:
        'Não foi possível extrair o áudio desse link automaticamente. Dica: você pode tentar colar o nome da música (ex: "Bondade de Deus Isaias Saad") ou enviar o arquivo MP3 diretamente.',
      details: err.message
    });
  }
});

// Endpoint: Upload de arquivo de áudio (MP3, WAV, M4A)
app.post('/api/upload-audio', upload.single('audio'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'Nenhum arquivo enviado.' });
    }
    const originalName = req.file.originalname.replace(/\.[^/.]+$/, '');
    const audioFullPath = req.file.path;
    const audioFilename = req.file.filename;

    let detectedGender = detectGenderFromText(originalName) || 'male';
    const webLookup = await lookupKeyFromWeb(originalName);
    let detectedKey = 'G';
    let keySource = 'Análise de Áudio IA';

    if (webLookup && webLookup.key) {
      detectedKey = webLookup.key;
      keySource = webLookup.source;
      if (webLookup.gender) detectedGender = webLookup.gender;
    } else {
      const analysis = await analyzeAudioKeyAndPitch(audioFullPath);
      detectedKey = analysis.key;
    }

    return res.json({
      id: audioFilename,
      title: originalName,
      artist: 'Arquivo Enviado',
      thumbnail: '',
      audioUrl: `/uploads/cache/${audioFilename}`,
      audioFile: audioFilename,
      originalKey: detectedKey,
      originalGender: detectedGender,
      keySource
    });
  } catch (err) {
    console.error('Erro no upload:', err);
    return res.status(500).json({ error: 'Falha ao processar arquivo de áudio.' });
  }
});

// Endpoint: Gerar áudio com Tom Alterado no servidor via FFmpeg (compatível 100% com iPhone/Safari, Android, Windows e Mac + Download para WhatsApp!)
app.get('/api/audio-shifted', async (req, res) => {
  try {
    const { file, semitones = 0, download = '0' } = req.query;
    if (!file) return res.status(400).send('Parâmetro file obrigatório');

    const safeFile = path.basename(file);
    const inputPath = path.join(cacheDir, safeFile);
    if (!fs.existsSync(inputPath)) {
      return res.status(404).send('Arquivo de áudio original não encontrado');
    }

    const st = parseFloat(semitones) || 0;
    if (Math.abs(st) < 0.05) {
      if (download === '1') {
        res.download(inputPath, `louvor_tom_original_${safeFile}`);
      } else {
        res.sendFile(inputPath);
      }
      return;
    }

    const stTag = st >= 0 ? `plus${st}` : `minus${Math.abs(st)}`;
    const outFilename = `shifted_${safeFile.replace(/\.[^/.]+$/, '')}_${stTag}.mp3`;
    const outPath = path.join(shiftedDir, outFilename);

    if (!fs.existsSync(outPath)) {
      // Pitch factor = 2^(semitones/12)
      // Tempo compensation = 1 / pitchFactor (so duration/BPM stays identical!)
      const pitchFactor = Math.pow(2, st / 12.0);
      const tempoFactor = 1.0 / pitchFactor;

      // atempo filter accepts [0.5, 2.0]. Chain two if outside range
      let atempoFilters = [];
      let remTempo = tempoFactor;
      while (remTempo < 0.5) {
        atempoFilters.push('atempo=0.5');
        remTempo /= 0.5;
      }
      while (remTempo > 2.0) {
        atempoFilters.push('atempo=2.0');
        remTempo /= 2.0;
      }
      atempoFilters.push(`atempo=${remTempo.toFixed(6)}`);

      const filterChain = `aresample=44100,asetrate=44100*${pitchFactor.toFixed(6)},${atempoFilters.join(',')},aresample=44100`;

      await new Promise((resolve, reject) => {
        execFile(
          'ffmpeg',
          ['-y', '-i', inputPath, '-vn', '-af', filterChain, '-b:a', '160k', outPath],
          { timeout: 60000 },
          (err) => {
            if (err) return reject(err);
            resolve();
          }
        );
      });
    }

    if (download === '1') {
      return res.download(outPath, outFilename);
    }
    return res.sendFile(outPath);
  } catch (err) {
    console.error('Erro ao mudar tom do áudio:', err);
    return res.status(500).send('Erro ao processar mudança de tom');
  }
});

// Repertório / Histórico de Tons dos Ministros
const repertoireFile = path.join(dataDir, 'repertoire.json');
if (!fs.existsSync(repertoireFile)) {
  const initialData = [
    {
      id: 'demo-1',
      title: 'Graça - Israel Salazar',
      originalKey: 'A',
      originalGender: 'male',
      ministerName: 'Rebeca (Voz Feminina)',
      ministerGender: 'female',
      chosenKey: 'D',
      semitoneShift: -5,
      adjustmentFromAverage: '+0 (Média Feminina)',
      updatedAt: new Date().toISOString()
    },
    {
      id: 'demo-2',
      title: 'Tudo É Teu - Israel Salazar',
      originalKey: 'G',
      originalGender: 'male',
      ministerName: 'Priscila (Voz Feminina)',
      ministerGender: 'female',
      chosenKey: 'E',
      semitoneShift: -3,
      adjustmentFromAverage: '+1 Tom acima da Média Feminina',
      updatedAt: new Date().toISOString()
    },
    {
      id: 'demo-3',
      title: 'Lugar Secreto - Gabriela Rocha',
      originalKey: 'C',
      originalGender: 'female',
      ministerName: 'Lucas (Voz Masculina)',
      ministerGender: 'male',
      chosenKey: 'G',
      semitoneShift: -5,
      adjustmentFromAverage: 'Média Masculina',
      updatedAt: new Date().toISOString()
    }
  ];
  fs.writeFileSync(repertoireFile, JSON.stringify(initialData, null, 2));
}

app.get('/api/repertoire', (req, res) => {
  try {
    const items = JSON.parse(fs.readFileSync(repertoireFile, 'utf8'));
    res.json(items);
  } catch (e) {
    res.json([]);
  }
});

app.post('/api/repertoire', (req, res) => {
  try {
    const items = JSON.parse(fs.readFileSync(repertoireFile, 'utf8'));
    const newItem = {
      id: `rep_${Date.now()}`,
      title: req.body.title || 'Música sem título',
      originalKey: req.body.originalKey || 'G',
      originalGender: req.body.originalGender || 'male',
      ministerName: req.body.ministerName || 'Ministro(a)',
      ministerGender: req.body.ministerGender || 'female',
      chosenKey: req.body.chosenKey || 'C',
      semitoneShift: req.body.semitoneShift || 0,
      adjustmentFromAverage: req.body.adjustmentFromAverage || '',
      updatedAt: new Date().toISOString()
    };
    items.unshift(newItem);
    fs.writeFileSync(repertoireFile, JSON.stringify(items, null, 2));
    res.json(newItem);
  } catch (e) {
    res.status(500).json({ error: 'Erro ao salvar no repertório.' });
  }
});

app.delete('/api/repertoire/:id', (req, res) => {
  try {
    let items = JSON.parse(fs.readFileSync(repertoireFile, 'utf8'));
    items = items.filter((i) => i.id !== req.params.id);
    fs.writeFileSync(repertoireFile, JSON.stringify(items, null, 2));
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: 'Erro ao remover item.' });
  }
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Servidor Tom do Louvor rodando na porta ${PORT}`);
});
