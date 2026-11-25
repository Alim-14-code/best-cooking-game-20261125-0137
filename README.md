# 🍳 Dapur Kilat — Game Masak Warung

[![competition](https://make.fun/badge/best-cooking-game-20261125-0137/competition?owner=Alim-14-code&repo=best-cooking-game-20261125-0137)](https://make.fun/bounty/best-cooking-game-20261125-0137)
[![rank](https://make.fun/badge/best-cooking-game-20261125-0137/rank?owner=Alim-14-code&repo=best-cooking-game-20261125-0137)](https://make.fun/bounty/best-cooking-game-20261125-0137)
[![reward](https://make.fun/badge/best-cooking-game-20261125-0137/reward?owner=Alim-14-code&repo=best-cooking-game-20261125-0137)](https://make.fun/bounty/best-cooking-game-20261125-0137)

Game masak warung asli: layani pesanan pelanggan secepat kilat di dapur warung
Indonesia. Semua gambar digambar di canvas, semua suara disintesis dengan
WebAudio — tanpa aset luar, tanpa request jaringan, tanpa build step.

## Cara main

1. **Pesanan muncul di PAPAN PESANAN** (atas) — tiap pesanan punya batas
   waktu sendiri. Klik pesanan untuk memilih target.
2. **Klik bahan di KONTER** (bawah) atau tekan tombol **1–0**. Bahan
   bertanda 🔥 (telur, ayam, mie, sate) harus dimasak di kompor dulu sampai
   MATANG, lalu klik kompornya untuk memindahkan ke piring.
3. **Rakit hidangan di piring** sesuai pesanan, lalu klik **BEL SAJI** atau
   tekan **Spasi** untuk menyajikan.
4. Sajian benar = koin + skor + kombo. Salah saji atau pesanan kedaluwarsa =
   strike. **3 strike = dapur tutup!**
5. Shift 150 detik. Tiap 5 sajian level naik — pesanan datang lebih cepat
   dan waktunya makin pendek.

## Menu warung

Nasi Goreng, Mie Ayam, Sate Ayam, Ayam Geprek, Telur Dadar, Es Teh Manis —
dari bahan nasi, telur, ayam, mie, sate, kecap, cabai, bawang, teh, dan es.

## Kontrol

| Tombol | Aksi |
|---|---|
| Klik / 1–0 | Tambah bahan ke piring (atau ke kompor kalau perlu dimasak) |
| Klik kompor | Ambil masakan yang sudah matang ke piring |
| Klik bahan di piring | Buang bahan dari piring |
| Klik pesanan | Pilih target pesanan |
| Spasi / klik bel | Sajikan hidangan |
| P / Esc | Jeda |
| M | Suara on/off |
| R / Enter | Main lagi (di layar akhir) |

## Menjalankan

```sh
node serve.ts
# buka http://localhost:8080
```

Game statis di `game/` (`index.html` + `game.js` + `game.css`), dimainkan di
desktop Chrome tanpa request jaringan.

## Lisensi

MIT — lihat `LICENSE`.
