import axios from 'axios';

export default {
  name: "Waifu",
  description: "Mendapatkan gambar waifu anime random",
  category: "Random",
  methods: ["GET"],
  params: [],
  paramsSchema: {},

  async run(req, res) {
    try {
      console.log("Mengambil gambar waifu random baru...");
      
      // Daftar tags NSFW yang akan dikecualikan
      const excludedNsfwTags = [
        "ass", "hentai", "oral", "paizuri", "ecchi", "ero",
        "oppai", "milf", "nsfw", "lewds", "suggestive", "explicit",
        "adult", "porn", "sex", "nude", "naked", "breasts", "pussy",
        "penis", "fuck", "bdsm", "bondage", "master", "slave", 
        "rape", "cum", "semen", "creampie", "gangbang", "orgy",
        "groping", "molestation", "incest", "loli", "shota", 
        "underage", "futanari", "trap", "yaoi", "yuri-explicit"
      ];
      
      // Daftar included tags untuk variasi maid
      const maidTags = ['maid', 'servant', 'anime', 'dress', 'cute', 'teen', 'beautiful', 'girl'];
      
      // Pilih random tag dari daftar
      const randomTag = maidTags[Math.floor(Math.random() * maidTags.length)];
      
      console.log(`Menggunakan tag: ${randomTag} untuk variasi`);
      
      // Request ke waifu.im API dengan anti-cache
      const timestamp = Date.now();
      const response = await axios.get('https://api.waifu.im/search', {
        params: {
          included_tags: [randomTag],
          excluded_tags: excludedNsfwTags,
          is_nsfw: false,
          many: false,
          height: ">=400",
          _: timestamp
        },
        timeout: 10000,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'Cache-Control': 'no-cache'
        }
      });

      if (!response.data || !response.data.images || response.data.images.length === 0) {
        throw new Error("Tidak ada gambar maid yang ditemukan");
      }

      const images = response.data.images;
      const randomImage = images[Math.floor(Math.random() * images.length)];
      const imageUrl = randomImage.url;
      
      console.log("Maid Image URL:", imageUrl);
      console.log("Tags:", randomImage.tags.map(t => t.name));
      
      // Download gambar dengan anti-cache
      const imageResponse = await axios.get(imageUrl, {
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
      res.setHeader('X-Image-Type', 'Random Maid');
      res.setHeader('X-Source', 'waifu.im');
      res.setHeader('X-Rating', 'SFW');
      res.setHeader('X-Selected-Tag', randomTag);
      res.setHeader('X-Request-Time', timestamp.toString());
      res.setHeader('Access-Control-Allow-Origin', '*');
      
      // Kirim gambar
      res.send(Buffer.from(imageResponse.data));

    } catch (error) {
      console.error('Error mendapatkan gambar maid:', error.message);
      
      // Fallback images khusus maid dengan variasi
      const maidFallbackImages = [
        'https://cdn.waifu.im/7719.jpg?_=' + Date.now(),
        'https://cdn.waifu.im/7629.jpg?_=' + Date.now(),
        'https://cdn.waifu.im/7570.jpg?_=' + Date.now(),
        'https://cdn.waifu.im/7555.jpg?_=' + Date.now(),
        'https://cdn.waifu.im/7500.jpg?_=' + Date.now(),
        'https://cdn.waifu.im/7485.jpg?_=' + Date.now(),
        'https://cdn.waifu.im/7460.jpg?_=' + Date.now(),
        'https://cdn.waifu.im/7430.jpg?_=' + Date.now(),
        'https://cdn.waifu.im/7400.jpg?_=' + Date.now(),
        'https://cdn.waifu.im/7380.jpg?_=' + Date.now()
      ];
      
      try {
        const randomFallback = maidFallbackImages[Math.floor(Math.random() * maidFallbackImages.length)];
        console.log("Menggunakan fallback image:", randomFallback);
        
        const fallbackResponse = await axios.get(randomFallback.split('?_=')[0], {
          responseType: 'arraybuffer',
          timeout: 8000,
          headers: {
            'Cache-Control': 'no-cache'
          }
        });
        
        res.setHeader('Content-Type', 'image/jpeg');
        res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
        res.setHeader('X-Fallback', 'true');
        res.setHeader('X-Image-Type', 'Random Maid');
        res.setHeader('X-Rating', 'SFW');
        res.send(Buffer.from(fallbackResponse.data));
      } catch (fallbackError) {
        res.setHeader('Content-Type', 'application/json');
        res.setHeader('Cache-Control', 'no-store, no-cache');
        res.status(500).json({
          success: false,
          error: "Gagal mendapatkan gambar maid",
          message: "Refresh halaman untuk gambar maid baru",
          refresh_tip: "Tekan F5 atau Ctrl+R untuk gambar berbeda"
        });
      }
    }
  }
};
