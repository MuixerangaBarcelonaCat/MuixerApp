---
name: ui-language-rules
description: Style rules for every text in the UI. Apply when writing any UI element, error messages, or any other text in Catalan that may be displayed to users.
---

Tots els textos visibles a l'usuari han de ser en valencià. Aplica esta guia per escriure'ls.

# Guia d'estil per a textos de UI en català
> Basada en la [Guia d'estil de Softcatalà](https://www.softcatala.org/guia-estil-de-softcatala/tota-la-guia/)

Aplica estes normes **sempre** que escrigues o modifiques text visible a la interfície d'usuari (etiquetes, botons, missatges, menús, diàlegs, textos d'ajuda, etc.).

---

## 1. To i estil general

- Estil **clar, directe i formal**. Sense col·loquialismes ni onomatopeies.
- **No "humanitzis"** l'aplicació: elimina "Sorry", "Please", "Oh bother", "Simply", etc.
  - ❌ `Si us plau, torneu-ho a provar més tard.`
  - ✅ `Torneu a provar-ho més tard.`
  - ❌ `Em sap greu, este nom ja existeix.`
  - ✅ `Este nom ja existeix.`
- Evita les frases llargues i complexes. Prefereix oracions curtes amb verb conjugat.

---

## 2. Tractament de l'usuari

- **L'app s'adreça a l'usuari com a "vós"** (2a persona del plural):
  - ❌ `Estàs segur que vols eliminar el fitxer?`
  - ❌ `Esteu segurs que voleu eliminar el fitxer?`
  - ✅ `Esteu segur que voleu eliminar el fitxer?` *(el plural no implica que siguin més d'una persona)*
- Evita el pronom "vós" explícit sempre que siga possible; usa pronoms febles o reformula:
  - ❌ `Genereu una clau per a vós mateix.`
  - ✅ `Genereu una clau pròpia.`
- **L'usuari dona ordres a l'app → imperatiu 2a singular** ("tu"):
  - ❌ `Obrir` / `Editar` / `Alçar`
  - ✅ `Obre` / `Edita` / `Alça`
- Per a **públic infantil** (jocs educatius, etc.) es pot usar el singular "tu/teu".

---

## 3. Formes verbals

### Gerundi
- Acció en curs → `S'està…` / `S'estan…`, **mai** el gerundi sol:
  - ❌ `Baixant el correu…`
  - ✅ `S'està baixant el correu…`
- Gerundi com a adjectiu → oració de relatiu:
  - ❌ `Fitxer contenint la documentació`
  - ✅ `Fitxer que conté la documentació`
- Simultaneïtat → `en` + infinitiu (**mai** `al` + infinitiu):
  - ❌ `Al tancar l'ordinador, recordeu…`
  - ✅ `En tancar l'ordinador, recordeu…`
- En títols i opcions → substantiu:
  - ❌ `Editant fitxers`
  - ✅ `Edició de fitxers`

### Infinitiu i expressions sintètiques
- No uses l'infinitiu com a ordre ni com a frase autònoma; usa verb conjugat:
  - ❌ `Continuar?`
  - ✅ `Voleu continuar?`
  - ❌ `Error en el fitxer.`
  - ✅ `Hi ha un error en el fitxer.`
  - ❌ `Carpeta ineliminable.`
  - ✅ `No es pot eliminar la carpeta.`

### Veu passiva
- Prefereix la veu activa o la passiva pronominal:
- Ordre recomanat en veu passiva pronominal: verb primer, subjecte després:
  - ❌ `El fitxer és alçat.`
  - ❌ `El fitxer s'ha alçat.`
  - ✅ `S'ha alçat el fitxer.`

### Ser / estar
- **Lloc** → `ser` (no `estar`):
  - ❌ `El fitxer està a la carpeta Y.`
  - ✅ `El fitxer és a la carpeta Y.`
- **Adjectiu** → prefereix `ser`:
  - ❌ `La base de dades està buida.`
  - ✅ `La base de dades és buida.`
- Excepcions acceptables: `està danyat`, `està desconfigurat`, `està baixat`.

### Temps verbal
- Evita el futur on el present és correcte:
  - ❌ `La primera entrada haurà de ser…`
  - ✅ `La primera entrada ha de ser…`
- `Could not / Was unable to` → `No s'ha pogut` (no condicional).
- `Should` (recomanació) → `És recomanable que` + subjuntiu:
  - ❌ `Hauríeu de tancar tots els programes.`
  - ✅ `És recomanable que tanqueu tots els programes.`

---

## 4. Estructura de la frase

- Ordre: **Subjecte + Verb + Complements regits + Complements no regits**.
- Informació general primer, detalls després:
  - ❌ `Trieu Obre al menú Fitxer.`
  - ✅ `Al menú Fitxer, trieu Obre.`
- Prefereix construccions **positives**:
  - ❌ `No us oblideu de desar el document.`
  - ✅ `Recordeu-vos de desar el document.`
- El complement en català va **darrere** del substantiu:
  - ❌ `Nou fitxer` / `Següents passos`
  - ✅ `Fitxer nou` / `Passos següents`

---

## 5. Articles i pronoms possessius

- Afegeix l'article quan siga necessari (el català en fa més ús que l'anglès):
  - ❌ `S'està baixant correu.`
  - ✅ `S'està baixant el correu.`
