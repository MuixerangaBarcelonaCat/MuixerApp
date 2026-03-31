# API APPsistencia - Muixeranga de Barcelona

Documentacio dels endpoints descoberts a `https://muixerangadebarcelona.appsistencia.cat`.

> **Stack**: PHP backend, jQuery + Bootstrap Table frontend. No es un SPA, es server-rendered amb taules Bootstrap Table que carreguen dades via endpoints JSON interns.

---

## 1. Autenticacio

### Login

```
POST /
Content-Type: application/x-www-form-urlencoded
```

| Camp | Valor | Notes |
|------|-------|-------|
| `username` | `estadistiques` | Usuari |
| `password` | `xxxxxx` | Contrasenya |
| `submitted` | `1` | Camp hidden obligatori |
| `email_confirm` | *(buit)* | Honeypot antibot, cal enviar buit |
| `phone` | *(buit)* | Honeypot antibot, cal enviar buit |

**Resposta**: Redirect a `/home`. La sessio es manté amb cookie `PHPSESSID`.

**Important**: El servidor requereix un `User-Agent` real. Requests sense UA reben `403 Forbidden`.

### Exemple Python

```python
import requests

session = requests.Session()
session.headers.update({
    "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
})

BASE = "https://muixerangadebarcelona.appsistencia.cat"

session.get(f"{BASE}/")  # Obtenir PHPSESSID
resp = session.post(f"{BASE}/", data={
    "username": "estadistiques",
    "password": ".AppEst.",
    "submitted": "1",
    "email_confirm": "",
    "phone": "",
}, allow_redirects=True)

assert "tancar" in resp.text.lower(), "Login failed"
# A partir d'aqui, session manté la cookie i es pot fer qualsevol GET
```

---

## 2. Endpoints API

Tots els endpoints retornen JSON amb el format de Bootstrap Table:

```json
{
  "total": 258,
  "totalNotFiltered": 258,
  "rows": [ { ... }, { ... } ]
}
```

El camp `"0"` de cada fila conté HTML amb botons d'accio (editar, eliminar...) i es pot ignorar.

---

### 2.1 Castellers (Persones)

```
GET /api/castellers
```

Retorna **totes** les persones registrades (258). Es l'endpoint principal de persones.

> Nota: A la web la seccio es diu "Persones" pero l'endpoint API es `/api/castellers`.

#### Camps de resposta

| Camp | Tipus | Exemple | Descripcio |
|------|-------|---------|------------|
| `id` | string | `"204"` | ID unic de la persona |
| `nom` | string | `"ADRIAN"` | Nom |
| `cognom1` | string | `"ABREU"` | Primer cognom |
| `cognom2` | string | `"GONZALEZ"` | Segon cognom |
| `mote` | string | `"ADRI"` | Alies / malnom |
| `posicio` | string | `"PRIMERES + VENTS"` | Posicio a la figura |
| `te_app` | string | `"Sí"` / `"No"` | Si te l'APP instal-lada |
| `email` | string | `"email@gmail.com"` | Correu electronic |
| `data_naixement` | string | `"19/02/1992"` | Data naixement DD/MM/YYYY |
| `telefon` | string | `"611436919"` | Telefon mobil |
| `instant_camisa` | string | `"08/11/2025"` | Data entrega camisa |
| `alcada_espatlles` | string | `"163"` | Alcada espatlles en cm |
| `revisat` | string | `"Sí"` / `"No"` | Si esta revisat |
| `estat_acollida` | string | `"Finalitzat"` | Estat d'acollida |
| `llistes` | string | `"Sí"` | Habitual? |
| `tecnica` | string | `"No"` | Permisos especials APP |
| `propi` | string | `"Sí"` | Integrant de la colla? |
| `lesionat` | string | `"No"` | Lesionat llarga durada? |
| `n_assistencies` | string | `""` | Nombre assistencies (pot ser buit) |
| `observacions` | string | `""` | Observacions |
| `import_quota` | string | `"0,00 €"` | Import quota |

#### Valors de `posicio`

- `PRIMERES + VENTS` - Primeres i vents
- `LATERALS` - Laterals
- `CONTRAFORTS + 2NS LATERALS` - Contraforts i segons laterals
- `CROSSES` - Crosses
- `CANALLA` - Canalla (menors)
- `NENS COLLA` - Nens de la colla
- `ACOMPANYANTS` - Acompanyants
- `ALTRES` - Altres
- `NOVATOS` - Novatos
- `IMATGE I PARADETA` - Imatge i paradeta

#### Valors de `estat_acollida`

