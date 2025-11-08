# links-client

Клиентская библиотека Node.js для [link-cli](https://github.com/link-foundation/link-cli) — реализация базы данных Links Theory.

## Установка

### Предварительные условия

Установите link-cli глобально:
```bash
dotnet tool install --global clink
```

### Установка пакета

```bash
npm install @unidel2035/links-client
```

Или воспользуйтесь GitHub напрямую:

```bash
npm install git+https://github.com/unidel2035/links-client.git
```

## Использование

### Основное Использование

```javascript
import { LinkDBService } from '@unidel2035/links-client';

const db = new LinkDBService('/путь/к/базеданных.ссылки');

// Создать ссылку
const ссылка = await db.СоздатьСсылку(100, 200);
console.log(ссылка); // { идентификатор: 1, источник: 100, целевая: 200 }

// Прочитать все ссылки
const ссылки = await db.ПрочитатьСсылки();

// Удалить ссылку
await db.УдалитьСсылку(1);
```

### Menu Storage

```javascript
import { MenuStorageService } from '@unidel2035/links-client';

const menuStorage = new MenuStorageService();

const menu = [
  {
    label: "Dashboard",
    icon: "pi pi-home",
    to: "/dashboard",
    items: [
      { label: "Analytics", to: "/dashboard/analytics" }
    ]
  }
];

await menuStorage.storeMenuStructure(menu, 0);
const retrievedMenu = await menuStorage.getMenuStructure(0);
```

### Authentication Storage

```javascript
import { AuthStorageService } from '@unidel2035/links-client';

const authStorage = new AuthStorageService();

// Создать пользователя
const user = await authStorage.createUser({
  username: "алиса",
  email: "alice@example.com"
});

// Набор пароля
await authStorage.setPassword(user.userId, {
  hash: "hashed_password",
  salt: "random_salt"
});
```

## API

Подробную документацию по API см. в docs/.

## Примеры

Примеры использования см. в examples/.

## Лицензия

MIT

## Ссылки

- Исходный репозиторий: https://github.com/unidel2035/dronedoc2025
- link-cli: https://github.com/link-foundation/link-cli
