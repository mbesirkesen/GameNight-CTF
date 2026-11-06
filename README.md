# Cyber Detectives CTF

Üç parçalı yapı:

| Klasör | Rol | Port |
|---|---|---|
| `frontend/` | Oyuncu arayüzü | 5173 |
| `backend/` | Bayrak, skor, oturum, WS API | 8787 |
| `admin/` | Kontrol odası | 5174 |

## Kurulum

```bash
npm run install:all
```

## Çalıştırma

Üç ayrı terminal:

```bash
npm run dev:backend
npm run dev:frontend
npm run dev:admin
```

## Kodlar / env

`backend/.env` (örnek: `backend/.env.example`):

- `ACCESS_CODE` — oyuncu giriş kodu (varsayılan `HSD_FIRAT_2026`)
- `ADMIN_PASSWORD` — admin şifresi (varsayılan `admin_hsd_2026`)
- `SESSION_HOURS` — normal süre (3)
- `PRACTICE_MINUTES` — prova süresi (15)
- `SUBMIT_RATE_LIMIT` — dakikada bayrak denemesi (30)
- `CORS_ORIGIN` — izinli origin’ler

## Bayrak biçimi

- Sabit format: `CTF{icerik}`
- İçerik: yalnızca `a-z`, `0-9`, `_`
- Büyük/küçük harf ve Türkçe `İ` / `ı` / `i` fark etmez

## Oyun gecesi checklist

1. Backend + frontend + admin ayakta mı kontrol et (`/api/health`)
2. Admin → **Yedek Al** (isteğe bağlı)
3. Gerekirse **Her Şeyi Sil** veya **Lobiye Dön**
4. İstersen **Prova** aç (15 dk)
5. Oyuncular rumuz + kod ile giriş yapsın (lobi)
6. Herkes gelince **Oyunu Başlat**
7. Gerekirse duyuru gönder / dalga aç / dondur
8. Bitince **Skor CSV** + **Çözüm CSV** indir
9. İtiraz için audit log admin sağlık panelinde

## Yedek host

Tek makine düşerse: SQLite `backend/data/ctf.sqlite` + `backend/data/backups/` kopyalanıp başka makinede aynı `backend/.env` ile ayağa kaldırılır. Frontend/admin yalnızca API URL’ini (`VITE_API_URL`) yeni hosta çevirir.

## Neden backend?

Bayraklar ve skor doğrulama sunucuda. Oyuncular lobide bekler; süre admin **Oyunu Başlat** deyince açılır. WebSocket ile duyuru/skor anlık düşer; HTTP poll yedek kanaldır.