- Els noms de programes i SO porten article amb apostrofació normal: `l'Excel`, `el Windows`, `el Linux`, `el GIMP`.
- **Possessius**: no els uses si no hi ha ambigüitat:
  - ❌ `Esteu segur que voleu eliminar el vostre fitxer?`
  - ✅ `Esteu segur que voleu eliminar el fitxer?`

---

## 6. Negació

- `or` negatiu → `ni`:
  - ❌ `No podreu obrir o modificar el fitxer.`
  - ✅ `No podreu obrir ni modificar el fitxer.`
- Doble negació obligatòria amb `mai`, `cap`, `res`, `gens`, `ningú`:
  - ✅ `No tragueu mai el dispositiu.` / `Cap ordre no s'ha d'escriure en majúscules.`
- Article indefinit en negatiu → `cap`:
  - ❌ `No s'ha trobat un fitxer vàlid.`
  - ✅ `No s'ha trobat cap fitxer vàlid.`

---

## 7. Preposicions clau

| Situació | Preposició | Exemple                              |
|---|---|--------------------------------------|
| Moviment | `a` | `Envieu-lo a la paperera.`           |
| Lloc (topònims) | `a` | `La reunió és a València.`           |
| Lloc (altres casos) | `en` | `Alceu-lo en esta carpeta.`          |
| Agent / causa | `per` | `Traduït per Softcatalà.`            |
| Destinació / finalitat | `per a` | `Programa per a comprimir fitxers.`  |
| Simultaneïtat | `en` + inf. | `En tancar, es desa automàticament.` |

- **Mai** `al` + infinitiu; **sempre** `en` + infinitiu.
- **Evita** `per tal de` / `per tal que` → substitueix per `per a` / `perquè`.
- **Preposicions de lloc compostes**: usa la forma més curta: `darrere`, `davant`, `sobre`, `sota` (sense `al/a` davant si es pot evitar).

---

## 8. Puntuació

- **Punts suspensius**: enganxats a la paraula anterior, sense espai: `S'està carregant...` (no `S'està carregant ...`).
- **Coma**: no poses coma davant de `i` o `o` en enumeracions. Sí davant de proposicions.
- **Cometes**: usa sempre « » (baixes/llatines). Dins d'elles, si cal aniuar: « » > " " > ' '.
- **Guió llarg**: no l'utilitzes.
- **Admiració**: usa-la només per a avisos greus (pèrdua de dades). Elimina-la en errors normals.
- **Barra `/`**: sense espais entre dos elements (`Numeració/Pics`); amb espais entre seqüències de paraules (`artistes / àlbums`).

---

## 9. Majúscules i minúscules

- Majúscula **només** a:
  - Inici de text, frase, o després de `.`, `!`, `?`, `...`
  - Noms propis
  - Primer mot del nom d'un menú, finestra o diàleg (la resta en minúscula):
    - ✅ `Preferències del sistema` (no `Preferències Del Sistema`)
