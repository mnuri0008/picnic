
# NURI – Piknik v4 PRO
- TR/EN iki dil
- Genişletilmiş kategoriler + birimler (kg,g,lt,ml,adet,paket)
- 50 kullanıcıya kadar; online / toplam gösterimi + baş harf rozetleri
- Tarih seçimi; son 2 gün kala kilit; 7 gün sonra otomatik oda temizleme
- iOS PWA (Ana ekrana ekle)

## Lokal Çalıştırma (Windows)
1) PowerShell: `tools\run_local.ps1`
2) Tarayıcı: http://127.0.0.1:8000

## Render Deploy
- `render.yaml` hazır. Render otomatik `gunicorn+eventlet` kurar.
- Ortam değişkeni: `MAX_USERS=50` (değiştirilebilir)
