# AdaptLearn

AdaptLearn adalah aplikasi pembelajaran adaptif untuk mahasiswa dan dosen. Aplikasi menyediakan materi kuliah, pengelolaan tugas, pelacakan aktivitas belajar, gamifikasi EXP dan badge, pemantauan energi, serta indikator risiko burnout.

## Daftar Isi

- [Fitur](#fitur)
- [Teknologi](#teknologi)
- [Persyaratan](#persyaratan)
- [Instalasi Lokal](#instalasi-lokal)
- [Konfigurasi Firebase](#konfigurasi-firebase)
- [Konfigurasi EmailJS](#konfigurasi-emailjs)
- [Menjalankan Aplikasi](#menjalankan-aplikasi)
- [Alur Penggunaan](#alur-penggunaan)
- [Sistem EXP dan Level](#sistem-exp-dan-level)
- [Analisis Risiko Burnout](#analisis-risiko-burnout)
- [Struktur Proyek](#struktur-proyek)
- [Perintah](#perintah)
- [Catatan Keamanan dan Batasan](#catatan-keamanan-dan-batasan)

## Fitur

### Mahasiswa

- Registrasi dengan nama lengkap, NIM angka, email kampus, dan kata sandi.
- Verifikasi email sebelum dapat masuk ke akun.
- Login menggunakan NIM atau email beserta kata sandi.
- Dashboard menampilkan level, EXP, badge, energi, ringkasan risiko burnout, dan tenggat tugas terdekat.
- Study Care menyediakan sesi fokus dan pencatatan aktivitas belajar.
- Energy Recharge berisi permainan Memory Sequence dan Quick Math untuk memulihkan energi serta memperoleh EXP.
- To-Do List menampilkan tugas pribadi dan tugas dari dosen. Mahasiswa dapat mengirim dokumen, gambar, dan tautan pada tugas dosen.
- Courses menampilkan daftar materi kuliah.
- Leaderboard membandingkan level dan EXP mahasiswa.

### Dosen

- Overview memuat jumlah mahasiswa, tugas aktif, waktu belajar kelas, dan peringatan risiko burnout.
- Upcoming Deadline Alerts menyoroti tugas yang segera jatuh tempo atau sudah terlambat.
- Assignment Submission Tracker menunjukkan tingkat pengumpulan tugas.
- Student Well-being Monitor menampilkan mahasiswa berisiko dan menyediakan tindakan kontak atau pencatatan intervensi.
- Task Management memungkinkan pembuatan dan penghapusan tugas, pemilihan mata kuliah, penetapan tenggat, deskripsi, tautan materi, serta lampiran kecil.
- Opsi pengiriman notifikasi tugas ke email mahasiswa menggunakan EmailJS.
- Student Progress menampilkan status pengumpulan tugas dan hasil kiriman mahasiswa.
- Dosen dapat mengubah nama dan EXP mahasiswa melalui Student Progress.

## Teknologi

- React 19
- Vite
- Tailwind CSS 4
- Firebase Authentication
- Cloud Firestore
- EmailJS Browser SDK
- lucide-react

## Persyaratan

- Node.js yang mendukung Vite 8.
- npm.
- Proyek Firebase dengan Authentication dan Cloud Firestore aktif.
- Akun EmailJS hanya jika ingin mengirim notifikasi tugas lewat email.

## Instalasi Lokal

1. Clone repository dan masuk ke direktori proyek:

   ```bash
   git clone https://github.com/ilhamjagad/adaptlearn.git
   cd adaptlearn
   ```

2. Pasang dependency:

   ```bash
   npm install
   ```

3. Jalankan aplikasi dalam mode pengembangan:

   ```bash
   npm run dev
   ```

4. Buka alamat lokal yang ditampilkan Vite di terminal.

## Konfigurasi Firebase

Konfigurasi Firebase saat ini ditulis pada `src/App.jsx`. Ganti nilai `firebaseConfig` dengan konfigurasi aplikasi web dari Firebase Console jika memakai proyek Firebase lain.

Aktifkan layanan berikut di Firebase Console:

1. **Authentication → Sign-in method → Email/Password**.
2. **Authentication → Settings → Authorized domains**: tambahkan domain lokal dan domain hosting aplikasi.
3. **Firestore Database**: buat database dan siapkan aturan akses yang sesuai.
4. **Authentication → Templates → Email address verification**: periksa pengaturan email verifikasi mahasiswa.

Data utama memakai collection berikut di bawah jalur `artifacts/{appId}/public/data/`:

- `users`: profil, NIM, alamat email, role, EXP, dan energi mahasiswa.
- `tasks`: tugas pribadi dan tugas global dari dosen.
- `completions`: status pengumpulan tugas, hasil kiriman, serta EXP yang diberikan.
- `studySessions`: durasi dan waktu sesi belajar.
- `interventions`: catatan tindak lanjut dosen terhadap mahasiswa berisiko.

Pastikan Firestore Rules membatasi operasi berdasarkan autentikasi dan role. Jangan memakai aturan publik yang memberi akses baca/tulis tanpa batas pada deployment nyata.

### Autentikasi Mahasiswa

- NIM diubah menjadi alamat `nama@mhs.uinjkt.ac.id` untuk Firebase Authentication.
- Profil mahasiswa mencatat NIM dan alamat email tersebut di Firestore.
- Firebase mengirim tautan verifikasi setelah registrasi; login mahasiswa dibatasi sampai alamat email terverifikasi.
- NIM yang sudah tercatat di Firestore tidak dapat dipakai untuk mendaftar lagi.
- Kata sandi registrasi harus minimal enam karakter, berisi huruf besar dan angka, serta tidak boleh berisi simbol.
- Alamat email kampus yang dibentuk aplikasi harus benar-benar dapat menerima email verifikasi.

### Akun Dosen

Akun dosen bawaan diatur dalam `src/App.jsx`. Untuk deployment, hindari kredensial tetap di source code. Buat dan kelola akun dosen melalui mekanisme administrasi yang aman, lalu ganti atau hapus kredensial bawaan.

## Konfigurasi EmailJS

Notifikasi email tugas dikirim dari browser menggunakan EmailJS. Fitur ini memerlukan Service ID, Template ID, dan Public Key.

1. Buat Email Service dan hubungkan penyedia email.
2. Buat template email. Atur **To Email** menjadi `{{to_email}}`.
3. Isi template dapat menggunakan variabel berikut:
   - `{{to_name}}`
   - `{{assignment_title}}`
   - `{{course}}`
   - `{{deadline}}`
   - `{{description}}`
   - `{{resource_url}}`
4. Buat `.env.local` pada direktori utama proyek:

   ```env
   VITE_EMAILJS_SERVICE_ID=service_id_anda
   VITE_EMAILJS_TEMPLATE_ID=template_id_anda
   VITE_EMAILJS_PUBLIC_KEY=public_key_anda
   ```

5. Hentikan dan jalankan ulang server Vite setelah mengubah file lingkungan.
6. Buat tugas percobaan dan periksa inbox serta folder spam.

EmailJS mengirim notifikasi kepada mahasiswa yang memiliki alamat email pada profil. Pengiriman lampiran berkas tidak dilakukan lewat email; gunakan tautan yang dapat diakses penerima pada Resource URL.

## Menjalankan Aplikasi

```bash
npm run dev
```

Alamat lokal ditampilkan pada terminal Vite. Untuk menguji hasil produksi secara lokal:

```bash
npm run build
npm run preview
```

## Alur Penggunaan

### Registrasi dan login mahasiswa

1. Pilih peran **Student**, lalu buka **Register here**.
2. Isi nama lengkap dengan setiap kata diawali huruf kapital, NIM angka, bagian nama email, dan kata sandi sesuai ketentuan.
3. Buka email verifikasi dan tekan tautan Firebase.
4. Setelah verifikasi, masuk menggunakan NIM atau alamat email lengkap bersama kata sandi.

### Tugas dosen dan pengumpulan mahasiswa

1. Dosen membuka **Task Management** dan mengisi judul, mata kuliah, tenggat, deskripsi, serta materi jika ada.
2. Pilih apakah notifikasi email perlu dikirim, lalu tekan **Assign to All Students**.
3. Mahasiswa menemukan tugas di To-Do List, menekan **Attach**, lalu mengirim berkas, gambar, atau tautan.
4. Dosen memeriksa status dan kiriman melalui **Student Progress**.

Lampiran berkas yang disimpan langsung di Firestore dibatasi hingga 700 KB. Untuk berkas lebih besar, unggah ke layanan berkas lain dan sertakan tautan dengan izin akses yang sesuai.

### Energy Recharge

Mahasiswa dapat memainkan Memory Sequence atau Quick Math saat energi belum penuh. Permainan yang berhasil menambah energi hingga batas 100% dan memberi EXP. Sesi belajar mengurangi energi; waktu istirahat memulihkannya.

### Log intervensi dosen

Pada monitor risiko burnout, dosen dapat mengisi catatan tindak lanjut dan memilih **Log Intervention**. Catatan disimpan pada collection `interventions`. Tombol **Contact Student** membuka aplikasi email dengan draf pesan kepada mahasiswa.

## Sistem EXP dan Level

Level maksimum adalah 100. EXP untuk naik level ditentukan dari level saat ini:

| Rentang level | EXP untuk naik level |
| --- | ---: |
| 1–3 | 300 per level |
| 4–6 | 600 per level |
| 7–8 | 800 per level |
| 9–10 | 1.000 per level |
| 11–99 | 2.000 per level |

Nama badge level 1–10 tercantum pada dashboard mahasiswa. Level 10–99 memakai gelar Supreme Archmage of AdaptLearn; Level 100 membuka Demon King.

## Analisis Risiko Burnout

Perhitungan risiko berada di `src/burnout.js`. Skor menggabungkan indikator pola penyelesaian tugas, durasi belajar, sesi larut malam, penurunan aktivitas, dan energi. Kategori yang ditampilkan:

- 0–29: **Low Risk**.
- 30–59: **Moderate (At Risk)**.
- 60–100: **High (Burnout Indicated)**.

Skor merupakan indikator aplikasi untuk membantu pemantauan, bukan diagnosis medis.

## Struktur Proyek

```text
src/
  App.jsx             Inisialisasi Firebase, autentikasi, data dan layout utama
  login_view.jsx      Registrasi, login, reset kata sandi dan verifikasi email
  student_view.jsx    Dashboard, tugas, materi, energy games dan leaderboard mahasiswa
  lecturer_view.jsx   Overview, pengelolaan tugas dan pemantauan mahasiswa
  burnout.js          Perhitungan skor risiko burnout
  assets/             Logo dan gambar latar
```

## Perintah

| Perintah | Fungsi |
| --- | --- |
| `npm run dev` | Menjalankan server pengembangan Vite |
| `npm run build` | Membuat bundle produksi di direktori `dist` |
| `npm run preview` | Menyajikan bundle produksi secara lokal |
| `npm run lint` | Menjalankan ESLint |

## Catatan Keamanan dan Batasan

- Variabel `VITE_*` masuk ke bundle sisi browser; jangan simpan password atau rahasia server di dalamnya. Public Key EmailJS memang dirancang untuk digunakan pada client, tetapi batasi domain dan kuota pengiriman dari dashboard EmailJS.
- Konfigurasi Firebase web dapat dilihat pengguna aplikasi. Keamanan data harus ditegakkan melalui Firebase Security Rules.
- Pengubahan EXP atau role di client tidak boleh dianggap tepercaya untuk sistem produksi. Validasi otoritatif perlu dipindah ke backend tepercaya.
- Fitur Courses berisi tautan contoh `#`; ganti dengan URL materi yang benar sebelum digunakan.
- Energi saat ini disimpan pada profil Firestore dan dicache pada browser.
- Notifikasi H-3/H-1 tidak berjalan otomatis. Pengiriman berjadwal memerlukan backend atau scheduler.
- Firebase Storage tidak digunakan. File yang disimpan langsung di Firestore dibatasi ukurannya agar dokumen tetap kecil.
