import axios from 'axios';

export default {
  name: "Anime Char",
  description: "Mendapatkan gambar karakter anime random",
  category: "Random",
  methods: ["GET"],
  params: [],
  paramsSchema: {},

  async run(req, res) {
    try {
      console.log("Mengambil gambar karakter anime random baru...");
      
      // Daftar API yang akan dicoba secara random
      const apiStrategies = [
        // Strategy 1: Waifu.im dengan tag anime
        async () => {
          const excludedNsfwTags = [
            "ass", "hentai", "oral", "paizuri", "ecchi", "ero",
            "oppai", "milf", "nsfw", "lewds", "suggestive", "explicit",
            "adult", "porn", "sex", "nude", "naked", "breasts", "pussy",
            "penis", "fuck", "bdsm", "bondage", "master", "slave", 
            "rape", "cum", "semen", "creampie", "gangbang", "orgy",
            "groping", "molestation", "incest", "loli", "shota", 
            "underage", "futanari", "trap", "yaoi", "yuri-explicit"
          ];
          
          const tags = ['anime', 'fiction', 'character'];
          const randomTag = tags[Math.floor(Math.random() * tags.length)];
          
          const response = await axios.get('https://api.waifu.im/search', {
            params: {
              included_tags: [randomTag],
              excluded_tags: excludedNsfwTags,
              is_nsfw: false,
              many: true,
              limit: 10,
              _: Date.now()
            },
            timeout: 8000,
            headers: { 'Cache-Control': 'no-cache' }
          });
          
          const images = response.data.images;
          const randomImage = images[Math.floor(Math.random() * images.length)];
          return {
            url: randomImage.url,
            source: 'waifu.im',
            tag: randomTag
          };
        },
        
        // Strategy 2: NekoBot API
        async () => {
          const types = ['neko', 'waifu', 'husbando'];
          const randomType = types[Math.floor(Math.random() * types.length)];
          
          const response = await axios.get('https://nekobot.xyz/api/image', {
            params: { 
              type: randomType,
              _: Date.now()
            },
            timeout: 8000
          });
          
          return {
            url: response.data.message,
            source: 'nekobot.xyz',
            type: randomType
          };
        },
        
        // Strategy 3: Neko-love API
        async () => {
          const endpoints = ['neko', 'waifu', 'husbando'];
          const randomEndpoint = endpoints[Math.floor(Math.random() * endpoints.length)];
          
          const response = await axios.get(`https://neko-love.xyz/api/v1/${randomEndpoint}`, {
            params: { _: Date.now() },
            timeout: 8000
          });
          
          return {
            url: response.data.url,
            source: 'neko-love.xyz',
            endpoint: randomEndpoint
          };
        }
      ];
      
      // Pilih random strategy
      const randomStrategy = apiStrategies[Math.floor(Math.random() * apiStrategies.length)];
      let result;
      let attempts = 0;
      
      // Coba maksimal 3 strategi berbeda
      while (attempts < 3) {
        try {
          const strategy = apiStrategies[Math.floor(Math.random() * apiStrategies.length)];
          result = await strategy();
          if (result) break;
        } catch (err) {
          attempts++;
          console.log(`Strategy ${attempts} gagal, mencoba yang lain...`);
          continue;
        }
      }
      
      if (!result) {
        throw new Error("Semua strategi API gagal");
      }
      
      console.log("Anime Character Image URL:", result.url);
      console.log("Source:", result.source);
      
      // Download gambar dengan anti-cache
      const imageResponse = await axios.get(result.url, {
        responseType: 'arraybuffer',
        timeout: 15000,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'Cache-Control': 'no-cache'
        },
        params: {
          _: Date.now()
        }
      });

      // Set headers untuk mencegah cache
      res.setHeader('Content-Type', imageResponse.headers['content-type'] || 'image/jpeg');
      res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');
      res.setHeader('X-Image-Type', 'Random Anime Character');
      res.setHeader('X-Source', result.source);
      res.setHeader('X-Rating', 'SFW');
      res.setHeader('X-Request-Time', Date.now().toString());
      res.setHeader('Access-Control-Allow-Origin', '*');
      
      // Kirim gambar
      res.send(Buffer.from(imageResponse.data));

    } catch (error) {
      console.error('Error mendapatkan gambar karakter anime:', error.message);
      
      // Fallback images untuk karakter anime dengan timestamp
      const animeFallbackImages = [
        `https://cdn.myanimelist.net/images/characters/13/491005.jpg?_=${Date.now()}`,
        `https://cdn.myanimelist.net/images/characters/16/497685.jpg?_=${Date.now()}`,
        `https://cdn.myanimelist.net/images/characters/6/533012.jpg?_=${Date.now()}`,
        `https://cdn.myanimelist.net/images/characters/2/547046.jpg?_=${Date.now()}`,
        `https://cdn.myanimelist.net/images/characters/11/530573.jpg?_=${Date.now()}`,
        `https://cdn.myanimelist.net/images/characters/9/527689.jpg?_=${Date.now()}`,
        `https://cdn.myanimelist.net/images/characters/15/497686.jpg?_=${Date.now()}`,
        `https://cdn.myanimelist.net/images/characters/7/504577.jpg?_=${Date.now()}`
      ];
      
      try {
        const randomFallback = animeFallbackImages[Math.floor(Math.random() * animeFallbackImages.length)];
        const cleanUrl = randomFallback.split('?_=')[0];
        console.log("Menggunakan fallback image:", cleanUrl);
        
        const fallbackResponse = await axios.get(cleanUrl, {
          responseType: 'arraybuffer',
          timeout: 8000,
          headers: {
            'Cache-Control': 'no-cache'
          }
        });
        
        res.setHeader('Content-Type', 'image/jpeg');
        res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
        res.setHeader('X-Fallback', 'true');
        res.setHeader('X-Image-Type', 'Random Anime Character');
        res.setHeader('X-Source', 'MyAnimeList');
        res.setHeader('X-Rating', 'SFW');
        res.send(Buffer.from(fallbackResponse.data));
      } catch (fallbackError) {
        res.setHeader('Content-Type', 'application/json');
        res.setHeader('Cache-Control', 'no-store, no-cache');
        res.status(500).json({
          success: false,
          error: "Gagal mendapatkan gambar karakter anime",
          message: "Refresh halaman untuk mencoba gambar baru",
          note: "Setiap refresh akan menghasilkan gambar yang berbeda",
          timestamp: Date.now()
        });
      }
    }
  }
};
