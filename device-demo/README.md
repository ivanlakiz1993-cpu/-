# Device — Blender + Three.js

Откройте `device.blend` в Blender или запустите генератор из корня проекта:

```powershell
& 'C:\Program Files (x86)\Steam\steamapps\common\Blender\blender.exe' --background --python tools/build_device.py
```

Скрипт использует API Blender 4.x; фактически экспорт проверен в установленном Blender 5.2.2 LTS. Генератор очищает текущую сцену, поэтому запускайте его в отдельном файле или фоновом процессе. Он создаёт GLB, BLEND, процедурную HDR-карту студийных софтбоксов и tangent-space normal map. Все файлы автономны.

Для просмотра запустите из корня проекта HTTP-сервер (например `python -m http.server 8080`) и откройте `http://localhost:8080/device-demo/`. Открытие HTML через file:// не поддерживается загрузчиками браузера. Интернет для просмотра не нужен.

The 400vh scroll range rotates the model around Y from 0? to 270? with scrub 1. All libraries are stored in `vendor/` and load from this site; no external CDN or import map is used. HDR, GLB, and normal-map failures are reported to the console.

Геометрия восстановлена по изображению, реальные размеры неизвестны; задняя стенка достроена. Это не подтверждённая точная инженерная копия. Корпус сделан матовым пластиком согласно техническому заданию; шлифованный металл назначен отдельной панели. Карта нормалей применяется к панели в Three.js. Цвет контактов серебристый согласно Metal_Shiny в задании.

Локальные библиотеки: Three.js 0.170.0 (MIT), GSAP 3.12.5 (лицензия в заголовках файлов). studio.hdr и brushed_normal.jpg генерируются собственным скриптом.

Проверка экспорта: `python tools/check_device_export.py`. Визуальное соответствие браузерного рендера фотографии требует отдельной оценки; успешный экспорт сам по себе его не гарантирует.
