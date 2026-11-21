<div align="center">

<h1>Hybrid Metaheuristik untuk Cloud Task Scheduling</h1>

<p>Tugas 7 SOKA, Kelompok 5<br>
HSO (PSO + Salp Swarm) vs HMMGA (Max-Min + Genetic Algorithm) di CloudSim 7.0.1, dibandingkan dengan CSA dan PHS dari tugas 5</p>

![Java](https://img.shields.io/badge/Java-21-E76F00?style=flat-square&logo=openjdk&logoColor=white)
![CloudSim](https://img.shields.io/badge/CloudSim-7.0.1-1f6feb?style=flat-square)
![React](https://img.shields.io/badge/React-19-149ECA?style=flat-square&logo=react&logoColor=white)
![Three.js](https://img.shields.io/badge/React_Three_Fiber-9-000000?style=flat-square&logo=threedotjs&logoColor=white)
![JUnit](https://img.shields.io/badge/JUnit-5-25A162?style=flat-square&logo=junit5&logoColor=white)

[Tugas](#tugas) · [Hasil](#hasil) · [Algoritma](#algoritma) · [Presentasi](#presentasi) · [Cara menjalankan](#cara-menjalankan) · [Referensi](#referensi)

</div>

## Tugas

Dari `context.md`: pilih dua algoritma hybrid dari paper dan cantumkan referensinya, implementasikan keduanya di CloudSim, uji dengan dataset GoCJ dari tugas 5, presentasikan cara kerja hybrid yang lebih unggul, lalu bandingkan dengan dua metode yang dipilih sebelumnya (CSA dan PHS).

| Hybrid | Paper | File |
|---|---|---|
| **HSO**: Hybrid Swarm Optimization | Eldesokey dkk. (2021), *Int. J. Commun. Syst.*, e4694, [doi:10.1002/dac.4694](https://doi.org/10.1002/dac.4694) | `docs/hso-eldesokey-2021.pdf` |
| **HMMGA**: Hybrid Max-Min Genetic Algorithm | Kodli & Terdal (2021), *IJIES* 14(1), 63–71, [doi:10.22266/ijies2021.0228.07](https://doi.org/10.22266/ijies2021.0228.07) | `docs/hmmga-kodli-2021.pdf` |

## Hasil

Lingkungan: 2 datacenter, 10 host, 50 VM heterogen (20 Small 500 MIPS×1, 20 Medium 1000×2, 10 Large 2000×4). Dataset GoCJ 1.000, 5.000, dan 10.000 task. Setiap algoritma dijalankan 3 kali (seed 42, 43, 44), lalu metriknya dirata-rata. Snapshot lengkap ada di `web/public/data/results/gocj-<n>.json`.

**Makespan rata-rata (detik).** LB = batas bawah teoretis `max(arrival + length/2000)`.

| Algoritma | 1.000 | 5.000 | 10.000 |
|---|---:|---:|---:|
| **HMMGA** | **2.062,0** | **5.237,5** | **23.173,3** |
| HSO | 2.062,0 | 6.259,7 ± 276,3 | 27.684,2 ± 2.021,9 |
| PHS (tugas 5) | 2.062,0 | 6.310,5 | 23.173,3 |
| CSA (tugas 5) | 4.348,3 ± 702,4 | 25.640,7 ± 144,3 | 40.500,0 ± 246,0 |
| Min-Min | 2.202,8 | 5.748,0 | 23.173,3 |
| Max-Min | 2.352,0 | 5.920,0 | 23.174,5 |
| SJF | 2.474,0 | 6.410,0 | 23.173,3 |
| FCFS | 3.202,0 | 5.406,5 | 23.844,0 |
| Round Robin | 9.888,0 | 30.850,0 | 45.404,0 |
| *LB* | *2.062,0* | *5.237,5* | *23.173,3* |

**PIR HMMGA** (Eq. 14 paper HSO: `(makespan_lain − makespan_HMMGA) × 100 / makespan_HMMGA`):

| Terhadap | 1.000 | 5.000 | 10.000 |
|---|---:|---:|---:|
| CSA | +110,9% | +389,6% | +74,8% |
| PHS | 0,0% | +20,5% | 0,0% |
| HSO | 0,0% | +19,5% | +19,5% |

**Kesimpulan.** HMMGA adalah hybrid yang lebih unggul. Ia mencapai batas bawah di ketiga skala dengan SD 0, mengalahkan HSO di 5k dan 10k, mengalahkan CSA di semua skala, dan mengalahkan PHS di 5k. Di 1k dan 10k, HMMGA seri dengan PHS karena keduanya sudah mencapai batas bawah.

**Trade-off yang perlu disebut:**
- Scheduling time HMMGA 7,6 s (5k) dan 10,7 s (10k), sedangkan PHS hanya 0,5 s dan 0,9 s.
- Di 5k, waiting time Min-Min (283 s) dan FCFS (752 s) lebih rendah daripada HMMGA (994 s).
- HMMGA lebih murah dan lebih seimbang daripada PHS di semua skala. Min-Min dan SJF lebih murah lagi, tetapi beban VM-nya sangat timpang (imbalance 7,2 dan 8,5 di 10k).
- Energi di model ini proporsional terhadap makespan, jadi tidak dibahas sebagai trade-off terpisah.

## Algoritma

Kode ada di `java/src/main/java/id/ac/soka/scheduling/algorithm/`.

- **`HmmgaScheduler`**:
  - Populasi awal: individu Max-Min (elit), 20% varian Max-Min yang dimutasi ringan, sisanya acak.
  - Tiap generasi: (1−r)·p disalin (elit lebih dulu, sisanya roulette), lalu r·p dibentuk lewat two-point crossover dengan Pc adaptif (Eq. 1) dan mutasi dengan Pm adaptif (Eq. 2).
  - Setelah itu, individu terbaik menjalani migrasi dari VM overload ke VM underload (Step 6).
  - Parameter: p = 30, G = 150, r = 0,6, k₁ = k₃ = 1,0, k₂ = k₄ = 0,5.
- **`HsoScheduler`**:
  - Posisi kontinu di atas VM yang diurutkan berdasarkan kapasitas, dengan populasi awal dari GA singkat.
  - PSO Eq. 9 dengan inersia menurun linier.
  - Rantai salp di sekitar gbest: leader memakai Eq. 1 dengan c₁ = 2e^-(4s/sₘₐₓ)² (Eq. 2), follower memakai Eq. 3.
  - Deteksi VM overload sebagai adaptasi MLR-DOVM.
  - Parameter: 30 partikel × 150 iterasi.
- **`LoadState`**: migrasi best-improvement yang dipakai bersama oleh kedua hybrid. Langkah diterima jika makespan tidak naik dan VM bottleneck menjadi lebih ringan. Aturan ini memecah kondisi seri di makespan, yang sering terjadi karena panjang task GoCJ kelipatan 1000 MI.
- **`ScheduleEvaluator`**: decoder tanpa alokasi yang identik dengan `ScheduleDecoder` (diuji). Dipakai sebagai fungsi fitness.

Catatan adaptasi:
- MLR-DOVM penuh butuh data profiling RAM/BW/time-series yang tidak ada di GoCJ, jadi diganti prediktor utilisasi CPU analitik (finish VM / rata-rata finish, threshold 1,0).
- Eq. 1 SSA diterapkan pada subset dimensi yang meluruh, karena memindahkan semua dimensi sekaligus merusak solusi diskret.

## Presentasi

**Cloud Kitchen** (`web/`, React 19 + Vite + React Three Fiber) adalah satu dunia 3D penuh layar yang memvisualkan konsep HMMGA sebagai dapur pesanan online. Isi cerita dibawakan oleh panel kaca di sisi kiri.

| Konsep | Di dalam dapur |
|---|---|
| VM Small / Medium / Large | koki junior (1 kompor), koki senior (2 kompor), kepala koki (4 kompor) |
| PE, MIPS | jumlah kompor, kecepatan masak |
| task GoCJ | pesanan (rantang); tinggi rantang = lama dimasak oleh koki itu |
| makespan | garis merah: pesanan terakhir selesai; garis biru = batas tercepat |
| scheduler | manajer |

Isi 9 bab:
1. **Sambutan**: peta konsep dan daftar tim.
2. **Seleksi**: HSO vs HMMGA di panggung kompetisi, dengan sitasi. HMMGA menang di makespan, jadi HMMGA yang dipresentasikan.
3. **Dapur**: tantangan interaktif. Klik rantang, lalu klik kompor koki untuk memindahkan pesanan, dan coba samai HMMGA. Isinya:
   - papan skor satu sumbu: Round Robin, Max-Min, HMMGA, batas tercepat, dan penanda "Dapur sekarang" beserta asal jadwalnya
   - garis target HMMGA
   - tombol **Petunjuk**, yang mencari pindahan terbaik dari koki bendera merah
   - tombol **Putar waktu**, yang memutar ulang dapur dari detik 0 sehingga menara tumbuh dan garis makespan muncul di akhir
4. **Max-Min**: manajer mengambil pesanan terberat lebih dulu dan memberikannya ke koki yang paling cepat selesai (step/play). Bab 4–6 diawali peta alur HMMGA: Max-Min → GA → migrasi.
5. **GA**: ruang rencana berisi kartu jadwal (kromosom) yang diurutkan menurut fitness, roda roulette, meja persilangan two-point dengan animasi mutasi, dan mahkota elit. Pendukungnya:
   - kotak istilah dan "resep satu generasi" (1 elit + 4 salinan roulette + 7 anak)
   - rumus Pc/Pm adaptif dengan nilai aktual
   - sorotan yang juga mengikuti kartu klon dan salinan
   - tombol lompat ke generasi pemecah rekor
6. **Migrasi**: koki overload (bendera merah, kompor berasap) mengoper pesanan. Migrasi adalah langkah di setiap generasi, bukan tahap setelah GA. Bab ini membandingkan jadwal Max-Min, jadwal setelah migrasi, dan hasil akhir.
7. **Kompetisi**: hasil CloudSim 50 VM sebagai menara rantang (makespan ÷ batas bawah), plus chart makespan dan tabel PIR.
8. **Trade-off**: menara berganti metrik, ditambah heatmap dan scatter scheduling time.
9. **Kesimpulan**: temuan, catatan jujur, dan referensi.

Dapur demo memakai 30 task GoCJ (dataset 5000, baris 930–959) dan satu host. Simulasinya berjalan di browser dengan port JS HMMGA yang hasilnya identik dengan Java untuk seed yang sama. Seed default dapur adalah 44, karena di seed ini semua tahap HMMGA terlihat: Max-Min 227 s, migrasi gen 1 menjadi 215 s, lalu mutasi gen 3 menjadi 207 s. Di seed 42 dan 43, perbaikannya hanya datang dari migrasi. Hasil CloudSim tetap rata-rata seed 42–44. Batas tercepat dapur demo dihitung sebagai max(pesanan datang + porsi ÷ 2000 MIPS, total porsi sejak waktu t ÷ 13.000 MIPS) ≈ 190 s.

Navigasi: ← / → atau `#bab-N`, seret untuk memutar, scroll untuk zoom. **H** menyembunyikan penjelasan; kontrol bab (putar/langkah, seed, tahap, skala, metrik) lalu pindah ke dock mengambang di atas navigasi supaya demo 3D tetap bisa dijalankan. **B** memperbesar panel dan teks, **F** membuka mode baca layar penuh (Esc kembali), dan tombol di kanan atas membuat browser layar penuh.

## Cara menjalankan

```powershell
# Tes (28 tes, termasuk invarian HSO/HMMGA)
cd java; .\gradlew.bat test

# CLI interaktif / instan
.\gradlew.bat runCli
.\gradlew.bat runCli --args="--tasks=5000 --runs=3 --algos=HSO,HMMGA,CSA,PHS,MaxMin"

# Regenerasi snapshot presentasi: jalankan server HTTP, lalu exporter
.\gradlew.bat run                     # terminal 1, http://localhost:8080
python ..\scripts\export_snapshots.py # terminal 2, default 1k/5k/10k × 3 run

# Presentasi
cd ..\web; npm ci; npm run dev        # atau: npm run build; npm run preview
```

Skrip pendukung di `web/scripts/`:
- `make-sample.mjs`: membuat instance lab dari dataset.
- `search-window.mjs`: mencari jendela 30 task tempat HMMGA bisa memperbaiki Max-Min.
- `parity.mjs`: mencetak hasil HMMGA versi JS untuk dibandingkan dengan versi Java.

GitHub Pages dibangun oleh `.github/workflows/pages.yml` (`npm ci`, typecheck, build, unggah `web/dist`).

## Struktur

```
task-7/
├── context.md, *.pdf        soal dan paper asli
├── dataset/                 GoCJ (salinan tugas 5)
├── docs/                    PDF keempat paper yang dirujuk
├── java/                    modul CloudSim (salinan mandiri tugas 5 + HSO/HMMGA)
├── scripts/export_snapshots.py
├── web/                     presentasi Vite + React + R3F
└── .github/workflows/pages.yml
```

## Referensi

1. Kodli, S., & Terdal, S. (2021). Hybrid Max-Min Genetic Algorithm for Load Balancing and Task Scheduling in Cloud Environment. *International Journal of Intelligent Engineering and Systems*, 14(1), 63–71. https://doi.org/10.22266/ijies2021.0228.07
2. Eldesokey, H. M., Abd El-atty, S. M., El-Shafai, W., Amoon, M., & Abd El-Samie, F. E. (2021). Hybrid swarm optimization algorithm based on task scheduling in a cloud environment. *International Journal of Communication Systems*, e4694. https://doi.org/10.1002/dac.4694
3. Jena (2017). A Two-Stage Clonal Selection Algorithm for Task Scheduling in Cloud Computing Environment. Metode CSA, tugas 5.
4. Melnik & Trofimenko (2015). Polyrhythmic Harmony Search Algorithm for Resource Allocation in Distributed Computing Systems. Metode PHS, tugas 5.