- `Finalitzat` - Proces d'acollida completat
- `En seguiment` - En seguiment
- `Perdut` - Persona perduda
- `No aplica` - No aplica

#### Valors de `tecnica` (Permisos)

- `No` - Sense permisos especials
- `Administrador` - Administrador
- `Tècnica/Junta` - Equip tecnic o junta

---

### 2.2 Assajos

#### Llistat d'assajos

```
GET /api/assajos
```

Retorna tots els assajos (74 registres, temporades 2025 i 2026).

| Camp | Tipus | Exemple | Descripcio |
|------|-------|---------|------------|
| `temporada` | int | `2026` | Any de temporada |
| `data` | string | `"17/09/2025"` | Data DD/MM/YYYY |
| `hora_esdeveniment` | string | `"18:45"` | Hora inici |
| `dia_setmana` | string | `"Dimecres"` | Dia de la setmana |
| `descripcio` | string (HTML) | `"<a href=...>ASSAIG GENERAL"` | Descripcio (conté HTML, cal netejar) |
| `n_si` | string | `"69"` | Nombre de "Vinc" |
| `n_potser` | string | `"0"` | Nombre de "Potser" |
| `n_no` | string | `"27"` | Nombre de "No vinc" |
| `n_canalla` | string | `"11"` | Nombre de canalla |
| `n_si_tots` | string | `"81"` | Total assistents (si + canalla) |
| `p_mentider` | string | `"3% (2/79)"` | % baixes sense avis |
| `p_planificades` | string | `"96% (66/69)"` | % planificades |
| `mostrar_qr` | string | `"No"` | Mostrar QR a l'app |

**Obtenir l'`event_id`**: Cal extreure'l del camp `"0"` (HTML), buscant el pattern `/llista/{id}`.

```python
import re
event_id = re.search(r'/llista/(\d+)', row["0"]).group(1)
```

#### Detall d'un assaig

```
GET /api/assajos/{event_id}
```

| Camp | Tipus | Exemple |
|------|-------|---------|
| `temporada` | string | `"2026"` |
| `data` | string | `"17/09/2025"` |
| `descripcio` | string | `"ASSAIG GENERAL"` |
| `hora_esdeveniment` | string | `"18:30"` |
| `hora_final` | string | `"21:00"` |
| `lloc_esdeveniment` | string | `"Local d'assaig dels Castellers de Sants"` |
| `obert` | string | `"0"` / `"1"` |
| `mostrar_qr` | string | `"0"` / `"1"` |
| `informacio` | string | HTML lliure |

---

### 2.3 Actuacions

#### Llistat d'actuacions

```
GET /api/actuacions
```

Retorna totes les actuacions (15 registres).

| Camp | Tipus | Exemple | Descripcio |
|------|-------|---------|------------|
| `temporada` | int | `2025` | Any |
| `data` | string | `"05/04/2025"` | Data DD/MM/YYYY |
| `hora_autocar` | string | `""` | Hora autocar |
| `hora_cotxe` | string | `"10:30"` | Hora cotxe |
| `hora_esdeveniment` | string | `"12:00"` | Hora de l'actuacio |
| `dia_setmana` | string | `"Dissabte"` | Dia |
| `descripcio` | string (HTML) | `"TROBADA VII ANIVERSARI..."` | Descripcio (conté HTML) |
| `resultats` | string | `""` | Resultats de l'actuacio |
| `n_si` | string | `"109"` | Nombre "Vinc" |
| `n_bus` | string | `"-"` | Places bus |
| `n_potser` | string | `"0"` | Nombre "Potser" |
| `n_no` | string | `"24"` | Nombre "No vinc" |
| `n_si_tots` | string | `"131"` | Total assistents |
| `mostrar_qr` | string | `"Sí"` | Mostrar QR |

> Diferencia clau amb assajos: **no te `n_canalla`**, pero te `n_bus`, `hora_autocar`, `hora_cotxe` i `resultats`.

#### Detall d'una actuacio

```
GET /api/actuacions/{event_id}
```

| Camp | Tipus | Exemple |
|------|-------|---------|
| `temporada` | string | `"2025"` |
| `data` | string | `"05/04/2025"` |
| `descripcio` | string | `"TROBADA VII ANIVERSARI MUIXERANGA DE BARCELONA"` |
| `hora_autocar` | string | `""` |
| `hora_cotxe` | string | `"10:30"` |
| `hora_esdeveniment` | string | `"12:00"` |
| `lloc_autocar` | string | `""` |
| `lloc_cotxe` | string | `"Bonet i Muixí"` |
| `lloc_esdeveniment` | string | `"Local"` |
| `colles` | string | `"Jove Muixeranga de València i Castellers de Mollet"` |
| `congres` | string | `"0"` |
| `resultats` | string | `""` |
| `casa` | string | `"1"` (a casa) / `"0"` (fora) |
| `obert` | string | `"0"` / `"1"` |
| `transport` | string | `"0"` / `"1"` |
| `aforament_autocar` | string | `"0"` |
| `mostrar_qr` | string | `"1"` |
| `informacio` | string | HTML lliure |
| `data_tancament` | string | `""` |
| `hora_tancament` | string | `""` |

