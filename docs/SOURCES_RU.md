# Источники реализации и происхождение

Исходный реестр ссылок унаследован из сборки 0.1 и датирован 24.09.2026. Наличие ссылки ниже не означает повторную проверку страницы в текущем продолжении. Источник предметных названий — приложенное ТЗ. Ниже первичная документация для разработчика, а не разрешение копировать фотографии или бренды.

- Исходный полный пользовательский документ: ORIGINAL_SPEC_RU.md. Использованы все 180 определений лута и названия 20 оружейных основ. Брендовые кандидаты модулей не выдаются за проверенные: действующий набор — самостоятельные виртуальные модели. Полный объём и границы указаны в IMPLEMENTATION_STATUS.md.
- PeerJS getting started: https://peerjs.com/client/getting-started
- PeerServer Cloud: https://peerjs.com/server/cloud
- Первичный код сигнализации PeerJS: https://github.com/peers/peerjs/blob/master/lib/socket.ts — параметры URL и сообщения heartbeat; https://github.com/peers/peerjs/blob/master/lib/util.ts — адрес общего PeerServer и STUN. Собственный клиент не включает библиотеку PeerJS и не заявляет проверку всех возможностей её протокола.
- WebRTC: https://developer.mozilla.org/en-US/docs/Web/API/RTCPeerConnection ; https://developer.mozilla.org/en-US/docs/Web/API/RTCDataChannel ; https://developer.mozilla.org/en-US/docs/Web/API/WebRTC_API/Connectivity
- WebGL2: https://developer.mozilla.org/en-US/docs/Web/API/WebGL2RenderingContext
- Pointer Lock: https://developer.mozilla.org/en-US/docs/Web/API/Pointer_Lock_API
- TTS: https://developer.mozilla.org/en-US/docs/Web/API/SpeechSynthesis/getVoices
- Node.js installer: https://nodejs.org/en/download ; фактически использован Node 22.16.0.
- TypeScript 5.8.3: https://github.com/microsoft/TypeScript/tree/v5.8.3 ; локальный пакет и лицензия приложены.
- Публикация: https://vercel.com/docs/deployments ; https://vercel.com/docs/project-configuration ; конфигурация подготовлена, фактический production-деплой не выполнен.

Внешние модели, фотографии, звуковые записи, шрифтовые файлы и коммерческие паттерны в игру не скачивались. Модельные размеры, совместимость деталей, цены, урон и прочие характеристики — виртуальная игровая модель. Проверка всех точных реальных оружейных вариантов/брендовых модулей из исходного каталога не выполнена.
