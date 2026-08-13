# Health Monitor — mobile (Flutter)

Mobilny klient dla tego samego backendu FastAPI co `frontend/` (web). Ekrany
1:1 do stron webowych: Dashboard, Sen, Sport, Analiza, Ankieta, plus
Ustawienia (adres backendu — na telefonie nie ma proxy z `package.json`, więc
trzeba go podać jawnie).

## Struktura

```
mobile/
  lib/
    main.dart                  ← MaterialApp, ciemny motyw
    api/client.dart             ← http wrapper + adres API (--dart-define + SharedPreferences override)
    api/endpoints.dart          ← port frontend/src/api.js
    api/types.dart              ← modele odpowiedzi backendu
    navigation/root_navigator.dart ← BottomNavigationBar (IndexedStack)
    screens/                    ← Dashboard, Sleep, Sport, Analysis, Survey, Settings
    widgets/                    ← Screen/AppCard/EmptyState, MetricCard
    theme/colors.dart
  assets/                       ← ikony aplikacji (do podpięcia w flutter_launcher_icons)
  pubspec.yaml
```

## Wymagania

Ten katalog zawiera tylko kod Dart (`lib/`, `pubspec.yaml`) — **foldery
platformowe `android/` i `ios/` nie są w repo** (analogicznie jak wcześniej
przy Expo managed workflow) i trzeba je wygenerować lokalnie po instalacji
Flutter SDK:

1. Zainstaluj [Flutter SDK](https://docs.flutter.dev/get-started/install)
   (kanał `stable`) i sprawdź `flutter doctor`.
2. W katalogu `mobile/`:
   ```
   flutter create --platforms=android,ios --org pl.dekk --project-name health_monitor .
   ```
   To dogeneruje `android/` i `ios/` obok istniejącego `lib/`/`pubspec.yaml`
   (istniejące pliki nie zostaną nadpisane).
3. `flutter pub get`

## Uruchomienie lokalnie

1. Uruchom backend: `docker compose up` w katalogu głównym `health-monitor/`
   (nginx wystawia całość na `http://localhost/api`).
2. Domyślny adres API to `http://localhost/api` (patrz `lib/api/client.dart`
   → `defaultApiUrl`). Żeby go zmienić na stałe w buildzie:
   ```
   flutter run --dart-define=API_URL=http://192.168.1.10/api
   ```
   - Emulator Androida: `http://10.0.2.2/api`.
   - Symulator iOS na tym samym komputerze co Docker: `http://localhost/api`.
   - Fizyczny telefon w tej samej sieci Wi-Fi: `http://<IP-LAN-komputera>/api`
     (np. `ipconfig` → adres IPv4 karty Wi-Fi).
3. `flutter run` — wybierz podłączone urządzenie/emulator.
4. Adres API można też zmienić w aplikacji bez rebuildu — zakładka
   **Ustawienia** zapisuje go przez `shared_preferences` i nadpisuje wartość
   domyślną.

Uwaga: backend nie ma autoryzacji i `nginx` domyślnie nasłuchuje tylko na
`localhost`/LAN — upewnij się, że firewall na komputerze z Dockerem
przepuszcza port 80 w sieci lokalnej, jeśli testujesz z fizycznego telefonu.

## Ikony aplikacji

`assets/` zawiera PNG-i przeniesione z poprzedniej wersji Expo (`icon.png`,
`splash-icon.png`, `android-icon-*.png`). Po `flutter create` podłącz je przez
pakiet [`flutter_launcher_icons`](https://pub.dev/packages/flutter_launcher_icons)
zamiast ręcznie kopiować do `android/`/`ios/`.

## Wdrożenie do sklepów

### Android
```
flutter build appbundle --release --dart-define=API_URL=https://twoja-domena.pl/api
```
Wynikowy `.aab` wgrywasz w [Google Play Console](https://play.google.com/console)
(jednorazowa opłata 25 USD za konto dewelopera). Wymaga podpisania kluczem —
patrz [Flutter docs: sign the app](https://docs.flutter.dev/deployment/android#signing-the-app).

### iOS
```
flutter build ipa --release --dart-define=API_URL=https://twoja-domena.pl/api
```
Do publikacji w App Store potrzebny jest **komputer Mac** (Xcode) oraz płatne
konto **Apple Developer Program** (99 USD/rok) — w odróżnieniu od EAS Build
(Expo) nie ma tu darmowej chmurowej kompilacji `.ipa` z Windows. Zanim wyślesz
apkę, backend musi wisieć pod publicznym, HTTPS-owym adresem (Apple
odrzuci/ostrzeże aplikację łączącą się z `http://` bez wyjątku ATS).
Wysyłka: `flutter build ipa` → Xcode Organizer albo `xcrun altool`/
`fastlane` do App Store Connect → TestFlight → review.