- **No** uses majúscula a cada paraula com en anglès (*Title Case*).
- Excepcions: sigles (`URL`, `PDF`) i noms de productes registrats.

---

## 10. Neutralitat de gènere

- Usa formes genèriques quan existisquen:

| Evita | Usa                     |
|---|-------------------------|
| Benvinguts | Vos donem la benvinguda |
| Tots/Totes | Tothom                  |
| Autor/Autora | Creat per / Obra de     |
| Nen/Nena | Infant / Xicalla        |

- Evita dobletes (`usuari/ària`). Si no existeix una forma genèrica, utilitza el femení genèric.
- Concordança amb dos gèneres → usa el **masculí** (menys marcat):
  - ✅ `Amagueu els programes i les aplicacions oberts.`

---

## 11. Terminologia i calcs

- Evita calcs de l'anglès; cerca el terme català consolidat. Consulta @recull-de-termes.md en cas de dubte.
- Plural de mots acabats en `-sc`, `-st`, `-xt`, `-ig` amb vocal epentètica:
  - `bosc` → `boscos`, `context` → `contextos`, `sondeig` → `sondejos`
- En enumeracions amb gèneres o nombres mixtos, repeteix el determinant:
  - ✅ `les pel·lícules i els fitxers de so`
- **No** uses `substantiu + a + infinitiu`:
  - ❌ `Fitxer a obrir`
  - ✅ `Fitxer que s'ha d'obrir`
- Prefixos i compostos: **sense guionet** en general (`antivirus`, `preenregistrament`). Guionet només si el segon mot català comença per `s`, `r` o `x` (`posa-ratolins`).

---

## 12. Variant dialectal

Els textos han d'estar en valencià, no en català central:

- Ortografia:
  - Vocals i variants lèxiques valencianes preferides (ex. nàixer, traure, redó, avançar).
  - Accent tancat en patrons valencians (anglés, interés, café, etc.).
  - Preferència per formes amb -tl- (espatla, motle).

- Morfologia nominal:
  - Plurals: evitar plurals en -ns (marges, termes), excepte hòmens i jóvens.
  - Possessius: meua, teua, seua.
  - Demostratius: preferència per sistema simple este/eixe/aquell.
  - Numerals: formes valencianes (huit, dèsset, díhuit) i ordinals cinqué, sisé.

- Sintaxi i morfologia verbal:
  - Pronoms febles: formes li'l, li la, vos (vos mira, no us mira)
  - Primera persona del present: jo cante, jo perd, jo òbric
  - Subjuntiu: que jo cante, que tu cantes
  - Subjuntiu en -ra (cantara).
  - Incoatius amb base en -eix-/-ix- segons persona.
  - Preferència per tindre, vindre, veure.
  - Participis regulars (establit, omplit, sigut).

- Lèxic:
  - Preferència pels adverbis hui, ací (no aquí), damunt (no a sobre), davall, enrere
  - Preferència per formes valencianes habituals: despús-demà, eixir, enguany, eina, vesprada, alçar (no guardar ni desar), etc.

---

## Referència ràpida per a missatges comuns

| Situació | ❌ Evita                             | ✅ Usa                                |
|---|-------------------------------------|--------------------------------------|
| Acció en curs | `Carregant...`                      | `S'està carregant...`                |
| Error genèric | `Error!` / `Hi ha hagut un error!`  | `S'ha produït un error.`             |
| Confirmació | `Segur que vols eliminar?`          | `Esteu segur que voleu eliminar...?` |
| Botó d'acció (menú) | `Obrir` / `Alçar`                   | `Obre` / `Alça`                      |
| Botó d'acció (diàleg app→usuari) | `Acceptar`                          | `Accepteu`                           |
| Èxit | `Fitxer alçat!`                     | `S'ha alçat el fitxer.`              |
| Advertiment | `Per favor, comproveu la connexió.` | `Comproveu la connexió.`             |
| Pregunta binària | `Continuar?`                        | `Voleu continuar?`                   |
