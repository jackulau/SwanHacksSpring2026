# Converge Dev Console

A cross-platform terminal UI for running the Converge local stack.

It starts and supervises:

- PocketBase from `backend/pocketbase.exe` on Windows, or `backend/pocketbase` on macOS/Linux.
- The frontend with `npm run dev` from `frontend/`.

## Run

Windows:

```bat
dev-tui.cmd
```

macOS/Linux:

```sh
./dev-tui.sh
```

Any platform with npm:

```sh
npm run dev:tui
```

Open without starting the servers:

```sh
npm run dev:tui:no-start
```

## macOS PocketBase Binary

This repo currently includes `backend/pocketbase.exe` for Windows. On macOS,
download the PocketBase binary for your architecture and place it at:

```sh
backend/pocketbase
```

Then make it executable:

```sh
chmod +x backend/pocketbase
```

Alternatively launch with:

```sh
PB_BINARY=/path/to/pocketbase ./dev-tui.sh
```

## Keys

- `s`: start PocketBase and Vite
- `x`: stop both
- `r`: restart both
- `b`: restart PocketBase
- `v`: restart Vite
- `1`: combined logs
- `2`: PocketBase logs
- `3`: Vite logs
- `4`: command logs
- `c`: clear logs
- `:`: command prompt
- `?`: help
- `q`: quit and stop children

## Commands

Inside the TUI, press `:` and run commands like:

```txt
start
stop pb
restart vite
open app
open admin
status
```

PocketBase internal commands:

```txt
pb --help
migrate up
migrate collections
migrate create add_new_collection
superuser upsert admin@example.com strongpassword
```

Frontend commands:

```txt
npm run build
seed
check-rules
```

## PocketBase Admin Editing

The TUI can edit PocketBase collection rules through the PocketBase Admin API.
Set these in your shell or in `backend/.env`:

```sh
PB_SUPERUSER_EMAIL=admin@example.com
PB_SUPERUSER_PASSWORD=strongpassword
```

Then use:

```txt
collections
collection users
set-rule notes listRule @request.auth.id = user
set-rule notes createRule null
```

Use `migrate collections` after changing collection configuration if you want
to snapshot the current PocketBase schema into a migration.
