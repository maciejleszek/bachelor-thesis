# Health Monitor — mobile (Expo / React Native)

Mobilny klient dla tego samego backendu FastAPI co `frontend/` (web). Ekrany
1:1 do stron webowych: Dashboard, Sen, Sport, Analiza, Ankieta, plus
Ustawienia (adres backendu — na telefonie nie ma proxy z `package.json`, więc
trzeba go podać jawnie).

## Struktura

```
mobile/
  App.tsx                    ← providerzy: React Query, Navigation, SafeArea
  src/
    api/client.ts             ← fetch wrapper + adres API (env + AsyncStorage override)
    api/endpoints.ts          ← port frontend/src/api.js
    api/types.ts               ← typy odpowiedzi backendu
    navigation/RootNavigator.tsx
    screens/                   ← Dashboard, Sleep, Sport, Analysis, Survey, Settings
    components/                ← MetricCard, Screen/Card/EmptyState
    theme/colors.ts
```

## Uruchomienie lokalnie

1. `cd mobile && npm install` (już zrobione).
2. Uruchom backend: `docker compose up` w katalogu głównym `health-monitor/`
   (nginx wystawia całość na `http://localhost/api`).
3. Ustaw adres API w `mobile/.env` (skopiowane z `.env.example`):
   - Symulator iOS / uruchamiasz Expo na tym samym komputerze co Docker: `http://localhost/api`.
   - Fizyczny telefon w tej samej sieci Wi-Fi: `http://<IP-LAN-komputera>/api`
     (np. `ipconfig` → adres IPv4 karty Wi-Fi).
   - Emulator Androida: `http://10.0.2.2/api`.
4. `npx expo start` — zeskanuj kod QR aplikacją **Expo Go** (Android/iOS) albo
   wciśnij `a` / `i` dla emulatora/symulatora.
5. Adres API można też zmienić w aplikacji bez rebuildu — zakładka
   **Ustawienia** zapisuje go w `AsyncStorage` i nadpisuje wartość z `.env`.

Uwaga: backend nie ma autoryzacji i `nginx` domyślnie nasłuchuje tylko na
`localhost`/LAN — upewnij się, że firewall na komputerze z Dockerem
przepuszcza port 80 w sieci lokalnej, jeśli testujesz z fizycznego telefonu.

## Wdrożenie do App Store (iOS)

Do publikacji w App Store **potrzebny jest komputer Mac tylko do rzeczy
opcjonalnych** — samą kompilację i wysyłkę da się zrobić z Windows dzięki
**EAS Build** (chmura Expo kompiluje `.ipa` za ciebie). Wymagane jest za to
płatne konto **Apple Developer Program** (99 USD/rok) — bez niego nie da się
opublikować aplikacji (można za to testować lokalnie przez Expo Go bez
konta).

### 1. Konto i identyfikatory
1. Załóż/zaloguj się na [Apple Developer](https://developer.apple.com) i
   wykup członkostwo Apple Developer Program.
2. Zdecyduj o unikalnym Bundle Identifier, np. `pl.dekk.healthmonitor`
   (już ustawiony w `app.json` → `ios.bundleIdentifier` — możesz zmienić na
   swój, jeśli `pl.dekk.healthmonitor` jest zajęty).
3. Zainstaluj EAS CLI i zaloguj się do konta Expo:
   ```
   npm install -g eas-cli
   eas login
   ```

### 2. Konfiguracja builda
1. W katalogu `mobile/`:
   ```
   eas build:configure
   ```
   Tworzy `eas.json` z profilami `development` / `preview` / `production`.
2. Wpisz produkcyjny adres backendu (musi być publicznie dostępny przez
   HTTPS, nie `localhost`!) jako zmienną środowiskową builda, np. w
   `eas.json` → profil `production`:
   ```json
   "production": {
     "env": { "EXPO_PUBLIC_API_URL": "https://twoja-domena.pl/api" }
   }
   ```
   (Zanim wyślesz apkę do App Store, backend musi wisieć pod publicznym,
   HTTPS-owym adresem — Apple odrzuci/ostrzeże aplikację próbującą łączyć się
   z `http://` bez wyjątku ATS, a domowy komputer z Dockerem nie jest
   dostępny z internetu bez dodatkowej konfiguracji, np. reverse proxy +
   certyfikat, VPS, albo Cloudflare Tunnel).

### 3. Build
```
eas build --platform ios --profile production
```
- Pierwsze uruchomienie zapyta o dane do Apple ID i pozwoli EAS samo
  wygenerować certyfikaty podpisujące i profil provisioning (zalecane —
  EAS zarządza tym za ciebie, nie trzeba Xcode).
- Build trwa w chmurze Expo (kilka–kilkanaście minut), na koniec dostajesz
  link do pobrania `.ipa` oraz numer builda w EAS.

### 4. Wysyłka do App Store Connect
```
eas submit --platform ios --latest
```
- Wymaga wcześniejszego utworzenia aplikacji w
  [App Store Connect](https://appstoreconnect.apple.com) (nazwa, bundle ID,
  SKU) — EAS submit może też zapytać i założyć wpis automatycznie przy
  pierwszym uruchomieniu.
- Po wysyłce apka trafia do przetwarzania (App Store Connect → TestFlight),
  zwykle kilka-kilkanaście minut do godziny.

### 5. TestFlight (testy przed publikacją)
- W App Store Connect → zakładka **TestFlight** dodaj się jako tester
  wewnętrzny (Internal Testing) — apka pojawi się w appce TestFlight na
  telefonie bez czekania na review Apple.
- To dobry moment na przetestowanie połączenia z produkcyjnym backendem.

### 6. Publikacja (App Store review)
1. W App Store Connect uzupełnij kartę aplikacji: opis, zrzuty ekranu
   (wymagane dla kilku rozmiarów ekranu), ikonę, kategorię, politykę
   prywatności (URL — wymagane nawet dla apki bez logowania, bo zbiera dane
   zdrowotne), odpowiedzi na pytania o **App Privacy** (jakie dane zbiera:
   tu dane zdrowotne z Garmin/Mi Band).
2. Podepnij zbudowany build (z kroku 3) do wersji aplikacji.
3. Wyślij do review (**Submit for Review**). Apple review trwa zwykle
   1–3 dni; kategoria "zdrowie" bywa dokładniej sprawdzana (mogą dopytać, do
   czego służą dane zdrowotne i czy jest polityka prywatności).
4. Po akceptacji — publikacja ręczna albo automatyczna (do wyboru w
   ustawieniach wersji).

### Kolejne wydania
Każda zmiana kodu → podbij `version`/`ios.buildNumber` w `app.json` (albo
włącz `"appVersionSource": "remote"` w `eas.json`, żeby EAS zarządzał numerem
builda automatycznie) → `eas build --platform ios --profile production` →
`eas submit --platform ios --latest`.

## Android (opcjonalnie, znacznie prostsze i tańsze)

Ten sam kod działa też na Androida bez zmian:
```
eas build --platform android --profile production
eas submit --platform android --latest
```
Konto Google Play Console to jednorazowa opłata 25 USD (vs. roczna
subskrypcja Apple). Warto zacząć testy właśnie tu — proces review jest
szybszy i mniej rygorystyczny niż w App Store, dobre miejsce, żeby
sprawdzić cały pipeline EAS build/submit zanim zajmiesz się iOS.
