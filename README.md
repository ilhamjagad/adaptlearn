# AdaptLearn

AdaptLearn merupakan platform pembelajaran adaptif berbasis web yang dirancang untuk memfasilitasi interaksi akademik antara mahasiswa dan dosen. Aplikasi ini menggabungkan pengelolaan tugas kuliah, pencatatan durasi belajar mandiri dengan metode Pomodoro, analisis wawasan belajar adaptif, sistem gamifikasi berbasis EXP dan misi harian, permainan mini untuk relaksasi otak, serta pemantauan keaktifan kelas secara real-time.

## Daftar Isi

- [Fitur Utama](#fitur-utama)
- [Teknologi yang Digunakan](#teknologi-yang-digunakan)
- [Prasyarat Sistem](#prasyarat-sistem)
- [Panduan Instalasi Lokal](#panduan-instalasi-lokal)
- [Pengaturan Firebase](#pengaturan-firebase)
- [Pengaturan EmailJS](#pengaturan-emailjs)
- [Menjalankan Aplikasi](#menjalankan-aplikasi)
- [Alur Penggunaan Aplikasi](#alur-penggunaan-aplikasi)
- [Mekanisme EXP, Level, dan Gamifikasi](#mekanisme-exp-level-dan-gamifikasi)
- [Struktur Direktori Proyek](#struktur-direktori-proyek)
- [Daftar Perintah](#daftar-perintah)
- [Batasan dan Catatan Keamanan](#batasan-dan-catatan-keamanan)

## Fitur Utama

### Antarmuka Mahasiswa

- **Autentikasi dan Verifikasi Akun**: Pendaftaran mahasiswa menggunakan nama lengkap, Nomor Induk Mahasiswa (NIM), email kampus, dan kata sandi, dilengkapi pengiriman tautan verifikasi email sebelum akun dapat dipakai masuk serta fitur pemulihan kata sandi.
- **Dashboard Adaptif**: Menyajikan status level, progres EXP, lencana gelar (badge), pengingat tenggat tugas terdekat, ringkasan aktivitas mingguan, grafik fokus 7 hari terakhir, cuplikan peringkat kelas, riwayat perolehan EXP terbaru, serta spanduk *Adaptive Study Insight* yang memberi rekomendasi langkah belajar berdasarkan tenggat dan rentetan belajar (*streak*) pengguna.
- **Study Care (Timer Fokus Pomodoro)**: Pengatur waktu belajar dengan pilihan mode preset (*Classic*, *Deep Work*, *Quick*) maupun kustomisasi durasi fokus, istirahat singkat, istirahat panjang, dan jumlah putaran. Setiap menit fokus yang tuntas memberikan 1 EXP. Pada fase istirahat tersedia permainan mini *Tic-Tac-Toe*.
- **To-Do List**: Mengelola tugas pribadi maupun tugas global dari dosen dengan indikator perolehan EXP berdasarkan kecepatan pengumpulan sebelum tenggat waktu. Mahasiswa dapat melampirkan dokumen (Word/PDF), gambar, atau tautan URL untuk tugas dari dosen.
- **Gamifications Hub**: Pusat aktivitas gamifikasi yang mencakup penghitung *Study Streak* harian beserta tingkat pengali bonus, misi harian dan mingguan (*Daily & Weekly Quests*) dengan klaim hadiah EXP, *Class Boss Raid* kolaboratif di mana setiap pengumpulan tugas kelas mengurangi nyawa boss bersama, serta *Brain Games Arcade* berisi permainan *Daily Wordle* dan *Memory Card Match* berhadiah EXP harian.
- **Leaderboard**: Papan peringkat global yang menampilkan urutan mahasiswa berdasarkan total EXP, level, dan gelar tertinggi yang telah dicapai.

### Antarmuka Dosen

- **Lecturer Overview**: Ringkasan metrik kelas meliputi total mahasiswa terdaftar dan mahasiswa aktif pekan ini, jumlah tugas aktif, total akumulasi waktu belajar mandiri kelas selama 7 hari terakhir, serta grafik keterlibatan kelas 7 hari (*7-Day Class Engagement*).
- **At-Risk Students Detector**: Pendeteksi otomatis mahasiswa yang memerlukan perhatian khusus apabila tidak memiliki aktivitas belajar atau pengumpulan tugas selama lebih dari 7 hari, atau memiliki tugas yang belum dikumpulkan maupun melewati tenggat.
- **Upcoming Deadline Alerts dan Submission Tracker**: Peringatan tugas yang mendekati tenggat atau sudah lewat waktu, dilengkapi pelacak persentase pengumpulan tiap tugas secara langsung.
- **Task Management**: Pembuatan tugas baru untuk seluruh mahasiswa dengan pilihan mata kuliah, tanggal tenggat, deskripsi, tautan referensi, dan lampiran berkas. Mendukung penyaringan daftar tugas berdasarkan mata kuliah (*Course Filter*), penyuntingan detail tugas secara langsung (*Inline Edit*), serta penghapusan tugas.
- **Notifikasi Email Otomatis**: Opsi pengiriman pemberitahuan tugas baru secara massal ke alamat email seluruh mahasiswa terdaftar melalui EmailJS.
- **Student Progress dan Manajemen Akun**: Pemantauan status pengumpulan tiap mahasiswa per mata kuliah, peninjauan maupun pengunduhan berkas/tautan hasil kiriman mahasiswa, serta pengelolaan data nama, perolehan EXP, atau penghapusan akun mahasiswa.

## Teknologi yang Digunakan

- React 19
- Vite
- Tailwind CSS 4
- Firebase Authentication
- Cloud Firestore
- EmailJS Browser SDK
- Lucide React (ikon antarmuka)

## Prasyarat Sistem

- Node.js versi terbaru yang kompatibel dengan Vite.
- Pengelola paket npm.
- Proyek Firebase dengan layanan Authentication dan Cloud Firestore yang sudah diaktifkan.
- Akun EmailJS apabila fitur pengiriman notifikasi email tugas ingin digunakan.

## Panduan Instalasi Lokal

1. Salin repositori proyek ke komputer lokal dan masuk ke folder proyek:

   ```bash
   git clone https://github.com/ilhamjagad/adaptlearn.git
   cd adaptlearn
   ```

2. Instal seluruh paket dependensi yang dibutuhkan:

   ```bash
   npm install
   ```

3. Jalankan server pengembangan lokal:

   ```bash
   npm run dev
   ```

4. Akses alamat URL lokal yang tertera pada terminal menggunakan peramban.

## Pengaturan Firebase

Konfigurasi koneksi Firebase didefinisikan di dalam `src/App.jsx` pada objek `firebaseConfig`. Sesuaikan nilai konfigurasi tersebut dengan kredensial aplikasi web dari Firebase Console Anda.

Pastikan layanan berikut telah dikonfigurasi di Firebase Console:

1. **Authentication > Sign-in method > Email/Password**: Aktifkan metode masuk menggunakan email dan kata sandi.
2. **Authentication > Settings > Authorized domains**: Daftarkan domain lokal (`localhost`) serta domain hosting produksi Anda.
3. **Firestore Database**: Buat database Firestore dan terapkan aturan keamanan (*Security Rules*) yang sesuai.
4. **Authentication > Templates > Email address verification**: Sesuaikan templat tautan verifikasi email untuk pendaftar baru.

Struktur penyimpanan data utama berada di bawah jalur `artifacts/{appId}/public/data/` dengan koleksi berikut:

- `users`: Menyimpan profil pengguna, NIM, email, peran (`student` atau `lecturer`), total EXP, status verifikasi, serta riwayat klaim misi harian.
- `tasks`: Menyimpan daftar tugas global dari dosen maupun tugas pribadi mahasiswa.
- `completions`: Mencatat riwayat penyelesaian tugas, lampiran hasil kerja mahasiswa, dan jumlah EXP yang diperoleh.
- `studySessions`: Menyimpan catatan durasi dan waktu pelaksanaan sesi fokus Pomodoro.

### Ketentuan Akun Mahasiswa dan Dosen

- Mahasiswa dapat masuk menggunakan NIM atau alamat email kampus yang telah terverifikasi.
- Sistem mencegah pendaftaran ulang menggunakan NIM yang sudah terdaftar di Firestore.
- Kata sandi pendaftaran harus terdiri dari minimal enam karakter, memuat huruf kapital dan angka, serta tanpa karakter simbol.
- Kredensial akses dosen bawaan dikonfigurasi di dalam `src/App.jsx` untuk keperluan pengujian lokal dan sebaiknya dikelola melalui mekanisme administrasi aman saat tahap produksi.

## Pengaturan EmailJS

Pengiriman notifikasi email dari halaman *Task Management* dosen memanfaatkan layanan EmailJS sisi klien.

1. Buat layanan email baru pada dasbor EmailJS dan hubungkan dengan penyedia email Anda.
2. Siapkan templat email dengan kolom **To Email** diisi `{{to_email}}`.
3. Gunakan variabel berikut di dalam isi templat sesuai kebutuhan:
   - `{{to_name}}`
   - `{{assignment_title}}`
   - `{{course}}`
   - `{{deadline}}`
   - `{{description}}`
   - `{{resource_url}}`
4. Buat berkas `.env.local` pada direktori utama proyek dan isi dengan kredensial Anda:

   ```env
   VITE_EMAILJS_SERVICE_ID=service_id_anda
   VITE_EMAILJS_TEMPLATE_ID=template_id_anda
   VITE_EMAILJS_PUBLIC_KEY=public_key_anda
   ```

5. Mulai ulang server pengembangan Vite agar variabel lingkungan terbaca oleh aplikasi.

## Menjalankan Aplikasi

Untuk menjalankan mode pengembangan:

```bash
npm run dev
```

Untuk membangun berkas produksi dan mengujinya secara lokal:

```bash
npm run build
npm run preview
```

## Alur Penggunaan Aplikasi

### Pendaftaran dan Masuk Mahasiswa

1. Pilih peran **Student** pada halaman awal, lalu buka formulir pendaftaran.
2. Lengkapi nama lengkap, NIM, alamat email kampus, dan kata sandi sesuai aturan validasi.
3. Periksa kotak masuk atau folder spam email untuk menekan tautan verifikasi dari Firebase.
4. Masuk kembali ke aplikasi menggunakan NIM atau email beserta kata sandi.

### Pengelolaan Tugas dan Pengumpulan

1. Dosen masuk ke menu **Task Management**, mengisi judul tugas, memilih mata kuliah, menentukan tenggat waktu, serta menambahkan instruksi, tautan, atau lampiran berkas jika diperlukan.
2. Centang opsi pengiriman notifikasi email bila ingin memberi tahu mahasiswa secara otomatis, lalu tekan **Assign to All Students**.
3. Mahasiswa melihat tugas tersebut pada **To-Do List**, menekan **Attach**, lalu mengunggah dokumen, gambar, atau tautan URL sebagai bukti pengumpulan.
4. Dosen memantau status pengumpulan, mengunduh kiriman mahasiswa, atau memperbarui detail tugas melalui **Task Management** dan **Student Progress**.

### Sesi Fokus dan Aktivitas Gamifikasi

1. Mahasiswa membuka **Study Care**, memilih preset durasi atau mengatur waktu secara manual, lalu menjalankan sesi fokus hingga selesai untuk memperoleh EXP.
2. Pada halaman **Gamifications**, mahasiswa dapat memantau rentetan hari belajar (*Study Streak*), mengklaim hadiah misi harian/mingguan, berkontribusi pada serangan *Class Boss Raid*, serta memainkan *Daily Wordle* dan *Memory Card Match* untuk tambahan EXP harian.

## Mekanisme EXP, Level, dan Gamifikasi

- **Sesi Fokus Pomodoro**: Memberikan 1 EXP untuk setiap 1 menit sesi fokus yang diselesaikan penuh.
- **Penyelesaian Tugas**: Memberikan 20 EXP (selesai minimal 7 hari sebelum tenggat), 15 EXP (3–6 hari sebelum tenggat), 5 EXP (0–2 hari sebelum tenggat), atau 2 EXP (melewati tenggat).
- **Misi dan Permainan Mini**: Memberikan tambahan 15 hingga 100 EXP per klaim sesuai jenis misi harian, misi mingguan, atau tantangan permainan yang diselesaikan.

Batas level maksimum adalah Level 100 dengan kebutuhan EXP per kenaikan level sebagai berikut:

| Rentang Level | Kebutuhan EXP per Level |
| --- | ---: |
| Level 1–3 | 300 EXP |
| Level 4–6 | 600 EXP |
| Level 7–8 | 800 EXP |
| Level 9–10 | 1.000 EXP |
| Level 11–99 | 2.000 EXP |

Setiap kenaikan level dari Level 1 hingga Level 10 membuka lencana gelar khusus mulai dari *EXP Trainee* hingga *Supreme Archmage of AdaptLearn* (Level 10–99), serta gelar rahasia *Demon King* pada Level 100.

## Struktur Direktori Proyek

```text
src/
  App.jsx             Inisialisasi Firebase, manajemen autentikasi, langganan data Firestore, dan navigasi utama
  login_view.jsx      Antarmuka halaman masuk, pendaftaran mahasiswa, dan pengaturan ulang kata sandi
  student_view.jsx    Dashboard mahasiswa, Study Care Pomodoro, To-Do List, Gamifications Hub, dan Leaderboard
  lecturer_view.jsx   Overview dosen, deteksi mahasiswa berisiko, pengelolaan tugas, dan progres mahasiswa
  assets/             Aset gambar logo institusi dan latar belakang
```

## Daftar Perintah

| Perintah | Keterangan |
| --- | --- |
| `npm run dev` | Menjalankan server pengembangan lokal dengan Vite |
| `npm run build` | Mengompilasi aplikasi menjadi bundel produksi di folder `dist` |
| `npm run preview` | Menjalankan pratinjau lokal dari hasil build produksi |
| `npm run lint` | Memeriksa kualitas dan konsistensi kode menggunakan ESLint |

## Batasan dan Catatan Keamanan

- Variabel lingkungan berawalan `VITE_` akan disertakan dalam kode sisi klien sehingga tidak boleh digunakan untuk menyimpan rahasia server.
- Keamanan akses baca dan tulis data Firestore harus ditegakkan melalui *Firebase Security Rules* sesuai peran pengguna.
- Ukuran berkas lampiran yang disimpan langsung di dokumen Firestore dibatasi maksimal 700 KB; untuk ukuran berkas yang lebih besar, gunakan tautan berbagi dari layanan penyimpanan awan eksternal.
- Validasi penambahan EXP dan perubahan peran pengguna pada lingkungan produksi sebaiknya dipindahkan ke layanan backend tepercaya seperti Cloud Functions.