# Дом по слоям

**[Открыть 3D-просмотрщик на GitHub Pages](https://jhoncool.github.io/view/)**

В разделе кладки доступны этажи, ряды и планы. Румтур начинается перед входной дверью. На iPad можно удерживать стрелку ходьбы и осматриваться вторым пальцем. [Кладка первого этажа и мансарды](https://jhoncool.github.io/view/#masonry)

Ендову между гаражом и слуховым окном над входом можно открыть крупным планом. На схеме отмечен участок под свесом. [Примыкание над входом в 3D](https://jhoncool.github.io/view/#entry-valley)

Статическая публикация HTML-просмотрщика единого дома 62–47AFL из проекта `house`.
В [разделе «Листы»](https://jhoncool.github.io/view/#sheets) доступны 48 оцифрованных страниц, пять редакций с прямым краем плиты и исходные сканы для сравнения. [Векторный комплект для печати на А3](https://jhoncool.github.io/view/data/house/print-sheets/62-47AFL-A3.pdf) содержит 53 страницы. После каждой исходной версии изменённого плана идёт его редакция. Печатайте на А3 в альбомной ориентации и масштабе 100 %.

Все 53 страницы содержат векторную геометрию и выделяемые текстовые подписи. На исправленной ВК-1 ввод воды расположен в 250 мм от осей 1 и Е. Превью листов и узлов встроены в HTML. Векторные PDF и полноразмерные сканы загружаются при открытии. Редактируемые исходники и рабочая база хранятся в проекте house.

## GitHub Pages

В [Settings → Pages](https://github.com/jhoncool/view/settings/pages) выбрано:

- Source: **Deploy from a branch**.
- Branch: **main**, папка **/ (root)**.

Файл `.nojekyll` отключает обработку Jekyll. После отправки коммита в `main`
GitHub автоматически обновляет сайт; результат виден в
[Actions](https://github.com/jhoncool/view/actions).

## Индексация

HTML содержит `<meta name="robots" content="noindex, nofollow, noimageindex">`.
Это просьба к поддерживающим её поисковикам не индексировать страницу и изображения.
Сайт и репозиторий публичны; эта настройка не ограничивает доступ по ссылке.

`robots.txt` с запретом обхода не добавлен: поисковик должен прочитать страницу,
чтобы увидеть `noindex`. На проектном адресе `/view/` файл `robots.txt` также
не управляет всем доменом. См. [документацию Google о noindex](https://developers.google.com/search/docs/crawling-indexing/block-indexing).
Настройка HTML не управляет индексацией самого репозитория на github.com.

## Обновление из локального проекта

В проекте `house` можно попросить Codex **«обнови pages»** или вызвать
[$update-pages](https://github.com/jhoncool/house/blob/main/.agents/skills/update-pages/SKILL.md).
Скилл синхронизирует HTML, сохраняет `noindex`, проверяет все встроенные изображения,
отправляет коммит и проверяет завершение публикации.

При соседних папках `/Users/shangin/g/house` и `/Users/shangin/g/view`:

```bash
cd /Users/shangin/g/view
python3 scripts/update-viewer.py
git add index.html data/house/print-sheets data/house/revised-sheets
git commit -m "Update house viewer"
git push origin main
```

Можно передать другой исходный HTML: `python3 scripts/update-viewer.py /path/to/index.html`.
Экспортёр проверяет контрольные суммы печатных листов и полных сканов, переносит файлы из реестра и сохраняет директиву `noindex`.