---

### 2.4 Assistencies per Esdeveniment

```
GET /api/assistencies/{event_id}
```

Retorna la llista de persones que han respost per a un event concret. L'`event_id` es compartit entre assajos i actuacions.

| Camp | Tipus | Exemple | Descripcio |
|------|-------|---------|------------|
| `id_assistencia` | string | `"10499"` | ID unic de l'assistencia |
| `nom_casteller` | string | `"MARTA PERIS"` | Nom complet (pot contenir HTML) |
| `estat` | string | `"Vinc"` | Resposta |
| `instant` | string | `"05/03/2026 12:59:18"` | Timestamp de la resposta |
| `observacions` | string | `""` | Observacions |
| `import` | string | `"0,00€"` | Import (per events de pagament) |
| `alimentacio` | string / null | `null` | Alimentacio especial |
| `intolerancies` | string / null | `null` | Intolerancies |

#### Valors de `estat`

- `Vinc` - Confirma assistencia
- `No vinc` - No assisteix
- `Potser` - No segur

#### Exemple: Comptar qui ve a un assaig

```python
assistencies = session.get(f"{BASE}/api/assistencies/86").json()
vinc = [r for r in assistencies["rows"] if r["estat"] == "Vinc"]
no_vinc = [r for r in assistencies["rows"] if r["estat"] == "No vinc"]
print(f"Vinc: {len(vinc)}, No vinc: {len(no_vinc)}")
```

---

### 2.5 Export Excel d'Assistencia

```
GET /assistencia-export/{event_id}
```

**Retorna**: Fitxer `.xlsx` amb l'assistencia detallada (persona, resposta, data naixement, posicio, alcada).

```
Content-Type: application/vnd.openxmlformats-officedocument.spreadsheetml.sheet
Content-Disposition: attachment;filename="Assistència ASSAIG GENERAL.xlsx"
```

El XLSX conté mes dades que l'endpoint JSON `/api/assistencies/{id}`:
- ID persona
- Nom complet
- Alies
- Resposta (Vinc / No vinc / Potser / sense resposta)
- Data naixement
- Posicio
- Alcada espatlles

#### Exemple: Descarregar XLSX

```python
resp = session.get(f"{BASE}/assistencia-export/86")
with open("assaig_86.xlsx", "wb") as f:
    f.write(resp.content)
```

---

### 2.6 Dispositius

```
GET /api/dispositius
```

Llista tots els dispositius amb l'app instal-lada (177 registres).

| Camp | Tipus | Exemple |
|------|-------|---------|
| `id` | string | `"18"` |
| `nom_casteller` | string | `"LLUÏSA BLÁZQUEZ"` |
| `sistema_operatiu` | string | `"iOS"` / `"Android"` |
| `idioma` | string | `"Català"` |
| `permisos` | string | `"Tècnica/Junta"` / `"Persona"` / `"Administrador"` |
| `push_noticies` | string | `"Activat"` / `"Desactivat"` |
| `push_assajos` | string | `"Activat"` / `"Desactivat"` |
| `push_actuacions` | string | `"Activat"` / `"Desactivat"` |
| `castellers_afegits` | string | `""` |
| `data_alta` | string | `"12/02/2025 21:16:15"` |
| `ultima_connexio` | string | `"26/03/2026 19:31:27"` |
| `ip_ultima_connexio` | string | `"93.176.177.111"` |

---

### 2.7 Noticies

```
GET /api/noticies
```

Llista les noticies publicades (9 registres).

| Camp | Tipus | Exemple |
|------|-------|---------|
| `id` | string | `"15"` |
| `fixada` | string | `"No"` |
| `missatge` | string | `"RECTIFICACIÓ RECORDATORI D'ASSAIG"` |
| `contingut` | string | `"ASSAIG GENERAL al local d'assaig..."` |
| `instant` | string | `"17/09/2025 15:58:46"` |

---

### 2.8 Checks d'Acceptacio

```
GET /api/checks-acceptacio
```

