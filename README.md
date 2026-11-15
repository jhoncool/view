# Дом по слоям

**[Открыть 3D-просмотрщик на GitHub Pages](https://jhoncool.github.io/view/)**

Статическая публикация HTML-просмотрщика единого дома 62–47AFL из проекта `house`.
Модель, интерфейс, превью всех 48 листов и 17 фрагментов встроены в `index.html`: сервер, сборка,
CDN и дополнительные библиотеки не нужны. Исходные PDF, изображения 300 dpi и
рабочая база данных здесь не публикуются. В карточках источников можно скачать
встроенное превью листа. Ограничения модели и открытые вопросы сохранены в HTML.

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
git add index.html
git commit -m "Update house viewer"
git push origin main
```

Можно передать другой исходный HTML: `python3 scripts/update-viewer.py /path/to/index.html`.
Скрипт добавляет директиву индексации и заменяет ссылки на локальные оригиналы
скачиванием встроенного превью. Модель и встроенные исходные данные не меняются.
