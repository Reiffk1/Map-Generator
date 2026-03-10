# Wayfinder Atelier

Wayfinder Atelier is a desktop-first map-planning and route-tracking app for RPG Maker-style games and other games that do not provide a useful in-game map.

It is built with:

- Tauri 2
- React 19
- TypeScript
- Vite
- Zustand
- Konva
- SQLite on desktop

The app includes:

- multiple maps per project
- room nodes, paths, icons, notes, anchors, transitions, zones, and sketch tools
- clickable linked doors and map transitions
- navigation history and breadcrumbs
- review tools, revisit tracking, and route planning
- JSON import and export
- PNG and PDF export
- a built-in custom SVG icon system

## Fastest possible build on a clean Windows PC

If you already have this project folder on your computer, this is the recommended path.

### What you do

1. Extract the project if it is still inside a `.zip` file.
2. Open the project folder.
3. Right-click [`build.bat`](./build.bat).
4. Click `Run as administrator`.
5. If Windows asks for permission, click `Yes`.
6. Wait for the script to finish.

### What the script does for you

`build.bat` will:

- check that `winget` exists
- install `Node.js LTS` if needed
- install `Rustup` if needed
- install `Microsoft Edge WebView2 Runtime` if needed
- install `Visual Studio Build Tools 2022` with the C++ workload if needed
- refresh the current terminal PATH
- run `npm install`
- build the Tauri desktop app

### Where the finished installers will be

Release build output:

```text
src-tauri\target\release\bundle
```

Debug build output:

```text
src-tauri\target\debug\bundle
```

Typical installer files:

- `.msi`
- `-setup.exe`

## Before you start

This project is meant to build on Windows 10 or Windows 11 with an internet connection.

You do not need:

- Git
- a global Tauri CLI install
- Node installed ahead of time
- Rust installed ahead of time

You do need:

- the project folder on disk
- administrator approval for installs
- `winget`, which normally comes from Microsoft `App Installer`

## If `build.bat` fails immediately

The most common reason is that `winget` is missing.

To fix that:

1. Open the Microsoft Store.
2. Search for `App Installer`.
3. Install it or update it.
4. Reboot Windows.
5. Run `build.bat` again.

You can verify `winget` manually:

1. Press the `Windows` key.
2. Type `PowerShell`.
3. Open `Windows PowerShell`.
4. Run:

```powershell
winget --version
```

If you see a version number, you are good to continue.

## Manual install instructions for a completely clean machine

Use this section if you do not want to use `build.bat`, or if you want to understand every step.

Follow the steps in this exact order.

### Step 1: Install or update `winget`

1. Open the Microsoft Store.
2. Search for `App Installer`.
3. Install or update it.
4. Reboot Windows.

Then verify it:

```powershell
winget --version
```

### Step 2: Install Node.js LTS

Open `Windows PowerShell` as Administrator and run:

```powershell
winget install --id OpenJS.NodeJS.LTS -e --source winget
```

Close PowerShell completely, open a fresh one, then verify:

```powershell
node -v
npm -v
```

If both commands print version numbers, continue.

### Step 3: Install Rust

Open `Windows PowerShell` as Administrator and run:

```powershell
winget install --id Rustlang.Rustup -e --source winget
```

Close PowerShell completely, open a fresh one, then run:

```powershell
rustup default stable-msvc
rustup target add x86_64-pc-windows-msvc
rustc -V
cargo -V
```

If `rustc` and `cargo` print version numbers, continue.

### Step 4: Install Visual Studio Build Tools 2022

This is the dependency people miss most often.

Open `Windows PowerShell` as Administrator and run:

```powershell
winget install --id Microsoft.VisualStudio.2022.BuildTools -e --source winget --override "--wait --passive --add Microsoft.VisualStudio.Workload.VCTools --includeRecommended"
```

What this installs:

- the MSVC compiler
- the Windows SDK
- the C++ tools Tauri needs on Windows

If you prefer the manual installer:

1. Download `Visual Studio Build Tools 2022`.
2. Open the installer.
3. Select the C++ build tools workload.
4. Let the installer finish fully.

### Step 5: Install Microsoft Edge WebView2 Runtime

Tauri uses WebView2 on Windows.

Run:

```powershell
winget install --id Microsoft.EdgeWebView2Runtime -e --source winget
```

### Step 6: Reboot Windows

Do this even if you think you do not need to.

It fixes a lot of PATH and compiler detection problems.

### Step 7: Open this project folder in PowerShell

1. Open File Explorer.
2. Open this project folder.
3. Click the address bar.
4. Type `powershell`.
5. Press `Enter`.

That opens PowerShell inside the correct folder.

### Step 8: Install project dependencies

Run:

```powershell
npm install
```

### Step 9: Build the desktop app

Release build:

```powershell
npm run tauri:build
```

Debug build:

```powershell
npm run tauri:build -- --debug
```

## Using `build.bat`

### Recommended

1. Right-click `build.bat`.
2. Click `Run as administrator`.
3. Approve the UAC prompt.
4. Wait for the script to finish.

### Command line usage

Release build:

```bat
build.bat
```

Debug build:

```bat
build.bat debug
```

### What happens during the build

The script runs this workflow:

1. Elevates to Administrator if needed.
2. Verifies `winget` exists.
3. Installs missing build prerequisites.
4. Refreshes the current PATH for Node and Rust.
5. Verifies `node`, `npm`, `rustup`, and `cargo`.
6. Activates the Rust MSVC toolchain.
7. Runs `npm install`.
8. Builds the Tauri desktop app.

## Running the app for development

If you want to run the app without creating installers:

Run the desktop app in development mode:

```powershell
npm run tauri:dev
```

Run only the web UI in a browser:

```powershell
npm run dev
```

## Useful commands

Install dependencies:

```powershell
npm install
```

Run lint:

```powershell
npm run lint
```

Build the web bundle:

```powershell
npm run build
```

Build desktop installers:

```powershell
npm run tauri:build
```

## Troubleshooting

### `winget` is not recognized

Install or update `App Installer` from the Microsoft Store, then reboot Windows.

### `node`, `npm`, `cargo`, or `rustup` is still not recognized

Close every terminal window.
Reboot Windows.
Open a new terminal and try again.

### Rust or linker errors mention MSVC, `link.exe`, or Windows SDK issues

Your Visual Studio Build Tools install is incomplete.

Re-run the Build Tools install step and make sure the C++ workload was included.

### The first build takes a very long time

That is normal.

The first build has to:

- download npm packages
- download Rust crates
- compile native dependencies
- compile the desktop app

### The app launches but shows a blank or broken window

Reinstall Microsoft Edge WebView2 Runtime, then try again.

### `build.bat` opens an Administrator prompt and then closes

That usually means one of these happened:

- you clicked `No` on the UAC prompt
- `winget` is missing
- an installer failed and printed an error before exit

Run `build.bat` from `cmd.exe` so you can read the output:

```bat
build.bat
```

## Project layout

```text
src/
  app/
  components/
  data/
  hooks/
  lib/
  models/
  store/

src-tauri/
  capabilities/
  src/
```

## Notes

- You do not need to install the Tauri CLI globally. It is already included in `devDependencies`.
- Desktop saves use local SQLite through Tauri.
- Browser fallback saves use IndexedDB.
- The seeded sample project demonstrates linked doors, review workflows, revisit markers, and inter-map navigation.
