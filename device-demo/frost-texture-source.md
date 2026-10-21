# Текстура и рост инея

`frost-height.png` — локальная карта высот, созданная встроенным ImageGen 21 октября 2026 года. Это не цветовая фотография: карта используется для кристаллического рельефа и плотности налёта. Внешних запросов при просмотре сайта нет.

Рост в `frost-surface.js` рассчитывается в координатах прибора от физических рёбер и углов к центрам панелей. Трипланарная проекция сохраняет масштаб на крышке и боковых стенках независимо от UV-развёртки. Мелкие объёмные кристаллы и сосульки прикреплены к модели и вращаются вместе с ней. При нулевом прогрессе налёт и геометрия льда скрыты.

Фронт состоит из детерминированных очагов вдоль каждого шва: у них различаются задержка, скорость, ширина и изгиб направления роста. Прокрутка меняет только порог времени — очаги не пересоздаются и не прыгают при движении назад. Отдельные скопления постепенно соединяются, а плотность покрытия остаётся неоднородной.

Вместо одного равномерного тайлинга карта читается в двух повёрнутых масштабах с плавным искажением координат. Ветвистые структуры сосредоточены у краёв и в отдельных скоплениях; мелкая процедурная изморозь заполняет промежутки. Цвет, шероховатость и рельеф используют одну маску роста. Объёмные кристаллы и сосульки тоже распределены группами, а не равномерным рядом. Результат приближен к фотографии по распределению налёта; карта не является точным сканом поверхности из референса.

Промпт генерации (built-in ImageGen):

> Generate a square seamless tileable grayscale HEIGHT MAP texture for physically based 3D hoarfrost on dark metal. This is a technical material asset, not a photograph or a scene. Orthographic flat top-down map, evenly distributed detail across all edges, no border, no text, no lighting or cast shadows baked in. Connected delicate fern-like frost dendrites, many irregular branching feathery crystalline needles, asymmetric elongated frost fans and small granular crystal clusters interwoven into a natural continuous microstructure. Avoid discrete six-point snowflake icons or regular star shapes, avoid large cloudy blobs or veins. About 40 small irregular feathery branching colonies across image, surrounded by hundreds of fine granular crystals. Low substrate height dark charcoal; thin raised crystalline ridges light gray to white, graded ridge heights. Fine very sharp micro-detail, some dark gaps between colonies, roughly 50% to 60% coverage. Perfectly seamless edge continuity. Flat grayscale neutral data, no blue coloration. Output a texture asset suitable for deriving a bump/normal map and frost coverage mask.