Llista els checks d'acceptacio que els usuaris han d'acceptar.

---

## 3. Pagines HTML (sense API directa)

### 3.1 Ranquing d'Assistencia

```
GET /ranquing/?interval=DD/MM/YYYY|DD/MM/YYYY
```

Retorna HTML amb una taula Bootstrap Table amb el ranquing d'assistencia per persona en un periode determinat.

**Columnes**: ID, Nom, Primer cognom, Alies, Posicio, Telefon, Assajos (x/y), %, Actuacions (x/y), %, Total (x/y), %

Per extreure les dades cal fer scraping del HTML o utilitzar el boto d'exportacio CSV/Excel del Bootstrap Table (via browser automation).

### 3.2 Assistencia Futura

```
GET /assistencia-futura
```

Pagina HTML amb la llista d'assistencies futures confirmades.

---

## 4. Endpoints de Mutacio (POST)

Endpoints que modifiquen dades. **Nomes per referencia, no utilitzar en scripts de lectura.**

| Endpoint | Funcio |
|----------|--------|
| `POST /api/assistencies/actualitzarLlista` | Actualitzar assistencia d'un event |
| `POST /api/castellers/generarForm` | Generar formulari nou casteller |
| `POST /api/castellers/enviarForm` | Enviar formulari casteller |
| `POST /api/castellers/anularForm` | Anular formulari casteller |

Pattern general de mutacio (definit a `index.js`):

```javascript
function apiCall(method, name, id, data, callback) {
    $.ajax({
        url: '/api/' + name + '/' + id,
        method: method,
        data: data ? JSON.stringify(data) : null
    })
}
```

---

## 5. Relacions entre Dades

```
castellers (persones)
    |
    |-- id ← nom_casteller a /api/assistencies/{event_id}
    |-- posicio → determina rol a la pinya
    |-- alcada_espatlles → planificacio de figures
    |
assajos / actuacions
    |
    |-- event_id → /api/assistencies/{event_id}  (qui ve)
    |-- event_id → /assistencia-export/{event_id} (XLSX complet)
    |-- event_id → /api/assajos/{event_id}       (detall lloc, hora final)
    |-- event_id → /api/actuacions/{event_id}     (detall colles, transport)
```

### Flux tipic: "Quanta gent ve a l'assaig X?"

1. `GET /api/assajos` → obtenir `event_id` de l'assaig desitjat
2. `GET /api/assistencies/{event_id}` → llistar respostes
3. Filtrar per `estat == "Vinc"` → comptar

### Flux tipic: "Perfil dels assistents per planificar figures"

1. `GET /api/castellers` → construir diccionari id → {posicio, alcada_espatlles, data_naixement}
2. `GET /api/assistencies/{event_id}` → obtenir noms dels que venen
3. Creuar noms amb diccionari de castellers → obtenir posicio i alcada

---

## 6. Notes Tecniques

| Aspecte | Detall |
|---------|--------|
| **Sessio** | Cookie PHP `PHPSESSID`, cal fer GET a `/` primer |
| **WAF** | Bloqueja requests sense User-Agent real (403) |
| **Format dates** | `DD/MM/YYYY` a tot arreu |
| **Format timestamps** | `DD/MM/YYYY HH:MM:SS` |
| **HTML en respostes** | Camps com `descripcio`, `nom_casteller` i `"0"` contenen HTML. Cal netejar amb regex `re.sub(r"<[^>]+>", "", text)` |
| **Encoding** | Respostes en UTF-8, el header diu `charset=UTF-8` |
| **Rate limiting** | No detectat, pero recomanat `time.sleep(0.2)` entre requests |
| **Assets** | JS/CSS servits des de `https://master.appsistencia.cat/assets/` |
| **Paginacio** | Les taules Bootstrap Table carreguen totes les files de cop (no paginacio server-side a l'API) |

---

## 7. Script de Referencia

L'script complet d'extraccio es a `scripts/appsistencia_extractor.py`. Execucio:

```bash
cd assistencia
source ../.venv/bin/activate
python scripts/appsistencia_extractor.py
```

Output a `data/extracted/`:
- `castellers.json` — 258 persones
- `assajos.json` — 74 assajos (resum)
- `assajos_details.json` — 74 detalls d'assaig
- `actuacions.json` — 15 actuacions (resum)
- `actuacions_details.json` — 15 detalls d'actuacio
- `assistencies/event_{id}.json` — 89 fitxers d'assistencia individual
- `excel/assistencia_{id}.xlsx` — 89 excels d'assistencia
- `dispositius.json` — 177 dispositius
- `noticies.json` — 9 noticies
