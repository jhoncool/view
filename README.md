# Дом по слоям

**[Открыть 3D-просмотрщик на GitHub Pages](https://jhoncool.github.io/view/)**

У дома есть отдельный обзор с румтуром. Фундамент, кладка, перекрытие и крыша открывают свои сцены и чертежи. Выбранную деталь крыши можно вращать в карточке с размерами. [Дом в 3D](https://jhoncool.github.io/view/#model) · [Крыша](https://jhoncool.github.io/view/#roof)

Ендову между гаражом и слуховым окном над входом можно открыть крупным планом. На схеме отмечен участок под свесом. [Примыкание над входом в 3D](https://jhoncool.github.io/view/#entry-valley)

Статическая публикация HTML-просмотрщика единого дома 62–47AFL из проекта `house`.
В каталоге доступны 48 действующих листов и исходные сканы. У 22 изменённых листов сохранена также исходная оцифровка. В печатном комплекте каждый лист представлен один раз. Печатайте на А3, альбомная ориентация, масштаб 100 %. [Листы проекта](https://jhoncool.github.io/view/#sheets) · [Скачать 48 страниц А3](https://jhoncool.github.io/view/data/house/print-sheets/62-47AFL-A3.pdf).

Все 48 страниц содержат векторную геометрию и выделяемые текстовые подписи. На исправленной ВК-1 ввод воды расположен в 250 мм от осей 1 и Е. Каталог показывает WebP-превью листов, попавших в область просмотра. Векторные чертежи, PDF и сканы 300 dpi загружаются по запросу. Редактируемые исходники и рабочая база хранятся в проекте house.

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
Скилл запускает сборку, сохраняет `noindex` и проверяет файлы публикации. Команда
«обнови pages» также отправляет все текущие изменения рабочего проекта в
`house/main`, публикует сборку из `view/main` и проверяет развёртывание.

При соседних папках `/Users/shangin/g/house` и `/Users/shangin/g/view`:

```bash
cd /Users/shangin/g/house
HOUSE_PY='/Users/shangin/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/bin/python3'
"$HOUSE_PY" tools/build_model.py
"$HOUSE_PY" /Users/shangin/g/view/scripts/update-viewer.py
```

Просмотрщик публикуется как `index.html`, `assets/`, `data/` и `viewer-manifest.json`. Экспортёр проверяет SHA-256 печатных листов и сканов. В манифесте указаны файлы текущей сборки. Предыдущие файлы с хешем в имени остаются доступны вкладкам, открытым до обновления.

Для проверки отдельной сборки передайте `--out-dir /path/to/preview`. Другой локальный исходный HTML можно указать первым аргументом.
