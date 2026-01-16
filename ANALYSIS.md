# Analiza Elementów Gry i Plan Przebudowy (Game Analysis & Rebuild Plan)

## 1. Obecne Elementy Gry (Current Game Elements)

### Postać (Player/Character)
*   **Logika:** Klasa `Character` (Character.js).
*   **Fizyka:** Własny silnik fizyki (prędkość, przyspieszenie, tarcie). Kolizje oparte na promieniu (radius).
*   **Statystyki:** System `CharacterStats` (Głód, Pragnienie, Energia, Toaleta, Masa ciała).
*   **Ekwipunek:** Klasa `Inventory` (20 slotów + 2 ręce). Limit wagowy oparty na sile.

### Teren (Terrain)
*   **System Chunków:** Generowanie proceduralne 10x10 kafelków na chunk (WorldManager.js).
*   **Biomy:** Definiowane w `TerrainGenerator.js` (Las, Pustynia, Śnieg, itp.) na podstawie mapy biomów i mapy wysokości.
*   **Woda:** Logika wykrywania wody i głębokiej wody (szum Perlin).

### Obiekty Świata (World Objects) - `Objects.js`
1.  **Drzewa (`Tree`)**
    *   **Stany:** Stojące (Standing), Powalone (Fallen), Kłody (Logs).
    *   **Gatunki:** Definiowane w `TREE_SPECIES` (Dąb, Brzoza, Sosna, Palma).
    *   **Rendering:** Pień (rysowany kodem) + Korona (PNG lub kod).
2.  **Krzewy (`Bush`)**
    *   **Typy:** Proceduralne (Paproć, Trzcina, Kwiaty, Krzak jagodowy).
    *   **Owoce:** Generowane losowo na podstawie definicji gatunku.
3.  **Kamienie (`Stone`)**
    *   **Rozmiar:** Mały, Średni, Duży.
    *   **Kształt:** Generowany proceduralnie (wielokąt).

### Przedmioty (`Item`) - `Inventory.js`
*   Typy: Narzędzia (Siekiera), Zasoby (Drewno, Kamień, Patyk, Trzcina), Jedzenie (Jagody, Owoce).
*   Atrybuty: Waga, Ikona, Statystyki (odżywcze).

## 2. Interakcje (Interactions)

### Interakcje ze Światem (Długie przytrzymanie / Kliknięcie)
1.  **Drzewa:**
    *   **Ścinanie (Chop):** Wymaga siekiery. Zmienia stan ze Stojącego na Powalone.
    *   **Rąbanie (Hack):** Wymaga siekiery. Zmienia stan z Powalonego na Kłody.
    *   **Potrząsanie (Shake):** Brak narzędzia. (Obecnie brak efektu, placeholder).
    *   **Zbieranie (Gather):** Zbieranie drewna z kłód.
2.  **Krzewy:**
    *   **Zbieranie Owoców:** Dodaje jedzenie do ekwipunku.
    *   **Zbieranie Zasobów:** Patyki (z uschniętych krzaków), Trzcina (z trzcin).
    *   **Badanie:** Wyświetla nazwę gatunku.
3.  **Kamienie:**
    *   **Podnoszenie:** Jeśli waga pozwala, dodaje kamień do ekwipunku i usuwa ze świata.

### Interakcje z Ekwipunkiem
*   **Drag & Drop:** Przenoszenie przedmiotów między slotami i rękami.
*   **Konsumpcja:** Dwukrotne kliknięcie na jedzenie odnawia statystyki postaci.

## 3. Plan Przebudowy (Rebuild Strategy)

W celu wprowadzenia zwierząt (Animals) i uporządkowania kodu, wymagane są następujące zmiany:

1.  **Wydzielenie Klasy Bazowej `MobileEntity`:**
    *   Obecnie `Character` zawiera całą logikę fizyki ruchu.
    *   Należy przenieść `velocity`, `acceleration`, `friction`, `x`, `y`, `rotation` oraz metodę `updatePhysics` do nowej klasy `MobileEntity` (w pliku `Entities.js`).
    *   `MobileEntity` będzie dziedziczyć po `GameObject`.

2.  **Struktura Zwierząt (`Animal` class):**
    *   Nowa klasa `Animal` dziedzicząca po `MobileEntity`.
    *   **Rendering:** Obsługa Spritesheetów PNG (zgodnie z życzeniem użytkownika - Pixel Art).
    *   **AI:** Prosta maszyna stanów (Idle -> Wander -> Flee).

3.  **Refaktoryzacja `Character`:**
    *   `Character` będzie dziedziczyć po `MobileEntity`.
    *   Usunięcie zduplikowanego kodu fizyki.

4.  **Integracja:**
    *   Dodanie obsługi zwierząt do pętli renderowania `WorldManager` (sortowanie po Y).
